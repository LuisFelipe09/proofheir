'use client'

import { useState } from 'react'
import { useAccount, useReadContract, usePublicClient } from 'wagmi'
import { useWallets } from '@privy-io/react-auth'
import { encodeFunctionData, pad, formatUnits, type Address, type Hex } from 'viem'

const PROOF_HEIR_ABI = [
    {
        "type": "function",
        "name": "claim",
        "inputs": [
            { "name": "proof", "type": "bytes" },
            { "name": "publicInputs", "type": "bytes32[]" },
            { "name": "tokens", "type": "address[]" },
            { "name": "recipient", "type": "address" }
        ],
        "outputs": [],
        "stateMutability": "external"
    }
] as const

export function ClaimCard() {
    const { address: connectedAddress, isConnected } = useAccount()
    const { wallets } = useWallets()
    const publicClient = usePublicClient()

    const [testatorAddress, setTestatorAddress] = useState('')
    const [recipientAddress, setRecipientAddress] = useState('0x03f72d5859858AFF7b93096B4AD9593442DD2327')
    const [tokenAddress, setTokenAddress] = useState('0x0165878A594ca255338adfa4d48449f69242Eb8F')
    const [authJson, setAuthJson] = useState('')

    const [status, setStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [txHash, setTxHash] = useState<string | null>(null)

    const handleClaim = async () => {
        // Priorizar la embedded wallet de Privy para evitar MetaMask
        const embeddedWallet = wallets.find(w => w.walletClientType === 'privy') || wallets.find(w => w.address === connectedAddress)

        if (!embeddedWallet) {
            setErrorMsg('Wallet de Privy no encontrada')
            setStatus('error')
            return
        }

        try {

            // Si hay un JSON de auth y NO está delegado, lo parseamos (lógica legacy, por si acaso)
            let authorization
            if (authJson && !authJson.trim().startsWith('{')) {
                // Si no es JSON válido lo ignoramos
            } else if (authJson) {
                try {
                    const rawAuth = JSON.parse(authJson)
                    authorization = {
                        address: (rawAuth.contractAddress || rawAuth.address) as Address,
                        chainId: Number(rawAuth.chainId),
                        nonce: Number(rawAuth.nonce || 0),
                        r: rawAuth.r as Hex,
                        s: rawAuth.s as Hex,
                        yParity: Number(rawAuth.yParity ?? (rawAuth.v === 28 ? 1 : rawAuth.v === 27 ? 0 : (rawAuth.v ?? 0)))
                    }
                } catch (e) {
                    console.warn("JSON de auth inválido, ignorando...", e)
                }
            }

            const proof = '0x' as Hex
            const recipient = (recipientAddress || connectedAddress) as Address
            const publicInputs = [pad(recipient, { size: 32 }) as Hex]
            const tokens = [tokenAddress as Address]

            // Encode the function call
            const data = encodeFunctionData({
                abi: PROOF_HEIR_ABI,
                functionName: 'claim',
                args: [proof, publicInputs, tokens, recipient]
            })

            // Hablamos directamente con el provider de la embedded wallet
            const provider = await embeddedWallet.getEthereumProvider()

            // Transacción básica
            const txParams: any = {
                from: embeddedWallet.address,
                to: testatorAddress,
                data
            }

            // Solo agregamos authorizationList si realmente existe una autorización
            if (authorization) {
                txParams.authorizationList = [authorization]
            }

            const hash = await provider.request({
                method: 'eth_sendTransaction',
                params: [txParams]
            }) as string

            setTxHash(hash)
            setStatus('success')
        } catch (e: any) {
            console.error(e)
            setErrorMsg(e.message || 'Error al ejecutar el reclamo')
            setStatus('error')
        }
    }

    if (!isConnected) return null

    return (
        <div className="w-full" style={{ color: 'black' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Execute Claim (Privy Native)</h2>

            <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1.5rem' }}>
                Ejecuta la herencia usando la delegación EIP-7702 directamente desde tu wallet.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                    <label htmlFor="testator-address" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>Dirección del Testador</label>
                    <input
                        id="testator-address"
                        type="text"
                        value={testatorAddress}
                        onChange={(e) => setTestatorAddress(e.target.value)}
                        placeholder="0x..."
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '0.25rem', fontSize: '0.875rem', fontFamily: 'monospace' }}
                    />
                </div>
                <div>
                    <label htmlFor="token-address" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>Token Address</label>
                    <input
                        id="token-address"
                        type="text"
                        value={tokenAddress}
                        onChange={(e) => setTokenAddress(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '0.25rem', fontSize: '0.875rem', fontFamily: 'monospace' }}
                    />
                </div>
                <div>
                    <label htmlFor="auth-json" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>Autorización EIP-7702 (JSON)</label>
                    <textarea
                        id="auth-json"
                        value={authJson}
                        onChange={(e) => setAuthJson(e.target.value)}
                        placeholder='{"address": "0x...", "r": "0x...", ...}'
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '0.25rem', fontSize: '0.725rem', fontFamily: 'monospace', height: '90px' }}
                    />
                </div>
            </div>

            <button
                onClick={handleClaim}
                disabled={status === 'executing'}
                style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    color: 'white',
                    backgroundColor: status === 'success' ? '#16a34a' : status === 'error' ? '#dc2626' : '#4f46e5',
                    border: 'none',
                    cursor: (status === 'executing') ? 'not-allowed' : 'pointer'
                }}
            >
                {status === 'executing' ? 'Ejecutando...' : 'Confirmar y Ejecutar'}
            </button>

            {status === 'success' && txHash && (
                <div role="status" aria-live="polite" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0fdf4', color: '#15803d', fontSize: '0.75rem', borderRadius: '0.25rem' }}>
                    <strong>¡Éxito!</strong> Transacción enviada: {txHash}
                </div>
            )}

            {status === 'error' && (
                <div role="alert" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.75rem', borderRadius: '0.25rem' }}>
                    {errorMsg}
                </div>
            )}
        </div>
    )
}
