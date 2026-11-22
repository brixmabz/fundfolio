import { getDbClient } from './db/client'
import type { Budget, BudgetCreate, BillCategory } from '@/types/database'

export async function getBudgets(userId: number, year: number, month: number): Promise<Budget[]> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `
      SELECT b.*, c.name as category_name
      FROM budgets b
      LEFT JOIN bill_categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.year = ? AND b.month = ?
      ORDER BY c.name
    `,
    args: [userId, year, month],
  })
  return result.rows as unknown as Budget[]
}

export async function getBudgetById(id: number): Promise<Budget | null> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `
      SELECT b.*, c.name as category_name
      FROM budgets b
      LEFT JOIN bill_categories c ON b.category_id = c.id
      WHERE b.id = ?
    `,
    args: [id],
  })
  return (result.rows[0] as unknown as Budget) || null
}

export async function createBudget(data: BudgetCreate): Promise<number> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `INSERT INTO budgets (user_id, category_id, month, year, limit_amount, currency)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      data.user_id,
      data.category_id,
      data.month,
      data.year,
      data.limit_amount,
      data.currency || 'PHP',
    ],
  })
  return Number(result.lastInsertRowid)
}

export async function updateBudget(id: number, limitAmount: number): Promise<void> {
  const client = getDbClient()
  await client.execute({
    sql: 'UPDATE budgets SET limit_amount = ? WHERE id = ?',
    args: [limitAmount, id],
  })
}

export async function deleteBudget(id: number): Promise<void> {
  const client = getDbClient()
  await client.execute({
    sql: 'DELETE FROM budgets WHERE id = ?',
    args: [id],
  })
}

export async function getBudgetWithSpending(
  userId: number,
  year: number,
  month: number
): Promise<(Budget & { spent_amount: number })[]> {
  const client = getDbClient()
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const result = await client.execute({
    sql: `
      SELECT
        b.*,
        c.name as category_name,
        COALESCE(
          (SELECT SUM(bp.amount_paid)
           FROM bill_payments bp
           JOIN bills bl ON bp.bill_id = bl.id
           WHERE bl.category_id = b.category_id
             AND bl.user_id = b.user_id
             AND bp.payment_date >= ?
             AND bp.payment_date <= ?),
          0
        ) as spent_amount
      FROM budgets b
      LEFT JOIN bill_categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.year = ? AND b.month = ?
      ORDER BY c.name
    `,
    args: [startDate, endDate, userId, year, month],
  })
  return result.rows as unknown as (Budget & { spent_amount: number })[]
}

export async function getBudgetSummary(
  userId: number,
  year: number,
  month: number
): Promise<{ totalBudget: number; totalSpent: number; remaining: number }> {
  const client = getDbClient()
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Get total budget
  const budgetResult = await client.execute({
    sql: 'SELECT COALESCE(SUM(limit_amount), 0) as total FROM budgets WHERE user_id = ? AND year = ? AND month = ?',
    args: [userId, year, month],
  })
  const totalBudget = Number((budgetResult.rows[0] as unknown as { total: number })?.total || 0)

  // Get total spent on budgeted categories
  const spentResult = await client.execute({
    sql: `
      SELECT COALESCE(SUM(bp.amount_paid), 0) as total
      FROM bill_payments bp
      JOIN bills bl ON bp.bill_id = bl.id
      WHERE bl.user_id = ?
        AND bp.payment_date >= ?
        AND bp.payment_date <= ?
        AND bl.category_id IN (SELECT category_id FROM budgets WHERE user_id = ? AND year = ? AND month = ?)
    `,
    args: [userId, startDate, endDate, userId, year, month],
  })
  const totalSpent = Number((spentResult.rows[0] as unknown as { total: number })?.total || 0)

  return {
    totalBudget,
    totalSpent,
    remaining: totalBudget - totalSpent,
  }
}

export async function getCategories(): Promise<BillCategory[]> {
  const client = getDbClient()
  const result = await client.execute('SELECT * FROM bill_categories ORDER BY name')
  return result.rows as unknown as BillCategory[]
}
