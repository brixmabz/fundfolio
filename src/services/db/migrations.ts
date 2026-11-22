import { getDbClient } from './client'

// Increment this when adding new migrations
const SCHEMA_VERSION = 5

const MIGRATIONS = [
  // Schema info table (no foreign keys - for system metadata)
  `CREATE TABLE IF NOT EXISTS schema_info (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,

  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Income sources
  `CREATE TABLE IF NOT EXISTS income_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    default_currency TEXT DEFAULT 'USD',
    markup_percentage REAL DEFAULT 0
  )`,

  // Salaries
  `CREATE TABLE IF NOT EXISTS salaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    amount_usd REAL NOT NULL,
    amount_php REAL NOT NULL,
    exchange_rate_used REAL NOT NULL,
    exchange_rate_market REAL,
    payment_date TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (source_id) REFERENCES income_sources(id)
  )`,

  // Bill categories
  `CREATE TABLE IF NOT EXISTS bill_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    color TEXT
  )`,

  // Bills
  `CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'PHP',
    due_day INTEGER,
    is_recurring INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES bill_categories(id)
  )`,

  // Bill payments
  `CREATE TABLE IF NOT EXISTS bill_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    amount_paid REAL NOT NULL,
    payment_date TEXT NOT NULL,
    status TEXT DEFAULT 'paid',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (bill_id) REFERENCES bills(id)
  )`,

  // Mortgages
  `CREATE TABLE IF NOT EXISTS mortgages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    property_name TEXT NOT NULL,
    principal_amount REAL NOT NULL,
    interest_rate REAL NOT NULL,
    loan_term_months INTEGER NOT NULL,
    monthly_payment REAL NOT NULL,
    start_date TEXT NOT NULL,
    currency TEXT DEFAULT 'PHP',
    lender_name TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  // Mortgage payments
  `CREATE TABLE IF NOT EXISTS mortgage_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mortgage_id INTEGER NOT NULL,
    payment_number INTEGER NOT NULL,
    principal_paid REAL NOT NULL,
    interest_paid REAL NOT NULL,
    total_paid REAL NOT NULL,
    remaining_balance REAL NOT NULL,
    payment_date TEXT NOT NULL,
    status TEXT DEFAULT 'paid',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (mortgage_id) REFERENCES mortgages(id)
  )`,

  // Exchange rates
  `CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    source TEXT NOT NULL,
    recorded_at TEXT DEFAULT (datetime('now'))
  )`,

  // Budgets
  `CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    limit_amount REAL NOT NULL,
    currency TEXT DEFAULT 'PHP',
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES bill_categories(id),
    UNIQUE(user_id, category_id, month, year)
  )`,

  // Settings
  `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    UNIQUE(user_id, key),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_salaries_user_date ON salaries(user_id, payment_date)`,
  `CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON bill_payments(payment_date)`,
  `CREATE INDEX IF NOT EXISTS idx_mortgage_payments_mortgage ON mortgage_payments(mortgage_id)`,
  `CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(recorded_at)`,
  `CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON budgets(user_id, year, month)`,

  // Migration: Add payment schedule fields to income_sources
  `ALTER TABLE income_sources ADD COLUMN payment_frequency TEXT DEFAULT 'none'`,
  `ALTER TABLE income_sources ADD COLUMN payment_schedule TEXT`,

  // Migration: Add status field to salaries
  `ALTER TABLE salaries ADD COLUMN status TEXT DEFAULT 'recorded'`,

  // Migration: Add default_amount field to income_sources
  `ALTER TABLE income_sources ADD COLUMN default_amount REAL DEFAULT 0`,

  // Migration: Add optional maturity date to bills (YYYY-MM-DD, NULL = none)
  `ALTER TABLE bills ADD COLUMN maturity_date TEXT DEFAULT NULL`,
]

async function getStoredVersion(): Promise<number> {
  const client = getDbClient()
  try {
    const result = await client.execute(
      "SELECT value FROM schema_info WHERE key = 'version'"
    )
    return result.rows[0] ? Number(result.rows[0].value) : 0
  } catch {
    return 0 // Table doesn't exist yet
  }
}

async function setStoredVersion(version: number): Promise<void> {
  const client = getDbClient()
  await client.execute({
    sql: `INSERT OR REPLACE INTO schema_info (key, value) VALUES ('version', ?)`,
    args: [String(version)],
  })
}

export async function runMigrations(): Promise<void> {
  const storedVersion = await getStoredVersion()

  if (storedVersion >= SCHEMA_VERSION) {
    console.log(`Schema up to date (v${SCHEMA_VERSION})`)
    return
  }

  console.log(`Running migrations: v${storedVersion} → v${SCHEMA_VERSION}`)

  const client = getDbClient()
  for (const migration of MIGRATIONS) {
    try {
      await client.execute(migration)
    } catch (error) {
      // Ignore "duplicate column" errors for ALTER TABLE migrations
      const errorMessage = String(error)
      if (errorMessage.includes('duplicate column')) {
        continue
      }
      console.error('Migration failed:', migration.substring(0, 50), error)
      throw error
    }
  }

  await setStoredVersion(SCHEMA_VERSION)
  console.log('Migrations completed successfully')
}

export async function checkMigrationsNeeded(): Promise<boolean> {
  const client = getDbClient()

  try {
    // Check if users table exists
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    )
    return result.rows.length === 0
  } catch {
    return true
  }
}
