'use client'

import { WalletConnect } from '../components/WalletConnect';
import { DelegationCard } from '../components/DelegationCard';
import { ClaimCard } from '../components/ClaimCard';
import { useState } from 'react';

export default function Page() {
  const [activeTab, setActiveTab] = useState<'testator' | 'heir'>('testator');

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans">
      {/* Header */}
      <header className="w-full border-b border-white/10 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight">ProofHeir</span>
              <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Beta</span>
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold mb-4 tracking-tight bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
            ProofHeir Protocol
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Secure inheritance management powered by <span className="text-blue-400 font-medium">EIP-7702</span> and <span className="text-indigo-400 font-medium">Zero-Knowledge Proofs</span>.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-white/10 shadow-xl">
            <button
              onClick={() => setActiveTab('testator')}
              className={`
                px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2
                ${activeTab === 'testator'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}
              `}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Testator (Owner)
            </button>
            <button
              onClick={() => setActiveTab('heir')}
              className={`
                px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2
                ${activeTab === 'heir'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}
              `}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Heir (Claimer)
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-300">
          {activeTab === 'testator' && (
            <section className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Inheritance Configuration</h2>
                    <p className="text-sm text-slate-400">Configure your parameters and delegate access.</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <DelegationCard />
              </div>
            </section>
          )}

          {activeTab === 'heir' && (
            <section className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-indigo-600/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Claim Inheritance</h2>
                    <p className="text-sm text-slate-400">Execute claim using the owner's authorization.</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <ClaimCard />
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-slate-500 text-sm">
          ProofHeir © 2025 — Powered by EIP-7702
        </div>
      </footer>
    </div>
  );
}
