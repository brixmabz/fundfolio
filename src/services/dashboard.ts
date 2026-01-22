import { getDbClient } from './db/client'
import { getMonthlyTotals } from './income'
import { getBillsSummary, getBills } from './bills'
// getBudgetSummary imported for future use
import type {} from './budget'
import { getMortgages, getMortgageSummary } from './mortgage'

export interface DashboardStats {
  totalIncome: number
  totalIncomeUsd: number
  totalExpenses: number
  savings: number
  mortgageBalance: number
}

export interface UpcomingBill {
  id: number
  name: string
  amount: number
  dueDay: number
  categoryName: string | null
  categoryColor: string | null
}

export async function getDashboardStats(userId: number, year: number, month: number): Promise<DashboardStats> {
  // Get income totals
  const incomeTotals = await getMonthlyTotals(userId, year, month)

  // Get bills/expenses summary
  const billsSummary = await getBillsSummary(userId, year, month)

  // Get mortgage balance
  const mortgages = await getMortgages(userId)
  let mortgageBalance = 0
  for (const mortgage of mortgages) {
    const summary = await getMortgageSummary(mortgage.id)
    mortgageBalance += summary.remainingBalance
  }

  // Calculate savings (recorded income - expenses)
  const savings = incomeTotals.recordedPhp - billsSummary.totalPaid

  return {
    totalIncome: incomeTotals.recordedPhp,
    totalIncomeUsd: incomeTotals.recordedUsd,
    totalExpenses: billsSummary.totalPaid,
    savings,
    mortgageBalance,
  }
}

export async function getUpcomingBills(userId: number): Promise<UpcomingBill[]> {
  const currentDate = new Date()
  const currentDay = currentDate.getDate()

  const bills = await getBills(userId)

  // Filter to bills due in the next 7 days or overdue
  const upcomingBills = bills
    .filter((bill) => {
      if (!bill.due_day) return false
      // Include if due within 7 days or overdue
      const daysUntilDue = bill.due_day - currentDay
      return daysUntilDue <= 7
    })
    .slice(0, 5) // Limit to 5 bills

  return upcomingBills.map((bill) => ({
    id: bill.id,
    name: bill.name,
    amount: bill.amount,
    dueDay: bill.due_day || 0,
    categoryName: bill.category_name || null,
    categoryColor: bill.category_color || null,
  }))
}

export async function getRecentSalaries(userId: number, limit: number = 5): Promise<Array<{
  id: number
  sourceName: string
  amountPhp: number
  amountUsd: number
  paymentDate: string
}>> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `
      SELECT s.id, i.display_name as source_name, s.amount_php, s.amount_usd, s.payment_date
      FROM salaries s
      JOIN income_sources i ON s.source_id = i.id
      WHERE s.user_id = ?
      ORDER BY s.payment_date DESC
      LIMIT ?
    `,
    args: [userId, limit],
  })

  return result.rows.map((row: unknown) => {
    const r = row as { id: number; source_name: string; amount_php: number; amount_usd: number; payment_date: string }
    return {
      id: r.id,
      sourceName: r.source_name,
      amountPhp: r.amount_php,
      amountUsd: r.amount_usd,
      paymentDate: r.payment_date,
    }
  })
}
