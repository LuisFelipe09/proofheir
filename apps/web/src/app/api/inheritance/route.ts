import { NextRequest, NextResponse } from 'next/server'

// Upstash Redis REST API
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

// Simple hash function for email (SHA-256)
async function hashEmail(email: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(email.toLowerCase().trim())
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// POST: Register inheritance (testator saves heir email → their wallet)
export async function POST(request: NextRequest) {
    try {
        const { heirEmail, testatorWallet } = await request.json()

        if (!heirEmail || !testatorWallet) {
            return NextResponse.json(
                { error: 'Missing heirEmail or testatorWallet' },
                { status: 400 }
            )
        }

        if (!UPSTASH_REDIS_URL || !UPSTASH_REDIS_TOKEN) {
            return NextResponse.json(
                { error: 'Redis not configured' },
                { status: 500 }
            )
        }

        const emailHash = await hashEmail(heirEmail)

        // Use SET command via REST API
        // Key format: inheritance:{emailHash}
        // Value: JSON with testator info
        const response = await fetch(`${UPSTASH_REDIS_URL}/set/inheritance:${emailHash}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${UPSTASH_REDIS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                testatorWallet,
                createdAt: new Date().toISOString(),
            }),
        })

        if (!response.ok) {
            throw new Error('Failed to save to Redis')
        }

        return NextResponse.json({
            success: true,
            emailHash: emailHash.slice(0, 8) + '...' // Return partial hash for confirmation
        })

    } catch (error: any) {
        console.error('Error saving inheritance:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to save inheritance' },
            { status: 500 }
        )
    }
}

// GET: Lookup inheritance by heir email
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const heirEmail = searchParams.get('email')

        if (!heirEmail) {
            return NextResponse.json(
                { error: 'Missing email parameter' },
                { status: 400 }
            )
        }

        if (!UPSTASH_REDIS_URL || !UPSTASH_REDIS_TOKEN) {
            return NextResponse.json(
                { error: 'Redis not configured' },
                { status: 500 }
            )
        }

        const emailHash = await hashEmail(heirEmail)

        // Use GET command via REST API
        const response = await fetch(`${UPSTASH_REDIS_URL}/get/inheritance:${emailHash}`, {
            headers: {
                Authorization: `Bearer ${UPSTASH_REDIS_TOKEN}`,
            },
        })

        if (!response.ok) {
            throw new Error('Failed to fetch from Redis')
        }

        const data = await response.json()

        // Upstash returns { result: value } or { result: null }
        if (!data.result) {
            return NextResponse.json({
                found: false,
                message: 'No inheritance found for this email'
            })
        }

        // Parse the stored value (it's a JSON string)
        let inheritanceData
        try {
            inheritanceData = typeof data.result === 'string'
                ? JSON.parse(data.result)
                : data.result
        } catch {
            inheritanceData = { testatorWallet: data.result }
        }

        return NextResponse.json({
            found: true,
            testatorWallet: inheritanceData.testatorWallet,
            createdAt: inheritanceData.createdAt
        })

    } catch (error: any) {
        console.error('Error fetching inheritance:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch inheritance' },
            { status: 500 }
        )
    }
}
