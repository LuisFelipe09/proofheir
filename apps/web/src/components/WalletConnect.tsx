'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { Copy, Check } from 'lucide-react'

export function WalletConnect() {
    const { ready, authenticated, user, login, logout } = usePrivy()
    const [isCopied, setIsCopied] = useState(false)

    const handleCopyAddress = async (address: string) => {
        try {
            await navigator.clipboard.writeText(address)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy address:', err)
        }
    }

    if (!ready) {
        return (
            <div className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-xl">
                <div className="text-sm text-slate-400 animate-pulse">Loading...</div>
            </div>
        )
    }

    if (authenticated && user) {
        const wallet = user.linkedAccounts.find((account) => account.type === 'wallet')
        const address = wallet?.address

        return (
            <div className="flex items-center gap-2 sm:gap-3 bg-slate-800/80 backdrop-blur-sm border border-white/10 px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl">
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Avatar - smaller on mobile */}
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>

                    <div className="text-left">
                        <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs sm:text-sm text-white font-medium">
                                {address?.slice(0, 6)}...{address?.slice(-4)}
                            </span>
                            {address && (
                                <button
                                    onClick={() => handleCopyAddress(address)}
                                    aria-label={isCopied ? "Address copied" : "Copy address"}
                                    title="Copy address"
                                    className="p-0.5 rounded hover:bg-white/10 transition-colors"
                                >
                                    {isCopied ? (
                                        <Check size={14} className="text-emerald-400" />
                                    ) : (
                                        <Copy size={14} className="text-slate-400 hover:text-white" />
                                    )}
                                </button>
                            )}
                        </div>
                        {/* Email - hidden on mobile */}
                        <div className="hidden sm:block text-xs text-slate-400">
                            {user.email?.address || 'Connected'}
                        </div>
                    </div>
                </div>

                {/* Disconnect - icon only on mobile */}
                <button
                    onClick={logout}
                    aria-label="Disconnect wallet"
                    title="Disconnect"
                    className="ml-1 sm:ml-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-rose-400 hover:text-white hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 rounded-lg transition-all duration-200"
                >
                    <span className="hidden sm:inline">Disconnect</span>
                    <svg className="sm:hidden w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={login}
            className="group flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-semibold px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all duration-300 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
        >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden text-sm">Connect</span>
        </button>
    )
}
