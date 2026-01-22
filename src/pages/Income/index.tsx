import { useState, useEffect } from 'react'
import {
  Plus,
  Wallet,
  DollarSign,
  ArrowRightLeft,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import {
  getIncomeSources,
  getIncomeSourceByName,
  createSalary,
  getSalariesByMonth,
  getMonthlyTotals,
  getYearToDateTotals,
  deleteSalary,
  updateIncomeSourceAmount,
} from '@/services/income'
import { useAuthStore } from '@/stores/authStore'
import type { IncomeSource, Salary } from '@/types/database'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  getExpectedPaymentDates,
  parsePaymentSchedule,
  formatDateToISO,
} from '@/lib/paymentDates'
export default function IncomePage() {
  const { user } = useAuthStore()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false)
  const [selectedSalary, setSelectedSalary] = useState<Salary | null>(null)
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
  const [salaries, setSalaries] = useState<Salary[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState({
    recordedUsd: 0,
    recordedPhp: 0,
    expectedUsd: 0,
    expectedPhp: 0,
  })
  const [yearToDateTotals, setYearToDateTotals] = useState({ totalUsd: 0, totalPhp: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [recordFormData, setRecordFormData] = useState({
    amountUsd: '',
    exchangeRate: '',
    description: '',
  })
  const [formData, setFormData] = useState({
    source: '',
    amountUsd: '',
    exchangeRate: '',
    paymentDate: new Date().toISOString().split('T')[0],
    description: '',
  })
  const [generateAmounts, setGenerateAmounts] = useState<Record<number, string>>({})

  // Current viewing month
  const [viewDate, setViewDate] = useState(new Date())
  const currentMonth = viewDate.getMonth()
  const currentYear = viewDate.getFullYear()

  // Placeholder exchange rate
  const marketRate = 58.5

  // Load data on mount and when month changes
  useEffect(() => {
    loadData()
  }, [currentMonth, currentYear, user?.id])

  async function loadData() {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const [sources, entries, totals, ytdTotals] = await Promise.all([
        getIncomeSources(),
        getSalariesByMonth(user.id, currentYear, currentMonth),
        getMonthlyTotals(user.id, currentYear, currentMonth),
        getYearToDateTotals(user.id, currentYear),
      ])
      setIncomeSources(sources)
      setSalaries(entries)
      setYearToDateTotals(ytdTotals)
      setMonthlyTotals(totals)
    } catch (error) {
      console.error('Failed to load income data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveIncome(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id || !formData.source || !formData.amountUsd || !formData.exchangeRate) {
      return
    }

    setIsSaving(true)
    try {
      // Get source_id from the selected source name
      const source = await getIncomeSourceByName(formData.source)
      if (!source) {
        console.error('Income source not found:', formData.source)
        return
      }

      const amountUsd = parseFloat(formData.amountUsd)
      const exchangeRate = parseFloat(formData.exchangeRate)
      const amountPhp = amountUsd * exchangeRate

      await createSalary({
        user_id: user.id,
        source_id: source.id,
        amount_usd: amountUsd,
        amount_php: amountPhp,
        exchange_rate_used: exchangeRate,
        exchange_rate_market: marketRate,
        payment_date: formData.paymentDate,
        description: formData.description || undefined,
        status: 'recorded',
      })

      // Reset form and close dialog
      setFormData({
        source: '',
        amountUsd: '',
        exchangeRate: '',
        paymentDate: new Date().toISOString().split('T')[0],
        description: '',
      })
      setIsAddDialogOpen(false)

      // Refresh the data
      await loadData()
    } catch (error) {
      console.error('Failed to save income:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSourceChange = (value: string) => {
    setFormData({ ...formData, source: value })
    if (value === 'deel') {
      setFormData({
        ...formData,
        source: value,
        exchangeRate: (marketRate * 0.985).toFixed(2),
      })
    } else if (value === 'upwork') {
      setFormData({
        ...formData,
        source: value,
        exchangeRate: (marketRate * 0.975).toFixed(2),
      })
    }
  }

  async function handleGenerateExpected() {
    if (!user?.id) return

    setIsSaving(true)
    try {
      // Save updated default amounts
      for (const source of incomeSources) {
        if (source.payment_frequency === 'none') continue
        const newAmount = parseFloat(generateAmounts[source.id] || '0')
        if (newAmount !== source.default_amount) {
          await updateIncomeSourceAmount(source.id, newAmount)
        }
      }

      // Get existing salaries for this month to avoid duplicates
      const existingSalaries = await getSalariesByMonth(user.id, currentYear, currentMonth)
      const existingDates = new Set(
        existingSalaries.map((s) => `${s.source_id}-${s.payment_date}`)
      )

      for (const source of incomeSources) {
        if (source.payment_frequency === 'none' || !source.payment_schedule) continue

        const schedule = parsePaymentSchedule(source.payment_schedule)
        const dates = getExpectedPaymentDates(
          currentYear,
          currentMonth,
          source.payment_frequency,
          schedule
        )

        const amountUsd = parseFloat(generateAmounts[source.id] || '0')
        const exchangeRate = marketRate * (1 - (source.markup_percentage || 0))
        const amountPhp = amountUsd * exchangeRate

        for (const date of dates) {
          const dateStr = formatDateToISO(date)
          const key = `${source.id}-${dateStr}`

          // Skip if already exists
          if (existingDates.has(key)) continue

          await createSalary({
            user_id: user.id,
            source_id: source.id,
            amount_usd: amountUsd,
            amount_php: amountPhp,
            exchange_rate_used: exchangeRate,
            payment_date: dateStr,
            status: 'expected',
          })
        }
      }

      setIsGenerateDialogOpen(false)
      await loadData()
    } catch (error) {
      console.error('Failed to generate expected entries:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setViewDate((prev) => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const monthYearLabel = viewDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Count expected payments per source for the current month
  const getExpectedCounts = () => {
    const counts: Record<string, number> = { deel: 0, upwork: 0 }
    for (const source of incomeSources) {
      if (source.payment_frequency === 'none' || !source.payment_schedule) continue
      const schedule = parsePaymentSchedule(source.payment_schedule)
      const dates = getExpectedPaymentDates(
        currentYear,
        currentMonth,
        source.payment_frequency,
        schedule
      )
      counts[source.name] = dates.length
    }
    return counts
  }

  const expectedCounts = getExpectedCounts()

  function handleRecordExpected(salary: Salary) {
    setSelectedSalary(salary)
    // Find the source to pre-fill the exchange rate
    const source = incomeSources.find((s) => s.id === salary.source_id)
    const markupRate = source?.markup_percentage || 0
    setRecordFormData({
      amountUsd: '',
      exchangeRate: (marketRate * (1 - markupRate)).toFixed(2),
      description: '',
    })
    setIsRecordDialogOpen(true)
  }

  async function handleSaveRecord(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSalary || !recordFormData.amountUsd || !recordFormData.exchangeRate) return

    setIsSaving(true)
    try {
      const amountUsd = parseFloat(recordFormData.amountUsd)
      const exchangeRate = parseFloat(recordFormData.exchangeRate)
      const amountPhp = amountUsd * exchangeRate

      // Delete the expected entry and create a recorded one
      await deleteSalary(selectedSalary.id)
      await createSalary({
        user_id: selectedSalary.user_id,
        source_id: selectedSalary.source_id,
        amount_usd: amountUsd,
        amount_php: amountPhp,
        exchange_rate_used: exchangeRate,
        exchange_rate_market: marketRate,
        payment_date: selectedSalary.payment_date,
        description: recordFormData.description || undefined,
        status: 'recorded',
      })

      setIsRecordDialogOpen(false)
      setSelectedSalary(null)
      await loadData()
    } catch (error) {
      console.error('Failed to record income:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Income"
        subtitle="Track your salary and earnings"
        actions={
          <div className="flex gap-2">
            <Dialog
              open={isGenerateDialogOpen}
              onOpenChange={(open) => {
                setIsGenerateDialogOpen(open)
                if (open) {
                  // Initialize amounts from income sources
                  const amounts: Record<number, string> = {}
                  incomeSources.forEach((source) => {
                    if (source.payment_frequency !== 'none') {
                      amounts[source.id] = String(source.default_amount || 0)
                    }
                  })
                  setGenerateAmounts(amounts)
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Calendar className="h-4 w-4 mr-2" />
                  Generate Expected
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                  <DialogTitle>Generate Expected Entries</DialogTitle>
                  <DialogDescription>
                    Create placeholder entries for expected payments in{' '}
                    {monthYearLabel}. You can update default amounts here.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {incomeSources
                    .filter((s) => s.payment_frequency !== 'none')
                    .map((source) => (
                      <div key={source.id} className="space-y-2 p-3 bg-muted rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{source.display_name}</span>
                          <Badge variant="secondary">
                            {expectedCounts[source.name] || 0} payments
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">
                            Amount (USD):
                          </Label>
                          <div className="relative flex-1">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              className="pl-7 h-8"
                              value={generateAmounts[source.id] || ''}
                              onChange={(e) =>
                                setGenerateAmounts({
                                  ...generateAmounts,
                                  [source.id]: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {source.name === 'deel' && '11th & 26th of each month'}
                          {source.name === 'upwork' && 'Every Friday'}
                        </p>
                      </div>
                    ))}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsGenerateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleGenerateExpected} disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Generate {expectedCounts.deel + expectedCounts.upwork}{' '}
                    Entries
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Income
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add Income</DialogTitle>
                  <DialogDescription>
                    Record a new income entry from Deel, Upwork, or other
                    sources.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleSaveIncome}>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Select
                      value={formData.source}
                      onValueChange={handleSourceChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select income source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deel">Deel</SelectItem>
                        <SelectItem value="upwork">Upwork</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amountUsd">Amount (USD)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="amountUsd"
                          type="number"
                          placeholder="0.00"
                          className="pl-9"
                          value={formData.amountUsd}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amountUsd: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exchangeRate">Exchange Rate</Label>
                      <div className="relative">
                        <ArrowRightLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="exchangeRate"
                          type="number"
                          placeholder={marketRate.toString()}
                          className="pl-9"
                          value={formData.exchangeRate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              exchangeRate: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {formData.amountUsd && formData.exchangeRate && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Amount in PHP:
                        </span>
                        <span className="font-semibold text-primary">
                          ₱
                          {(
                            parseFloat(formData.amountUsd) *
                            parseFloat(formData.exchangeRate)
                          ).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-muted-foreground">
                          Market rate:
                        </span>
                        <span>₱{marketRate}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="paymentDate">Payment Date</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={formData.paymentDate}
                      onChange={(e) =>
                        setFormData({ ...formData, paymentDate: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                      id="description"
                      placeholder="e.g., January salary"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Income
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Record Expected Entry Dialog */}
      <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Income</DialogTitle>
            <DialogDescription>
              Record the actual payment for{' '}
              {selectedSalary && new Date(selectedSalary.payment_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveRecord}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recordAmountUsd">Amount (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="recordAmountUsd"
                    type="number"
                    placeholder="0.00"
                    className="pl-9"
                    value={recordFormData.amountUsd}
                    onChange={(e) =>
                      setRecordFormData({
                        ...recordFormData,
                        amountUsd: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recordExchangeRate">Exchange Rate</Label>
                <div className="relative">
                  <ArrowRightLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="recordExchangeRate"
                    type="number"
                    placeholder={marketRate.toString()}
                    className="pl-9"
                    value={recordFormData.exchangeRate}
                    onChange={(e) =>
                      setRecordFormData({
                        ...recordFormData,
                        exchangeRate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {recordFormData.amountUsd && recordFormData.exchangeRate && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Amount in PHP:</span>
                  <span className="font-semibold text-primary">
                    ₱
                    {(
                      parseFloat(recordFormData.amountUsd) *
                      parseFloat(recordFormData.exchangeRate)
                    ).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="recordDescription">Description (optional)</Label>
              <Input
                id="recordDescription"
                placeholder="e.g., January salary"
                value={recordFormData.description}
                onChange={(e) =>
                  setRecordFormData({
                    ...recordFormData,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsRecordDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Record Income
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">{monthYearLabel}</h2>
          <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recorded This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ₱{monthlyTotals.recordedPhp.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                ${monthlyTotals.recordedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expected This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                ₱{monthlyTotals.expectedPhp.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                ${monthlyTotals.expectedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Year to Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱{yearToDateTotals.totalPhp.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                ${yearToDateTotals.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Income Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Income History</CardTitle>
                <CardDescription>
                  All your recorded income entries
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-9 w-[200px]" />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : salaries.length > 0 ? (
              <div className="space-y-2">
                {salaries.map((salary) => (
                  <div
                    key={`salary-${salary.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${salary.status === 'expected' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                      <div>
                        <p className="font-medium">{salary.display_name || salary.source_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(salary.payment_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {salary.status === 'recorded' ? (
                        <div className="text-right">
                          <p className="font-medium">
                            ₱{salary.amount_php.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${salary.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} @ {salary.exchange_rate_used}
                          </p>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRecordExpected(salary)}
                        >
                          Record
                        </Button>
                      )}
                      <Badge variant={salary.status === 'expected' ? 'outline' : 'default'}>
                        {salary.status === 'expected' ? 'Expected' : 'Recorded'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Wallet className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No income recorded yet</h3>
                <p className="text-muted-foreground mt-1">
                  Generate expected entries or add your first income to start
                  tracking.
                </p>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsGenerateDialogOpen(true)}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Generate Expected
                  </Button>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Income
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
