'use client'

import { useState, useEffect } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { encodeFunctionData, type Address } from 'viem'
import { CONTRACTS } from '../config/contracts'
import { emailToSalt, isValidEmail } from '../lib/utils'
import { TokenSelector } from './TokenSelector'
import { ClaimSuccess } from './ClaimSuccess'

const PROOF_HEIR_ABI = [
    {
        "type": "function",
        "name": "claimInheritance",
        "inputs": [
            { "name": "tokens", "type": "address[]" }
        ],
        "outputs": [],
        "stateMutability": "external"
    },
    {
        "type": "function",
        "name": "getRegisteredHeir",
        "inputs": [],
        "outputs": [{ "name": "", "type": "address" }],
        "stateMutability": "view"
    }
] as const

export function ClaimCard() {
    const { address: connectedAddress, isConnected } = useAccount()
    const { user } = usePrivy()
    const { wallets } = useWallets()
    const publicClient = usePublicClient()

    // Get email from Privy user (auto-filled from login)
    const userEmail = user?.email?.address || ''

    const [testatorAddress, setTestatorAddress] = useState('')
    const [inheritanceLookupDone, setInheritanceLookupDone] = useState(false)
    const [foundInheritance, setFoundInheritance] = useState(false)

    // Multi-token support
    const [tokenAddresses, setTokenAddresses] = useState<string[]>([])

    // NUIP still needs manual input (only required if heir not registered)
    const [nuipInput, setNuipInput] = useState('')

    // Heir registration status
    const [registeredHeir, setRegisteredHeir] = useState<string | null>(null)
    const [isHeirRegistered, setIsHeirRegistered] = useState(false)
    const [checkingHeir, setCheckingHeir] = useState(false)

    const [status, setStatus] = useState<'idle' | 'checking' | 'generating' | 'waiting' | 'executing' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [txHash, setTxHash] = useState<string | null>(null)

    // Life status check
    const [lifeStatus, setLifeStatus] = useState<'unknown' | 'alive' | 'deceased' | 'checking' | 'error'>('unknown')
    const [togglingStatus, setTogglingStatus] = useState(false)

    // Check life status when NUIP field loses focus
    const checkLifeStatus = async (nuip: string) => {
        if (!nuip || nuip.trim() === '') {
            setLifeStatus('unknown')
            return
        }

        setLifeStatus('checking')
        try {
            const response = await fetch(`/api/check-status?nuip=${encodeURIComponent(nuip)}`)
            const data = await response.json()

            if (data.found) {
                setLifeStatus(data.isAlive ? 'alive' : 'deceased')
            } else {
                setLifeStatus('error')
            }
        } catch (e) {
            console.warn('Life status check failed:', e)
            setLifeStatus('error')
        }
    }

    // Toggle status for MVP testing
    const handleToggleStatus = async () => {
        if (!nuipInput || togglingStatus || lifeStatus === 'checking' || lifeStatus === 'unknown' || lifeStatus === 'error') return

        setTogglingStatus(true)
        try {
            const response = await fetch('/api/toggle-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nuip: nuipInput, currentStatus: lifeStatus })
            })
            const data = await response.json()

            if (data.success) {
                setLifeStatus(data.isAlive ? 'alive' : 'deceased')
            }
        } catch (e) {
            console.warn('Toggle status failed:', e)
        } finally {
            setTogglingStatus(false)
        }
    }

    // Auto-lookup inheritance registry when user is logged in
    useEffect(() => {
        const lookupInheritance = async () => {
            if (!userEmail || inheritanceLookupDone) return

            try {
                const response = await fetch(`/api/inheritance?email=${encodeURIComponent(userEmail)}`)
                const data = await response.json()

                if (data.found && data.testatorWallet) {
                    setTestatorAddress(data.testatorWallet)
                    setFoundInheritance(true)
                    console.log('Found inheritance from:', data.testatorWallet)
                }
            } catch (e) {
                console.warn('Inheritance lookup failed:', e)
            } finally {
                setInheritanceLookupDone(true)
            }
        }

        lookupInheritance()
    }, [userEmail, inheritanceLookupDone])

    // Check if heir is already registered when testator address changes
    useEffect(() => {
        const checkHeirStatus = async () => {
            if (!testatorAddress || !testatorAddress.startsWith('0x') || testatorAddress.length !== 42 || !publicClient) {
                setRegisteredHeir(null)
                setIsHeirRegistered(false)
                return
            }

            setCheckingHeir(true)
            try {
                const heir = await publicClient.readContract({
                    address: testatorAddress as Address,
                    abi: PROOF_HEIR_ABI,
                    functionName: 'getRegisteredHeir',
                })

                const heirAddress = heir as string
                setRegisteredHeir(heirAddress)

                // Check if the connected address is the registered heir
                if (heirAddress && heirAddress !== '0x0000000000000000000000000000000000000000' && connectedAddress) {
                    setIsHeirRegistered(heirAddress.toLowerCase() === connectedAddress.toLowerCase())
                } else {
                    setIsHeirRegistered(false)
                }
            } catch (e) {
                console.log('Could not check heir status:', e)
                setRegisteredHeir(null)
                setIsHeirRegistered(false)
            } finally {
                setCheckingHeir(false)
            }
        }

        checkHeirStatus()
    }, [testatorAddress, connectedAddress, publicClient])

    // Token selection is now handled by TokenSelector component

    const handleClaim = async () => {
        const embeddedWallet = wallets.find(w => w.walletClientType === 'privy') || wallets.find(w => w.address === connectedAddress)

        if (!embeddedWallet) {
            setErrorMsg('Privy wallet not found')
            setStatus('error')
            return
        }

        try {
            if (!testatorAddress || testatorAddress.trim() === '') {
                setErrorMsg('Please enter the testator address')
                setStatus('error')
                return
            }

            if (tokenAddresses.length === 0) {
                setErrorMsg('Please add at least one token to claim')
                setStatus('error')
                return
            }

            // If heir is already registered and it's the connected wallet, skip ZK proof
            if (isHeirRegistered) {
                console.log('Heir already registered, skipping ZK proof generation')
                setStatus('executing')
            } else {
                // Need to generate ZK proof first
                if (!userEmail || !isValidEmail(userEmail)) {
                    setErrorMsg('Your account email is required. Please log in with email.')
                    setStatus('error')
                    return
                }

                if (!nuipInput || nuipInput.trim() === '') {
                    setErrorMsg('Please enter the NUIP')
                    setStatus('error')
                    return
                }

                // STEP 1: Generate ZK Proof
                setStatus('generating')

                const recipient = connectedAddress as Address

                // Convert email to salt (using the logged-in user's email)
                const salt = await emailToSalt(userEmail)

                const proofRes = await fetch('/api/generate-proof', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipient: recipient,
                        nuip: nuipInput,
                        salt: salt,
                        testator_address: testatorAddress,
                    }),
                })

                if (!proofRes.ok) {
                    const errorData = await proofRes.json()
                    throw new Error(errorData.error || 'Failed to generate proof')
                }

                const proofData = await proofRes.json()

                // STEP 2: Wait for heir registration
                setStatus('waiting')
                await new Promise(resolve => setTimeout(resolve, 3000))

                setStatus('executing')
            }

            // STEP 3: Call claimInheritance
            const tokens = tokenAddresses.map(t => t as Address)

            const data = encodeFunctionData({
                abi: PROOF_HEIR_ABI,
                functionName: 'claimInheritance',
                args: [tokens]
            })

            const provider = await embeddedWallet.getEthereumProvider()

            // First estimate gas to catch errors early
            let gasEstimate: string
            try {
                gasEstimate = await provider.request({
                    method: 'eth_estimateGas',
                    params: [{
                        from: embeddedWallet.address,
                        to: testatorAddress,
                        data
                    }]
                }) as string
                console.log('Gas estimate:', gasEstimate)
            } catch (gasError: any) {
                console.warn('Gas estimation failed:', gasError)
                throw new Error(`Transaction would fail: ${gasError?.message || 'Contract call reverted'}`)
            }

            const txParams = {
                from: embeddedWallet.address,
                to: testatorAddress,
                data,
                gas: gasEstimate
            }

            console.log('Sending transaction:', txParams)

            const hash = await provider.request({
                method: 'eth_sendTransaction',
                params: [txParams]
            }) as string

            console.log('Transaction hash:', hash)
            setTxHash(hash)
            setStatus('success')
        } catch (e: any) {
            console.warn('Claim error:', e)
            // Check if user rejected the transaction
            if (e?.code === 4001 || e?.message?.includes('rejected') || e?.message?.includes('denied')) {
                setErrorMsg('Transaction was rejected by user')
            } else {
                setErrorMsg(e.message || 'Claim execution error')
            }
            setStatus('error')
        }
    }

    if (!isConnected) return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Wallet Connection Required</h3>
            <p className="text-slate-400 text-sm max-w-sm">Please connect your wallet to claim your inheritance.</p>
        </div>
    )

    return (
        <div className="w-full">
            {status === 'success' ? (
                // SUCCESS STATE - Show balances and transfer options
                <ClaimSuccess
                    claimedTokens={tokenAddresses}
                    txHash={txHash}
                    userAddress={connectedAddress || ''}
                />
            ) : (
                <>
                    {/* Your Email Banner - Auto-detected */}
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <div>
                                <div className="text-sm text-emerald-200 font-medium">Claiming as: {userEmail}</div>
                                <div className="text-xs text-slate-400">This email will be used to verify your identity</div>
                            </div>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Testator's Wallet Address
                                {foundInheritance && (
                                    <span className="ml-2 text-xs text-emerald-400 font-normal">
                                        ✓ Auto-detected
                                    </span>
                                )}
                            </label>
                            <input
                                type="text"
                                value={testatorAddress}
                                onChange={(e) => {
                                    setTestatorAddress(e.target.value)
                                    setFoundInheritance(false) // Clear auto-detect flag on manual edit
                                }}
                                placeholder="0x..."
                                className={`w-full p-3 bg-slate-700/50 border rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${foundInheritance ? 'border-emerald-500/30' : 'border-white/10'
                                    }`}
                            />
                            {foundInheritance && (
                                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    We found an inheritance registered for your email
                                </p>
                            )}
                            {/* Heir Status Indicator */}
                            {testatorAddress && testatorAddress.length === 42 && (
                                <div className="mt-2">
                                    {checkingHeir ? (
                                        <p className="text-xs text-slate-400 flex items-center gap-2">
                                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                            </svg>
                                            Checking heir status...
                                        </p>
                                    ) : isHeirRegistered ? (
                                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                            <p className="text-xs text-emerald-300 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                You are already registered as heir! No ZK proof needed.
                                            </p>
                                        </div>
                                    ) : registeredHeir && registeredHeir !== '0x0000000000000000000000000000000000000000' ? (
                                        <p className="text-xs text-amber-400">
                                            ⚠️ Another heir is registered: {registeredHeir.slice(0, 10)}...
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        {/* Token Selector */}
                        <div>
                            <TokenSelector
                                selectedTokens={tokenAddresses}
                                onTokensChange={setTokenAddresses}
                                userAddress={testatorAddress || undefined}
                                mode="claim"
                            />
                        </div>

                        {/* NUIP - Only show if heir not already registered */}
                        {!isHeirRegistered && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Testator's NUIP (ID Number)
                                </label>
                                <input
                                    type="text"
                                    value={nuipInput}
                                    onChange={(e) => {
                                        setNuipInput(e.target.value)
                                        setLifeStatus('unknown') // Reset on change
                                    }}
                                    onBlur={() => checkLifeStatus(nuipInput)}
                                    placeholder="e.g. 12345678"
                                    className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    The testator should have shared this with you.
                                </p>

                                {/* Life Status Indicator */}
                                {lifeStatus === 'checking' && (
                                    <div className="mt-3 p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg">
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                            </svg>
                                            Checking civil registry...
                                        </div>
                                    </div>
                                )}

                                {(lifeStatus === 'alive' || lifeStatus === 'deceased') && (
                                    <div className={`mt-3 p-3 rounded-lg border ${lifeStatus === 'alive'
                                        ? 'bg-amber-500/10 border-amber-500/30'
                                        : 'bg-emerald-500/10 border-emerald-500/30'
                                        }`}>
                                        {/* Current Status Display */}
                                        <div className={`flex items-center gap-2 text-sm mb-2 ${lifeStatus === 'alive' ? 'text-amber-300' : 'text-emerald-300'
                                            }`}>
                                            {lifeStatus === 'alive' ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                            <span className="font-medium">
                                                Current Status: {lifeStatus === 'alive' ? 'ALIVE' : 'DECEASED'}
                                            </span>
                                        </div>

                                        <p className={`text-xs mb-3 ${lifeStatus === 'alive' ? 'text-amber-200/70' : 'text-emerald-200/70'}`}>
                                            {lifeStatus === 'alive'
                                                ? 'Inheritance cannot be claimed for a living person.'
                                                : 'You may proceed with the inheritance claim.'}
                                        </p>

                                        {/* Mark as Deceased Button - Only show when alive */}
                                        {lifeStatus === 'alive' && (
                                            <button
                                                onClick={handleToggleStatus}
                                                disabled={togglingStatus}
                                                className="w-full py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-200"
                                            >
                                                {togglingStatus ? (
                                                    <>
                                                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                                        </svg>
                                                        Updating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                        Mark as Deceased (MVP Testing)
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {/* MVP Info Popup */}
                                        <div className="mt-3 p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <div className="text-[11px] text-indigo-200/80">
                                                    <strong className="text-indigo-300">MVP Testing Mode:</strong> This is a mock civil registry for demonstration purposes.
                                                    In production, this data would come from an official government source and cannot be modified.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {lifeStatus === 'error' && (
                                    <div className="mt-3 p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg">
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Could not verify in registry
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleClaim}
                        disabled={status !== 'idle' && status !== 'error'}
                        className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${status !== 'idle' && status !== 'error'
                            ? 'bg-indigo-500/50 cursor-wait'
                            : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25'
                            }`}
                    >
                        {status === 'generating' && (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating ZK Proof...
                            </>
                        )}
                        {status === 'waiting' && (
                            <>
                                <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Verifying Identity...
                            </>
                        )}
                        {status === 'executing' && (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Transferring Assets...
                            </>
                        )}
                        {(status === 'idle' || status === 'error') && (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                {isHeirRegistered ? 'Claim Inheritance' : 'Verify & Claim'}
                            </>
                        )}
                    </button>

                    {/* Error Message */}
                    {status === 'error' && (
                        <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                            <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="text-sm text-rose-300">{errorMsg}</div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
