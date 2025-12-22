import { createPublicClient, createWalletClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains'

// CONFIGURACIÓN (Actualizar según tu despliegue de Anvil)
const PROOF_HEIR_ADDRESS = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'
const MOCK_TOKEN_ADDRESS = '0x0165878A594ca255338adfa4d48449f69242Eb8F'
const RPC_URL = 'http://127.0.0.1:8545'

// CUENTAS DE ANVIL (Cuentas 0 y 1 por defecto)
const sponsorKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const testatorKey = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'

const sponsorAccount = privateKeyToAccount(sponsorKey)
const testatorAccount = privateKeyToAccount(testatorKey)

async function testDelegation() {
    console.log('--- EIP-7702 CONTROLLED TEST ---')
    console.log('Sponsor (Paga Gas):', sponsorAccount.address)
    console.log('Testador (Recibe Código):', testatorAccount.address)
    console.log('Contrato a Delegar:', PROOF_HEIR_ADDRESS)

    const publicClient = createPublicClient({
        chain: anvil,
        transport: http(RPC_URL)
    })

    const sponsorClient = createWalletClient({
        account: sponsorAccount,
        chain: anvil,
        transport: http(RPC_URL)
    })

    const testatorClient = createWalletClient({
        account: testatorAccount,
        chain: anvil,
        transport: http(RPC_URL)
    })

    // 1. Obtener Nonce del Testador
    const nonce = await publicClient.getTransactionCount({
        address: testatorAccount.address
    })
    console.log('\n1. Nonce del Testador:', nonce)

    // 2. Firmar Autorización (Self-Sign)
    console.log('2. Firmando autorización EIP-7702...')
    const authorization = await testatorClient.signAuthorization({
        contractAddress: PROOF_HEIR_ADDRESS as Address,
        chainId: 31337,
        nonce
    })
    console.log('✅ Firma generada:', JSON.stringify(authorization, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2))

    // 3. Enviar Transacción a través del Sponsor
    console.log('\n3. Enviando transacción de delegación (Type 4)...')
    const hash = await sponsorClient.sendTransaction({
        to: sponsorAccount.address, // Cambiado de testatorAccount.address
        data: '0x',
        authorizationList: [authorization]
    })
    console.log('🚀 Transacción enviada:', hash)

    // 4. Confirmar
    console.log('⏳ Esperando bloque...')
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('✅ Confirmado en bloque:', receipt.blockNumber.toString())

    // 5. Verificar BYTECODE
    console.log('\n4. Verificando Bytecode del Testador...')
    const code = await publicClient.getBytecode({
        address: testatorAccount.address
    })

    if (code?.startsWith('0xef0100')) {
        console.log('🎉 ¡ÉXITO! La cuenta ahora está DELEGADA.')
        console.log('Bytecode:', code)

        // 5. TEST ADICIONAL: ¿Puede el Sponsor transferir fondos DEL Testador?
        // Esto es lo que hace el "Claim"
        const TOKEN_ABI = [
            { "type": "function", "name": "transfer", "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "nonpayable" },
            { "type": "function", "name": "balanceOf", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
            { "type": "function", "name": "mint", "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [], "stateMutability": "external" }
        ] as const

        console.log('\n--- PRUEBA DE TRANSFERENCIA (CLAIM) ---')

        console.log('Minting 100 tokens to Testator...')
        const mintHash = await sponsorClient.sendTransaction({
            to: MOCK_TOKEN_ADDRESS,
            data: encodeFunctionData({
                abi: TOKEN_ABI,
                functionName: 'mint',
                args: [testatorAccount.address, 100n * 10n ** 18n]
            })
        })
        await publicClient.waitForTransactionReceipt({ hash: mintHash })

        // El sponsor le manda 100 tokens al testador primero (para que tenga algo que heredar)
        const initialBalance = await publicClient.readContract({
            address: MOCK_TOKEN_ADDRESS,
            abi: TOKEN_ABI,
            functionName: 'balanceOf',
            args: [testatorAccount.address]
        })
        console.log('Saldo inicial del Testador:', initialBalance.toString())

        // El SPONSOR llama al contrato MOCK_TOKEN como si fuera el TESTADOR
        // Gracias a EIP-7702, si el contrato ProofHeir (al que delegamos) permite ejecutar cosas,
        // entonces el código en la cuenta del Testador ahora tiene lógica.

        // Pero espera, para probar el "Claim", necesitamos que el contrato ProofHeir
        // llame al MockToken. El contrato ProofHeir tiene la función "claim".

        console.log('Ejecutando transferencia simple desde la cuenta delegada...')
        const transferHash = await sponsorClient.sendTransaction({
            to: MOCK_TOKEN_ADDRESS,
            data: encodeFunctionData({
                abi: TOKEN_ABI,
                functionName: 'transfer',
                args: [sponsorAccount.address, 10n * 10n ** 18n]
            }),
            account: testatorAccount.address // <--- ¡AQUÍ ESTÁ LA MAGIA! El sponsor firma, pero el 'from' es el testador.
        })

        console.log('🚀 Transferencia enviada desde cuenta delegada:', transferHash)
        await publicClient.waitForTransactionReceipt({ hash: transferHash })

        const finalBalance = await publicClient.readContract({
            address: MOCK_TOKEN_ADDRESS,
            abi: TOKEN_ABI,
            functionName: 'balanceOf',
            args: [testatorAccount.address]
        })
        console.log('Saldo final del Testador:', finalBalance.toString())

        if (finalBalance < initialBalance) {
            console.log('✅ ¡FUNCIONA! La cuenta delegada ejecutó una transacción pagada por un sponsor.')
        }

    } else {
        console.log('❌ FALLO: El bytecode no es una delegación EIP-7702.')
        console.log('Bytecode actual:', code || '0x')
    }
}

import { encodeFunctionData } from 'viem'

testDelegation().catch(console.error)
