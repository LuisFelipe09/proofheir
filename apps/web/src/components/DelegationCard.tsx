'use client'

import { useState, useEffect } from 'react'
import { usePrivy, useSign7702Authorization, useWallets } from '@privy-io/react-auth'
import { useReadContract, usePublicClient } from 'wagmi'
import { formatUnits, encodeFunctionData, type Address, type Hex } from 'viem'
import { CONTRACTS } from '../config/contracts'

const PROOF_HEIR_ADDRESS = CONTRACTS.PROOF_HEIR
const MOCK_TOKEN_ADDRESS = CONTRACTS.MOCK_TOKEN

export function DelegationCard() {
    const { authenticated, createWallet } = usePrivy()
    const { signAuthorization } = useSign7702Authorization()
    const { wallets } = useWallets()
    const publicClient = usePublicClient()

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

    const [delegationStatus, setDelegationStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle')
    const [delegationError, setDelegationError] = useState('')
    const [installTxHash, setInstallTxHash] = useState<string | null>(null)
    const [isDelegated, setIsDelegated] = useState<boolean>(false)

    const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle')
    const [registrationError, setRegistrationError] = useState('')
    const [registerTxHash, setRegisterTxHash] = useState<string | null>(null)
    const [nuipInput, setNuipInput] = useState('')
    const [saltInput, setSaltInput] = useState('0x1111111111111111111111111111111111111111111111111111111111111111')

    const [currentStep, setCurrentStep] = useState(0)

    useEffect(() => {
        const checkDelegation = async () => {
            if (!embeddedWallet || !publicClient) return
            try {
                const code = await publicClient.getBytecode({
                    address: embeddedWallet.address as Address
                })
                const alreadyDelegated = code?.startsWith('0xef0100') ?? false
                setIsDelegated(alreadyDelegated)

                if (alreadyDelegated && currentStep < 1) {
                    setCurrentStep(1)
                    setDelegationStatus('success')
                }
            } catch (e) {
                // Error checking delegation
            }
        }
        checkDelegation()
        const interval = setInterval(checkDelegation, 5000)
        return () => clearInterval(interval)
    }, [embeddedWallet, publicClient, currentStep])

    const handleDelegate = async () => {
        if (!authenticated || !embeddedWallet) {
            setDelegationError('Connect your embedded wallet first')
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
                throw new Error(errorData.error || 'Server delegation error')
            }

            const { hash } = await response.json()
            await publicClient.waitForTransactionReceipt({ hash })
            setInstallTxHash(hash)
            setDelegationStatus('success')
            setCurrentStep(1)

        } catch (e: any) {
            setDelegationError(e.message || 'Delegation error')
            setDelegationStatus('error')
        }
    }

    const handleRegister = async () => {
        if (!authenticated || !embeddedWallet || !nuipInput || !saltInput) {
            setRegistrationError('Please enter NUIP and Salt')
            setRegistrationStatus('error')
            return
        }

        try {
            setRegistrationStatus('executing')
            setRegistrationError('')

            if (!publicClient) throw new Error('Public client not available')

            const nuipBytes = new TextEncoder().encode(nuipInput)
            const nuipPadded = new Uint8Array(15)
            nuipPadded.set(nuipBytes.slice(0, Math.min(nuipBytes.length, 15)))

            const saltBytes = new Uint8Array(
                saltInput.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
            )

            const combined = new Uint8Array(nuipPadded.length + saltBytes.length)
            combined.set(nuipPadded)
            combined.set(saltBytes, nuipPadded.length)

            const identityCommitment = `0x${Array.from(
                new Uint8Array(
                    await crypto.subtle.digest('SHA-256', combined)
                )
            ).map(b => b.toString(16).padStart(2, '0')).join('')}`

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

            const provider = await embeddedWallet.getEthereumProvider()
            const registerTx = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: embeddedWallet.address,
                    to: embeddedWallet.address,
                    data: calldata
                }]
            })

            await publicClient.waitForTransactionReceipt({ hash: registerTx as `0x${string}` })
            setRegisterTxHash(registerTx as string)

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
                setCurrentStep(2)
            } else {
                throw new Error('Identity commitment mismatch!')
            }

        } catch (e: any) {
            setRegistrationError(e.message || 'Registration error')
            setRegistrationStatus('error')
        }
    }

    const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy')

    const steps = [
        { id: 'install', title: 'Install Plan' },
        { id: 'register', title: 'Register Identity' },
        { id: 'complete', title: 'Complete' }
    ]

    if (!authenticated) return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Wallet Connection Required</h3>
            <p className="text-slate-400 text-sm max-w-sm">Please connect your wallet to begin the inheritance configuration process.</p>
        </div>
    )

    return (
        <div className="w-full">
            {/* Balance Display */}
            <div className="mb-6 p-4 bg-slate-700/50 rounded-xl border border-white/10">
                <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm font-medium">Available Balance</span>
                    <span className="font-mono text-lg font-bold text-white">
                        {balanceData !== undefined ? `${formatUnits(balanceData as bigint, 18)} MOCK` : 'Loading...'}
                    </span>
                </div>
            </div>

            {!hasEmbeddedWallet ? (
                <div className="text-center py-8">
                    <p className="text-slate-400 text-sm mb-4">
                        You need a Privy embedded wallet to use ProofHeir features.
                    </p>
                    <button
                        onClick={createWallet}
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-purple-500/25"
                    >
                        Create Embedded Wallet
                    </button>
                </div>
            ) : (
                <>
                    {/* Stepper */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between relative">
                            <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-700" />
                            <div
                                className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                                style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                            />
                            {steps.map((step, index) => (
                                <div key={step.id} className="relative flex flex-col items-center z-10">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${index < currentStep
                                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                                                : index === currentStep
                                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 ring-4 ring-blue-500/20'
                                                    : 'bg-slate-700 text-slate-400'
                                            }`}
                                    >
                                        {index < currentStep ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            index + 1
                                        )}
                                    </div>
                                    <span className={`mt-2 text-xs font-medium ${index <= currentStep ? 'text-white' : 'text-slate-500'
                                        }`}>
                                        {step.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step Content */}
                    <div className="min-h-[280px]">
                        {/* STEP 1: INSTALL */}
                        {currentStep === 0 && (
                            <div className="space-y-4 animate-fadeIn">
                                <div className="bg-slate-700/30 p-5 rounded-xl border border-white/5">
                                    <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        Enable EIP-7702 Delegation
                                    </h4>
                                    <p className="text-sm text-slate-400 mb-4">
                                        This transaction authorizes the ProofHeir contract to manage your account for inheritance purposes.
                                    </p>

                                    <button
                                        onClick={handleDelegate}
                                        disabled={delegationStatus === 'executing'}
                                        className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${delegationStatus === 'executing'
                                                ? 'bg-blue-600/50 cursor-wait'
                                                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/25'
                                            }`}
                                    >
                                        {delegationStatus === 'executing' ? (
                                            <>
                                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Processing...
                                            </>
                                        ) : (
                                            <>Sign & Install Delegation</>
                                        )}
                                    </button>

                                    {delegationError && (
                                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-start gap-2">
                                            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>{delegationError}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* STEP 2: REGISTER */}
                        {currentStep === 1 && (
                            <div className="space-y-4 animate-fadeIn">
                                <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 mb-4">
                                    <h4 className="font-semibold text-amber-300 mb-1 text-sm">Setup Identity Secrets</h4>
                                    <p className="text-xs text-amber-200/70">
                                        These values are hashed to create your identity commitment. Keep them safe.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            NUIP (ID Number)
                                        </label>
                                        <input
                                            type="text"
                                            value={nuipInput}
                                            onChange={(e) => setNuipInput(e.target.value)}
                                            placeholder="e.g. 12345678"
                                            className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Secret Salt (Hex)
                                        </label>
                                        <input
                                            type="text"
                                            value={saltInput}
                                            onChange={(e) => setSaltInput(e.target.value)}
                                            placeholder="0x..."
                                            className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleRegister}
                                    disabled={registrationStatus === 'executing'}
                                    className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white transition-all mt-2 ${registrationStatus === 'executing'
                                            ? 'bg-amber-600/50 cursor-wait'
                                            : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-500/25'
                                        }`}
                                >
                                    {registrationStatus === 'executing' ? 'Registering...' : 'Register Identity'}
                                </button>

                                {registrationError && (
                                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                                        <strong>Error:</strong> {registrationError}
                                    </div>
                                )}

                                {installTxHash && (
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <div className="text-xs text-green-400 flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>Delegation: {installTxHash.slice(0, 12)}...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 3: COMPLETE */}
                        {currentStep === 2 && (
                            <div className="flex flex-col items-center justify-center py-8 text-center bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl border border-green-500/20 animate-fadeIn">
                                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
                                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Configuration Complete!</h3>
                                <p className="text-slate-400 mb-6 max-w-sm text-sm">
                                    Your account is now delegated and your identity is registered. ProofHeir will protect your assets.
                                </p>

                                <div className="w-full max-w-xs space-y-2">
                                    {installTxHash && (
                                        <div className="flex justify-between text-xs p-3 bg-slate-800/50 rounded-lg border border-white/10">
                                            <span className="text-slate-500">Delegation</span>
                                            <span className="font-mono text-green-400">{installTxHash.slice(0, 10)}...</span>
                                        </div>
                                    )}
                                    {registerTxHash && (
                                        <div className="flex justify-between text-xs p-3 bg-slate-800/50 rounded-lg border border-white/10">
                                            <span className="text-slate-500">Identity</span>
                                            <span className="font-mono text-green-400">{registerTxHash.slice(0, 10)}...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
