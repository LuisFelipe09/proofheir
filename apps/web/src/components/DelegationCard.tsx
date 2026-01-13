'use client'

import { useState, useEffect } from 'react'
import { usePrivy, useSign7702Authorization, useWallets } from '@privy-io/react-auth'
import { usePublicClient } from 'wagmi'
import { encodeFunctionData, type Address, type Hex } from 'viem'
import { CONTRACTS } from '../config/contracts'
import { activeChain } from '../config/wagmi'
import { emailToSalt, isValidEmail } from '../lib/utils'
import { TokenSelector } from './TokenSelector'

const PROOF_HEIR_ADDRESS = CONTRACTS.PROOF_HEIR

export function DelegationCard() {
    const { authenticated, createWallet } = usePrivy()
    const { signAuthorization } = useSign7702Authorization()
    const { wallets } = useWallets()
    const publicClient = usePublicClient()

    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')

    // Multi-token state
    const [selectedTokens, setSelectedTokens] = useState<string[]>([])

    // Heir info (email replaces salt)
    const [heirEmail, setHeirEmail] = useState('')
    const [nuipInput, setNuipInput] = useState('')

    // Stepper state - 4 steps: 0=Welcome, 1=Assets, 2=Activate(delegation), 3=Register(identity)
    const [currentStep, setCurrentStep] = useState(0)

    // Process states
    const [delegationStatus, setDelegationStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle')
    const [delegationError, setDelegationError] = useState('')
    const [installTxHash, setInstallTxHash] = useState<string | null>(null)
    const [isDelegated, setIsDelegated] = useState<boolean>(false)

    const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle')
    const [registrationError, setRegistrationError] = useState('')
    const [registerTxHash, setRegisterTxHash] = useState<string | null>(null)

    const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy')

    // Check delegation status and if delegated to CURRENT contract
    useEffect(() => {
        const checkDelegation = async () => {
            if (!embeddedWallet || !publicClient) return
            try {
                const code = await publicClient.getBytecode({
                    address: embeddedWallet.address as Address
                })

                // Check if delegated (has EIP-7702 prefix)
                const hasDelegation = code?.startsWith('0xef0100') ?? false

                // Check if delegated to the CURRENT contract (not an old one)
                // EIP-7702 delegation code format: 0xef0100 + 20 bytes address
                if (hasDelegation && code && code.length >= 46) {
                    const delegatedTo = '0x' + code.slice(8, 48).toLowerCase()
                    const currentContract = PROOF_HEIR_ADDRESS.toLowerCase()

                    // Only consider "delegated" if it's to the current contract
                    const delegatedToCurrentContract = delegatedTo === currentContract
                    setIsDelegated(delegatedToCurrentContract)

                    if (!delegatedToCurrentContract) {
                        console.log('Wallet delegated to OLD contract:', delegatedTo, 'Current:', currentContract)
                    }
                } else {
                    setIsDelegated(false)
                }

                // Auto-advance to step 3 if already delegated to current contract
                if (isDelegated && currentStep === 2 && delegationStatus !== 'success') {
                    setDelegationStatus('success')
                }
            } catch (e) {
                // Error checking delegation
            }
        }
        checkDelegation()
        const interval = setInterval(checkDelegation, 5000)
        return () => clearInterval(interval)
    }, [embeddedWallet, publicClient, currentStep, delegationStatus, isDelegated])

    // Token selection is now handled by TokenSelector component

    const handleDelegate = async () => {
        if (!authenticated || !embeddedWallet) {
            setDelegationError('Connect your wallet first')
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
                chainId: activeChain.id,
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
            setCurrentStep(3) // Move to Register Identity step

        } catch (e: any) {
            setDelegationError(e.message || 'Delegation error')
            setDelegationStatus('error')
        }
    }

    const handleRegister = async () => {
        if (!authenticated || !embeddedWallet || !nuipInput || !heirEmail) {
            setRegistrationError('Please fill all fields')
            setRegistrationStatus('error')
            return
        }

        if (!isValidEmail(heirEmail)) {
            setRegistrationError('Please enter a valid email address')
            setRegistrationStatus('error')
            return
        }

        try {
            setRegistrationStatus('executing')
            setRegistrationError('')

            if (!publicClient) throw new Error('Public client not available')

            // Convert email to salt
            const salt = await emailToSalt(heirEmail)

            const nuipBytes = new TextEncoder().encode(nuipInput)
            const nuipPadded = new Uint8Array(15)
            nuipPadded.set(nuipBytes.slice(0, Math.min(nuipBytes.length, 15)))

            const saltBytes = new Uint8Array(
                salt.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
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

            const txParams = {
                from: embeddedWallet.address,
                to: embeddedWallet.address,
                data: calldata
            }

            // First estimate gas to catch errors early
            let gasEstimate: string
            try {
                gasEstimate = await provider.request({
                    method: 'eth_estimateGas',
                    params: [txParams]
                }) as string
                console.log('Gas estimate for registerIdentity:', gasEstimate)
            } catch (gasError: any) {
                console.warn('Gas estimation failed:', gasError)
                throw new Error(`Transaction would fail: ${gasError?.message || 'Contract call reverted'}`)
            }

            console.log('Sending registerIdentity transaction:', txParams)

            const registerTx = await provider.request({
                method: 'eth_sendTransaction',
                params: [{ ...txParams, gas: gasEstimate }]
            })

            console.log('Transaction hash:', registerTx)

            await publicClient.waitForTransactionReceipt({ hash: registerTx as `0x${string}` })
            setRegisterTxHash(registerTx as string)

            // Save inheritance registry to Upstash (heir email -> testator wallet)
            try {
                await fetch('/api/inheritance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        heirEmail: heirEmail,
                        testatorWallet: embeddedWallet.address
                    })
                })
                console.log('Inheritance registry saved for heir:', heirEmail)
            } catch (registryError) {
                console.warn('Failed to save inheritance registry:', registryError)
                // Don't fail the whole flow if registry fails
            }

            setRegistrationStatus('success')

        } catch (e: any) {
            console.warn('Registration error:', e)
            // Check if user rejected the transaction
            if (e?.code === 4001 || e?.message?.includes('rejected') || e?.message?.includes('denied')) {
                setRegistrationError('Transaction was rejected by user')
            } else {
                setRegistrationError(e.message || 'Registration error')
            }
            setRegistrationStatus('error')
        }
    }

    // CORRECTED STEP ORDER:
    // 0: Welcome
    // 1: Select Assets (tokens)
    // 2: Activate Plan (EIP-7702 delegation FIRST)
    // 3: Register Identity (NUIP + email AFTER delegation)

    const steps = [
        { id: 'welcome', title: 'Welcome' },
        { id: 'assets', title: 'Select Assets' },
        { id: 'activate', title: 'Activate Plan' },
        { id: 'register', title: 'Register Identity' }
    ]

    // STEP 0: WELCOME
    if (currentStep === 0) {
        return (
            <div className="w-full">
                <StepIndicator steps={steps} currentStep={currentStep} />

                <div className="text-center py-8">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center">
                        <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Secure Your Digital Legacy</h3>
                    <p className="text-slate-400 max-w-md mx-auto mb-8">
                        ProofHeir uses cutting-edge blockchain technology to ensure your digital assets are passed on to your chosen heir securely and privately.
                    </p>

                    {!authenticated ? (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                            <p className="text-amber-300 text-sm">
                                Please connect your wallet using the button in the header to continue.
                            </p>
                        </div>
                    ) : !hasEmbeddedWallet ? (
                        <button
                            onClick={createWallet}
                            className="w-full max-w-xs mx-auto bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-purple-500/25"
                        >
                            Create Secure Wallet
                        </button>
                    ) : (
                        <button
                            onClick={() => setCurrentStep(1)}
                            className="w-full max-w-xs mx-auto bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
                        >
                            Begin Setup
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // STEP 1: SELECT ASSETS
    if (currentStep === 1) {
        return (
            <div className="w-full">
                <StepIndicator steps={steps} currentStep={currentStep} />

                {/* Token Selector Component */}
                <TokenSelector
                    selectedTokens={selectedTokens}
                    onTokensChange={setSelectedTokens}
                    userAddress={embeddedWallet?.address}
                    mode="delegation"
                />

                {/* Navigation */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => setCurrentStep(0)}
                        className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-400 border border-white/10 hover:bg-slate-700/50 transition-colors"
                    >
                        Back
                    </button>
                    <button
                        onClick={() => setCurrentStep(2)}
                        disabled={selectedTokens.length === 0}
                        className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25"
                    >
                        Continue
                    </button>
                </div>
            </div>
        )
    }

    // STEP 2: ACTIVATE PLAN (EIP-7702 Delegation) - NOW COMES BEFORE IDENTITY REGISTRATION
    if (currentStep === 2) {
        return (
            <div className="w-full">
                <StepIndicator steps={steps} currentStep={currentStep} />

                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Activate Your Plan</h3>
                    <p className="text-slate-400 text-sm">Enable the inheritance smart contract on your wallet using EIP-7702.</p>
                </div>

                {/* What this does */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm text-blue-200">
                            <strong>What happens:</strong> Your wallet will be enhanced with inheritance capabilities. This is a one-time setup that allows the claim contract to manage asset transfers.
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-slate-700/30 rounded-xl p-4 mb-6">
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Plan Summary</h4>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Tokens included:</span>
                            <span className="text-white">{selectedTokens.length} selected</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Contract:</span>
                            <span className="text-white font-mono text-xs">{PROOF_HEIR_ADDRESS.slice(0, 10)}...</span>
                        </div>
                    </div>
                </div>

                {/* Delegation Button */}
                {isDelegated || delegationStatus === 'success' ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-medium text-white">Plan Activated!</h4>
                                <p className="text-xs text-emerald-400">EIP-7702 delegation successful</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={handleDelegate}
                        disabled={delegationStatus === 'executing'}
                        className="w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-wait transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 mb-6"
                    >
                        {delegationStatus === 'executing' ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Activating...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Activate Plan
                            </>
                        )}
                    </button>
                )}

                {delegationError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-6">
                        <p className="text-rose-400 text-sm">{delegationError}</p>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex gap-3">
                    <button
                        onClick={() => setCurrentStep(1)}
                        className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-400 border border-white/10 hover:bg-slate-700/50 transition-colors"
                    >
                        Back
                    </button>
                    <button
                        onClick={() => setCurrentStep(3)}
                        disabled={!isDelegated && delegationStatus !== 'success'}
                        className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25"
                    >
                        Continue
                    </button>
                </div>
            </div>
        )
    }

    // STEP 3: REGISTER IDENTITY (NUIP + Email) - NOW COMES AFTER DELEGATION
    return (
        <div className="w-full">
            <StepIndicator steps={steps} currentStep={currentStep} />

            {registrationStatus === 'success' ? (
                // SUCCESS STATE
                <div className="text-center py-8">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Inheritance Plan Complete!</h3>
                    <p className="text-slate-400 max-w-md mx-auto mb-6">
                        Your digital legacy is now protected. Your heir can claim the assets using their email and your NUIP.
                    </p>

                    <div className="bg-slate-700/50 rounded-xl p-4 max-w-sm mx-auto space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Assets included:</span>
                            <span className="text-white font-medium">{selectedTokens.length} token(s)</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Heir:</span>
                            <span className="text-white font-medium">{heirEmail}</span>
                        </div>
                        {registerTxHash && (
                            <div className="flex justify-between text-xs pt-2 border-t border-white/10">
                                <span className="text-slate-500">Tx:</span>
                                <span className="text-emerald-400 font-mono">{registerTxHash.slice(0, 12)}...</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-white mb-2">Register Heir Identity</h3>
                        <p className="text-slate-400 text-sm">Enter your heir's information to complete the setup.</p>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Heir's Email Address
                            </label>
                            <input
                                type="email"
                                value={heirEmail}
                                onChange={(e) => setHeirEmail(e.target.value)}
                                placeholder="heir@example.com"
                                className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Your heir will use this email to identify themselves when claiming.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Your NUIP (National ID Number)
                            </label>
                            <input
                                type="text"
                                value={nuipInput}
                                onChange={(e) => setNuipInput(e.target.value)}
                                placeholder="e.g. 12345678"
                                className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Used for ZK proof verification. Never stored on-chain.
                            </p>
                        </div>
                    </div>

                    {/* Info Banner */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="text-sm text-amber-200">
                                <strong>Important:</strong> Share these details securely with your heir. They will need both the email and NUIP to claim the inheritance.
                            </div>
                        </div>
                    </div>

                    {/* Register Button */}
                    <button
                        onClick={handleRegister}
                        disabled={registrationStatus === 'executing' || !heirEmail || !nuipInput || !isValidEmail(heirEmail)}
                        className="w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 disabled:cursor-wait transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 mb-6"
                    >
                        {registrationStatus === 'executing' ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Registering...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Complete Setup
                            </>
                        )}
                    </button>

                    {registrationError && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-6">
                            <p className="text-rose-400 text-sm">{registrationError}</p>
                        </div>
                    )}

                    {/* Back Button */}
                    <button
                        onClick={() => setCurrentStep(2)}
                        className="w-full py-3 px-4 rounded-xl font-medium text-slate-400 border border-white/10 hover:bg-slate-700/50 transition-colors"
                    >
                        Back
                    </button>
                </>
            )}
        </div>
    )
}

// Step Indicator Component - Mobile Optimized
function StepIndicator({ steps, currentStep }: { steps: { id: string; title: string }[]; currentStep: number }) {
    // Short labels for mobile
    const mobileLabels: Record<string, string> = {
        'Welcome': 'Start',
        'Select Assets': 'Assets',
        'Activate Plan': 'Activate',
        'Register Identity': 'Register'
    }

    return (
        <nav aria-label="Progress" className="mb-6 sm:mb-8">
            <ol className="flex items-start justify-between relative px-2 sm:px-0">
                {/* Progress line background */}
                <div className="absolute top-4 sm:top-5 left-6 right-6 sm:left-5 sm:right-5 h-0.5 bg-slate-700" aria-hidden="true" />
                {/* Progress line fill */}
                <div
                    className="absolute top-4 sm:top-5 left-6 sm:left-5 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `calc(${(currentStep / (steps.length - 1)) * 100}% - 24px)` }}
                    aria-hidden="true"
                />
                {steps.map((step, index) => (
                    <li key={step.id} className="relative flex flex-col items-center z-10 flex-1">
                        <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 ${index < currentStep
                                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30'
                                : index === currentStep
                                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30 ring-2 sm:ring-4 ring-cyan-500/20'
                                    : 'bg-slate-700 text-slate-400'
                                }`}
                            aria-current={index === currentStep ? 'step' : undefined}
                        >
                            {index < currentStep ? (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <span aria-hidden="true">{index + 1}</span>
                            )}
                            <span className="sr-only">Step {index + 1}: {step.title} {index < currentStep ? '(Completed)' : ''}</span>
                        </div>
                        <span className={`mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-medium text-center leading-tight max-w-[60px] sm:max-w-none ${index <= currentStep ? 'text-white' : 'text-slate-500'
                            }`}
                            aria-hidden="true"
                        >
                            <span className="sm:hidden">{mobileLabels[step.title] || step.title}</span>
                            <span className="hidden sm:inline">{step.title}</span>
                        </span>
                    </li>
                ))}
            </ol>
        </nav>
    )
}
