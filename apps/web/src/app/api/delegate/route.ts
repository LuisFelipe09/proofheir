import { NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, type Address, type Hex } from 'viem'
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

function getPublicClient() {
    return createPublicClient({
        chain: mantleSepoliaTestnet,
        transport: http(rpcUrl)
    })
}

export async function POST(request: Request) {
    try {
        const sponsorClient = getSponsorClient()
        const publicClient = getPublicClient()

        const body = await request.json()
        const { authorization, targetAddress } = body

        if (!authorization || !targetAddress) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        const txParams = {
            to: targetAddress as Address,
            value: 0n,
            data: '0x' as Hex,
            authorizationList: [authorization],
        }

        // Try to estimate gas, with fallback to high limit
        let gasLimit: bigint
        try {
            const gasEstimate = await publicClient.estimateGas({
                account: sponsorClient.account,
                ...txParams,
            })
            // Add 50% buffer for safety
            gasLimit = gasEstimate * 150n / 100n
            console.log(`Gas estimated: ${gasEstimate}, using: ${gasLimit} (+50% buffer)`)
        } catch (estimateError) {
            // Fallback to high limit if estimation fails
            console.warn('Gas estimation failed, using fallback:', estimateError)
            gasLimit = 200_000_000n
        }

        const hash = await sponsorClient.sendTransaction({
            ...txParams,
            gas: gasLimit,
        })

        return NextResponse.json({ hash }, { status: 200 })

    } catch (error: unknown) {
        console.error('API Error:', error)
        const message = error instanceof Error ? error.message : 'Internal Server Error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
