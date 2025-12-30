'use client'

import { usePrivy } from '@privy-io/react-auth'

export function WalletConnect() {
    const { ready, authenticated, user, login, logout } = usePrivy()

    if (!ready) {
        return (
            <div
                role="status"
                aria-live="polite"
                style={{ backgroundColor: '#f3f4f6', padding: '0.5rem', borderRadius: '0.5rem' }}
            >
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
                    <div style={{ fontFamily: 'monospace' }}>{address?.slice(0, 6)}...{address?.slice(-4)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {user.email?.address || 'Connected'}
                    </div>
                </div>
                <button
                    onClick={logout}
                    aria-label="Disconnect wallet"
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
