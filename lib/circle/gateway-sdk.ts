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

import { randomBytes } from "crypto";
import {
  http,
  maxUint256,
  zeroAddress,
  pad,
  createPublicClient,
  erc20Abi,
  type Address,
  type Hash,
  type Chain,
} from "viem";
import * as chains from "viem/chains";
import { circleDeveloperSdk } from "@/lib/circle/sdk";
import {
  Transaction,
  Blockchain,
  TransactionType,
} from "@circle-fin/developer-controlled-wallets";

export const GATEWAY_WALLET_ADDRESS = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
export const GATEWAY_MINTER_ADDRESS = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

const arcRpcKey = process.env.ARC_TESTNET_RPC_KEY;
if (!arcRpcKey) {
  throw new Error("ARC_TESTNET_RPC_KEY environment variable is not set");
}

export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: [`https://rpc.testnet.arc.network/${arcRpcKey}`] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.arc.testnet.circle.com' },
  },
  testnet: true,
} as const satisfies Chain;

export const USDC_ADDRESSES = {
  arcTestnet: "0x3600000000000000000000000000000000000000",
  avalancheFuji: "0x5425890298aed601595a70ab815c96711a31bc65",
  baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
} as const;

export const TOKEN_IDS = {
  arcTestnet: "15dc2b5d-0994-58b0-bf8c-3a0501148ee8",
  sepolia: "d2177333-b33a-5263-b699-2a6a52722214",
} as const;

export const DOMAIN_IDS = {
  avalancheFuji: 1,
  baseSepolia: 6,
  arcTestnet: 26,
} as const;

export type SupportedChain = keyof typeof USDC_ADDRESSES;

// Mapping for Circle API "blockchain" parameter
export const CIRCLE_CHAIN_NAMES: Record<SupportedChain, Blockchain> = {
  avalancheFuji: Blockchain.AvaxFuji,
  baseSepolia: Blockchain.BaseSepolia,
  arcTestnet: Blockchain.ArcTestnet,
};

export const CHAIN_BY_DOMAIN: Record<number, SupportedChain> = {
  [DOMAIN_IDS.avalancheFuji]: "avalancheFuji",
  [DOMAIN_IDS.baseSepolia]: "baseSepolia",
  [DOMAIN_IDS.arcTestnet]: "arcTestnet",
} as const;

function getChainConfig(chain: SupportedChain): Chain {
  switch (chain) {
    case "arcTestnet":
      return arcTestnet;
    case "avalancheFuji":
      return chains.avalancheFuji;
    case "baseSepolia":
      return chains.baseSepolia;
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

const gatewayWalletAbi = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "initiateWithdrawal",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "availableBalance",
    inputs: [
      { name: "depositor", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawingBalance",
    inputs: [
      { name: "depositor", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawableBalance",
    inputs: [
      { name: "depositor", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawalBlock",
    inputs: [
      { name: "depositor", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawalDelay",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "addDelegate",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "delegate", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeDelegate",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "delegate", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const gatewayMinterAbi = [
  {
    type: "function",
    name: "gatewayMint",
    inputs: [
      { name: "attestationPayload", type: "bytes", internalType: "bytes" },
      { name: "signature", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const EIP712Domain = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
] as const;

const TransferSpec = [
  { name: "version", type: "uint32" },
  { name: "sourceDomain", type: "uint32" },
  { name: "destinationDomain", type: "uint32" },
  { name: "sourceContract", type: "bytes32" },
  { name: "destinationContract", type: "bytes32" },
  { name: "sourceToken", type: "bytes32" },
  { name: "destinationToken", type: "bytes32" },
  { name: "sourceDepositor", type: "bytes32" },
  { name: "destinationRecipient", type: "bytes32" },
  { name: "sourceSigner", type: "bytes32" },
  { name: "destinationCaller", type: "bytes32" },
  { name: "value", type: "uint256" },
  { name: "salt", type: "bytes32" },
  { name: "hookData", type: "bytes" },
] as const;

const BurnIntent = [
  { name: "maxBlockHeight", type: "uint256" },
  { name: "maxFee", type: "uint256" },
  { name: "spec", type: "TransferSpec" },
] as const;

function addressToBytes32(address: Address): `0x${string}` {
  return pad(address.toLowerCase() as Address, { size: 32 });
}

interface BurnIntentSpec {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  sourceContract: Address;
  destinationContract: Address;
  sourceToken: Address;
  destinationToken: Address;
  sourceDepositor: Address;
  destinationRecipient: Address;
  sourceSigner: Address;
  destinationCaller: Address;
  value: bigint;
  salt: `0x${string}`;
  hookData: `0x${string}`;
}

interface BurnIntentData {
  maxBlockHeight: bigint;
  maxFee: bigint;
  spec: BurnIntentSpec;
}

function burnIntentTypedData(burnIntent: BurnIntentData) {
  const domain = {
    name: "GatewayWallet",
    version: "1",
  };
  return {
    types: { EIP712Domain, TransferSpec, BurnIntent },
    domain,
    primaryType: "BurnIntent" as const,
    message: {
      ...burnIntent,
      spec: {
        ...burnIntent.spec,
        sourceContract: addressToBytes32(burnIntent.spec.sourceContract),
        destinationContract: addressToBytes32(burnIntent.spec.destinationContract),
        sourceToken: addressToBytes32(burnIntent.spec.sourceToken),
        destinationToken: addressToBytes32(burnIntent.spec.destinationToken),
        sourceDepositor: addressToBytes32(burnIntent.spec.sourceDepositor),
        destinationRecipient: addressToBytes32(burnIntent.spec.destinationRecipient),
        sourceSigner: addressToBytes32(burnIntent.spec.sourceSigner),
        destinationCaller: addressToBytes32(burnIntent.spec.destinationCaller),
      },
    },
  };
}

interface ChallengeResponse {
  id: string;
}

async function waitForTransactionConfirmation(challengeId: string): Promise<string> {
  while (true) {
    const response = await circleDeveloperSdk.getTransaction({ id: challengeId });
    const tx = response.data?.transaction;

    if (tx?.state === "CONFIRMED" || tx?.state === "COMPLETE") {
      console.log(`Transaction ${challengeId} reached terminal state '${tx.state}' with hash: ${tx.txHash}`);
      if (!tx.txHash) {
        throw new Error(`Transaction ${challengeId} is ${tx.state} but txHash is missing.`);
      }
      return tx.txHash;
    } else if (tx?.state === "FAILED") {
      console.error("Circle API Error:", tx);
      throw new Error(`Transaction ${challengeId} failed with reason: ${tx.errorReason}`);
    }

    console.log(`Transaction ${challengeId} state: ${tx?.state}. Polling again in 2s...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function initiateContractInteraction(
  walletId: string,
  contractAddress: Address,
  abiFunctionSignature: string,
  args: any[],
  blockchain?: Blockchain
): Promise<string> {
  const txParams: any = {
    walletId,
    contractAddress,
    abiFunctionSignature,
    abiParameters: args,
    fee: {
      type: "level",
      config: {
        feeLevel: "HIGH",
      },
    }
  };

  // Add blockchain parameter if provided
  if (blockchain) {
    txParams.blockchain = blockchain;
  }

  const response = await circleDeveloperSdk.createContractExecutionTransaction(txParams);

  const responseData = response.data as unknown as ChallengeResponse;

  if (!responseData?.id) {
    console.error("Circle API Error: Challenge ID not found in response", response.data);
    throw new Error("Circle API did not return a Challenge ID.");
  }

  return responseData.id;
}

export async function initiateDepositFromCustodialWallet(
  walletId: string,
  chain: SupportedChain,
  amountInAtomicUnits: bigint,
  delegateAddress?: Address
): Promise<string> {
  const usdcAddress = USDC_ADDRESSES[chain];
  const blockchain = CIRCLE_CHAIN_NAMES[chain];
  let lastTxHash: string | undefined = undefined;

  // Step 1: Add delegate if provided (allows EOA to sign burn intents)
  if (delegateAddress) {
    console.log(`Step 1: Adding delegate ${delegateAddress} for wallet ${walletId} on ${blockchain}...`);
    const addDelegateChallengeId = await initiateContractInteraction(
      walletId,
      GATEWAY_WALLET_ADDRESS as Address,
      "addDelegate(address,address)",
      [usdcAddress, delegateAddress],
      blockchain
    );

    console.log(`Step 2: Waiting for addDelegate transaction to confirm...`);
    lastTxHash = await waitForTransactionConfirmation(addDelegateChallengeId);
    console.log(`Delegate added successfully. TxHash: ${lastTxHash}`);
  }

  // Only deposit if amount > 0
  if (amountInAtomicUnits > BigInt(0)) {
    const stepOffset = delegateAddress ? 2 : 0;

    console.log(`Step ${1 + stepOffset}: Approving Gateway contract for wallet ${walletId} on ${blockchain}...`);
    const approvalChallengeId = await initiateContractInteraction(
      walletId,
      usdcAddress as Address,
      "approve(address,uint256)",
      [GATEWAY_WALLET_ADDRESS, amountInAtomicUnits.toString()],
      blockchain
    );

    console.log(`Step ${2 + stepOffset}: Waiting for approval transaction (Challenge ID: ${approvalChallengeId}) to confirm...`);
    await waitForTransactionConfirmation(approvalChallengeId);

    console.log(`Step ${3 + stepOffset}: Calling deposit function on Gateway for wallet ${walletId} on ${blockchain}...`);
    const depositChallengeId = await initiateContractInteraction(
      walletId,
      GATEWAY_WALLET_ADDRESS as Address,
      "deposit(address,uint256)",
      [usdcAddress, amountInAtomicUnits.toString()],
      blockchain
    );

    console.log(`Step ${4 + stepOffset}: Waiting for deposit transaction (Challenge ID: ${depositChallengeId}) to confirm...`);
    const depositTxHash = await waitForTransactionConfirmation(depositChallengeId);

    console.log("Custodial deposit successful. Final TxHash:", depositTxHash);
    return depositTxHash;
  }

  // If we only added delegate and didn't deposit, return that txHash
  if (lastTxHash) {
    return lastTxHash;
  }

  throw new Error("No deposit amount and no delegate provided");
}

export async function withdrawFromCustodialWallet(
  walletId: string,
  chain: SupportedChain,
  amountInAtomicUnits: bigint
): Promise<string> {
  const usdcAddress = USDC_ADDRESSES[chain];
  const blockchain = CIRCLE_CHAIN_NAMES[chain];

  console.log(`Step 1: Calling initiateWithdrawal function on Gateway for wallet ${walletId} on ${blockchain}...`);
  const initiateWithdrawalChallengeId = await initiateContractInteraction(
    walletId,
    GATEWAY_WALLET_ADDRESS as Address,
    "initiateWithdrawal(address,uint256)",
    [usdcAddress, amountInAtomicUnits.toString()],
    blockchain
  );

  console.log(`Step 2: Waiting for initiateWithdrawal transaction (Challenge ID: ${initiateWithdrawalChallengeId}) to confirm...`);
  await waitForTransactionConfirmation(initiateWithdrawalChallengeId);

  console.log(`Step 3: Calling withdraw function on Gateway for wallet ${walletId} on ${blockchain}...`);
  const withdrawChallengeId = await initiateContractInteraction(
    walletId,
    GATEWAY_WALLET_ADDRESS as Address,
    "withdraw(address)",
    [usdcAddress],
    blockchain
  );

  console.log(`Step 4: Waiting for withdraw transaction (Challenge ID: ${withdrawChallengeId}) to confirm...`);
  const withdrawTxHash = await waitForTransactionConfirmation(withdrawChallengeId);

  console.log("Custodial withdrawal successful. Final TxHash:", withdrawTxHash);
  return withdrawTxHash;
}

export async function submitBurnIntent(
  burnIntent: any,
  signature: `0x${string}`
): Promise<{
  attestation: `0x${string}`;
  attestationSignature: `0x${string}`;
  transferId: string;
  fees: any;
}> {
  const payload = [
    {
      burnIntent: {
        maxBlockHeight: burnIntent.maxBlockHeight.toString(),
        maxFee: burnIntent.maxFee.toString(),
        spec: {
          ...burnIntent.spec,
          value: burnIntent.spec.value.toString(),
        },
      },
      signature,
    },
  ];

  const response = await fetch("https://gateway-api-testnet.circle.com/v1/transfer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const result = Array.isArray(data) ? data[0] : data;
  return {
    attestation: result.attestation as `0x${string}`,
    attestationSignature: result.signature as `0x${string}`,
    transferId: result.transferId,
    fees: result.fees,
  };
}

export async function getCircleWalletAddress(walletId: string): Promise<Address> {
  const response = await circleDeveloperSdk.getWallet({ id: walletId });
  if (!response.data?.wallet?.address) {
    throw new Error(`Could not fetch address for wallet ID: ${walletId}`);
  }
  return response.data.wallet.address as Address;
}

async function signBurnIntentCircle(
  walletId: string,
  burnIntentData: BurnIntentData
): Promise<`0x${string}`> {
  const typedData = burnIntentTypedData(burnIntentData);

  const serializedData = JSON.stringify(typedData, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

  const response = await circleDeveloperSdk.signTypedData({
    walletId,
    data: serializedData,
  });

  const signature = response.data?.signature;

  if (!signature) {
    throw new Error("Failed to retrieve signature from Circle API.");
  }

  return signature as `0x${string}`;
}

// Helper to execute mint specifically on a target blockchain
// If walletId is provided, uses Circle wallet to execute mint
// If userId is provided without walletId, uses EOA wallet to execute mint
export async function executeMintCircle(
  walletIdOrUserId: string,
  destinationChain: SupportedChain,
  attestation: string,
  signature: string,
  isUserId: boolean = false
): Promise<Transaction> {
  const blockchain = CIRCLE_CHAIN_NAMES[destinationChain];
  if (!blockchain) throw new Error(`No Circle blockchain mapping for ${destinationChain}`);

  let response;
  let walletAddress: string;

  try {
    if (isUserId) {
      // Use EOA wallet to execute mint for external recipients
      const { address } = await getSignerWalletIdForUser(walletIdOrUserId, destinationChain);
      walletAddress = address;
    } else {
      // Use Circle SCA wallet to execute mint - get wallet address from Circle
      const walletResponse = await circleDeveloperSdk.getWallet({ id: walletIdOrUserId });
      walletAddress = walletResponse.data?.wallet?.address || '';
      if (!walletAddress) {
        throw new Error(`Could not find address for wallet ID: ${walletIdOrUserId}`);
      }
    }

    // Execute mint using walletAddress (not walletId) for multichain support
    response = await circleDeveloperSdk.createContractExecutionTransaction({
      walletAddress, // Use walletAddress for multichain transactions
      blockchain, // Specify destination blockchain
      contractAddress: GATEWAY_MINTER_ADDRESS,
      abiFunctionSignature: "gatewayMint(bytes,bytes)",
      abiParameters: [attestation, signature],
      fee: {
        type: "level",
        config: { feeLevel: "MEDIUM" },
      },
    } as any);
  } catch (error: any) {
    console.error("Circle API error during mint:", error?.response?.data || error.message);
    
    // Check if this is an insufficient gas error
    const errorData = error?.response?.data;
    if (errorData?.code === 155258 || errorData?.errors?.[0]?.error === 'invalid_value') {
      const walletIdUsed = isUserId ? (await getSignerWalletIdForUser(walletIdOrUserId, destinationChain)).walletId : walletIdOrUserId;
      throw new Error(`INSUFFICIENT_GAS:${walletIdUsed}:${blockchain}`);
    }
    
    throw new Error(`Failed to execute mint transaction: ${errorData?.message || error.message}`);
  }

  const challengeId = response.data?.id;
  if (!challengeId) throw new Error("Failed to initiate minting challenge");

  // Wait for transaction confirmation to get the txHash
  console.log(`Waiting for mint transaction ${challengeId} to confirm...`);
  const txHash = await waitForTransactionConfirmation(challengeId);
  
  // Fetch the final transaction object
  const tx = await circleDeveloperSdk.getTransaction({ id: challengeId });
  if (!tx?.data?.transaction) {
    throw new Error(`Failed to fetch transaction ${challengeId}`);
  }
  
  // Ensure txHash is set
  const transaction = tx.data.transaction;
  if (!transaction.txHash) {
    transaction.txHash = txHash;
  }
  
  return transaction;
}

/**
 * Get the Circle wallet ID for the EOA signer for the given source chain and user
 */
async function getSignerWalletIdForUser(
  userId: string,
  chain: SupportedChain
): Promise<{ walletId: string; address: string }> {
  const { getGatewayEOAWalletId } = await import("@/lib/circle/create-gateway-eoa-wallets");
  
  const chainMap: Record<SupportedChain, string> = {
    baseSepolia: 'BASE-SEPOLIA',
    avalancheFuji: 'AVAX-FUJI',
    arcTestnet: 'ARC-TESTNET',
  };

  const blockchain = chainMap[chain];
  return await getGatewayEOAWalletId(userId, blockchain);
}

/**
 * Check if a wallet has sufficient native token balance for gas fees
 * Returns the wallet address and balance info
 */
export async function checkWalletGasBalance(
  walletId: string,
  chain: SupportedChain
): Promise<{ hasGas: boolean; address: string; balance: string }> {
  const chainConfig = getChainConfig(chain);
  
  // Get wallet address
  const walletResponse = await circleDeveloperSdk.getWallet({ id: walletId });
  const walletAddress = walletResponse.data?.wallet?.address as Address;
  
  if (!walletAddress) {
    throw new Error(`Could not fetch address for wallet ID: ${walletId}`);
  }

  // Check native token balance
  const publicClient = createPublicClient({
    chain: chainConfig,
    transport: http(),
  });

  const balance = await publicClient.getBalance({ address: walletAddress });
  const hasGas = balance > BigInt(0);

  return {
    hasGas,
    address: walletAddress,
    balance: balance.toString(),
  };
}

async function signBurnIntentWithEOA(
  burnIntentData: BurnIntentData,
  sourceChain: SupportedChain,
  userId: string
): Promise<`0x${string}`> {
  const typedData = burnIntentTypedData(burnIntentData);

  const { walletId, address } = await getSignerWalletIdForUser(userId, sourceChain);

  console.log("Signing burn intent with EOA:", address);

  // Helper function to serialize BigInt values for JSON
  const serializeBigInt = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return obj.toString();
    if (Array.isArray(obj)) return obj.map(serializeBigInt);
    if (typeof obj === "object") {
      const result: any = {};
      for (const key in obj) {
        result[key] = serializeBigInt(obj[key]);
      }
      return result;
    }
    return obj;
  };

  // Serialize BigInt values to strings for JSON
  const serializedTypedData = serializeBigInt(typedData);

  // Use Circle SDK to sign the typed data
  const response = await circleDeveloperSdk.signTypedData({
    walletId,
    data: JSON.stringify(serializedTypedData),
  });

  if (!response.data?.signature) {
    throw new Error("Failed to sign burn intent with Circle SDK");
  }

  return response.data.signature as `0x${string}`;
}

/**
 * Transfer Gateway balance using EOA wallet signing (no Circle wallet needed)
 * @param depositorAddress - The address that deposited to Gateway (has the balance)
 */
export async function transferGatewayBalanceWithEOA(
  userId: string,
  amount: bigint,
  sourceChain: SupportedChain,
  destinationChain: SupportedChain,
  recipientAddress: Address,
  depositorAddress: Address
): Promise<{
  transferId: string;
  attestation: `0x${string}`;
  attestationSignature: `0x${string}`;
}> {
  // 1. Get EOA signer for source chain (used for signing only)
  const { address } = await getSignerWalletIdForUser(userId, sourceChain);
  const eoaSignerAddress = address as Address;

  console.log(`Transferring ${Number(amount) / 1_000_000} USDC from Gateway`);
  console.log(`  Depositor (has balance): ${depositorAddress}`);
  console.log(`  Signer (signs burn): ${eoaSignerAddress}`);

  // 2. Ensure domains are defined
  const sourceDomain = DOMAIN_IDS[sourceChain];
  const destinationDomain = DOMAIN_IDS[destinationChain];
  
  if (sourceDomain === undefined || destinationDomain === undefined) {
    throw new Error(`Invalid chain configuration: source=${sourceChain}, destination=${destinationChain}`);
  }

  // 3. Construct Burn Intent
  // maxFee is the maximum fee Gateway can charge (deducted from transfer amount)
  // It should be reasonable but less than the transfer amount
  // Gateway typically charges ~0.1% to 0.2% of the transfer
  const maxFee = amount > BigInt(10_000_000) // If > 10 USDC
    ? BigInt(2_010_000) // Allow up to 2.01 USDC fee
    : amount / BigInt(10); // Otherwise allow 10% of amount as max fee

  const burnIntentData: BurnIntentData = {
    maxBlockHeight: maxUint256,
    maxFee: maxFee,
    spec: {
      version: 1,
      sourceDomain: sourceDomain,
      destinationDomain: destinationDomain,
      sourceContract: GATEWAY_WALLET_ADDRESS as Address,
      destinationContract: GATEWAY_MINTER_ADDRESS as Address,
      sourceToken: USDC_ADDRESSES[sourceChain] as Address,
      destinationToken: USDC_ADDRESSES[destinationChain] as Address,
      sourceDepositor: depositorAddress, // The wallet that deposited (has the balance)
      destinationRecipient: recipientAddress,
      sourceSigner: eoaSignerAddress, // EOA signs the burn intent
      destinationCaller: zeroAddress,
      value: amount,
      salt: `0x${randomBytes(32).toString("hex")}` as `0x${string}`,
      hookData: "0x" as `0x${string}`,
    },
  };

  // 4. Sign Intent with EOA
  const signature = await signBurnIntentWithEOA(burnIntentData, sourceChain, userId);

  // 5. Submit to Gateway
  const typedData = burnIntentTypedData(burnIntentData);

  const { attestation, attestationSignature, transferId } = await submitBurnIntent(
    typedData.message,
    signature
  );

  console.log(`Gateway transfer submitted. ID: ${transferId}`);

  // 6. Poll for attestation if not immediately available
  let finalAttestation = attestation;
  let finalSignature = attestationSignature;

  if (!finalAttestation || !finalSignature) {
    console.log(`Polling for attestation...`);
    
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 3000)); // Wait 3s

      const pollResponse = await fetch(`https://gateway-api-testnet.circle.com/v1/transfers/${transferId}`);
      const pollJson = await pollResponse.json();
      const status = pollJson.status || pollJson.state;

      console.log(`Transfer Status: ${status} (attempt ${attempts + 1}/${maxAttempts})`);

      if (pollJson.attestation && pollJson.signature) {
        finalAttestation = pollJson.attestation;
        finalSignature = pollJson.signature;
        console.log(`Attestation received!`);
        break;
      } else if (status === "FAILED") {
        throw new Error(`Transfer failed: ${JSON.stringify(pollJson)}`);
      }
      
      attempts++;
    }
    
    if (!finalAttestation || !finalSignature) {
      throw new Error(`Attestation not received after ${maxAttempts} attempts. Transfer ID: ${transferId}`);
    }
  }

  return {
    transferId,
    attestation: finalAttestation as `0x${string}`,
    attestationSignature: finalSignature as `0x${string}`,
  };
}
export async function transferUnifiedBalanceCircle(
  walletId: string,
  amount: bigint,
  sourceChain: SupportedChain,
  destinationChain: SupportedChain,
  recipientAddress?: Address
): Promise<{
  burnTxHash: Hash;
  attestation: `0x${string}`;
  mintTxHash: Hash;
}> {

  // 1. Get Wallet Address
  const walletAddress = await getCircleWalletAddress(walletId);
  const recipient = recipientAddress || walletAddress;

  // 2. Construct Burn Intent
  // maxFee is the maximum fee Gateway can charge (deducted from transfer amount)
  const maxFee = amount > BigInt(10_000_000) // If > 10 USDC
    ? BigInt(1_010_000) // Allow up to 1.01 USDC fee
    : amount / BigInt(10); // Otherwise allow 10% of amount as max fee

  const burnIntentData: BurnIntentData = {
    maxBlockHeight: maxUint256,
    maxFee: maxFee,
    spec: {
      version: 1,
      sourceDomain: DOMAIN_IDS[sourceChain],
      destinationDomain: DOMAIN_IDS[destinationChain],
      sourceContract: GATEWAY_WALLET_ADDRESS as Address,
      destinationContract: GATEWAY_MINTER_ADDRESS as Address,
      sourceToken: USDC_ADDRESSES[sourceChain] as Address,
      destinationToken: USDC_ADDRESSES[destinationChain] as Address,
      sourceDepositor: walletAddress,
      destinationRecipient: recipient,
      sourceSigner: walletAddress,
      destinationCaller: zeroAddress,
      value: amount,
      salt: `0x${randomBytes(32).toString("hex")}` as `0x${string}`,
      hookData: "0x" as `0x${string}`,
    },
  };

  // 3. Sign Intent (Custodial)
  const signature = await signBurnIntentCircle(walletId, burnIntentData);

  // 4. Submit to Gateway
  // (We need to regenerate typedData here just to get the 'message' part for the submission payload)
  const typedData = burnIntentTypedData(burnIntentData);

  const { attestation, attestationSignature, transferId } = await submitBurnIntent(
    typedData.message,
    signature
  );

  console.log(`Transfer submitted. ID: ${transferId}. Polling for attestation...`);

  // 5. Poll for Attestation
  let finalAttestation = attestation;
  let finalSignature = attestationSignature;

  if (!finalAttestation || !finalSignature) {
    while (true) {
      await new Promise((r) => setTimeout(r, 3000)); // Wait 3s

      const pollResponse = await fetch(`https://gateway-api-testnet.circle.com/v1/transfers/${transferId}`);
      const pollJson = await pollResponse.json();
      const status = pollJson.status || pollJson.state;

      console.log(`Transfer Status: ${status}`);

      if (pollJson.attestation && pollJson.signature) {
        finalAttestation = pollJson.attestation;
        finalSignature = pollJson.signature;
        break;
      } else if (status === "FAILED") {
        throw new Error(`Transfer failed on Gateway: ${JSON.stringify(pollJson)}`);
      }
    }
  }

  // 6. Execute Mint on Destination (Custodial)
  const mintTx = await executeMintCircle(
    walletId,
    destinationChain,
    finalAttestation,
    finalSignature
  );

  return {
    burnTxHash: "0x" as Hash,
    attestation: finalAttestation,
    mintTxHash: mintTx.txHash as Hash,
  };
}

export async function fetchGatewayBalance(address: Address): Promise<{
  token: string;
  balances: Array<{ domain: number; depositor: string; balance: string }>;
}> {
  const sources = [
    { domain: DOMAIN_IDS.arcTestnet, depositor: address },
    { domain: DOMAIN_IDS.avalancheFuji, depositor: address },
    { domain: DOMAIN_IDS.baseSepolia, depositor: address },
  ];

  const requestBody = {
    token: "USDC",
    sources,
  };

  const response = await fetch("https://gateway-api-testnet.circle.com/v1/balances", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

export async function getUsdcBalance(
  address: Address,
  chain: SupportedChain
): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: getChainConfig(chain),
    transport: http(),
  });

  const balance = await publicClient.readContract({
    address: USDC_ADDRESSES[chain] as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  return balance as bigint;
}

export async function fetchGatewayInfo(): Promise<{
  version: number;
  domains: Array<{
    chain: string;
    network: string;
    domain: number;
    walletContract: { address: string; supportedTokens: string[] };
    minterContract: { address: string; supportedTokens: string[] };
    processedHeight: string;
    burnIntentExpirationHeight: string;
  }>;
}> {
  const response = await fetch("https://gateway-api-testnet.circle.com/v1/info", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gateway API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data;
}
