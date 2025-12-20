# 📜 ProofHeir

**ProofHeir** is a decentralized, privacy-preserving inheritance protocol. It allows users to secure the future of their digital assets by automating transfers based on real-world web activity (via **TLSNotary**) and privacy-centric proofs (via **Noir ZK**), leveraging the power of **EIP-7702**.
---

## 🚀 The Vision

Traditional crypto inheritance relies on sharing private keys (insecure) or centralized custodians (defeats the purpose of crypto). **ProofHeir** creates a "Dead Man's Switch" that:
1.  **Proves Inactivity:** Uses TLSNotary to verify the last time you logged into a web service (Gmail, Banking, etc.).
2.  **Protects Privacy:** Uses Noir ZK-Proofs to prove you've been inactive for $X$ months without revealing your email or sensitive metadata.
3.  **Executes Seamlessly:** Uses EIP-7702 to allow an EOA to delegate transfer power to our inheritance vault only when the proof is valid.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Blockchain** | Mantle Network (L2) |
| **Account Abstraction** | EIP-7702 (EOA Delegation) |
| **Web Attestation** | [TLSNotary](https://tlsnotary.org/) (Rust) |
| **ZK-Circuits** | [Noir](https://noir-lang.org/) |
| **Monorepo** | [Nx](https://nx.dev/) |
| **Backend** | Rust (Axum API) |
| **Frontend** | Next.js + Tailwind + Viem |

---

## 🏗 Project Structure

This project is managed as an **Nx Integrated Monorepo** for seamless polyglot development:

```text
proofheir/
├── apps/
│   ├── web/            # Next.js (Dashboard & EIP-7702 signing logic)
│   └── api/            # Rust API (Orchestrates TLSN + Noir Proofs)
├── packages/
│   ├── circuits/       # Noir ZK-circuits (Inheritance conditions)
│   ├── contracts/      # Foundry (Vaults & ZK Verifiers)
│   └── notary/    # Shared Rust lib for TLSN Prover logic
├── nx.json             # Monorepo orchestration
└── Cargo.toml          # Rust Workspace root
```

##  ⚙️ How It Works
**1. Proof of Life (Setup & Delegation):**
The account owner establishes their "Proof of Life" by actively signing an **EIP-7702** delegation. This registers the inheritance rules and designates the heir's account, ensuring control remains with the owner while they are active.

**2. Proof of Death (Execution):**
To trigger inheritance, a valid "Proof of Death" is required. This is generated via **TLSNotary** (verifying inactivity or digital records) and **Noir** (creating a private ZK-proof). Once the ProofHeir Vault validates this proof, it executes the transfer of assets to the heir.

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

To install a new plugin you can use the `nx add` command. Here's an example of adding the React plugin:
```sh
npx nx add @nx/react
```

Use the plugin's generator to create new projects. For example, to create a new React app or library:

```sh
# Generate an app
npx nx g @nx/react:app demo

# Generate a library
npx nx g @nx/react:lib some-lib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)


[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/getting-started/intro#learn-nx?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:
- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
