'use client';

import { usePrivy } from '@privy-io/react-auth';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

export function WalletConnect() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleLogout = async () => {
    setIsDisconnecting(true);
    try {
      await logout();
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (!ready) {
    return (
      <div
        style={{
          backgroundColor: '#f3f4f6',
          padding: '0.5rem',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <Loader2 className="animate-spin" size={16} />
        <div style={{ fontSize: '0.875rem' }}>Loading...</div>
      </div>
    );
  }

  if (authenticated && user) {
    const wallet = user.linkedAccounts.find(
      (account) => account.type === 'wallet',
    );
    const address = wallet?.address;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          backgroundColor: '#f3f4f6',
          padding: '0.5rem',
          borderRadius: '0.5rem',
        }}
      >
        <div style={{ fontSize: '0.875rem' }}>
          <div style={{ fontFamily: 'monospace' }}>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {user.email?.address || 'Connected'}
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={isDisconnecting}
          aria-label="Disconnect wallet"
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '0.25rem',
            border: 'none',
            cursor: isDisconnecting ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            opacity: isDisconnecting ? 0.7 : 1,
          }}
        >
          {isDisconnecting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          {isDisconnecting ? 'Disconnecting' : 'Disconnect'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      aria-label="Connect your wallet"
      style={{
        backgroundColor: 'black',
        color: 'white',
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
    >
      Connect Wallet
    </button>
  );
}
