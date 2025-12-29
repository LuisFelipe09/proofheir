'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

export function WalletConnect() {
    const { ready, authenticated, user, login, logout } = usePrivy()
    const [copied, setCopied] = useState(false)

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    if (!ready) {
        return (
            <div style={{ backgroundColor: '#f3f4f6', padding: '0.5rem', borderRadius: '0.5rem' }}>
                <div style={{ fontSize: '0.875rem' }}>Loading...</div>
            </div>
        )
    }

    if (authenticated && user) {
        const wallet = user.linkedAccounts.find((account) => account.type === 'wallet')
        const address = wallet?.address

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#f3f4f6', padding: '0.5rem', borderRadius: '0.5rem' }}>
                <div style={{ fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ fontFamily: 'monospace' }}>{address?.slice(0, 6)}...{address?.slice(-4)}</div>
                        {address && (
                            <button
                                onClick={() => copyToClipboard(address)}
                                aria-label="Copy address"
                                title="Copy address"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '2px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: copied ? '#16a34a' : '#6b7280'
                                }}
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                        )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {user.email?.address || 'Connected'}
                    </div>
                </div>
                <button
                    onClick={logout}
                    style={{ backgroundColor: '#ef4444', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                    Disconnect
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={login}
            style={{ backgroundColor: 'black', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' }}
        >
            Connect Wallet
        </button>
    )
}
