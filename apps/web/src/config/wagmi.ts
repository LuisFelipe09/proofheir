import { createConfig } from '@privy-io/wagmi'
import { http } from 'wagmi'
import { anvil } from 'wagmi/chains'

export const config = createConfig({
    chains: [anvil],
    transports: {
        [anvil.id]: http(),
    },
})


