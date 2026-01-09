import { NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, parseEther, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mantleSepoliaTestnet, mantle } from 'viem/chains'

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'
const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '31337')

// Get the active chain based on chain ID
function getActiveChain() {
    switch (chainId) {
        case 5003:
            return mantleSepoliaTestnet
        case 5000:
            return mantle
        default:
            return null // Not a Mantle network
    }
}

// Helper to get sponsor client - created lazily to avoid build-time errors
function getSponsorClient() {
    const sponsorKey = process.env.SPONSOR_PRIVATE_KEY as Hex
    const chain = getActiveChain()

    if (!sponsorKey) {
        throw new Error('Missing SPONSOR_PRIVATE_KEY environment variable')
    }

    if (!chain) {
        throw new Error('Faucet only available on Mantle networks')
    }

    const sponsorAccount = privateKeyToAccount(sponsorKey)

    return createWalletClient({
        account: sponsorAccount,
        chain,
        transport: http(rpcUrl)
    })
}

function getPublicClient() {
    const chain = getActiveChain()
    if (!chain) {
        throw new Error('Faucet only available on Mantle networks')
    }

    return createPublicClient({
        chain,
        transport: http(rpcUrl)
    })
}

// Minimum balance threshold (0.01 MNT)
const MIN_BALANCE_THRESHOLD = parseEther('0.01')
// Amount to send (1 MNT)
const FAUCET_AMOUNT = parseEther('1')

export async function POST(request: Request) {
    try {
        const chain = getActiveChain()
        if (!chain) {
            return NextResponse.json(
                { error: 'Faucet only available on Mantle networks (chainId 5003 or 5000)' },
                { status: 400 }
            )
        }

        const body = await request.json()
        const { address } = body

        if (!address) {
            return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 })
        }

        const publicClient = getPublicClient()

        // Check current balance
        const currentBalance = await publicClient.getBalance({ address: address as Address })

        if (currentBalance >= MIN_BALANCE_THRESHOLD) {
            return NextResponse.json(
                { error: 'Balance is sufficient, no faucet needed', balance: currentBalance.toString() },
                { status: 400 }
            )
        }

        const sponsorClient = getSponsorClient()

        // Send 1 MNT to the user
        const hash = await sponsorClient.sendTransaction({
            to: address as Address,
            value: FAUCET_AMOUNT,
        })

        return NextResponse.json({ hash, amount: '1' }, { status: 200 })

    } catch (error: unknown) {
        console.error('Faucet API Error:', error)
        const message = error instanceof Error ? error.message : 'Internal Server Error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
