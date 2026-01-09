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

        console.log('📋 Delegate request received:', {
            targetAddress,
            authAddress: authorization?.address,
            authChainId: authorization?.chainId,
            authNonce: authorization?.nonce,
        })

        if (!authorization || !targetAddress) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        const txParams = {
            to: targetAddress as Address,
            value: 0n,
            data: '0x' as Hex,
            authorizationList: [authorization],
        }

        // EIP-7702 has additional intrinsic gas costs that eth_estimateGas might not handle well
        // Mantle requires ~145M gas for EIP-7702 delegation transactions
        const MIN_GAS_FOR_7702 = 150_000_000n // 150M minimum for Mantle EIP-7702

        let gasLimit: bigint
        try {
            const gasEstimate = await publicClient.estimateGas({
                account: sponsorClient.account,
                ...txParams,
            })
            console.log(`✅ Gas estimated: ${gasEstimate}`)

            // Add 100% buffer for EIP-7702 overhead that might not be fully captured
            gasLimit = gasEstimate * 2n

            // Ensure minimum gas for EIP-7702
            if (gasLimit < MIN_GAS_FOR_7702) {
                gasLimit = MIN_GAS_FOR_7702
            }

            console.log(`📊 Using gas: ${gasLimit} (2x estimate + min check)`)
        } catch (estimateError) {
            // EIP-7702 estimation often fails - use fallback
            console.warn('⚠️ Gas estimation failed (common for EIP-7702):', estimateError)
            gasLimit = 200_000_000n // High fallback for Mantle + ZK verification
            console.log(`📊 Using fallback gas: ${gasLimit}`)
        }

        console.log('🔄 Sending EIP-7702 delegation transaction...')

        const hash = await sponsorClient.sendTransaction({
            ...txParams,
            gas: gasLimit,
        })

        console.log(`✅ Transaction sent: ${hash}`)

        return NextResponse.json({ hash }, { status: 200 })

    } catch (error: unknown) {
        console.error('❌ API Error:', error)
        const message = error instanceof Error ? error.message : 'Internal Server Error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

