# Arc Multichain Wallet

A sample application demonstrating how to build optimal USDC interoperability UX for wallets using Arc and Circle Gateway. This app showcases unified balance management, deposits, and cross-chain transfers across multiple EVM chains using Next.js and Supabase.

<img width="830" height="658" alt="Interface for depositing to and transferring from a Gateway balance" src="public/screenshot.png" />

## Prerequisites

- Node.js 20.x or newer
- npm (automatically installed when Node.js is installed)
- Docker (for running Supabase locally)
- Circle Developer Controlled Wallets [API key](https://console.circle.com/signin) and [Entity Secret](https://developers.circle.com/wallets/dev-controlled/register-entity-secret)

## Getting Started

1. Clone the repository and install dependencies:

   ```bash
   git clone git@github.com:circlefin/arc-multichain-wallet.git
   cd arc-multichain-wallet
   npm install
   ```
   
2. Create a `.env.local` file in the project root:

   ```bash
   cp .env.example .env.local
   ```

   Required variables:

   ```bash
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_or_anon_key

   # Circle
   CIRCLE_API_KEY=your_circle_api_key
   CIRCLE_ENTITY_SECRET=your_entity_secret
   ```

3. Set up Supabase (Local)
   
   This project uses **local Supabase** via Docker for development:

   ```bash
   # Start local Supabase (requires Docker)
   npx supabase start

   # Push database migrations
   npx supabase db push
   ```
   **Note:** If you prefer cloud-hosted Supabase, you can use:
   
   ```bash
   npx supabase link
   npx supabase db push
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`.

## How It Works

- Built with [Next.js](https://nextjs.org/) and [Supabase](https://supabase.com/)
- Uses [Circle Gateway](https://developers.circle.com/gateway) for unified USDC balance and cross-chain transfers
- Integrates [Circle Developer Controlled Wallets](https://developers.circle.com/wallets/dev-controlled) for server-side wallet operations
- Demonstrates wallet connectivity with [Wagmi](https://wagmi.sh/) and [Viem](https://viem.sh/)

### Unified Balance

When you deposit USDC to the Gateway Wallet, it becomes part of your unified balance accessible from any supported chain. The Gateway Wallet uses the same address on all chains: `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`

### Deposit Flow

1. Approve Gateway Wallet to spend your USDC
2. Call `deposit()` to transfer USDC to Gateway
3. Balance becomes available across all chains after finalization

### Cross-Chain Transfer Flow

1. Create and sign burn intent (EIP-712)
2. Submit to Gateway API for attestation
3. Call `gatewayMint()` on destination chain
4. USDC minted on destination

## Environment Variables

| Variable                              | Scope       | Purpose                                                                  |
| ------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`            | Public      | Supabase project URL                                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public     | Supabase anonymous/public key                                            |
| `CIRCLE_API_KEY`                      | Server-side | Circle API key for Gateway operations                                    |
| `CIRCLE_ENTITY_SECRET`                | Server-side | Circle entity secret for wallet operations                               |

## Usage Notes

- Designed for testnet only
- Requires valid Circle API credentials and Supabase configuration
- Private keys are processed server-side and never stored
- Never use mainnet private keys with this application

## Scripts

- `npm run dev`: Start Next.js development server with auto-reload
- `npx supabase start`: Start local Supabase instance

## Security & Usage Model

This sample application:
- Assumes testnet usage only
- Handles secrets via environment variables
- Processes private keys server-side without storage
- Is not intended for production use without modification

See `SECURITY.md` for vulnerability reporting guidelines. Please report issues privately via Circle's bug bounty program.

## Getting Testnet USDC

To test the application, you'll need testnet USDC on the supported chains. Use the Circle Faucet to get free testnet tokens:

### Using the Circle Faucet

1. **Get Your Wallet Address**: After signing up, your Circle Wallet addresses will be displayed in the dashboard
2. **Visit the Faucet**: Go to [https://faucet.circle.com/](https://faucet.circle.com/)
3. **Request Tokens**: 
   - Enter your wallet address
   - Select the desired testnet (Arc Testnet, Base Sepolia, or Avalanche Fuji)
   - Request USDC
4. **Wait for Confirmation**: Transactions typically confirm within a few minutes
5. **Deposit to Gateway**: Once received, use the "Deposit" tab to add USDC to your Gateway balance

### Supported Testnets

- **Arc Testnet**: Primary chain for deposits and Gateway operations
- **Base Sepolia**: Ethereum Layer 2 testnet
- **Avalanche Fuji**: Avalanche testnet

### Note on Gas Fees

When transferring USDC cross-chain, you'll need native tokens on the destination chain to pay for gas fees:
- **Arc Testnet**: USDC (no additional gas token needed)
- **Base Sepolia**: ETH (get from [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia))
- **Avalanche Fuji**: AVAX (get from [Avalanche Faucet](https://core.app/tools/testnet-faucet/))

## Resources

- [Circle Gateway Documentation](https://developers.circle.com/gateway)
- [Unified Balance Guide](https://developers.circle.com/gateway/howtos/create-unified-usdc-balance)
- [Circle Faucet](https://faucet.circle.com/)
