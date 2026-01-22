import { getDbClient } from './db/client'
import type { Bill, BillCreate, BillPayment, BillCategory } from '@/types/database'

export async function getBillCategories(): Promise<BillCategory[]> {
  const client = getDbClient()
  const result = await client.execute('SELECT * FROM bill_categories ORDER BY name')
  return result.rows as unknown as BillCategory[]
}

export async function createBillCategory(name: string, icon?: string, color?: string): Promise<number> {
  const client = getDbClient()
  const result = await client.execute({
    sql: 'INSERT INTO bill_categories (name, icon, color) VALUES (?, ?, ?)',
    args: [name, icon || null, color || null],
  })
  return Number(result.lastInsertRowid)
}

export async function getBills(userId: number): Promise<Bill[]> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `
      SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM bills b
      LEFT JOIN bill_categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.is_active = 1
      ORDER BY b.amount DESC
    `,
    args: [userId],
  })
  return result.rows as unknown as Bill[]
}

export async function getBillById(id: number): Promise<Bill | null> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `
      SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM bills b
      LEFT JOIN bill_categories c ON b.category_id = c.id
      WHERE b.id = ?
    `,
    args: [id],
  })
  return (result.rows[0] as unknown as Bill) || null
}

export async function createBill(data: BillCreate): Promise<number> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `INSERT INTO bills (user_id, category_id, name, amount, currency, due_day, is_recurring, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.user_id,
      data.category_id || null,
      data.name,
      data.amount,
      data.currency || 'PHP',
      data.due_day || null,
      data.is_recurring !== false ? 1 : 0,
      data.notes || null,
    ],
  })
  return Number(result.lastInsertRowid)
}

export async function updateBill(id: number, data: Partial<BillCreate>): Promise<void> {
  const client = getDbClient()
  const updates: string[] = []
  const args: (string | number | null)[] = []

  if (data.name !== undefined) {
    updates.push('name = ?')
    args.push(data.name)
  }
  if (data.category_id !== undefined) {
    updates.push('category_id = ?')
    args.push(data.category_id || null)
  }
  if (data.amount !== undefined) {
    updates.push('amount = ?')
    args.push(data.amount)
  }
  if (data.due_day !== undefined) {
    updates.push('due_day = ?')
    args.push(data.due_day || null)
  }
  if (data.is_recurring !== undefined) {
    updates.push('is_recurring = ?')
    args.push(data.is_recurring ? 1 : 0)
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?')
    args.push(data.notes || null)
  }

  if (updates.length === 0) return

  updates.push("updated_at = datetime('now')")
  args.push(id)

  await client.execute({
    sql: `UPDATE bills SET ${updates.join(', ')} WHERE id = ?`,
    args,
  })
}

export async function deleteBill(id: number): Promise<void> {
  const client = getDbClient()
  await client.execute({
    sql: 'UPDATE bills SET is_active = 0 WHERE id = ?',
    args: [id],
  })
}

export async function getInactiveBills(userId: number): Promise<Bill[]> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `
      SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM bills b
      LEFT JOIN bill_categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.is_active = 0
      ORDER BY b.amount DESC
    `,
    args: [userId],
  })
  return result.rows as unknown as Bill[]
}

export async function restoreBill(id: number): Promise<void> {
  const client = getDbClient()
  await client.execute({
    sql: 'UPDATE bills SET is_active = 1 WHERE id = ?',
    args: [id],
  })
}

export async function createBillPayment(
  billId: number,
  amountPaid: number,
  paymentDate: string,
  status: 'paid' | 'partial' | 'missed' = 'paid',
  notes?: string
): Promise<number> {
  const client = getDbClient()
  const result = await client.execute({
    sql: `INSERT INTO bill_payments (bill_id, amount_paid, payment_date, status, notes)
          VALUES (?, ?, ?, ?, ?)`,
    args: [billId, amountPaid, paymentDate, status, notes || null],
  })
  return Number(result.lastInsertRowid)
}

export async function getBillPayments(billId: number): Promise<BillPayment[]> {
  const client = getDbClient()
  const result = await client.execute({
    sql: 'SELECT * FROM bill_payments WHERE bill_id = ? ORDER BY payment_date DESC',
    args: [billId],
  })
  return result.rows as unknown as BillPayment[]
}

export async function getBillPaymentsForMonth(userId: number, year: number, month: number): Promise<BillPayment[]> {
  const client = getDbClient()
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const result = await client.execute({
    sql: `
      SELECT bp.*, b.name as bill_name, b.amount as bill_amount
      FROM bill_payments bp
      JOIN bills b ON bp.bill_id = b.id
      WHERE b.user_id = ? AND bp.payment_date >= ? AND bp.payment_date <= ?
      ORDER BY bp.payment_date DESC
    `,
    args: [userId, startDate, endDate],
  })
  return result.rows as unknown as BillPayment[]
}

export async function getBillsSummary(userId: number, year: number, month: number): Promise<{
  totalMonthly: number
  totalPaid: number
  totalPending: number
  totalOverdue: number
}> {
  const client = getDbClient()
  const today = new Date()
  const currentDay = today.getDate()
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

  // Get total monthly bills
  const billsResult = await client.execute({
    sql: 'SELECT COALESCE(SUM(amount), 0) as total FROM bills WHERE user_id = ? AND is_active = 1',
    args: [userId],
  })
  const totalMonthly = Number((billsResult.rows[0] as unknown as { total: number })?.total || 0)

  // Get total paid this month
  const paidResult = await client.execute({
    sql: `
      SELECT COALESCE(SUM(bp.amount_paid), 0) as total
      FROM bill_payments bp
      JOIN bills b ON bp.bill_id = b.id
      WHERE b.user_id = ? AND bp.payment_date >= ? AND bp.payment_date <= ? AND bp.status = 'paid'
    `,
    args: [userId, startDate, endDate],
  })
  const totalPaid = Number((paidResult.rows[0] as unknown as { total: number })?.total || 0)

  // Calculate pending (bills not yet paid this month, due date hasn't passed)
  const pendingResult = await client.execute({
    sql: `
      SELECT COALESCE(SUM(b.amount), 0) as total
      FROM bills b
      WHERE b.user_id = ? AND b.is_active = 1 AND b.due_day >= ?
        AND b.id NOT IN (
          SELECT bp.bill_id FROM bill_payments bp
          WHERE bp.payment_date >= ? AND bp.payment_date <= ?
        )
    `,
    args: [userId, currentDay, startDate, endDate],
  })
  const totalPending = Number((pendingResult.rows[0] as unknown as { total: number })?.total || 0)

  // Calculate overdue (bills not paid, due date has passed)
  const overdueResult = await client.execute({
    sql: `
      SELECT COALESCE(SUM(b.amount), 0) as total
      FROM bills b
      WHERE b.user_id = ? AND b.is_active = 1 AND b.due_day < ?
        AND b.id NOT IN (
          SELECT bp.bill_id FROM bill_payments bp
          WHERE bp.payment_date >= ? AND bp.payment_date <= ?
        )
    `,
    args: [userId, currentDay, startDate, endDate],
  })
  const totalOverdue = Number((overdueResult.rows[0] as unknown as { total: number })?.total || 0)

  return { totalMonthly, totalPaid, totalPending, totalOverdue }
}
