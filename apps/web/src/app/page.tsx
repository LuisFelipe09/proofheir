import { WalletConnect } from '../components/WalletConnect';
import { DelegationCard } from '../components/DelegationCard';

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 text-gray-900 font-sans">
      <header className="w-full max-w-5xl p-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg"></div>
          <span className="font-bold text-xl tracking-tight">ProofHeir</span>
        </div>
        <WalletConnect />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-5xl">
        <div className="text-center mb-12 max-w-2xl">
          <h1 className="text-5xl font-extrabold mb-6 tracking-tight text-gray-900">
            Secure Inheritance <br />
            <span className="text-blue-600">Trustless & Private</span>
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Leverage EIP-7702 and Zero-Knowledge proofs to ensure your digital legacy
            is passed on securely, without trusted intermediaries.
          </p>
        </div>

        <DelegationCard />
      </main>

      <footer className="p-6 text-gray-400 text-sm">
        ProofHeir © 2025
      </footer>
    </div>
  );
}
