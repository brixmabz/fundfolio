import { getDbClient } from './db/client'
import type { Setting } from '@/types/database'

export async function getSettings(userId: number): Promise<Setting[]> {
  const client = getDbClient()
  const result = await client.execute({
    sql: 'SELECT * FROM settings WHERE user_id = ?',
    args: [userId],
  })
  return result.rows as unknown as Setting[]
}

export async function getSetting(userId: number, key: string): Promise<string | null> {
  const client = getDbClient()
  const result = await client.execute({
    sql: 'SELECT value FROM settings WHERE user_id = ? AND key = ?',
    args: [userId, key],
  })
  return (result.rows[0] as unknown as { value: string })?.value || null
}

export async function setSetting(userId: number, key: string, value: string): Promise<void> {
  const client = getDbClient()
  await client.execute({
    sql: `INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)`,
    args: [userId, key, value],
  })
}

export async function deleteSetting(userId: number, key: string): Promise<void> {
  const client = getDbClient()
  await client.execute({
    sql: 'DELETE FROM settings WHERE user_id = ? AND key = ?',
    args: [userId, key],
  })
}

// Specific setting getters/setters
export async function getDeelMarkup(userId: number): Promise<number> {
  const value = await getSetting(userId, 'deel_markup')
  return value ? parseFloat(value) : 1.5 // Default 1.5%
}

export async function setDeelMarkup(userId: number, markup: number): Promise<void> {
  await setSetting(userId, 'deel_markup', String(markup))
}

export async function getUpworkMarkup(userId: number): Promise<number> {
  const value = await getSetting(userId, 'upwork_markup')
  return value ? parseFloat(value) : 2.5 // Default 2.5%
}

export async function setUpworkMarkup(userId: number, markup: number): Promise<void> {
  await setSetting(userId, 'upwork_markup', String(markup))
}

export async function getDefaultCurrency(userId: number): Promise<string> {
  const value = await getSetting(userId, 'default_currency')
  return value || 'PHP'
}

export async function setDefaultCurrency(userId: number, currency: string): Promise<void> {
  await setSetting(userId, 'default_currency', currency)
}
