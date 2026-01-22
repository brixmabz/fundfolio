type PaymentFrequency = 'weekly' | 'monthly_fixed' | 'none'

interface WeeklySchedule {
  day: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
}

interface MonthlyFixedSchedule {
  dates: number[]
}

type PaymentSchedule = WeeklySchedule | MonthlyFixedSchedule | null

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

/**
 * Get all occurrences of a specific day of week in a given month
 */
export function getAllDayOccurrencesInMonth(
  year: number,
  month: number,
  dayOfWeek: number
): Date[] {
  const dates: Date[] = []
  const date = new Date(year, month, 1)

  // Find first occurrence of the day
  while (date.getDay() !== dayOfWeek) {
    date.setDate(date.getDate() + 1)
  }

  // Collect all occurrences in the month
  while (date.getMonth() === month) {
    dates.push(new Date(date))
    date.setDate(date.getDate() + 7)
  }

  return dates
}

/**
 * Get all Fridays in a given month
 */
export function getFridaysInMonth(year: number, month: number): Date[] {
  return getAllDayOccurrencesInMonth(year, month, 5) // 5 = Friday
}

/**
 * Get fixed dates in a month (e.g., 11th and 26th)
 */
export function getFixedDatesInMonth(
  year: number,
  month: number,
  dates: number[]
): Date[] {
  const result: Date[] = []
  const lastDay = new Date(year, month + 1, 0).getDate()

  for (const day of dates) {
    if (day <= lastDay) {
      result.push(new Date(year, month, day))
    }
  }

  return result.sort((a, b) => a.getTime() - b.getTime())
}

/**
 * Calculate expected payment dates for an income source in a given month
 */
export function getExpectedPaymentDates(
  year: number,
  month: number,
  frequency: PaymentFrequency,
  schedule: PaymentSchedule
): Date[] {
  if (frequency === 'none' || !schedule) {
    return []
  }

  if (frequency === 'weekly' && 'day' in schedule) {
    const dayOfWeek = DAY_MAP[schedule.day]
    return getAllDayOccurrencesInMonth(year, month, dayOfWeek)
  }

  if (frequency === 'monthly_fixed' && 'dates' in schedule) {
    return getFixedDatesInMonth(year, month, schedule.dates)
  }

  return []
}

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDateToISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Parse payment schedule JSON
 */
export function parsePaymentSchedule(scheduleJson: string | null): PaymentSchedule {
  if (!scheduleJson) return null
  try {
    return JSON.parse(scheduleJson)
  } catch {
    return null
  }
}

/**
 * Get count of expected payments in a month for display
 */
export function getExpectedPaymentCount(
  year: number,
  month: number,
  frequency: PaymentFrequency,
  schedule: PaymentSchedule
): number {
  return getExpectedPaymentDates(year, month, frequency, schedule).length
}
