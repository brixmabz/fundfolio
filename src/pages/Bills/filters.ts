import type { Bill, BillCategory } from '@/types/database'

/** Data a filter may need besides the bill itself. Extend this when a new filter needs more. */
export interface BillFilterContext {
  categories: BillCategory[]
  isOverdue: (bill: Bill) => boolean
}

export interface FilterOption {
  value: string
  label: string
}

export interface BillFilterDefinition {
  id: string
  label: string
  /** Options shown in the dropdown (the "All" option is added automatically). */
  getOptions: (ctx: BillFilterContext) => FilterOption[]
  /** Returns true if the bill should be shown for the selected option value. */
  matches: (bill: Bill, value: string, ctx: BillFilterContext) => boolean
}

/** Sentinel value meaning "filter not applied". */
export const FILTER_ALL = 'all'

const UNCATEGORIZED = 'none'

/**
 * Filters shown on the Bills page, in display order.
 * To add a filter, append a definition here; the UI and filtering pick it up automatically.
 */
export const BILL_FILTERS: BillFilterDefinition[] = [
  {
    id: 'status',
    label: 'Status',
    getOptions: () => [
      { value: 'overdue', label: 'Overdue' },
      { value: 'not-overdue', label: 'Not overdue' },
    ],
    matches: (bill, value, ctx) =>
      value === 'overdue' ? ctx.isOverdue(bill) : !ctx.isOverdue(bill),
  },
  {
    id: 'category',
    label: 'Category',
    getOptions: (ctx) => [
      ...ctx.categories.map((c) => ({ value: String(c.id), label: c.name })),
      { value: UNCATEGORIZED, label: 'Uncategorized' },
    ],
    matches: (bill, value) =>
      value === UNCATEGORIZED ? bill.category_id == null : String(bill.category_id) === value,
  },
]

export type BillFilterValues = Record<string, string>

export function getActiveFilterCount(values: BillFilterValues): number {
  return Object.values(values).filter((v) => v && v !== FILTER_ALL).length
}

export function applyBillFilters(
  bills: Bill[],
  values: BillFilterValues,
  ctx: BillFilterContext
): Bill[] {
  const active = BILL_FILTERS.filter((f) => values[f.id] && values[f.id] !== FILTER_ALL)
  if (active.length === 0) return bills
  return bills.filter((bill) => active.every((f) => f.matches(bill, values[f.id], ctx)))
}
