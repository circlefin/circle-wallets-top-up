/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from "next/server";
import {
  transferGatewayBalanceWithEOA,
  executeMintCircle,
  withdrawFromCustodialWallet,
  getCircleWalletAddress,
  type SupportedChain,
  CIRCLE_CHAIN_NAMES,
} from "@/lib/circle/gateway-sdk";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "viem";
import { Transaction, Blockchain } from "@circle-fin/developer-controlled-wallets";
import { circleDeveloperSdk } from "@/lib/circle/sdk";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sourceChain, destinationChain, amount, recipientAddress } =
    await req.json();

  try {
    if (!sourceChain || !destinationChain || !amount) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: sourceChain, destinationChain, amount",
        },
        { status: 400 }
      );
    }

    // Validate chains
    const validChains: SupportedChain[] = [
      "baseSepolia",
      "avalancheFuji",
      "arcTestnet"
    ];
    if (
      !validChains.includes(sourceChain) ||
      !validChains.includes(destinationChain)
    ) {
      return NextResponse.json(
        { error: `Invalid chain. Must be one of: ${validChains.join(", ")}` },
        { status: 400 }
      );
    }

    // Same-chain transfers are allowed (withdrawal from Gateway to wallet)
    // Cross-chain transfers will go through Gateway's burn/mint process

    const parsedAmount = parseFloat(amount);

    if (!isFinite(parsedAmount)) {
      return NextResponse.json(
        { error: "Amount must be a valid number" },
        { status: 400 }
      );
    }

    if (parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Parse integer and decimal parts separately to avoid float precision issues
    const [intPart, decPart = ""] = parsedAmount.toFixed(6).split(".");
    const amountInAtomicUnits = BigInt(intPart) * 1_000_000n + BigInt(decPart);

    // Get the user's multichain SCA wallet
    const { data: wallets, error: walletError } = await supabase
      .from("wallets")
      .select("circle_wallet_id, address")
      .eq("user_id", user.id)
      .eq("type", "sca")
      .limit(1);

    if (walletError) {
      console.error("Database error fetching wallets:", walletError);
      return NextResponse.json(
        { error: "Database error when fetching wallets." },
        { status: 500 }
      );
    }

    if (!wallets || wallets.length === 0 || !wallets[0]?.circle_wallet_id) {
      console.log(`No SCA wallet found for user ${user.id}`);
      return NextResponse.json(
        { error: "No Circle wallet found. Please ensure wallet is created during signup." },
        { status: 404 }
      );
    }

    const wallet = wallets[0];
    const walletId = wallet.circle_wallet_id;
    const walletAddress = wallet.address as Address;
    const recipient = recipientAddress || walletAddress;

    // Determine if we're using external recipient
    const isExternalRecipient = recipientAddress && recipientAddress.toLowerCase() !== walletAddress.toLowerCase();
    
    // PRE-FLIGHT CHECK: Verify gas balance on destination chain BEFORE burning
    const { getGatewayEOAWalletId } = await import("@/lib/circle/create-gateway-eoa-wallets");
    const { checkWalletGasBalance } = await import("@/lib/circle/gateway-sdk");
    
    try {
      let minterWalletId: string;
      
      if (isExternalRecipient) {
        // For external recipients, EOA wallet will execute mint
        const chainMap: Record<SupportedChain, string> = {
          baseSepolia: 'BASE-SEPOLIA',
          avalancheFuji: 'AVAX-FUJI',
          arcTestnet: 'ARC-TESTNET',
        };
        const { walletId: eoaWalletId } = await getGatewayEOAWalletId(user.id, chainMap[destinationChain as SupportedChain]);
        minterWalletId = eoaWalletId;
      } else {
        // For own wallet, SCA wallet will execute mint
        minterWalletId = walletId;
      }
      
      // Check if the minter wallet has gas
      const gasCheck = await checkWalletGasBalance(minterWalletId, destinationChain as SupportedChain);
      
      if (!gasCheck.hasGas) {
        return NextResponse.json(
          {
            error: "INSUFFICIENT_GAS",
            walletId: minterWalletId,
            walletAddress: gasCheck.address,
            blockchain: CIRCLE_CHAIN_NAMES[destinationChain as SupportedChain],
            chain: destinationChain,
            message: `Insufficient gas: The wallet that will execute the mint transaction has no native tokens on ${destinationChain}.`,
          },
          { status: 400 }
        );
      }
      
      console.log(`Gas check passed for ${gasCheck.address} on ${destinationChain} (balance: ${gasCheck.balance})`);
    } catch (gasCheckError: any) {
      console.error("Gas pre-flight check failed:", gasCheckError);
      // Continue anyway - the actual mint will catch this if it's a real issue
    }

    // Use EOA-signed burn/mint process for all transfers (same-chain and cross-chain)
    const { attestation, attestationSignature } = await transferGatewayBalanceWithEOA(
      user.id,
      amountInAtomicUnits,
      sourceChain as SupportedChain,
      destinationChain as SupportedChain,
      recipient as Address,
      walletAddress
    );

    // Execute mint on destination chain
    // If recipient is external (not the user's wallet), use EOA to execute mint
    // Otherwise use the user's Circle SCA wallet
    const mintTx: Transaction = await executeMintCircle(
      isExternalRecipient ? user.id : walletId,
      destinationChain as SupportedChain,
      attestation,
      attestationSignature,
      isExternalRecipient // Pass true if using userId instead of walletId
    );

    const attestationHash = attestation;
    const mintTxHash = mintTx.txHash;

    // Store transaction in database
    await supabase.from("transaction_history").insert([
      {
        user_id: user.id,
        chain: sourceChain,
        tx_type: "transfer",
        amount: parseFloat(amount),
        tx_hash: mintTxHash,
        gateway_wallet_address: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
        destination_chain: destinationChain,
        status: "success",
        created_at: new Date().toISOString(),
      },
    ]);

    return NextResponse.json({
      success: true,
      attestation: attestationHash,
      mintTxHash,
      sourceChain,
      destinationChain,
      amount: parseFloat(amount),
      recipient,
    });
  } catch (error: any) {
    console.error("Error in transfer:", error);

    // Check if this is an insufficient gas error
    if (error.message?.startsWith("INSUFFICIENT_GAS:")) {
      const [, walletId, blockchain] = error.message.split(":");
      
      // Get the wallet address
      try {
        const walletResponse = await circleDeveloperSdk.getWallet({ id: walletId });
        const eoaAddress = walletResponse.data?.wallet?.address;
        
        return NextResponse.json(
          {
            error: "INSUFFICIENT_GAS",
            walletId,
            walletAddress: eoaAddress,
            blockchain,
            chain: destinationChain,
          },
          { status: 400 }
        );
      } catch (walletError) {
        console.error("Error fetching wallet details:", walletError);
      }
    }

    // Log failed transaction to database
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("transaction_history").insert([
          {
            user_id: user.id,
            chain: sourceChain,
            tx_type: "transfer",
            amount: parseFloat(amount || 0),
            destination_chain: destinationChain,
            status: "failed",
            reason: error.message || "Unknown error",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (dbError) {
      console.error("Error logging failed transaction:", dbError);
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}