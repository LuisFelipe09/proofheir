'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { formatUnits, type Address } from 'viem'
import { CONTRACTS } from '../config/contracts'

// ABI for ERC20 token info
const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'symbol',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
    },
    {
        name: 'name',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
] as const

export interface TokenInfo {
    address: string
    symbol: string
    name: string
    balance: string
    rawBalance: bigint
    decimals: number
    isDemo?: boolean
}

interface UseTokenBalancesReturn {
    tokens: TokenInfo[]
    isLoading: boolean
    error: string | null
    refetch: () => void
}

// Blockscout API for Mantle Sepolia
const BLOCKSCOUT_API = 'https://explorer.sepolia.mantle.xyz/api'

interface BlockscoutToken {
    contractAddress: string
    name: string
    symbol: string
    decimals: string
    balance: string
}

export function useTokenBalances(userAddress?: string): UseTokenBalancesReturn {
    const publicClient = usePublicClient()
    const [tokens, setTokens] = useState<TokenInfo[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchTokenBalances = useCallback(async () => {
        // Always show Demo Token, even without address
        if (!publicClient) {
            // Show placeholder Demo Token
            setTokens([{
                address: CONTRACTS.MOCK_TOKEN,
                symbol: 'MOCK',
                name: 'Demo Token',
                balance: '-',
                rawBalance: 0n,
                decimals: 18,
                isDemo: true,
            }])
            return
        }

        // If no address, show Demo Token with placeholder
        if (!userAddress) {
            setTokens([{
                address: CONTRACTS.MOCK_TOKEN,
                symbol: 'MOCK',
                name: 'Demo Token',
                balance: '-',
                rawBalance: 0n,
                decimals: 18,
                isDemo: true,
            }])
            return
        }

        setIsLoading(true)
        setError(null)

        const allTokens: TokenInfo[] = []

        // 1. Always fetch Demo Token (MOCK) first
        try {
            const mockAddress = CONTRACTS.MOCK_TOKEN as Address

            const [balance, symbol, name, decimals] = await Promise.all([
                publicClient.readContract({
                    address: mockAddress,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress as Address],
                }),
                publicClient.readContract({
                    address: mockAddress,
                    abi: ERC20_ABI,
                    functionName: 'symbol',
                }).catch(() => 'MOCK'),
                publicClient.readContract({
                    address: mockAddress,
                    abi: ERC20_ABI,
                    functionName: 'name',
                }).catch(() => 'Demo Token'),
                publicClient.readContract({
                    address: mockAddress,
                    abi: ERC20_ABI,
                    functionName: 'decimals',
                }).catch(() => 18),
            ])

            allTokens.push({
                address: mockAddress,
                symbol: symbol as string,
                name: name as string,
                balance: formatUnits(balance as bigint, decimals as number),
                rawBalance: balance as bigint,
                decimals: decimals as number,
                isDemo: true,
            })
        } catch (e) {
            console.warn('Could not fetch Demo Token:', e)
            // Still add it with zero balance for visibility
            allTokens.push({
                address: CONTRACTS.MOCK_TOKEN,
                symbol: 'MOCK',
                name: 'Demo Token',
                balance: '0',
                rawBalance: 0n,
                decimals: 18,
                isDemo: true,
            })
        }

        // 2. Fetch tokens from Blockscout API
        try {
            const response = await fetch(
                `${BLOCKSCOUT_API}?module=account&action=tokenlist&address=${userAddress}`,
                { signal: AbortSignal.timeout(5000) } // 5 second timeout
            )

            if (response.ok) {
                const data = await response.json()

                if (data.status === '1' && Array.isArray(data.result)) {
                    for (const token of data.result as BlockscoutToken[]) {
                        // Skip if it's the demo token (already added)
                        if (token.contractAddress.toLowerCase() === CONTRACTS.MOCK_TOKEN.toLowerCase()) {
                            continue
                        }

                        const decimals = parseInt(token.decimals) || 18
                        const rawBalance = BigInt(token.balance || '0')

                        allTokens.push({
                            address: token.contractAddress,
                            symbol: token.symbol || 'Unknown',
                            name: token.name || 'Unknown Token',
                            balance: formatUnits(rawBalance, decimals),
                            rawBalance,
                            decimals,
                            isDemo: false,
                        })
                    }
                }
            }
        } catch (e) {
            console.warn('Could not fetch tokens from Blockscout:', e)
            // Don't set error - just continue with demo token
        }

        setTokens(allTokens)
        setIsLoading(false)
    }, [userAddress, publicClient])

    useEffect(() => {
        fetchTokenBalances()
    }, [fetchTokenBalances])

    return {
        tokens,
        isLoading,
        error,
        refetch: fetchTokenBalances,
    }
}
