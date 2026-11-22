import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BILL_FILTERS,
  FILTER_ALL,
  getActiveFilterCount,
  type BillFilterContext,
  type BillFilterValues,
} from './filters'

interface BillFiltersProps {
  values: BillFilterValues
  onChange: (values: BillFilterValues) => void
  context: BillFilterContext
}

/** Renders one dropdown per entry in BILL_FILTERS. */
export function BillFilters({ values, onChange, context }: BillFiltersProps) {
  const activeCount = getActiveFilterCount(values)

  return (
    <div className="flex flex-wrap items-end gap-3">
      {BILL_FILTERS.map((filter) => (
        <div key={filter.id} className="space-y-1 w-full sm:w-40">
          <Label htmlFor={`filter-${filter.id}`} className="text-xs text-muted-foreground">
            {filter.label}
          </Label>
          <Select
            value={values[filter.id] ?? FILTER_ALL}
            onValueChange={(value) => onChange({ ...values, [filter.id]: value })}
          >
            <SelectTrigger id={`filter-${filter.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All</SelectItem>
              {filter.getOptions(context).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          <X className="h-4 w-4 mr-1" />
          Clear filters ({activeCount})
        </Button>
      )}
    </div>
  )
}
