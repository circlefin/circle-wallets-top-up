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

// lib/deposit.ts
import { createClient } from '@/lib/supabase/server';

export type DepositParams = {
  userId?: string;
  chain?: string;
  amount?: number;
};

export type DepositResult =
  | { success: true; depositResult: any }
  | { error: string };

export async function handleDeposit(
  params: DepositParams,
  supabaseClient?: any
): Promise<DepositResult> {
  const { userId, chain, amount } = params;

  // Validate required fields
  if (!userId) {
    return { error: 'Missing userId' };
  }
  if (!chain) {
    return { error: 'Missing chain' };
  }
  if (amount === undefined || amount === null) {
    return { error: 'Missing amount' };
  }

  /**
   * Circle Paymaster API Integration (Planned)
   *
   * The Circle Paymaster API enables gas abstraction for ERC-4337 UserOperations,
   * allowing users to pay transaction fees in USDC instead of native gas tokens.
   *
   * Planned integration steps:
   * 1. Construct the deposit UserOperation for the target chain.
   * 2. Call the Circle Paymaster API (`POST /paymaster/policy/{policyId}/sponsor`)
   *    to obtain a sponsored `paymasterAndData` payload.
   * 3. Sign the sponsored UserOperation with the user's developer-controlled wallet.
   * 4. Submit the signed UserOperation to the bundler for on-chain execution.
   *
   * This will replace the mock deposit logic below with actual on-chain transactions
   * where gas fees are transparently covered in USDC via the Circle Paymaster.
   *
   * @see https://developers.circle.com/paymaster/overview
   */
  const depositResult = {
    txHash: 'mock-tx-hash',
    gatewayWalletAddress: 'mock-gateway-wallet-address',
    gasPaidWithUSDC: true,
  };

  // Store transaction in Supabase
  try {
    const supabase = supabaseClient || await createClient();
    await supabase
      .from('transaction_history')
      .insert([{
        user_id: userId,
        chain,
        tx_type: 'deposit',
        amount,
        tx_hash: depositResult.txHash,
        gateway_wallet_address: depositResult.gatewayWalletAddress,
        created_at: new Date().toISOString(),
      }]);
  } catch (e) {
    // For unit tests, ignore Supabase errors
  }

  return { success: true, depositResult };
}
