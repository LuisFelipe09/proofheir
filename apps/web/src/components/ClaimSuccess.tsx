'use client'

import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { useWallets } from '@privy-io/react-auth'
import { formatUnits, parseUnits, type Address } from 'viem'

// ERC20 ABI for balance and transfer
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
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const

interface TokenBalance {
    address: string
    symbol: string
    balance: string
    rawBalance: bigint
    decimals: number
}

interface ClaimSuccessProps {
    claimedTokens: string[]
    txHash: string | null
    userAddress: string
}

export function ClaimSuccess({ claimedTokens, txHash, userAddress }: ClaimSuccessProps) {
    const publicClient = usePublicClient()
    const { wallets } = useWallets()

    const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Transfer modal state
    const [transferToken, setTransferToken] = useState<TokenBalance | null>(null)
    const [transferTo, setTransferTo] = useState('')
    const [transferAmount, setTransferAmount] = useState('')
    const [transferStatus, setTransferStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle')
    const [transferError, setTransferError] = useState('')
    const [transferTxHash, setTransferTxHash] = useState<string | null>(null)

    // Fetch balances for claimed tokens
    useEffect(() => {
        const fetchBalances = async () => {
            if (!publicClient || !userAddress || claimedTokens.length === 0) {
                setIsLoading(false)
                return
            }

            setIsLoading(true)
            const balances: TokenBalance[] = []

            for (const tokenAddress of claimedTokens) {
                try {
                    const [balance, symbol, decimals] = await Promise.all([
                        publicClient.readContract({
                            address: tokenAddress as Address,
                            abi: ERC20_ABI,
                            functionName: 'balanceOf',
                            args: [userAddress as Address],
                        }),
                        publicClient.readContract({
                            address: tokenAddress as Address,
                            abi: ERC20_ABI,
                            functionName: 'symbol',
                        }).catch(() => 'TOKEN'),
                        publicClient.readContract({
                            address: tokenAddress as Address,
                            abi: ERC20_ABI,
                            functionName: 'decimals',
                        }).catch(() => 18),
                    ])

                    balances.push({
                        address: tokenAddress,
                        symbol: symbol as string,
                        balance: formatUnits(balance as bigint, decimals as number),
                        rawBalance: balance as bigint,
                        decimals: decimals as number,
                    })
                } catch (e) {
                    console.warn('Could not fetch balance for', tokenAddress, e)
                }
            }

            setTokenBalances(balances)
            setIsLoading(false)
        }

        fetchBalances()
    }, [publicClient, userAddress, claimedTokens])

    const handleTransfer = async () => {
        if (!transferToken || !transferTo || !transferAmount) return

        const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
        if (!embeddedWallet) {
            setTransferError('Wallet not found')
            setTransferStatus('error')
            return
        }

        try {
            setTransferStatus('executing')
            setTransferError('')

            const amount = parseUnits(transferAmount, transferToken.decimals)

            // Encode the transfer call
            const data = `0xa9059cbb${transferTo.slice(2).padStart(64, '0')}${amount.toString(16).padStart(64, '0')}` as `0x${string}`

            const provider = await embeddedWallet.getEthereumProvider()

            const txParams = {
                from: embeddedWallet.address,
                to: transferToken.address,
                data,
            }

            // Estimate gas
            let gasEstimate: string
            try {
                gasEstimate = await provider.request({
                    method: 'eth_estimateGas',
                    params: [txParams]
                }) as string
            } catch (gasError: any) {
                throw new Error(`Transfer would fail: ${gasError?.message || 'Insufficient balance or invalid address'}`)
            }

            const hash = await provider.request({
                method: 'eth_sendTransaction',
                params: [{ ...txParams, gas: gasEstimate }]
            }) as string

            await publicClient?.waitForTransactionReceipt({ hash: hash as `0x${string}` })

            setTransferTxHash(hash)
            setTransferStatus('success')

            // Refresh balances
            const newBalance = await publicClient?.readContract({
                address: transferToken.address as Address,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress as Address],
            })

            if (newBalance !== undefined) {
                setTokenBalances(prev => prev.map(t =>
                    t.address === transferToken.address
                        ? { ...t, balance: formatUnits(newBalance as bigint, t.decimals), rawBalance: newBalance as bigint }
                        : t
                ))
            }

        } catch (e: any) {
            console.warn('Transfer error:', e)
            if (e?.code === 4001 || e?.message?.includes('rejected') || e?.message?.includes('denied')) {
                setTransferError('Transaction was rejected')
            } else {
                setTransferError(e.message || 'Transfer failed')
            }
            setTransferStatus('error')
        }
    }

    const openTransferModal = (token: TokenBalance) => {
        setTransferToken(token)
        setTransferTo('')
        setTransferAmount('')
        setTransferStatus('idle')
        setTransferError('')
        setTransferTxHash(null)
    }

    const closeTransferModal = () => {
        setTransferToken(null)
        setTransferStatus('idle')
    }

    const formatBalance = (balance: string) => {
        const num = parseFloat(balance)
        if (num === 0) return '0'
        if (num < 0.0001) return '<0.0001'
        if (num > 1000000) return `${(num / 1000000).toFixed(2)}M`
        if (num > 1000) return `${(num / 1000).toFixed(2)}K`
        return num.toFixed(4)
    }

    return (
        <div className="space-y-4">
            {/* Compact Success Header */}
            <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">Claim Successful!</h3>
                    <p className="text-sm text-emerald-300">
                        {tokenBalances.length > 0
                            ? `${tokenBalances.length} token${tokenBalances.length > 1 ? 's' : ''} received`
                            : 'Your inheritance is now in your wallet'
                        }
                    </p>
                </div>
                {txHash && (
                    <div className="text-right">
                        <p className="text-xs text-slate-500">Tx</p>
                        <p className="text-xs text-emerald-400 font-mono">{txHash.slice(0, 8)}...</p>
                    </div>
                )}
            </div>

            {/* Token List - Compact with inline actions */}
            <div className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-400">Your Assets</span>
                    {tokenBalances.length > 1 && (
                        <span className="text-xs text-slate-500">{tokenBalances.length} tokens</span>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                        <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Loading...
                    </div>
                ) : tokenBalances.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-slate-500">No tokens found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {tokenBalances.map((token) => (
                            <div
                                key={token.address}
                                className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                            >
                                {/* Token Info */}
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-lg flex items-center justify-center border border-indigo-500/20 shrink-0">
                                        <span className="text-sm font-bold text-indigo-400">
                                            {token.symbol.charAt(0)}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-white text-sm">{token.symbol}</p>
                                        <p className="text-xs text-slate-500 font-mono truncate">
                                            {token.address.slice(0, 6)}...{token.address.slice(-4)}
                                        </p>
                                    </div>
                                </div>

                                {/* Balance */}
                                <div className="text-right mx-4">
                                    <p className="font-bold text-white">{formatBalance(token.balance)}</p>
                                </div>

                                {/* Transfer Button - Inline */}
                                <button
                                    onClick={() => openTransferModal(token)}
                                    disabled={token.rawBalance === 0n}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                    Send
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Transfer Modal */}
            {transferToken && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="font-semibold text-white">Transfer {transferToken.symbol}</h3>
                            <button
                                onClick={closeTransferModal}
                                className="text-slate-400 hover:text-white p-1"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4">
                            {transferStatus === 'success' ? (
                                <div className="text-center py-4">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h4 className="text-lg font-semibold text-white mb-2">Transfer Complete!</h4>
                                    {transferTxHash && (
                                        <p className="text-xs text-slate-400 font-mono">
                                            Tx: {transferTxHash.slice(0, 16)}...
                                        </p>
                                    )}
                                    <button
                                        onClick={closeTransferModal}
                                        className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Balance */}
                                    <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
                                        <p className="text-xs text-slate-400">Available Balance</p>
                                        <p className="text-lg font-bold text-white">
                                            {formatBalance(transferToken.balance)} {transferToken.symbol}
                                        </p>
                                    </div>

                                    {/* Recipient Address */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Recipient Address
                                        </label>
                                        <input
                                            type="text"
                                            value={transferTo}
                                            onChange={(e) => setTransferTo(e.target.value)}
                                            placeholder="0x..."
                                            className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Amount */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Amount
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={transferAmount}
                                                onChange={(e) => setTransferAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full p-3 pr-20 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            />
                                            <button
                                                onClick={() => setTransferAmount(transferToken.balance)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-lg hover:bg-indigo-500/30"
                                            >
                                                MAX
                                            </button>
                                        </div>
                                    </div>

                                    {/* Error */}
                                    {transferError && (
                                        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                                            <p className="text-sm text-rose-400">{transferError}</p>
                                        </div>
                                    )}

                                    {/* Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={closeTransferModal}
                                            className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-400 border border-white/10 hover:bg-slate-700/50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleTransfer}
                                            disabled={transferStatus === 'executing' || !transferTo || !transferAmount}
                                            className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                        >
                                            {transferStatus === 'executing' ? (
                                                <>
                                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                                    </svg>
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                    </svg>
                                                    Send
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
