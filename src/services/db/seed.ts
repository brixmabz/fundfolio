import { getDbClient } from './client'

const INCOME_SOURCES = [
  {
    name: 'deel',
    display_name: 'Deel',
    markup_percentage: 0.015,
    payment_frequency: 'monthly_fixed',
    payment_schedule: JSON.stringify({ dates: [11, 26] }),
    default_amount: 625,
  },
  {
    name: 'upwork',
    display_name: 'Upwork',
    markup_percentage: 0.025,
    payment_frequency: 'weekly',
    payment_schedule: JSON.stringify({ day: 'friday' }),
    default_amount: 479.01,
  },
  {
    name: 'esl',
    display_name: 'ESL',
    markup_percentage: 0,
    payment_frequency: 'none',
    payment_schedule: null,
    default_amount: 0,
  },
  {
    name: 'other',
    display_name: 'Other',
    markup_percentage: 0,
    payment_frequency: 'none',
    payment_schedule: null,
    default_amount: 0,
  },
]

const BILL_CATEGORIES = [
  { name: 'Utilities', icon: 'Zap', color: '#f59e0b' },
  { name: 'Internet', icon: 'Wifi', color: '#3b82f6' },
  { name: 'Phone', icon: 'Phone', color: '#8b5cf6' },
  { name: 'Insurance', icon: 'Shield', color: '#10b981' },
  { name: 'Subscriptions', icon: 'Play', color: '#ef4444' },
  { name: 'Transportation', icon: 'Car', color: '#6366f1' },
  { name: 'Food', icon: 'Utensils', color: '#f97316' },
  { name: 'Healthcare', icon: 'Heart', color: '#ec4899' },
  { name: 'Education', icon: 'GraduationCap', color: '#14b8a6' },
  { name: 'Entertainment', icon: 'Film', color: '#a855f7' },
  { name: 'Other', icon: 'MoreHorizontal', color: '#6b7280' },
]

export async function seedDatabase(): Promise<void> {
  const client = getDbClient()

  console.log('Seeding database...')

  // Seed default user (required for foreign key constraints)
  try {
    await client.execute({
      sql: `INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)`,
      args: [1, 'admin', 'not_used_auth_is_localStorage'],
    })
  } catch (error) {
    console.error('Failed to seed default user:', error)
  }

  // Seed income sources
  for (const source of INCOME_SOURCES) {
    try {
      // Insert if not exists
      await client.execute({
        sql: `INSERT OR IGNORE INTO income_sources (name, display_name, markup_percentage, payment_frequency, payment_schedule, default_amount)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          source.name,
          source.display_name,
          source.markup_percentage,
          source.payment_frequency,
          source.payment_schedule,
          source.default_amount,
        ],
      })
      // Update payment schedule for existing records
      await client.execute({
        sql: `UPDATE income_sources
              SET payment_frequency = ?, payment_schedule = ?
              WHERE name = ? AND (payment_schedule IS NULL OR payment_frequency IS NULL OR payment_frequency = 'none')`,
        args: [source.payment_frequency, source.payment_schedule, source.name],
      })
      // Update default_amount for records that don't have it set
      await client.execute({
        sql: `UPDATE income_sources
              SET default_amount = ?
              WHERE name = ? AND (default_amount IS NULL OR default_amount = 0)`,
        args: [source.default_amount, source.name],
      })
    } catch (error) {
      console.error('Failed to seed income source:', source.name, error)
    }
  }

  // Seed bill categories
  for (const category of BILL_CATEGORIES) {
    try {
      await client.execute({
        sql: `INSERT OR IGNORE INTO bill_categories (name, icon, color)
              VALUES (?, ?, ?)`,
        args: [category.name, category.icon, category.color],
      })
    } catch (error) {
      console.error('Failed to seed bill category:', category.name, error)
    }
  }

  console.log('Seeding completed successfully')
}

export async function checkSeedNeeded(): Promise<boolean> {
  const client = getDbClient()

  try {
    // Check if default user exists
    const userResult = await client.execute('SELECT COUNT(*) as count FROM users WHERE id = 1')
    if ((userResult.rows[0]?.count as number) === 0) {
      return true
    }

    // Check if any expected income sources are missing
    const sourcesResult = await client.execute('SELECT name FROM income_sources')
    const existingNames = new Set(sourcesResult.rows.map((row) => row.name as string))
    if (INCOME_SOURCES.some((source) => !existingNames.has(source.name))) {
      return true
    }

    // Check if any records that require a schedule are missing one
    const missingResult = await client.execute(
      "SELECT COUNT(*) as count FROM income_sources WHERE payment_frequency != 'none' AND payment_schedule IS NULL"
    )
    return (missingResult.rows[0]?.count as number) > 0
  } catch {
    return true
  }
}
