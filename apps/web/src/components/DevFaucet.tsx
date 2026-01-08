'use client'

import { useState, useEffect, useRef } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useAccount, usePublicClient } from 'wagmi'
import { parseEther, formatEther, encodeFunctionData } from 'viem'
import { CONTRACTS } from '../config/contracts'

// ABI for MockERC20 mint function
const MOCK_ERC20_ABI = [
    {
        name: 'mint',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
] as const

export function DevFaucet() {
    const { authenticated, user } = usePrivy()
    const { wallets } = useWallets()
    const { address: connectedAddress } = useAccount()
    const publicClient = usePublicClient()

    // Get address from connected account
    const address = connectedAddress

    const [isOpen, setIsOpen] = useState(false)
    const [isRequestingEth, setIsRequestingEth] = useState(false)
    const [isRequestingTokens, setIsRequestingTokens] = useState(false)
    const [ethBalance, setEthBalance] = useState<string>('0')
    const [tokenBalance, setTokenBalance] = useState<string>('0')
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const popupRef = useRef<HTMLDivElement>(null)

    // Close popup when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Fetch balances
    const fetchBalances = async () => {
        if (!address || !publicClient) return

        try {
            // Get ETH balance
            const ethBal = await publicClient.getBalance({ address })
            setEthBalance(formatEther(ethBal))

            // Get token balance
            try {
                const tokenBal = await publicClient.readContract({
                    address: CONTRACTS.MOCK_TOKEN as `0x${string}`,
                    abi: MOCK_ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [address],
                })
                setTokenBalance(formatEther(tokenBal))
            } catch {
                setTokenBalance('0')
            }
        } catch (error) {
            console.error('Error fetching balances:', error)
        }
    }

    // Fetch balances when popup opens
    useEffect(() => {
        if (isOpen && address) {
            fetchBalances()
        }
    }, [isOpen, address])

    // Request ETH from Anvil faucet
    const requestEth = async () => {
        if (!address) return

        setIsRequestingEth(true)
        setMessage(null)

        console.log('Requesting ETH for address:', address)

        try {
            const response = await fetch('http://localhost:8545', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'anvil_setBalance',
                    params: [address, '0x56BC75E2D63100000'], // 100 ETH in hex
                    id: 1,
                }),
            })

            const result = await response.json()
            console.log('Anvil response:', result)

            if (result.error) {
                throw new Error(result.error.message)
            }

            setMessage({ type: 'success', text: '+100 ETH ✓' })
            await fetchBalances()
        } catch (error) {
            console.error('Error requesting ETH:', error)
            setMessage({ type: 'error', text: 'Failed - Is Anvil running?' })
        } finally {
            setIsRequestingEth(false)
        }
    }

    // Request Mock Tokens via Privy
    const requestTokens = async () => {
        const embeddedWallet = wallets.find(w => w.walletClientType === 'privy') || wallets.find(w => w.address === address)

        if (!address || !embeddedWallet) {
            setMessage({ type: 'error', text: 'Wallet not connected' })
            return
        }

        setIsRequestingTokens(true)
        setMessage(null)

        try {
            const mintAmount = parseEther('1000')

            const data = encodeFunctionData({
                abi: MOCK_ERC20_ABI,
                functionName: 'mint',
                args: [address, mintAmount],
            })

            const provider = await embeddedWallet.getEthereumProvider()

            const hash = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: embeddedWallet.address,
                    to: CONTRACTS.MOCK_TOKEN,
                    data
                }]
            }) as string

            await publicClient?.waitForTransactionReceipt({ hash: hash as `0x${string}` })

            setMessage({ type: 'success', text: '+1,000 MOCK ✓' })
            await fetchBalances()
        } catch (error) {
            console.error('Error minting tokens:', error)
            setMessage({ type: 'error', text: 'Failed to mint' })
        } finally {
            setIsRequestingTokens(false)
        }
    }

    if (!authenticated || !address) {
        return null
    }

    return (
        <div className="relative" ref={popupRef}>
            {/* Faucet Icon Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-10 h-10 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl flex items-center justify-center transition-all group"
                title="Developer Faucet"
            >
                <svg className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            </button>

            {/* Popup */}
            {isOpen && (
                <div className="absolute right-0 top-12 w-72 bg-slate-800 border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                                Testnet Faucet
                            </h3>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">DEV</span>
                        </div>
                        {/* Show target address */}
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">
                            {address?.slice(0, 10)}...{address?.slice(-8)}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        {/* Balances */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-slate-700/50 rounded-lg p-2.5">
                                <p className="text-[10px] text-slate-400 mb-0.5">ETH</p>
                                <p className="text-sm font-bold text-white">{parseFloat(ethBalance).toFixed(3)}</p>
                            </div>
                            <div className="bg-slate-700/50 rounded-lg p-2.5">
                                <p className="text-[10px] text-slate-400 mb-0.5">MOCK</p>
                                <p className="text-sm font-bold text-white">{parseFloat(tokenBalance).toFixed(0)}</p>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="space-y-2">
                            <button
                                onClick={requestEth}
                                disabled={isRequestingEth}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-all"
                            >
                                {isRequestingEth ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                                Get 100 ETH
                            </button>

                            <button
                                onClick={requestTokens}
                                disabled={isRequestingTokens}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-all"
                            >
                                {isRequestingTokens ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                )}
                                Mint 1,000 MOCK
                            </button>
                        </div>

                        {/* Message */}
                        {message && (
                            <div className={`mt-3 p-2 rounded-lg text-xs text-center ${message.type === 'success'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        {/* Footer */}
                        <p className="mt-3 text-[10px] text-slate-500 text-center">
                            Works with local Anvil (localhost:8545)
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
