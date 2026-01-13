'use client'

import { WalletConnect } from '../components/WalletConnect'
import { DelegationCard } from '../components/DelegationCard'
import { ClaimCard } from '../components/ClaimCard'
import { DevFaucet } from '../components/DevFaucet'
import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { activeChain } from '../config/wagmi'

type UserRole = 'none' | 'testator' | 'heir'

export default function Page() {
  const { authenticated } = usePrivy()
  const [selectedRole, setSelectedRole] = useState<UserRole>('none')

  // If not authenticated or no role selected, show landing
  const showLanding = !authenticated || selectedRole === 'none'

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans">
      {/* Header */}
      <header className="w-full border-b border-white/10 backdrop-blur-sm bg-slate-900/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo + Brand */}
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer flex-shrink-0" onClick={() => setSelectedRole('none')}>
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-white font-bold text-base sm:text-lg">P</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg sm:text-xl tracking-tight">ProofHeir</span>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full hidden sm:inline">Beta</span>
              </div>
            </div>

            {/* Navigation - Desktop (centered absolutely) */}
            {showLanding && (
              <nav className="hidden lg:flex items-center gap-8 text-sm text-slate-400 absolute left-1/2 -translate-x-1/2">
                <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
                <a href="#features" className="hover:text-white transition-colors">Features</a>
                <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              </nav>
            )}

            {/* Right Section */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Network Badge - Compact on mobile */}
              <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${activeChain.id === 31337
                ? 'bg-amber-500/20 text-amber-300'
                : activeChain.id === 5003
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                <span className="hidden sm:inline">{activeChain.name}</span>
                <span className="sm:hidden">{activeChain.id === 31337 ? 'Local' : activeChain.id === 5003 ? 'Mantle' : 'Net'}</span>
              </span>

              {/* Dev Faucet - Hidden on mobile */}
              <div className="hidden md:block">
                <DevFaucet />
              </div>

              {/* Wallet Connect */}
              <WalletConnect />

              {/* Mobile Menu Button */}
              {showLanding && (
                <button
                  className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  onClick={() => {
                    const mobileMenu = document.getElementById('mobile-menu');
                    if (mobileMenu) {
                      mobileMenu.classList.toggle('hidden');
                    }
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {showLanding && (
            <nav id="mobile-menu" className="hidden lg:hidden mt-4 pt-4 border-t border-white/10">
              <div className="flex flex-col gap-3 text-sm text-slate-400">
                <a href="#how-it-works" className="hover:text-white transition-colors py-2">How It Works</a>
                <a href="#features" className="hover:text-white transition-colors py-2">Features</a>
                <a href="#pricing" className="hover:text-white transition-colors py-2">Pricing</a>
                {/* Show DevFaucet on mobile menu */}
                <div className="md:hidden py-2">
                  <DevFaucet />
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1 w-full">
        {showLanding ? (
          // LANDING PAGE
          <div className="max-w-5xl mx-auto px-6 py-12">
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                <span className="text-sm text-blue-300">Powered by EIP-7702 & Zero-Knowledge Proofs</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight">
                <span className="bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
                  Secure Your
                </span>
                <br />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  Digital Legacy
                </span>
              </h1>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
                Your crypto assets, protected for generations. Set up your inheritance plan with privacy-preserving technology.
              </p>

              {/* EIP-7702 Value Proposition */}
              <div className="max-w-2xl mx-auto mb-12">
                <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-slate-200 leading-relaxed">
                        <span className="font-semibold text-white">Your assets never leave your wallet while you're alive.</span>{' '}
                        We use <span className="text-blue-400 font-medium">EIP-7702</span> to delegate transfer permissions from your EOA only at the moment of execution.
                      </p>
                      <p className="text-sm text-slate-400 mt-2">
                        The most secure and least intrusive inheritance solution on the market.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Role Selection Cards */}
              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16">
                {/* Leave Inheritance Card */}
                <button
                  onClick={() => setSelectedRole('testator')}
                  className="group p-6 sm:p-8 bg-slate-800/50 hover:bg-slate-800/80 border border-white/10 hover:border-blue-500/50 rounded-2xl text-left transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/25">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Leave an Inheritance</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Protect your digital assets and designate an heir who can claim them securely.
                  </p>
                  <span className="inline-flex items-center gap-2 text-blue-400 text-sm font-medium group-hover:gap-3 transition-all">
                    Create My Plan
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </button>

                {/* Claim Inheritance Card */}
                <button
                  onClick={() => setSelectedRole('heir')}
                  className="group p-6 sm:p-8 bg-slate-800/50 hover:bg-slate-800/80 border border-white/10 hover:border-indigo-500/50 rounded-2xl text-left transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/25">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Claim an Inheritance</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Receive the assets a loved one secured for your future.
                  </p>
                  <span className="inline-flex items-center gap-2 text-indigo-400 text-sm font-medium group-hover:gap-3 transition-all">
                    Claim Now
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </button>
              </div>

              {/* How It Works */}
              <div id="how-it-works" className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-white mb-8 text-center">How It Works</h2>
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">1</div>
                    <h3 className="font-semibold text-white mb-2">Connect & Configure</h3>
                    <p className="text-sm text-slate-400">Set up your wallet and select which assets to include in your inheritance plan.</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">2</div>
                    <h3 className="font-semibold text-white mb-2">Designate Your Heir</h3>
                    <p className="text-sm text-slate-400">Register your heir using their email. Zero-knowledge proofs protect their identity.</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">3</div>
                    <h3 className="font-semibold text-white mb-2">Secure Transfer</h3>
                    <p className="text-sm text-slate-400">When the time comes, your heir can claim assets by verifying their identity.</p>
                  </div>
                </div>
              </div>

              {/* Real-World Data Feature */}
              <div id="features" className="max-w-3xl mx-auto mt-16">
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-8 text-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Real-World Data Verification</h3>
                  <p className="text-sm text-slate-300 mb-5 max-w-xl mx-auto">
                    We use <span className="text-amber-400 font-semibold">TLSNotary</span> to fetch and cryptographically verify data from official civil registries. This proves the heir's identity status directly from the source, without exposing sensitive information.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 text-xs">
                    <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-full">Government Data Verified</span>
                    <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-full">TLS Signatures Proven</span>
                    <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-full">On-Chain Attestation</span>
                  </div>
                </div>
              </div>

              {/* Trust Signals */}
              <div className="mt-16 pt-8 border-t border-white/10">
                <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Non-custodial</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                    <span>Zero-Knowledge Privacy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>EIP-7702 Powered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span>TLSNotary Verified</span>
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div id="pricing" className="max-w-5xl mx-auto mt-20 px-4">
                <h2 className="text-2xl font-bold text-white mb-4 text-center">Choose Your Plan</h2>
                <p className="text-slate-400 text-center mb-10 max-w-xl mx-auto">
                  One-time setup fee + success fee only when assets are claimed. No monthly subscriptions.
                </p>

                <div className="grid md:grid-cols-3 gap-6">
                  {/* Basic Plan */}
                  <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-1">Basic</h3>
                    <p className="text-xs text-slate-500 mb-4">DeFi Retail Users</p>

                    <div className="text-2xl font-extrabold text-white mb-1">
                      $199 <span className="text-sm text-slate-400 font-normal">USD</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">one-time setup</p>

                    <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
                      <div className="text-sm text-slate-300">Success Fee</div>
                      <div className="text-xl font-bold text-white">1.5%</div>
                      <div className="text-xs text-slate-500">on execution</div>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <div className="text-sm text-slate-400 mb-3">Protected Assets</div>
                      <div className="text-lg font-semibold text-white">Up to $50k USD</div>
                    </div>

                    <ul className="mt-4 space-y-2 text-sm text-slate-400">
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        ZK proof verification
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        ETH & ERC-20 support
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        1 heir designation
                      </li>
                    </ul>
                  </div>

                  {/* Pro Plan */}
                  <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-2xl p-6 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold rounded-full shadow-lg">
                      MOST POPULAR
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Pro</h3>
                    <p className="text-xs text-blue-300 mb-4">Mid-Tier Investors & RWA</p>

                    <div className="text-2xl font-extrabold text-white mb-1">
                      $499 <span className="text-sm text-slate-400 font-normal">USD</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">one-time setup</p>

                    <div className="bg-blue-500/20 rounded-lg p-3 mb-4">
                      <div className="text-sm text-blue-200">Success Fee</div>
                      <div className="text-xl font-bold text-white">1.0%</div>
                      <div className="text-xs text-blue-300">on execution</div>
                    </div>

                    <div className="border-t border-blue-500/30 pt-4">
                      <div className="text-sm text-slate-400 mb-3">Protected Assets</div>
                      <div className="text-lg font-semibold text-white">$50k - $500k USD</div>
                    </div>

                    <ul className="mt-4 space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Everything in Basic
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Multi-token transfers
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Up to 3 heirs
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Priority support
                      </li>
                    </ul>
                  </div>

                  {/* Whale Plan */}
                  <div className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-2xl p-6 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold rounded-full shadow-lg">
                      BEST VALUE
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Whale</h3>
                    <p className="text-xs text-amber-300 mb-4">HNWIs & Whales</p>

                    <div className="text-2xl font-extrabold text-white mb-1">
                      $1,499 <span className="text-sm text-slate-400 font-normal">USD</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">one-time setup</p>

                    <div className="bg-amber-500/20 rounded-lg p-3 mb-4">
                      <div className="text-sm text-amber-200">Success Fee</div>
                      <div className="text-xl font-bold text-white">0.75%</div>
                      <div className="text-xs text-amber-300">on execution</div>
                    </div>

                    <div className="border-t border-amber-500/30 pt-4">
                      <div className="text-sm text-slate-400 mb-3">Protected Assets</div>
                      <div className="text-lg font-semibold text-white">$500k+ USD</div>
                    </div>

                    <ul className="mt-4 space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Everything in Pro
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Unlimited heirs
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Dedicated support
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Custom integrations
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Comparison note */}
                <p className="text-center text-sm text-slate-500 mt-8">
                  💡 Traditional notary fees range from 3% to 5% of estate value. ProofHeir saves you up to 85% on inheritance costs.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // AUTHENTICATED + ROLE SELECTED
          <div className="max-w-4xl mx-auto px-6 py-12">
            {/* Back Button */}
            <button
              onClick={() => setSelectedRole('none')}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </button>

            {selectedRole === 'testator' && (
              <section className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Leave an Inheritance</h2>
                      <p className="text-sm text-slate-400">Configure your inheritance plan and protect your assets.</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <DelegationCard />
                </div>
              </section>
            )}

            {selectedRole === 'heir' && (
              <section className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-indigo-600/10 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Claim Your Inheritance</h2>
                      <p className="text-sm text-slate-400">Verify your identity and receive your assets.</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <ClaimCard />
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-slate-500 text-sm">
          ProofHeir © 2025 — Powered by EIP-7702
        </div>
      </footer>
    </div>
  )
}
