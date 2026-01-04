'use client'

import { useState } from 'react'
import { useAccount, useReadContract, usePublicClient } from 'wagmi'
import { useWallets } from '@privy-io/react-auth'
import { encodeFunctionData, pad, formatUnits, type Address, type Hex } from 'viem'
import { CONTRACTS } from '../config/contracts'

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
    const [recipientAddress, setRecipientAddress] = useState('')
    const [tokenAddress, setTokenAddress] = useState(CONTRACTS.MOCK_TOKEN as string)
    const [authJson, setAuthJson] = useState('')

    // New fields for proof generation
    const [nuipInput, setNuipInput] = useState('')
    const [saltInput, setSaltInput] = useState('0x1111111111111111111111111111111111111111111111111111111111111111')

    const [status, setStatus] = useState<'idle' | 'generating' | 'executing' | 'success' | 'error'>('idle')
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
            setStatus('generating')

            // 1. Generate ZK Proof via API
            const recipient = (recipientAddress || connectedAddress) as Address
            const proofRes = await fetch('/api/generate-proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient,
                    nuip: nuipInput,
                    salt: saltInput,
                }),
            })


            if (!proofRes.ok) {
                const errorData = await proofRes.json()
                throw new Error(errorData.error || 'Failed to generate proof')
            }

            const { proof: rawProof, public_inputs: rawPublicInputs } = await proofRes.json()

            // Ensure proof has 0x prefix
            const proof = rawProof.startsWith('0x') ? rawProof : `0x${rawProof}`

            // Ensure all public inputs have 0x prefix
            const publicInputs = rawPublicInputs.map((input: string) =>
                input.startsWith('0x') ? input : `0x${input}`
            )

            console.log('Proof generated:', {
                proofLength: proof.length,
                inputsCount: publicInputs.length,
                firstInput: publicInputs[0]
            })

            setStatus('executing')

            // 2. Parse authorization (existing logic)
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

            const tokens = [tokenAddress as Address]

            // 3. Encode the function call with real proof
            const data = encodeFunctionData({
                abi: PROOF_HEIR_ABI,
                functionName: 'claim',
                args: [
                    proof as Hex,
                    publicInputs as Hex[],
                    tokens,
                    recipient
                ]
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
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>Dirección del Testador</label>
                    <input
                        type="text"
                        value={testatorAddress}
                        onChange={(e) => setTestatorAddress(e.target.value)}
                        placeholder="0x..."
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '0.25rem', fontSize: '0.875rem', fontFamily: 'monospace' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>Token Address</label>
                    <input
                        type="text"
                        value={tokenAddress}
                        onChange={(e) => setTokenAddress(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '0.25rem', fontSize: '0.875rem', fontFamily: 'monospace' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>NUIP (ID Nacional)</label>
                    <input
                        type="text"
                        value={nuipInput}
                        onChange={(e) => setNuipInput(e.target.value)}
                        placeholder="123456789"
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '0.25rem', fontSize: '0.875rem', fontFamily: 'monospace' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>Salt (32 bytes hex)</label>
                    <input
                        type="text"
                        value={saltInput}
                        onChange={(e) => setSaltInput(e.target.value)}
                        placeholder="0x1111..."
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '0.25rem', fontSize: '0.725rem', fontFamily: 'monospace' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>Autorización EIP-7702 (JSON)</label>
                    <textarea
                        value={authJson}
                        onChange={(e) => setAuthJson(e.target.value)}
                        placeholder='{"address": "0x...", "r": "0x...", ...}'
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '0.25rem', fontSize: '0.725rem', fontFamily: 'monospace', height: '90px' }}
                    />
                </div>
            </div>

            <button
                onClick={handleClaim}
                disabled={status === 'generating' || status === 'executing'}
                style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    color: 'white',
                    backgroundColor: status === 'success' ? '#16a34a' : status === 'error' ? '#dc2626' : '#4f46e5',
                    border: 'none',
                    cursor: (status === 'generating' || status === 'executing') ? 'not-allowed' : 'pointer'
                }}
            >
                {status === 'generating' ? 'Generando Prueba...' : status === 'executing' ? 'Ejecutando Claim...' : 'Confirmar y Ejecutar'}
            </button>

            {status === 'success' && txHash && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0fdf4', color: '#15803d', fontSize: '0.75rem', borderRadius: '0.25rem' }}>
                    <strong>¡Éxito!</strong> Transacción enviada: {txHash}
                </div>
            )}

            {status === 'error' && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.75rem', borderRadius: '0.25rem' }}>
                    {errorMsg}
                </div>
            )}
        </div>
    )
}
