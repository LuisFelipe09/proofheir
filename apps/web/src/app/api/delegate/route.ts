import { NextResponse } from 'next/server'
import { createWalletClient, http, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mantleSepoliaTestnet } from 'viem/chains'

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'

// Helper to get sponsor client - created lazily to avoid build-time errors
function getSponsorClient() {
    const sponsorKey = process.env.SPONSOR_PRIVATE_KEY as Hex

    if (!sponsorKey) {
        throw new Error('Missing SPONSOR_PRIVATE_KEY environment variable')
    }

    const sponsorAccount = privateKeyToAccount(sponsorKey)

    return createWalletClient({
        account: sponsorAccount,
        chain: mantleSepoliaTestnet,
        transport: http(rpcUrl)
    })
}

export async function POST(request: Request) {
    try {
        const sponsorClient = getSponsorClient()

        const body = await request.json()
        const { authorization, targetAddress } = body

        if (!authorization || !targetAddress) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }


        const hash = await sponsorClient.sendTransaction({
            to: targetAddress as Address, // Send to the user's address (EIP-7702 target)
            value: 0n,
            data: '0x', // Empty data
            authorizationList: [authorization], // The EIP-7702 authorization
            kzg: undefined // Not needed for this simple case
        })

        return NextResponse.json({ hash }, { status: 200 })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}

