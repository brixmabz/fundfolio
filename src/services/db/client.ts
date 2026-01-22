import { createClient, type Client } from '@libsql/client'

let client: Client | null = null

export function getDbClient(): Client {
  if (!client) {
    const url = import.meta.env.VITE_TURSO_DATABASE_URL
    const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN

    if (!url) {
      throw new Error('VITE_TURSO_DATABASE_URL is not defined')
    }

    client = createClient({
      url,
      authToken,
    })
  }
  return client
}

export function closeDbClient(): void {
  if (client) {
    client.close()
    client = null
  }
}

export default getDbClient
