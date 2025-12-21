'use client'

import { useState } from 'react'
import { usePrivy, useSign7702Authorization, useWallets } from '@privy-io/react-auth'

const PROOF_HEIR_ADDRESS = '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512'

export function DelegationCard() {
    const { authenticated, createWallet, user } = usePrivy()
    const { signAuthorization } = useSign7702Authorization()
    const { wallets } = useWallets()

    const [status, setStatus] = useState<'idle' | 'signing' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [authData, setAuthData] = useState<any>(null)

    const handleDelegate = async () => {
        if (!authenticated) {
            setErrorMsg('Por favor conecta tu wallet primero')
            setStatus('error')
            return
        }

        // Buscar específicamente el embedded wallet de Privy
        const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')

        if (!embeddedWallet) {
            setErrorMsg('No se encontró embedded wallet. Haz clic en el botón de abajo para crear una.')
            setStatus('error')
            return
        }

        try {
            setStatus('signing')
            setErrorMsg('')

            console.log('🔐 Firmando autorización EIP-7702 con Privy...')
            console.log('Using embedded wallet:', embeddedWallet.address)

            // Usar el hook de Privy para firmar autorización EIP-7702
            // Cast a any para evitar error de lint si 'address' no está en el tipo pero sí en el SDK
            const authorization = await (signAuthorization as any)({
                contractAddress: PROOF_HEIR_ADDRESS as `0x${string}`,
                chainId: 31337, // Anvil
                address: embeddedWallet.address,
                nonce: 0, // Usar 0 como default para autorización universal o inicial
            })
            console.log('✅ Autorización EIP-7702 firmada:', authorization)
            setAuthData(authorization)
            setStatus('success')

        } catch (e: any) {
            console.error('❌ Error al firmar autorización:', e)
            setErrorMsg(e.message || 'Error al firmar la autorización EIP-7702')
            setStatus('error')
        }
    }

    const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy')

    if (!authenticated) return null

    return (
        <div className="border p-6 rounded-xl shadow-md bg-white max-w-md w-full text-black">
            <h2 className="text-xl font-bold mb-4">ProofHeir Delegation</h2>
            <p className="text-sm text-gray-600 mb-6">
                Autoriza al contrato ProofHeir para actuar en nombre de tu cuenta usando EIP-7702.
                <strong> Requiere una embedded wallet de Privy.</strong>
            </p>

            {!hasEmbeddedWallet ? (
                <button
                    onClick={createWallet}
                    className="w-full py-3 mb-4 rounded-lg font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors"
                >
                    Crear Embedded Wallet
                </button>
            ) : (
                <button
                    onClick={handleDelegate}
                    disabled={status === 'signing' || status === 'success'}
                    className={`w-full py-3 rounded-lg font-semibold text-white ${status === 'success' ? 'bg-green-600' :
                        status === 'error' ? 'bg-red-600 hover:bg-red-700' :
                            'bg-blue-600 hover:bg-blue-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {status === 'idle' && 'Autorizar con EIP-7702'}
                    {status === 'signing' && 'Firmando...'}
                    {status === 'success' && '✓ ¡Cuenta Delegada!'}
                    {status === 'error' && 'Reintentar'}
                </button>
            )}

            {status === 'success' && authData && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 text-sm font-bold mb-2">✓ Autorización firmada exitosamente</p>
                    <div className="text-xs text-green-700 font-mono break-all">
                        <div className="mb-1"><strong>Contrato:</strong> {PROOF_HEIR_ADDRESS}</div>
                        <div><strong>Firma:</strong> {JSON.stringify(authData, (_, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 100)}...</div>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded">
                    <strong>Error:</strong> {errorMsg}
                </div>
            )}
        </div>
    )
}
