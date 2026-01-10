import { NextRequest, NextResponse } from 'next/server'

const CIVIL_REGISTRY_URL = process.env.CIVIL_REGISTRY_URL || 'https://web-production-05160.up.railway.app/'

/**
 * POST /api/toggle-status
 * Toggles a person's life status in the civil registry (MVP ONLY)
 * Body: { nuip: string, currentStatus: 'alive' | 'deceased' }
 * 
 * Uses the civil registry admin endpoint:
 * POST /admin/update-status { nuip: number, status: "Vigente" | "No Vigente (Fallecido)" }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { nuip, currentStatus } = body

        if (!nuip) {
            return NextResponse.json(
                { error: 'Missing nuip in request body' },
                { status: 400 }
            )
        }

        // Toggle: if currently alive -> set to deceased, if deceased -> set to alive
        const targetStatus = currentStatus === 'alive' ? 'No Vigente (Fallecido)' : 'Vigente'

        const response = await fetch(`${CIVIL_REGISTRY_URL}/admin/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nuip: parseInt(nuip, 10),
                status: targetStatus
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Registry returned ${response.status}: ${errorText}`)
        }

        const data = await response.json()

        // Determine the new status from response
        const isAlive = data.status === 'Vigente'

        return NextResponse.json({
            success: true,
            nuip: data.nuip,
            newStatus: isAlive ? 'alive' : 'deceased',
            isAlive,
            registryStatus: data.status
        })
    } catch (error: any) {
        console.error('Toggle status failed:', error)
        return NextResponse.json(
            { error: 'Failed to update status', details: error.message },
            { status: 500 }
        )
    }
}
