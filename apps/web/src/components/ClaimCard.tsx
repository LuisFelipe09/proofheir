'use client'

import { useState } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { useWallets } from '@privy-io/react-auth'
import { encodeFunctionData, type Address, type Hex } from 'viem'
import { CONTRACTS } from '../config/contracts'

const PROOF_HEIR_ABI = [
    {
        "type": "function",
        "name": "claimInheritance",
        "inputs": [
            { "name": "tokens", "type": "address[]" }
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
    const [tokenAddress, setTokenAddress] = useState(CONTRACTS.MOCK_TOKEN as string)
    const [authJson, setAuthJson] = useState('')

    const [nuipInput, setNuipInput] = useState('')
    const [saltInput, setSaltInput] = useState('0x1111111111111111111111111111111111111111111111111111111111111111')

    const [status, setStatus] = useState<'idle' | 'generating' | 'waiting' | 'executing' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [txHash, setTxHash] = useState<string | null>(null)

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

            if (!nuipInput || nuipInput.trim() === '') {
                setErrorMsg('Please enter the NUIP')
                setStatus('error')
                return
            }

            // STEP 1: Generate ZK Proof
            setStatus('generating')

            const recipient = connectedAddress as Address

            const proofRes = await fetch('/api/generate-proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: recipient,
                    nuip: nuipInput,
                    salt: saltInput,
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

            // STEP 3: Call claimInheritance
            setStatus('executing')

            let authorization
            if (authJson && !authJson.trim().startsWith('{')) {
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
                }
            }

            const tokens = [tokenAddress as Address]

            const data = encodeFunctionData({
                abi: PROOF_HEIR_ABI,
                functionName: 'claimInheritance',
                args: [tokens]
            })

            const provider = await embeddedWallet.getEthereumProvider()

            const txParams: any = {
                from: embeddedWallet.address,
                to: testatorAddress,
                data
            }

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
            setErrorMsg(e.message || 'Claim execution error')
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
            {/* Info Banner */}
            <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-indigo-200">
                        <strong>Two-Step Process:</strong> First, generate ZK proof (auto-registers heir on-chain). Then, execute claim to transfer assets.
                    </div>
                </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Testator Address
                    </label>
                    <input
                        type="text"
                        value={testatorAddress}
                        onChange={(e) => setTestatorAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Token Address
                    </label>
                    <input
                        type="text"
                        value={tokenAddress}
                        onChange={(e) => setTokenAddress(e.target.value)}
                        className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            NUIP (ID Number)
                        </label>
                        <input
                            type="text"
                            value={nuipInput}
                            onChange={(e) => setNuipInput(e.target.value)}
                            placeholder="123456789"
                            className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Salt (Hex)
                        </label>
                        <input
                            type="text"
                            value={saltInput}
                            onChange={(e) => setSaltInput(e.target.value)}
                            placeholder="0x1111..."
                            className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        EIP-7702 Authorization (JSON) <span className="text-slate-500 font-normal">- Optional</span>
                    </label>
                    <textarea
                        value={authJson}
                        onChange={(e) => setAuthJson(e.target.value)}
                        placeholder='{"address": "0x...", "r": "0x...", ...}'
                        className="w-full p-3 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all h-24 resize-none"
                    />
                </div>
            </div>

            {/* Submit Button */}
            <button
                onClick={handleClaim}
                disabled={status === 'generating' || status === 'waiting' || status === 'executing'}
                className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${status === 'success'
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/25'
                        : status === 'error'
                            ? 'bg-gradient-to-r from-rose-600 to-rose-500'
                            : status !== 'idle'
                                ? 'bg-indigo-500/50 cursor-wait'
                                : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/25'
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
                        Waiting for On-Chain Registration...
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
                {status === 'idle' && (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Execute Claim
                    </>
                )}
                {status === 'success' && (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Claim Successful!
                    </>
                )}
                {status === 'error' && 'Retry Claim'}
            </button>

            {/* Success Message */}
            {status === 'success' && txHash && (
                <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <strong>Success!</strong>
                    </div>
                    <div className="text-xs text-emerald-300/80 font-mono break-all">
                        Transaction: {txHash}
                    </div>
                </div>
            )}

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
        </div>
    )
}
