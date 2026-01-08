// Contract addresses for ProofHeir protocol
// Configured via environment variables for multi-chain support

// Chain configuration
export const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '31337')

// Default addresses for local Anvil development
const ANVIL_CONTRACTS = {
    PROOF_HEIR: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    MOCK_TOKEN: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
}

// Mantle Sepolia Testnet addresses (update after deployment)
const MANTLE_SEPOLIA_CONTRACTS = {
    PROOF_HEIR: process.env.NEXT_PUBLIC_PROOF_HEIR_ADDRESS || '',
    MOCK_TOKEN: process.env.NEXT_PUBLIC_MOCK_TOKEN_ADDRESS || ''
}

// Select contracts based on chain
export const CONTRACTS = {
    PROOF_HEIR: (process.env.NEXT_PUBLIC_PROOF_HEIR_ADDRESS || ANVIL_CONTRACTS.PROOF_HEIR) as `0x${string}`,
    MOCK_TOKEN: (process.env.NEXT_PUBLIC_MOCK_TOKEN_ADDRESS || ANVIL_CONTRACTS.MOCK_TOKEN) as `0x${string}`
} as const

// Helper to check if we're on Mantle
export const IS_MANTLE = CHAIN_ID === 5003 || CHAIN_ID === 5000
export const IS_ANVIL = CHAIN_ID === 31337
