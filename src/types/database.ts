export interface User {
  id: number
  username: string
  password_hash: string
  created_at: string
  updated_at: string
}

export type PaymentFrequency = 'weekly' | 'monthly_fixed' | 'none'

export interface IncomeSource {
  id: number
  name: string
  display_name: string
  default_currency: string
  markup_percentage: number
  payment_frequency: PaymentFrequency
  payment_schedule: string | null
  default_amount: number
}

export type SalaryStatus = 'expected' | 'recorded'

export interface Salary {
  id: number
  user_id: number
  source_id: number
  amount_usd: number
  amount_php: number
  exchange_rate_used: number
  exchange_rate_market: number | null
  payment_date: string
  description: string | null
  status: SalaryStatus
  created_at: string
  source_name?: string
  display_name?: string
}

export interface SalaryCreate {
  user_id: number
  source_id: number
  amount_usd: number
  amount_php: number
  exchange_rate_used: number
  exchange_rate_market?: number
  payment_date: string
  description?: string
  status?: SalaryStatus
}

export interface BillCategory {
  id: number
  name: string
  icon: string | null
  color: string | null
}

export interface Bill {
  id: number
  user_id: number
  category_id: number | null
  name: string
  amount: number
  currency: string
  due_day: number | null
  maturity_date: string | null
  is_recurring: boolean
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  category_name?: string
  category_icon?: string
  category_color?: string
}

export interface BillCreate {
  user_id: number
  category_id?: number
  name: string
  amount: number
  currency?: string
  due_day?: number
  maturity_date?: string | null
  is_recurring?: boolean
  notes?: string
}

export interface BillPayment {
  id: number
  bill_id: number
  amount_paid: number
  payment_date: string
  status: 'paid' | 'partial' | 'missed'
  notes: string | null
  created_at: string
}

export interface Mortgage {
  id: number
  user_id: number
  property_name: string
  principal_amount: number
  interest_rate: number
  loan_term_months: number
  monthly_payment: number
  start_date: string
  currency: string
  lender_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MortgageCreate {
  user_id: number
  property_name: string
  principal_amount: number
  interest_rate: number
  loan_term_months: number
  monthly_payment: number
  start_date: string
  currency?: string
  lender_name?: string
  notes?: string
}

export interface MortgagePayment {
  id: number
  mortgage_id: number
  payment_number: number
  principal_paid: number
  interest_paid: number
  total_paid: number
  remaining_balance: number
  payment_date: string
  status: 'paid' | 'pending' | 'missed'
  notes: string | null
  created_at: string
}

export interface ExchangeRate {
  id: number
  from_currency: string
  to_currency: string
  rate: number
  source: 'market' | 'deel' | 'upwork' | 'manual'
  recorded_at: string
}

export interface Budget {
  id: number
  user_id: number
  category_id: number
  month: number
  year: number
  limit_amount: number
  currency: string
  category_name?: string
  spent_amount?: number
}

export interface BudgetCreate {
  user_id: number
  category_id: number
  month: number
  year: number
  limit_amount: number
  currency?: string
}

export interface Setting {
  id: number
  user_id: number
  key: string
  value: string
}
