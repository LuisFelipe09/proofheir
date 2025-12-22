'use client'

import { useState } from 'react'
import { usePrivy, useSign7702Authorization, useWallets } from '@privy-io/react-auth'
import { useReadContract, usePublicClient } from 'wagmi'
import { formatUnits, type Address, type Hex } from 'viem'
import { useEffect } from 'react'

const PROOF_HEIR_ADDRESS = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'
const MOCK_TOKEN_ADDRESS = '0x0165878A594ca255338adfa4d48449f69242Eb8F'

export function DelegationCard() {
    const { authenticated, createWallet } = usePrivy()
    const { signAuthorization } = useSign7702Authorization()
    const { wallets } = useWallets()
    const publicClient = usePublicClient()

    // Buscar específicamente el embedded wallet de Privy
    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')

    const { data: balanceData } = useReadContract({
        address: MOCK_TOKEN_ADDRESS as Address,
        abi: [{
            "type": "function",
            "name": "balanceOf",
            "inputs": [{ "name": "account", "type": "address" }],
            "outputs": [{ "name": "", "type": "uint256" }],
            "stateMutability": "view"
        }],
        functionName: 'balanceOf',
        args: embeddedWallet ? [embeddedWallet.address as Address] : undefined,
        query: {
            enabled: !!embeddedWallet,
            refetchInterval: 5000
        }
    })

    const [status, setStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [installTxHash, setInstallTxHash] = useState<string | null>(null)
    const [isDelegated, setIsDelegated] = useState<boolean>(false)

    // Verificar si la cuenta ya está delegada
    useEffect(() => {
        const checkDelegation = async () => {
            if (!embeddedWallet || !publicClient) return
            try {
                const code = await publicClient.getBytecode({
                    address: embeddedWallet.address as Address
                })
                const alreadyDelegated = code?.startsWith('0xef0100') ?? false
                setIsDelegated(alreadyDelegated)
            } catch (e) {
                console.error('Error checking delegation status:', e)
            }
        }
        checkDelegation()
        const interval = setInterval(checkDelegation, 5000)
        return () => clearInterval(interval)
    }, [embeddedWallet, publicClient])

    const handleDelegate = async () => {
        if (!authenticated || !embeddedWallet) {
            setErrorMsg('Conecta tu embedded wallet primero')
            setStatus('error')
            return
        }

        try {
            setStatus('executing')
            setErrorMsg('')

            if (!publicClient) throw new Error('Public client not available')

            const anvilNonce = await publicClient.getTransactionCount({
                address: embeddedWallet.address as Address
            })

            const rawAuth = await (signAuthorization as any)({
                contractAddress: PROOF_HEIR_ADDRESS as Address,
                chainId: 31337,
                nonce: anvilNonce
            })

            const authorization = {
                address: (rawAuth.contractAddress || rawAuth.address) as Address,
                chainId: Number(rawAuth.chainId),
                nonce: Number(rawAuth.nonce ?? anvilNonce),
                r: rawAuth.r as Hex,
                s: rawAuth.s as Hex,
                yParity: Number(rawAuth.yParity ?? (rawAuth.v !== undefined ? Number(BigInt(rawAuth.v) % 2n === 0n ? 0 : 1) : 0))
            }

            const response = await fetch('/api/delegate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    authorization,
                    targetAddress: embeddedWallet.address
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Error al delegar en el servidor')
            }

            const { hash } = await response.json()
            const receipt = await publicClient.waitForTransactionReceipt({ hash })
            setInstallTxHash(hash)
            setStatus('success')

        } catch (e: any) {
            console.error('❌ Error:', e)
            setErrorMsg(e.message || 'Error al firmar')
            setStatus('error')
        }
    }

    const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy')

    const { data: ethBalance } = useReadContract({
        abi: [{ "type": "function", "name": "balanceOf", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" }],
        address: '0x0000000000000000000000000000000000000000', // Dummy, we use eth balance
        functionName: 'balanceOf',
        query: { enabled: false } // Actually we just need eth balance
    })

    // Funding logic removed for security. Use CLI or backend if needed.

    if (!authenticated) return null

    return (
        <div className="w-full" style={{ color: 'black' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>ProofHeir Delegation</h2>

            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: '#f0f7ff', borderRadius: '0.5rem', border: '1px solid #d0e7ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', fontWeight: '500' }}>
                    <span style={{ color: '#1d4ed8' }}>Saldo Actual:</span>
                    <span style={{ color: '#1e3a8a', fontFamily: 'monospace' }}>
                        {balanceData !== undefined ? `${formatUnits(balanceData as bigint, 18)} MOCK` : 'Cargando...'}
                    </span>
                </div>
            </div>

            <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1.5rem' }}>
                Autoriza al contrato ProofHeir para actuar en nombre de tu cuenta usando EIP-7702.
                <strong style={{ display: 'block', marginTop: '0.25rem' }}> Requiere una embedded wallet de Privy.</strong>
            </p>

            {!hasEmbeddedWallet ? (
                <button
                    onClick={createWallet}
                    style={{
                        width: '100%',
                        padding: '12px',
                        marginBottom: '1rem',
                        borderRadius: '0.5rem',
                        fontWeight: '600',
                        color: 'white',
                        backgroundColor: '#9333ea',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    Crear Embedded Wallet
                </button>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        onClick={handleDelegate}
                        disabled={status === 'executing' || isDelegated}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '0.5rem',
                            fontWeight: '600',
                            color: 'white',
                            backgroundColor: isDelegated ? '#10b981' : status === 'error' ? '#dc2626' : '#2563eb',
                            border: 'none',
                            cursor: (status === 'executing' || isDelegated) ? 'not-allowed' : 'pointer',
                            opacity: status === 'executing' ? 0.7 : 1
                        }}
                    >
                        {status === 'idle' && (isDelegated ? '✓ Plan Activo' : '⭐ Instalar Plan (Sponsor)')}
                        {status === 'executing' && 'Instalando...'}
                        {status === 'success' && '✓ ¡Delegado!'}
                        {status === 'error' && 'Reintentar'}
                    </button>

                    {status === 'success' && installTxHash && (
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem' }}>
                            <p style={{ color: '#166534', fontSize: '0.875rem', fontWeight: 'bold' }}>✓ Instalación exitosa</p>
                            <div style={{ fontSize: '0.7rem', color: '#15803d', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '4px' }}>Hash: {installTxHash}</div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.75rem', borderRadius: '0.25rem' }}>
                            <strong>Error:</strong> {errorMsg}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
