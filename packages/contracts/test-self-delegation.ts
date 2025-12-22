import { createPublicClient, createWalletClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains'

// CONFIGURACIÓN (Actualizar según tu despliegue de Anvil)
const PROOF_HEIR_ADDRESS = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'
const RPC_URL = 'http://127.0.0.1:8545'

// CUENTA DE ANVIL (Cuenta 3 para que esté limpia)
const testatorKey = '0x47e170ec341022451124841bb45b5b48e3d6446e504c552097e3ce766ce5236a'
const testatorAccount = privateKeyToAccount(testatorKey)

const account0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

async function testSelfDelegation() {
    console.log('--- EIP-7702 SELF-DELEGATION TEST ---')
    console.log('Cuenta (Firma y Paga):', testatorAccount.address)
    console.log('Contrato a Delegar:', PROOF_HEIR_ADDRESS)

    const publicClient = createPublicClient({
        chain: anvil,
        transport: http(RPC_URL)
    })

    const testatorClient = createWalletClient({
        account: testatorAccount,
        chain: anvil,
        transport: http(RPC_URL)
    })

    // 1. Obtener Nonce
    const nonce = await publicClient.getTransactionCount({
        address: testatorAccount.address
    })
    console.log('\n1. Nonce Inicial:', nonce)

    // 2. Firmar Autorización
    console.log('2. Firmando autorización...')
    const authorization = await testatorClient.signAuthorization({
        contractAddress: PROOF_HEIR_ADDRESS as Address,
        chainId: 31337,
        nonce: nonce + 1 // Incrementado porque somos el SENDER
    })

    // 3. Enviar Transacción (Self-Execution)
    console.log('\n3. Enviando transacción de SELF-DELEGACIÓN...')
    // IMPORTANTE: Enviamos a una dirección neutra para evitar el revert del "no-fallback"
    // si enviáramos 'to: testatorAccount.address', fallaría porque el testator "se vuelve" contrato
    // y no tiene función receive/fallback.
    const hash = await testatorClient.sendTransaction({
        to: account0 as Address,
        data: '0x',
        authorizationList: [authorization]
    })
    console.log('🚀 Transacción enviada:', hash)

    // 4. Confirmar
    console.log('⏳ Esperando bloque...')
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('✅ Confirmado en bloque:', receipt.blockNumber.toString())

    // 5. Verificar BYTECODE
    console.log('\n4. Verificando Bytecode...')
    const code = await publicClient.getBytecode({
        address: testatorAccount.address
    })

    if (code?.startsWith('0xef0100')) {
        console.log('🎉 ¡ÉXITO! Auto-delegación completada.')
        console.log('Bytecode:', code)

        const nextNonce = await publicClient.getTransactionCount({
            address: testatorAccount.address
        })
        console.log('Nuevo Nonce:', nextNonce)
    } else {
        console.log('❌ FALLO: No se detectó la delegación.')
        console.log('Bytecode actual:', code || '0x')
    }
}

testSelfDelegation().catch(console.error)
