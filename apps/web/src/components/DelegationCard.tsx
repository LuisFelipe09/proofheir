'use client'

import { useState } from 'react'
import { usePrivy, useSign7702Authorization, useWallets } from '@privy-io/react-auth'
import { useReadContract, usePublicClient } from 'wagmi'
import { formatUnits, encodeFunctionData, type Address, type Hex } from 'viem'
import { useEffect } from 'react'
import { CONTRACTS } from '../config/contracts'

const PROOF_HEIR_ADDRESS = CONTRACTS.PROOF_HEIR
const MOCK_TOKEN_ADDRESS = CONTRACTS.MOCK_TOKEN

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

    // Delegation state
    const [delegationStatus, setDelegationStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle')
    const [delegationError, setDelegationError] = useState('')
    const [installTxHash, setInstallTxHash] = useState<string | null>(null)
    const [isDelegated, setIsDelegated] = useState<boolean>(false)

    // Registration state
    const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle')
    const [registrationError, setRegistrationError] = useState('')
    const [registerTxHash, setRegisterTxHash] = useState<string | null>(null)
    const [nuipInput, setNuipInput] = useState('')
    const [saltInput, setSaltInput] = useState('0x1111111111111111111111111111111111111111111111111111111111111111')

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
                if (alreadyDelegated) {
                    setDelegationStatus('success')
                }
            } catch (e) {
                // Error checking delegation, will retry
            }
        }
        checkDelegation()
        const interval = setInterval(checkDelegation, 5000)
        return () => clearInterval(interval)
    }, [embeddedWallet, publicClient])

    const handleDelegate = async () => {
        if (!authenticated || !embeddedWallet) {
            setDelegationError('Conecta tu embedded wallet primero')
            setDelegationStatus('error')
            return
        }

        try {
            setDelegationStatus('executing')
            setDelegationError('')

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
            await publicClient.waitForTransactionReceipt({ hash })
            setInstallTxHash(hash)
            setDelegationStatus('success')

        } catch (e: any) {
            setDelegationError(e.message || 'Error al delegar')
            setDelegationStatus('error')
        }
    }

    const handleRegister = async () => {
        if (!authenticated || !embeddedWallet || !nuipInput || !saltInput) {
            setRegistrationError('Por favor ingresa NUIP y Salt')
            setRegistrationStatus('error')
            return
        }

        try {
            setRegistrationStatus('executing')
            setRegistrationError('')

            if (!publicClient) throw new Error('Public client not available')

            // Pad NUIP to 15 bytes to match Rust prover implementation
            const nuipBytes = new TextEncoder().encode(nuipInput)
            const nuipPadded = new Uint8Array(15)
            nuipPadded.set(nuipBytes.slice(0, Math.min(nuipBytes.length, 15)))

            // Convert salt hex string to bytes
            const saltBytes = new Uint8Array(
                saltInput.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
            )

            // Concatenate padded NUIP + salt
            const combined = new Uint8Array(nuipPadded.length + saltBytes.length)
            combined.set(nuipPadded)
            combined.set(saltBytes, nuipPadded.length)

            // Calculate identity commitment: SHA-256(padded_nuip || salt)
            const identityCommitment = `0x${Array.from(
                new Uint8Array(
                    await crypto.subtle.digest('SHA-256', combined)
                )
            ).map(b => b.toString(16).padStart(2, '0')).join('')}`

            // Encode the function call using viem for type safety
            const calldata = encodeFunctionData({
                abi: [{
                    type: 'function',
                    name: 'registerIdentity',
                    inputs: [{ name: '_identityCommitment', type: 'bytes32' }],
                    outputs: [],
                    stateMutability: 'nonpayable'
                }],
                functionName: 'registerIdentity',
                args: [identityCommitment as `0x${string}`]
            })

            // Call register on the delegated account
            const provider = await embeddedWallet.getEthereumProvider()
            const registerTx = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: embeddedWallet.address,
                    to: embeddedWallet.address, // Call self (delegated contract)
                    data: calldata
                }]
            })

            await publicClient.waitForTransactionReceipt({ hash: registerTx as `0x${string}` })
            setRegisterTxHash(registerTx as string)

            // Verify the commitment was stored correctly
            const storedCommitment = await publicClient.readContract({
                address: embeddedWallet.address as Address,
                abi: [{
                    type: 'function',
                    name: 'getIdentityCommitment',
                    inputs: [],
                    outputs: [{ name: '', type: 'bytes32' }],
                    stateMutability: 'view'
                }],
                functionName: 'getIdentityCommitment'
            })

            if (storedCommitment === identityCommitment) {
                setRegistrationStatus('success')
            } else {
                throw new Error('Identity commitment mismatch!')
            }

        } catch (e: any) {
            setRegistrationError(e.message || 'Error al registrar')
            setRegistrationStatus('error')
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

            {!hasEmbeddedWallet ? (
                <>
                    <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1.5rem' }}>
                        Crea una embedded wallet de Privy para comenzar.
                    </p>
                    <button
                        onClick={createWallet}
                        style={{
                            width: '100%',
                            padding: '12px',
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
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* STEP 1: Delegation */}
                    <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                            Paso 1: Instalar Plan de Herencia
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                            Delega tu cuenta al contrato ProofHeir usando EIP-7702.
                        </p>

                        <button
                            onClick={handleDelegate}
                            disabled={delegationStatus === 'executing' || isDelegated}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '0.5rem',
                                fontWeight: '600',
                                color: 'white',
                                backgroundColor: isDelegated ? '#10b981' : delegationStatus === 'error' ? '#dc2626' : '#2563eb',
                                border: 'none',
                                cursor: (delegationStatus === 'executing' || isDelegated) ? 'not-allowed' : 'pointer',
                                opacity: delegationStatus === 'executing' ? 0.7 : 1
                            }}
                        >
                            {delegationStatus === 'idle' && (isDelegated ? '✓ Plan Activo' : '⭐ Instalar Plan')}
                            {delegationStatus === 'executing' && 'Instalando...'}
                            {delegationStatus === 'success' && '✓ Plan Instalado'}
                            {delegationStatus === 'error' && 'Reintentar'}
                        </button>

                        {delegationStatus === 'success' && installTxHash && (
                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem' }}>
                                <p style={{ color: '#166534', fontSize: '0.875rem', fontWeight: 'bold' }}>✓ Delegación exitosa</p>
                                <div style={{ fontSize: '0.7rem', color: '#15803d', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '4px' }}>Hash: {installTxHash}</div>
                            </div>
                        )}

                        {delegationStatus === 'error' && (
                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.75rem', borderRadius: '0.25rem' }}>
                                <strong>Error:</strong> {delegationError}
                            </div>
                        )}
                    </div>

                    {/* STEP 2: Registration - Only show if delegated */}
                    {isDelegated && (
                        <div style={{ padding: '1rem', backgroundColor: '#fefce8', borderRadius: '0.5rem', border: '1px solid #fde047' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                                Paso 2: Registrar Identidad
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#854d0e', marginBottom: '1rem' }}>
                                Registra tu NUIP y Salt para crear tu compromiso de identidad.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#374151' }}>
                                        NUIP (Número de Identificación)
                                    </label>
                                    <input
                                        type="text"
                                        value={nuipInput}
                                        onChange={(e) => setNuipInput(e.target.value)}
                                        placeholder="Ej: 454545454"
                                        disabled={registrationStatus === 'success'}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '0.5rem',
                                            border: '1px solid #d1d5db',
                                            fontSize: '0.875rem',
                                            fontFamily: 'monospace'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#374151' }}>
                                        Salt (Secreto)
                                    </label>
                                    <input
                                        type="text"
                                        value={saltInput}
                                        onChange={(e) => setSaltInput(e.target.value)}
                                        placeholder="0x1111..."
                                        disabled={registrationStatus === 'success'}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '0.5rem',
                                            border: '1px solid #d1d5db',
                                            fontSize: '0.75rem',
                                            fontFamily: 'monospace'
                                        }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleRegister}
                                disabled={registrationStatus === 'executing' || registrationStatus === 'success'}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '0.5rem',
                                    fontWeight: '600',
                                    color: 'white',
                                    backgroundColor: registrationStatus === 'success' ? '#10b981' : registrationStatus === 'error' ? '#dc2626' : '#f59e0b',
                                    border: 'none',
                                    cursor: (registrationStatus === 'executing' || registrationStatus === 'success') ? 'not-allowed' : 'pointer',
                                    opacity: registrationStatus === 'executing' ? 0.7 : 1
                                }}
                            >
                                {registrationStatus === 'idle' && '📝 Registrar Identidad'}
                                {registrationStatus === 'executing' && 'Registrando...'}
                                {registrationStatus === 'success' && '✓ Identidad Registrada'}
                                {registrationStatus === 'error' && 'Reintentar Registro'}
                            </button>

                            {registrationStatus === 'success' && registerTxHash && (
                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem' }}>
                                    <p style={{ color: '#166534', fontSize: '0.875rem', fontWeight: 'bold' }}>✓ Registro exitoso</p>
                                    <div style={{ fontSize: '0.7rem', color: '#15803d', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '4px' }}>Hash: {registerTxHash}</div>
                                </div>
                            )}

                            {registrationStatus === 'error' && (
                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.75rem', borderRadius: '0.25rem' }}>
                                    <strong>Error:</strong> {registrationError}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
