import { getDbClient } from './db/client'
import type { Mortgage, MortgageCreate, MortgagePayment } from '@/types/database'

export async function getMortgages(userId: number): Promise<Mortgage[]> {
  const client = getDbClient()
  const result = await client.execute({
    sql: 'SELECT * FROM mortgages WHERE user_id = ? ORDER BY start_date DESC',
    args: [userId],
  })
  return result.rows as unknown as Mortgage[]
}

export async function getMortgageById(id: number): Promise<Mortgage | null> {
  const client = getDbClient()
  const result = await client.execute({
    sql: 'SELECT * FROM mortgages WHERE id = ?',
    args: [id],
  })
  return (result.rows[0] as unknown as Mortgage) || null
}

export async function createMortgage(data: MortgageCreate): Promise<number> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `INSERT INTO mortgages (user_id, property_name, principal_amount, interest_rate, loan_term_months, monthly_payment, start_date, currency, lender_name, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.user_id,
      data.property_name,
      data.principal_amount,
      data.interest_rate,
      data.loan_term_months,
      data.monthly_payment,
      data.start_date,
      data.currency || 'PHP',
      data.lender_name || null,
      data.notes || null,
    ],
  })
  return Number(result.lastInsertRowid)
}

export async function updateMortgage(id: number, data: Partial<MortgageCreate>): Promise<void> {
  const client = getDbClient()
  const updates: string[] = []
  const args: (string | number | null)[] = []

  if (data.property_name !== undefined) {
    updates.push('property_name = ?')
    args.push(data.property_name)
  }
  if (data.principal_amount !== undefined) {
    updates.push('principal_amount = ?')
    args.push(data.principal_amount)
  }
  if (data.interest_rate !== undefined) {
    updates.push('interest_rate = ?')
    args.push(data.interest_rate)
  }
  if (data.loan_term_months !== undefined) {
    updates.push('loan_term_months = ?')
    args.push(data.loan_term_months)
  }
  if (data.monthly_payment !== undefined) {
    updates.push('monthly_payment = ?')
    args.push(data.monthly_payment)
  }
  if (data.lender_name !== undefined) {
    updates.push('lender_name = ?')
    args.push(data.lender_name || null)
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?')
    args.push(data.notes || null)
  }

  if (updates.length === 0) return

  updates.push("updated_at = datetime('now')")
  args.push(id)

  await client.execute({
    sql: `UPDATE mortgages SET ${updates.join(', ')} WHERE id = ?`,
    args,
  })
}

export async function deleteMortgage(id: number): Promise<void> {
  const client = getDbClient()
  // Delete payments first
  await client.execute({
    sql: 'DELETE FROM mortgage_payments WHERE mortgage_id = ?',
    args: [id],
  })
  // Then delete the mortgage
  await client.execute({
    sql: 'DELETE FROM mortgages WHERE id = ?',
    args: [id],
  })
}

export async function getMortgagePayments(mortgageId: number): Promise<MortgagePayment[]> {
  const client = getDbClient()
  const result = await client.execute({
    sql: 'SELECT * FROM mortgage_payments WHERE mortgage_id = ? ORDER BY payment_number ASC',
    args: [mortgageId],
  })
  return result.rows as unknown as MortgagePayment[]
}

export async function createMortgagePayment(
  mortgageId: number,
  paymentNumber: number,
  principalPaid: number,
  interestPaid: number,
  remainingBalance: number,
  paymentDate: string,
  status: 'paid' | 'pending' | 'missed' = 'paid',
  notes?: string
): Promise<number> {
  const client = getDbClient()
  const totalPaid = principalPaid + interestPaid

  const result = await client.execute({
    sql: `INSERT INTO mortgage_payments (mortgage_id, payment_number, principal_paid, interest_paid, total_paid, remaining_balance, payment_date, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [mortgageId, paymentNumber, principalPaid, interestPaid, totalPaid, remainingBalance, paymentDate, status, notes || null],
  })
  return Number(result.lastInsertRowid)
}

export async function getMortgageSummary(mortgageId: number): Promise<{
  totalPaid: number
  totalPrincipalPaid: number
  totalInterestPaid: number
  remainingBalance: number
  paymentsCompleted: number
}> {
  const client = getDbClient()

  const result = await client.execute({
    sql: `
      SELECT
        COALESCE(SUM(total_paid), 0) as total_paid,
        COALESCE(SUM(principal_paid), 0) as total_principal_paid,
        COALESCE(SUM(interest_paid), 0) as total_interest_paid,
        COUNT(*) as payments_completed
      FROM mortgage_payments
      WHERE mortgage_id = ? AND status = 'paid'
    `,
    args: [mortgageId],
  })

  const row = result.rows[0] as unknown as {
    total_paid: number
    total_principal_paid: number
    total_interest_paid: number
    payments_completed: number
  }

  // Get current remaining balance from the latest payment
  const latestPayment = await client.execute({
    sql: `
      SELECT remaining_balance
      FROM mortgage_payments
      WHERE mortgage_id = ? AND status = 'paid'
      ORDER BY payment_number DESC
      LIMIT 1
    `,
    args: [mortgageId],
  })

  // Get principal if no payments yet
  const mortgage = await getMortgageById(mortgageId)
  const remainingBalance = latestPayment.rows[0]
    ? Number((latestPayment.rows[0] as unknown as { remaining_balance: number }).remaining_balance)
    : mortgage?.principal_amount || 0

  return {
    totalPaid: row?.total_paid || 0,
    totalPrincipalPaid: row?.total_principal_paid || 0,
    totalInterestPaid: row?.total_interest_paid || 0,
    remainingBalance,
    paymentsCompleted: Number(row?.payments_completed || 0),
  }
}

// Calculate monthly payment using the amortization formula
export function calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || annualRate <= 0 || months <= 0) return 0

  const monthlyRate = annualRate / 100 / 12
  const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)

  return payment
}

// Generate amortization schedule
export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  months: number,
  monthlyPayment: number
): Array<{
  paymentNumber: number
  principalPaid: number
  interestPaid: number
  totalPaid: number
  remainingBalance: number
}> {
  const schedule = []
  let balance = principal
  const monthlyRate = annualRate / 100 / 12

  for (let i = 1; i <= months && balance > 0; i++) {
    const interestPaid = balance * monthlyRate
    const principalPaid = Math.min(monthlyPayment - interestPaid, balance)
    balance = Math.max(0, balance - principalPaid)

    schedule.push({
      paymentNumber: i,
      principalPaid,
      interestPaid,
      totalPaid: principalPaid + interestPaid,
      remainingBalance: balance,
    })
  }

  return schedule
}
