import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Convert an email address to a 32-byte hex salt using SHA-256
 * This provides a deterministic, privacy-preserving identifier for the heir
 */
export async function emailToSalt(email: string): Promise<`0x${string}`> {
    const normalizedEmail = email.toLowerCase().trim()
    const encoder = new TextEncoder()
    const data = encoder.encode(normalizedEmail)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return `0x${hashHex}` as `0x${string}`
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
