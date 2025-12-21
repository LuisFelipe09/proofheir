'use client'

import { usePrivy } from '@privy-io/react-auth'

export function WalletConnect() {
    const { ready, authenticated, user, login, logout } = usePrivy()

    if (!ready) {
        return (
            <div className="bg-gray-100 p-2 rounded-lg">
                <div className="text-sm">Loading...</div>
            </div>
        )
    }

    if (authenticated && user) {
        const wallet = user.linkedAccounts.find((account) => account.type === 'wallet')
        const address = wallet?.address

        return (
            <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-lg">
                <div className="text-sm">
                    <div className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</div>
                    <div className="text-xs text-gray-500">
                        {user.email?.address || 'Connected'}
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                    Disconnect
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={login}
            className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded transition-colors"
        >
            Connect Wallet
        </button>
    )
}
