const SESSION_KEY = 'fundfolio_session'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

interface Session {
  token: string
  expiry: number
  createdAt: number
}

// Simple hash function for browser environment
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function validateCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const expectedUsername = import.meta.env.VITE_AUTH_USERNAME || 'admin'
  const expectedPasswordHash = import.meta.env.VITE_AUTH_PASSWORD_HASH

  if (username !== expectedUsername) {
    return false
  }

  const inputHash = await hashPassword(password)

  // If no hash is set in env, use a default for development
  if (!expectedPasswordHash) {
    // Default password for development: "fundfolio123"
    const defaultHash = await hashPassword('fundfolio123')
    return inputHash === defaultHash
  }

  return inputHash === expectedPasswordHash
}

export function createSession(): string {
  const sessionToken = crypto.randomUUID()
  const session: Session = {
    token: sessionToken,
    expiry: Date.now() + SESSION_DURATION,
    createdAt: Date.now(),
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return sessionToken
}

export function validateSession(): boolean {
  const sessionStr = localStorage.getItem(SESSION_KEY)
  if (!sessionStr) return false

  try {
    const session: Session = JSON.parse(sessionStr)
    if (Date.now() > session.expiry) {
      logout()
      return false
    }
    return true
  } catch {
    logout()
    return false
  }
}

export function refreshSession(): void {
  const sessionStr = localStorage.getItem(SESSION_KEY)
  if (!sessionStr) return

  try {
    const session: Session = JSON.parse(sessionStr)
    session.expiry = Date.now() + SESSION_DURATION
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Session is invalid, do nothing
  }
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function getSessionExpiry(): Date | null {
  const sessionStr = localStorage.getItem(SESSION_KEY)
  if (!sessionStr) return null

  try {
    const session: Session = JSON.parse(sessionStr)
    return new Date(session.expiry)
  } catch {
    return null
  }
}

// Utility to generate password hash for env variable
export async function generatePasswordHash(password: string): Promise<string> {
  return hashPassword(password)
}
