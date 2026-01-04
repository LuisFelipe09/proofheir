import { NextResponse } from 'next/server'

/**
 * POST /api/generate-proof
 * 
 * Generates a ZK proof for the "Proof of Death" claim.
 * This endpoint calls the Rust notary package to:
 * 1. Connect to civil registry via MPC-TLS
 * 2. Extract authenticated death certificate data
 * 3. Generate ZK proof using Noir circuit
 * 4. Return proof bundle formatted for Solidity
 * 
 * Request body:
 * {
 *   "recipient": "0xabcd...",  // Heir's Ethereum address (40 hex chars)
 *   "nuip": "123456789",        // National ID number
 *   "salt": "0x1111..."         // 32-byte salt (64 hex chars)
 * }
 * 
 * Response:
 * {
 *   "proof": "0x...",                    // Hex-encoded ZK proof
 *   "publicInputs": ["0x...", ...]       // 116 hex-encoded 32-byte fields
 * }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { recipient, nuip, salt } = body

        // Validate inputs
        if (!recipient || !nuip || !salt) {
            return NextResponse.json(
                { error: 'Missing required parameters: recipient, nuip, salt' },
                { status: 400 }
            )
        }

        // Validate recipient format (0x + 40 hex chars)
        if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
            return NextResponse.json(
                { error: 'Invalid recipient address format' },
                { status: 400 }
            )
        }

        // Validate salt format (0x + 64 hex chars)
        if (!/^0x[0-9a-fA-F]{64}$/.test(salt)) {
            return NextResponse.json(
                { error: 'Invalid salt format (must be 0x + 64 hex chars)' },
                { status: 400 }
            )
        }

        // Validate NUIP is numeric
        if (!/^\d+$/.test(nuip)) {
            return NextResponse.json(
                { error: 'Invalid NUIP format (must be numeric)' },
                { status: 400 }
            )
        }

        // Call Rust API server
        console.log('Calling Rust API server at http://localhost:3001/api/generate-proof')

        const rustApiUrl = process.env.RUST_API_URL || 'http://localhost:3001'
        const response = await fetch(`${rustApiUrl}/api/generate-proof`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipient,
                nuip,
                salt,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            return NextResponse.json(
                { error: errorData.error || `Rust API error: ${response.statusText}` },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data, { status: 200 })

    } catch (error: any) {
        console.error('Proof generation error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
