'use client'

import { useState } from 'react'
import { useTokenBalances, type TokenInfo } from '../hooks/useTokenBalances'

interface TokenSelectorProps {
    selectedTokens: string[]
    onTokensChange: (tokens: string[]) => void
    userAddress?: string
    mode?: 'delegation' | 'claim'
}

export function TokenSelector({
    selectedTokens,
    onTokensChange,
    userAddress,
    mode = 'delegation'
}: TokenSelectorProps) {
    const { tokens, isLoading, refetch } = useTokenBalances(userAddress)
    const [customAddress, setCustomAddress] = useState('')
    const [searchQuery, setSearchQuery] = useState('')

    const toggleToken = (address: string) => {
        if (selectedTokens.includes(address)) {
            onTokensChange(selectedTokens.filter(t => t !== address))
        } else {
            onTokensChange([...selectedTokens, address])
        }
    }

    const addCustomToken = () => {
        if (customAddress && customAddress.startsWith('0x') && customAddress.length === 42) {
            if (!selectedTokens.includes(customAddress)) {
                onTokensChange([...selectedTokens, customAddress])
            }
            setCustomAddress('')
        }
    }

    // Filter tokens by search query
    const filterToken = (token: TokenInfo) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return token.symbol.toLowerCase().includes(query) ||
            token.address.toLowerCase().includes(query)
    }

    const demoToken = tokens.find(t => t.isDemo)
    const otherTokens = tokens.filter(t => !t.isDemo && t.rawBalance > 0n).filter(filterToken)
    const allSelectableTokens = tokens.filter(t => t.rawBalance > 0n || t.isDemo).map(t => t.address)

    const selectAll = () => {
        onTokensChange(allSelectableTokens)
    }

    const deselectAll = () => {
        onTokensChange([])
    }

    const formatBalance = (balance: string) => {
        const num = parseFloat(balance)
        if (num === 0) return '0'
        if (num < 0.01) return '<0.01'
        if (num > 1000000) return `${(num / 1000000).toFixed(2)}M`
        if (num > 1000) return `${(num / 1000).toFixed(2)}K`
        return num.toFixed(2)
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-semibold text-slate-300">
                    {mode === 'delegation' ? 'Select Assets to Include' : 'Tokens to Claim'}
                </h4>
                <div className="flex items-center gap-2">
                    {allSelectableTokens.length > 0 && (
                        <>
                            <button
                                onClick={selectedTokens.length === allSelectableTokens.length ? deselectAll : selectAll}
                                aria-label={selectedTokens.length === allSelectableTokens.length ? "Deselect all tokens" : "Select all tokens"}
                                className="text-xs text-slate-400 hover:text-white transition-colors"
                            >
                                {selectedTokens.length === allSelectableTokens.length ? 'Clear' : 'Select All'}
                            </button>
                            <span className="text-slate-600">•</span>
                        </>
                    )}
                    <button
                        onClick={refetch}
                        disabled={isLoading}
                        aria-label="Refresh token balances"
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 disabled:opacity-50"
                    >
                        <svg className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Demo Token - Always visible and prominent */}
            {demoToken && (
                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-400">⭐</span>
                            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">Demo Token</span>
                        </div>
                        <button
                            onClick={refetch}
                            aria-label="Refresh demo token balance"
                            className="text-xs text-slate-400 hover:text-white"
                        >
                            ↻
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-white">{demoToken.symbol}</p>
                            <p className="text-xs text-slate-400 font-mono">{demoToken.address.slice(0, 10)}...{demoToken.address.slice(-6)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="font-bold text-white">{formatBalance(demoToken.balance)}</p>
                                <p className="text-xs text-slate-400">{demoToken.symbol}</p>
                            </div>
                            <button
                                onClick={() => toggleToken(demoToken.address)}
                                aria-label={selectedTokens.includes(demoToken.address) ? `Deselect ${demoToken.symbol}` : `Select ${demoToken.symbol}`}
                                className={`w-11 h-11 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-200 transform active:scale-90 hover:scale-105 ${selectedTokens.includes(demoToken.address)
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
                                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
                                    }`}
                            >
                                {selectedTokens.includes(demoToken.address) ? (
                                    <svg className="w-4 h-4 animate-[scaleIn_0.2s_ease-out]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                    {demoToken.balance === '-' ? (
                        <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Enter testator address to see balance
                        </p>
                    ) : parseFloat(demoToken.balance) === 0 && (
                        <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {mode === 'delegation' ? 'Use the Faucet (💰) to get demo tokens' : 'No tokens available to claim'}
                        </p>
                    )}
                </div>
            )}

            {/* Other Tokens from Wallet */}
            {tokens.filter(t => !t.isDemo && t.rawBalance > 0n).length > 0 && (
                <div className="bg-slate-700/30 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <span className="text-xs text-slate-400">Detected in Your Wallet</span>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative mb-3">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tokens..."
                            aria-label="Search tokens by symbol or address"
                            className="w-full p-2.5 pl-9 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                aria-label="Clear search"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded-full p-1 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <div className="space-y-2">
                        {otherTokens.length > 0 ? (
                            otherTokens.map((token) => (
                                <TokenRow
                                    key={token.address}
                                    token={token}
                                    isSelected={selectedTokens.includes(token.address)}
                                    onToggle={() => toggleToken(token.address)}
                                    formatBalance={formatBalance}
                                />
                            ))
                        ) : searchQuery ? (
                            <p className="text-center text-slate-500 text-xs py-3">
                                No tokens match "{searchQuery}"
                            </p>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-4 text-slate-400 text-sm">
                    <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Loading tokens...
                </div>
            )}

            {/* Custom Token Input */}
            <div className="bg-slate-700/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <label htmlFor="custom-token-input" className="text-xs text-slate-400">Add Custom Token</label>
                </div>
                <div className="flex gap-2">
                    <input
                        id="custom-token-input"
                        type="text"
                        value={customAddress}
                        onChange={(e) => setCustomAddress(e.target.value)}
                        placeholder="0x... token address"
                        aria-invalid={!!customAddress && (!customAddress.startsWith('0x') || customAddress.length !== 42)}
                        aria-describedby="custom-token-error"
                        className={`flex-1 p-2.5 bg-slate-800/50 border rounded-lg text-white placeholder-slate-500 font-mono text-xs focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${customAddress && (!customAddress.startsWith('0x') || customAddress.length !== 42)
                            ? 'border-rose-500/50'
                            : 'border-white/10'
                            }`}
                    />
                    <button
                        onClick={addCustomToken}
                        disabled={!customAddress || !customAddress.startsWith('0x') || customAddress.length !== 42}
                        aria-label="Add custom token"
                        className="px-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Add
                    </button>
                </div>
                {customAddress && (!customAddress.startsWith('0x') || customAddress.length !== 42) && (
                    <p id="custom-token-error" role="alert" className="text-xs text-rose-400 mt-2">
                        {!customAddress.startsWith('0x')
                            ? 'Address must start with 0x'
                            : `Address must be 42 characters (${customAddress.length}/42)`}
                    </p>
                )}
            </div>

            {/* Selected Tokens Summary */}
            {selectedTokens.length > 0 && (
                <div className="bg-slate-700/30 rounded-xl p-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Selected:</span>
                        <span className="text-white font-medium">{selectedTokens.length} token{selectedTokens.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {selectedTokens.map((addr) => {
                            const token = tokens.find(t => t.address.toLowerCase() === addr.toLowerCase())
                            return (
                                <span
                                    key={addr}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-lg"
                                >
                                    {token?.symbol || addr.slice(0, 6) + '...'}
                                    <button
                                        onClick={() => toggleToken(addr)}
                                        aria-label={`Remove ${token?.symbol || 'token'}`}
                                        className="hover:text-white"
                                    >
                                        ×
                                    </button>
                                </span>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

// Sub-component for token rows
function TokenRow({
    token,
    isSelected,
    onToggle,
    formatBalance
}: {
    token: TokenInfo
    isSelected: boolean
    onToggle: () => void
    formatBalance: (balance: string) => string
}) {
    return (
        <div
            onClick={onToggle}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle();
                }
            }}
            className={`flex items-center justify-between p-2 rounded-lg border transition-all duration-200 cursor-pointer ${isSelected
            ? 'bg-cyan-500/10 border-cyan-500/30'
            : 'bg-slate-800/50 border-white/5 hover:border-white/10'
            }`}
        >
            <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm truncate">{token.symbol}</p>
                <p className="text-xs text-slate-500 font-mono truncate">
                    <span className="sm:hidden">{token.address.slice(0, 6)}...{token.address.slice(-4)}</span>
                    <span className="hidden sm:inline">{token.address.slice(0, 8)}...{token.address.slice(-4)}</span>
                </p>
            </div>
            <div className="flex items-center gap-2">
                <div className="text-right">
                    <p className="text-sm font-medium text-white">{formatBalance(token.balance)}</p>
                </div>
                <div
                    className={`w-11 h-11 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all duration-200 transform active:scale-90 hover:scale-105 ${isSelected
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/40'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
                        }`}
                >
                    {isSelected ? (
                        <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-[scaleIn_0.2s_ease-out]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    )}
                </div>
            </div>
        </div>
    )
}
