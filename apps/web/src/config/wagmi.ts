import { createConfig } from '@privy-io/wagmi'
import { http } from 'wagmi'
import { anvil, mantleSepoliaTestnet, mantle, type Chain } from 'wagmi/chains'

// Determine chain based on environment
const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '31337')

// Get the active chain based on chain ID
function getActiveChain(): Chain {
    switch (chainId) {
        case 5003:
            return mantleSepoliaTestnet
        case 5000:
            return mantle
        case 31337:
        default:
            return anvil
    }
}

export const activeChain = getActiveChain()

// Create config based on active chain
export const config = (() => {
    if (chainId === 5003) {
        return createConfig({
            chains: [mantleSepoliaTestnet],
            transports: {
                [mantleSepoliaTestnet.id]: http(),
            },
        })
    } else if (chainId === 5000) {
        return createConfig({
            chains: [mantle],
            transports: {
                [mantle.id]: http(),
            },
        })
    } else {
        return createConfig({
            chains: [anvil],
            transports: {
                [anvil.id]: http(),
            },
        })
    }
})()
