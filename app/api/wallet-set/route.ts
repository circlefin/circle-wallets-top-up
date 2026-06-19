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
import { circleDeveloperSdk } from "@/lib/circle/sdk";
import { createClient } from "@/lib/supabase/server";

export async function PUT(req: NextRequest) {
  try {
    const { entityName } = await req.json();

    if (typeof entityName !== "string" || !entityName.trim()) {
      return NextResponse.json(
        { error: "entityName is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const response = await circleDeveloperSdk.createWalletSet({
      name: entityName,
    });

    if (!response.data) {
      return NextResponse.json(
        "The response did not include a valid wallet set",
        { status: 500 }
      );
    }

    return NextResponse.json({ ...response.data.walletSet }, { status: 201 });
  } catch (error: any) {
    console.error(`Wallet set creation failed: ${error.message}`);
    return NextResponse.json(
      { error: "Failed to create wallet set" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if wallet set already exists for this user
    const { data: existingWallets } = await supabase
      .from("wallets")
      .select("wallet_set_id")
      .eq("user_id", user.id)
      .limit(1);

    if (existingWallets && existingWallets.length > 0) {
      return NextResponse.json({
        success: true,
        message: "Wallet set already exists for this user",
      });
    }

    // Create wallet set
    const walletSetResponse = await circleDeveloperSdk.createWalletSet({
      name: `User ${user.id.substring(0, 8)} - Wallet Set`,
    });

    if (!walletSetResponse.data?.walletSet) {
      throw new Error("Failed to create wallet set");
    }

    const walletSetId = walletSetResponse.data.walletSet.id;

    // Create multichain SCA wallet on ALL supported chains
    // This ensures Circle SDK recognizes the wallet on each chain for transactions
    const walletsResponse = await circleDeveloperSdk.createWallets({
      accountType: "SCA",
      blockchains: ["ARC-TESTNET", "BASE-SEPOLIA", "AVAX-FUJI"], // Create on all chains
      count: 1,
      walletSetId,
    });

    if (!walletsResponse.data?.wallets || walletsResponse.data.wallets.length === 0) {
      throw new Error("Failed to create wallet");
    }

    // Store ONE multichain wallet in database
    const wallet = walletsResponse.data.wallets[0];
    const walletRecords = [{
      user_id: user.id,
      circle_wallet_id: wallet.id,
      wallet_set_id: walletSetId,
      wallet_address: wallet.address,
      address: wallet.address,
      blockchain: "MULTICHAIN", // Indicates it works across all chains
      type: "sca",
      name: "Multichain Wallet",
    }];

    const { error: insertError } = await supabase
      .from("wallets")
      .insert(walletRecords);

    if (insertError) {
      console.error("Error storing wallets in database:", insertError);
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      walletSetId,
      wallets: walletRecords,
    });
  } catch (error: any) {
    console.error("Wallet set creation failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create wallet set" },
      { status: 500 }
    );
  }
}
