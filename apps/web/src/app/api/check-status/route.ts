import { NextRequest, NextResponse } from 'next/server'

const CIVIL_REGISTRY_URL = process.env.CIVIL_REGISTRY_URL || 'https://web-production-05160.up.railway.app'

/**
 * GET /api/check-status?nuip=123456789
 * Checks if a person is alive or deceased via the civil registry
 * 
 * Uses the civil registry endpoint:
 * POST /VigenciaCedula/consulta { nuip: number }
 * Returns: { nuip, vigencia: "Vigente" | "No Vigente (Fallecido)" }
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const nuip = searchParams.get('nuip')

    if (!nuip) {
        return NextResponse.json(
            { error: 'Missing nuip parameter' },
            { status: 400 }
        )
    }

    try {
        const response = await fetch(`${CIVIL_REGISTRY_URL}/VigenciaCedula/consulta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuip: parseInt(nuip, 10) })
        })

        if (!response.ok) {
            if (response.status === 404) {
                return NextResponse.json(
                    { found: false, error: 'Person not found in registry' },
                    { status: 404 }
                )
            }
            throw new Error(`Registry returned ${response.status}`)
        }

        const data = await response.json()

        // vigencia: "Vigente (Vivo)" = alive, "No Vigente (Fallecido)" = deceased
        const isAlive = data.vigencia === 'Vigente (Vivo)'

        return NextResponse.json({
            found: true,
            nuip: data.nuip,
            status: isAlive ? 'alive' : 'deceased',
            isAlive,
            vigencia: data.vigencia
        })
    } catch (error: any) {
        console.error('Civil registry check failed:', error)
        return NextResponse.json(
            { error: 'Failed to check civil registry', details: error.message },
            { status: 500 }
        )
    }
}
