import { getDbClient } from './db/client'
import type { Salary, SalaryCreate, IncomeSource } from '@/types/database'

export async function getIncomeSources(): Promise<IncomeSource[]> {
  const client = getDbClient()
  const result = await client.execute('SELECT * FROM income_sources')
  return result.rows as unknown as IncomeSource[]
}

export async function getIncomeSourceByName(name: string): Promise<IncomeSource | null> {
  const client = getDbClient()
  const result = await client.execute({
    sql: 'SELECT * FROM income_sources WHERE name = ?',
    args: [name],
  })
  return (result.rows[0] as unknown as IncomeSource) || null
}

export async function createSalary(data: SalaryCreate): Promise<number> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `INSERT INTO salaries (user_id, source_id, amount_usd, amount_php, exchange_rate_used, exchange_rate_market, payment_date, description, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.user_id,
      data.source_id,
      data.amount_usd,
      data.amount_php,
      data.exchange_rate_used,
      data.exchange_rate_market || null,
      data.payment_date,
      data.description || null,
      data.status || 'recorded',
    ],
  })
  return Number(result.lastInsertRowid)
}

export async function getSalaries(userId: number, month?: number, year?: number): Promise<Salary[]> {
  const client = getDbClient()

  let sql = `
    SELECT s.*, i.name as source_name, i.display_name
    FROM salaries s
    JOIN income_sources i ON s.source_id = i.id
    WHERE s.user_id = ?
  `
  const args: (number | string)[] = [userId]

  if (month !== undefined && year !== undefined) {
    sql += ` AND strftime('%m', s.payment_date) = ? AND strftime('%Y', s.payment_date) = ?`
    args.push(String(month + 1).padStart(2, '0'), String(year))
  }

  sql += ' ORDER BY s.payment_date DESC'

  const result = await client.execute({ sql, args })
  return result.rows as unknown as Salary[]
}

export async function getSalariesByMonth(userId: number, year: number, month: number): Promise<Salary[]> {
  const client = getDbClient()
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const result = await client.execute({
    sql: `
      SELECT s.*, i.name as source_name, i.display_name
      FROM salaries s
      JOIN income_sources i ON s.source_id = i.id
      WHERE s.user_id = ? AND s.payment_date >= ? AND s.payment_date <= ?
      ORDER BY s.payment_date DESC
    `,
    args: [userId, startDate, endDate],
  })
  return result.rows as unknown as Salary[]
}

export async function updateSalaryStatus(id: number, status: 'expected' | 'recorded'): Promise<void> {
  const client = getDbClient()
  await client.execute({
    sql: 'UPDATE salaries SET status = ? WHERE id = ?',
    args: [status, id],
  })
}

export async function deleteSalary(id: number): Promise<void> {
  const client = getDbClient()
  await client.execute({
    sql: 'DELETE FROM salaries WHERE id = ?',
    args: [id],
  })
}

export async function getMonthlyTotals(
  userId: number,
  year: number,
  month: number
): Promise<{
  recordedUsd: number
  recordedPhp: number
  expectedUsd: number
  expectedPhp: number
}> {
  const client = getDbClient()
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const result = await client.execute({
    sql: `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'recorded' THEN amount_usd ELSE 0 END), 0) as recorded_usd,
        COALESCE(SUM(CASE WHEN status = 'recorded' THEN amount_php ELSE 0 END), 0) as recorded_php,
        COALESCE(SUM(CASE WHEN status = 'expected' THEN amount_usd ELSE 0 END), 0) as expected_usd,
        COALESCE(SUM(CASE WHEN status = 'expected' THEN amount_php ELSE 0 END), 0) as expected_php
      FROM salaries
      WHERE user_id = ? AND payment_date >= ? AND payment_date <= ?
    `,
    args: [userId, startDate, endDate],
  })

  const row = result.rows[0] as unknown as {
    recorded_usd: number
    recorded_php: number
    expected_usd: number
    expected_php: number
  }
  return {
    recordedUsd: row?.recorded_usd || 0,
    recordedPhp: row?.recorded_php || 0,
    expectedUsd: row?.expected_usd || 0,
    expectedPhp: row?.expected_php || 0,
  }
}

export async function getYearToDateTotals(
  userId: number,
  year: number
): Promise<{ totalUsd: number; totalPhp: number }> {
  const client = getDbClient()
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  const result = await client.execute({
    sql: `
      SELECT COALESCE(SUM(amount_usd), 0) as total_usd, COALESCE(SUM(amount_php), 0) as total_php
      FROM salaries
      WHERE user_id = ? AND payment_date >= ? AND payment_date <= ? AND status = 'recorded'
    `,
    args: [userId, startDate, endDate],
  })

  const row = result.rows[0] as unknown as { total_usd: number; total_php: number }
  return {
    totalUsd: row?.total_usd || 0,
    totalPhp: row?.total_php || 0,
  }
}

export async function updateIncomeSourceAmount(sourceId: number, defaultAmount: number): Promise<void> {
  const client = getDbClient()
  await client.execute({
    sql: 'UPDATE income_sources SET default_amount = ? WHERE id = ?',
    args: [defaultAmount, sourceId],
  })
}
