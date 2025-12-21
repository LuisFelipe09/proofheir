'use client'

import { useState } from 'react'
import { usePrivy, useSign7702Authorization, useWallets } from '@privy-io/react-auth'
import { useReadContract } from 'wagmi'
import { formatUnits, type Address, type Hex } from 'viem'

const PROOF_HEIR_ADDRESS = '0x0dcd1bf9a1b36ce34237eeafef220932846bcd82'
const MOCK_TOKEN_ADDRESS = '0x9a676e781a523b5d0c0e43731313a708cb607508'

export function DelegationCard() {
    const { authenticated, createWallet } = usePrivy()
    const { signAuthorization } = useSign7702Authorization()
    const { wallets } = useWallets()

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

    const [status, setStatus] = useState<'idle' | 'signing' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [authData, setAuthData] = useState<any>(null)

    const handleDelegate = async () => {
        if (!authenticated || !embeddedWallet) {
            setErrorMsg('Conecta tu embedded wallet primero')
            setStatus('error')
            return
        }

        try {
            setStatus('signing')
            setErrorMsg('')

            console.log('🔐 Obteniendo nonce para:', embeddedWallet.address)

            // Usar el provider de la wallet conectada para pedir el nonce
            const provider = await embeddedWallet.getEthereumProvider()
            const nonceHex = await provider.request({
                method: 'eth_getTransactionCount',
                params: [embeddedWallet.address, 'latest']
            }) as string

            const nonce = parseInt(nonceHex, 16)
            console.log('Current Nonce:', nonce)

            console.log('🔐 Firmando autorización EIP-7702...')
            const rawAuth = await (signAuthorization as any)({
                contractAddress: PROOF_HEIR_ADDRESS as Address,
                address: embeddedWallet.address,
            })

            // Mapear al formato exacto de viem
            const authorization = {
                address: (rawAuth.contractAddress || rawAuth.address) as Address,
                chainId: Number(rawAuth.chainId),
                nonce: Number(rawAuth.nonce || nonce),
                r: rawAuth.r as Hex,
                s: rawAuth.s as Hex,
                yParity: Number(rawAuth.yParity ?? rawAuth.v ?? 0)
            }

            console.log('✅ Autorización lista:', authorization)
            setAuthData(authorization)
            setStatus('success')

        } catch (e: any) {
            console.error('❌ Error:', e)
            setErrorMsg(e.message || 'Error al firmar')
            setStatus('error')
        }
    }

    const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy')

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
                <button
                    onClick={handleDelegate}
                    disabled={status === 'signing' || status === 'success'}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '0.5rem',
                        fontWeight: '600',
                        color: 'white',
                        backgroundColor: status === 'success' ? '#16a34a' : status === 'error' ? '#dc2626' : '#2563eb',
                        border: 'none',
                        cursor: (status === 'signing' || status === 'success') ? 'not-allowed' : 'pointer',
                        opacity: (status === 'signing' || status === 'success') ? 0.5 : 1
                    }}
                >
                    {status === 'idle' && 'Autorizar con EIP-7702'}
                    {status === 'signing' && 'Firmando...'}
                    {status === 'success' && '✓ ¡Cuenta Delegada!'}
                    {status === 'error' && 'Reintentar'}
                </button>
            )}

            {status === 'success' && authData && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem' }}>
                    <p style={{ color: '#166534', fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>✓ Autorización firmada exitosamente</p>
                    <div style={{ fontSize: '0.75rem', color: '#15803d', fontFamily: 'monospace', wordBreak: 'break-all', backgroundColor: 'rgba(255,255,255,0.5)', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #dcfce7', marginBottom: '0.75rem' }}>
                        <div style={{ marginBottom: '0.25rem' }}><strong>Contrato:</strong> {PROOF_HEIR_ADDRESS}</div>
                        <div><strong>Data:</strong> {JSON.stringify(authData, (_, v) => typeof v === 'bigint' ? v.toString() : v)}</div>
                    </div>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(authData, (_, v) => typeof v === 'bigint' ? v.toString() : v));
                            alert('¡Copiado al portapapeles!');
                        }}
                        style={{
                            fontSize: '0.75rem',
                            backgroundColor: '#16a34a',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '0.25rem',
                            fontWeight: 'bold',
                            border: 'none',
                            cursor: 'pointer',
                            width: '100%'
                        }}
                    >
                        Copiar JSON de Autorización
                    </button>
                </div>
            )}

            {status === 'error' && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.75rem', borderRadius: '0.25rem' }}>
                    <strong>Error:</strong> {errorMsg}
                </div>
            )}
        </div>
    )
}
