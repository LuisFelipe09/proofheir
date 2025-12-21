import { WalletConnect } from '../components/WalletConnect';
import { DelegationCard } from '../components/DelegationCard';
import { ClaimCard } from '../components/ClaimCard';

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

      <main className="w-full max-w-6xl p-6 mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold mb-4 tracking-tight">
            ProofHeir Protocol
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Inheritance management powered by EIP-7702 and Zero-Knowledge Proofs.
          </p>
        </div>

        <div className="grid-2 mt-8 items-start">
          {/* Columna Izquierda: Testador */}
          <section className="card">
            <div className="card-header-blue">
              <h2 className="text-xl font-bold flex-row items-center">
                <span className="step-number text-blue-600">1</span>
                Testador (Dueño)
              </h2>
              <p className="text-blue-100 text-xs mt-1">
                Configura tu herencia y delega permisos a través de EIP-7702.
              </p>
            </div>
            <div className="card-body">
              <DelegationCard />
            </div>
          </section>

          {/* Columna Derecha: Heredero */}
          <section className="card">
            <div className="card-header-indigo">
              <h2 className="text-xl font-bold flex-row items-center">
                <span className="step-number text-indigo-600">2</span>
                Heredero (Ejecutor)
              </h2>
              <p className="text-indigo-100 text-xs mt-1">
                Ejecuta el reclamo de activos usando la autorización del Testador.
              </p>
            </div>
            <div className="card-body">
              <ClaimCard />
            </div>
          </section>
        </div>
      </main>

      <footer className="p-6 text-gray-400 text-sm">
        ProofHeir © 2025
      </footer>
    </div>
  );
}
