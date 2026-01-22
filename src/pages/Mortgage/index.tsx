import { useState, useEffect } from 'react'
import { Plus, Home, Calculator, Loader2, Trash2, DollarSign } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
import { useAuthStore } from '@/stores/authStore'
import {
  getMortgages,
  createMortgage,
  deleteMortgage,
  getMortgageSummary,
  calculateMonthlyPayment,
  createMortgagePayment,
} from '@/services/mortgage'
import type { Mortgage } from '@/types/database'

interface MortgageWithSummary extends Mortgage {
  summary: {
    totalPaid: number
    totalPrincipalPaid: number
    totalInterestPaid: number
    remainingBalance: number
    paymentsCompleted: number
  }
}

export default function MortgagePage() {
  const { user } = useAuthStore()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedMortgage, setSelectedMortgage] = useState<MortgageWithSummary | null>(null)
  const [mortgages, setMortgages] = useState<MortgageWithSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    propertyName: '',
    principalAmount: '',
    interestRate: '',
    loanTermMonths: '',
    startDate: '',
    lenderName: '',
  })

  useEffect(() => {
    loadData()
  }, [user?.id])

  async function loadData() {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const mortgagesData = await getMortgages(user.id)

      // Fetch summary for each mortgage
      const mortgagesWithSummary = await Promise.all(
        mortgagesData.map(async (mortgage) => {
          const summary = await getMortgageSummary(mortgage.id)
          return { ...mortgage, summary }
        })
      )

      setMortgages(mortgagesWithSummary)
    } catch (error) {
      console.error('Failed to load mortgage data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculatedMonthlyPayment = calculateMonthlyPayment(
    parseFloat(formData.principalAmount) || 0,
    parseFloat(formData.interestRate) || 0,
    parseInt(formData.loanTermMonths) || 0
  )

  async function handleSaveMortgage(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id || !formData.propertyName || !formData.principalAmount ||
        !formData.interestRate || !formData.loanTermMonths || !formData.startDate) {
      return
    }

    setIsSaving(true)
    try {
      await createMortgage({
        user_id: user.id,
        property_name: formData.propertyName,
        principal_amount: parseFloat(formData.principalAmount),
        interest_rate: parseFloat(formData.interestRate),
        loan_term_months: parseInt(formData.loanTermMonths),
        monthly_payment: calculatedMonthlyPayment,
        start_date: formData.startDate,
        lender_name: formData.lenderName || undefined,
      })

      setFormData({
        propertyName: '',
        principalAmount: '',
        interestRate: '',
        loanTermMonths: '',
        startDate: '',
        lenderName: '',
      })
      setIsAddDialogOpen(false)
      await loadData()
    } catch (error) {
      console.error('Failed to save mortgage:', error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRecordPayment(mortgage: MortgageWithSummary) {
    if (!user?.id) return

    try {
      const monthlyRate = mortgage.interest_rate / 100 / 12
      const balance = mortgage.summary.remainingBalance
      const interestPaid = balance * monthlyRate
      const principalPaid = Math.min(mortgage.monthly_payment - interestPaid, balance)
      const newBalance = Math.max(0, balance - principalPaid)

      await createMortgagePayment(
        mortgage.id,
        mortgage.summary.paymentsCompleted + 1,
        principalPaid,
        interestPaid,
        newBalance,
        new Date().toISOString().split('T')[0],
        'paid'
      )

      await loadData()
    } catch (error) {
      console.error('Failed to record payment:', error)
    }
  }

  async function handleDeleteMortgage(mortgageId: number) {
    try {
      await deleteMortgage(mortgageId)
      await loadData()
    } catch (error) {
      console.error('Failed to delete mortgage:', error)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Mortgage"
        subtitle="Track your home loan"
        actions={
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Mortgage
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Mortgage</DialogTitle>
                <DialogDescription>
                  Enter your mortgage details to track payments.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSaveMortgage}>
                <div className="space-y-2">
                  <Label htmlFor="propertyName">Property Name</Label>
                  <Input
                    id="propertyName"
                    placeholder="e.g., My Home"
                    value={formData.propertyName}
                    onChange={(e) =>
                      setFormData({ ...formData, propertyName: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="principalAmount">Principal Amount (PHP)</Label>
                    <Input
                      id="principalAmount"
                      type="number"
                      placeholder="1,000,000"
                      value={formData.principalAmount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          principalAmount: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interestRate">Interest Rate (%)</Label>
                    <Input
                      id="interestRate"
                      type="number"
                      step="0.01"
                      placeholder="6.5"
                      value={formData.interestRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          interestRate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="loanTermMonths">Loan Term (months)</Label>
                    <Input
                      id="loanTermMonths"
                      type="number"
                      placeholder="240"
                      value={formData.loanTermMonths}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          loanTermMonths: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lenderName">Lender Name (optional)</Label>
                  <Input
                    id="lenderName"
                    placeholder="e.g., Bank Name"
                    value={formData.lenderName}
                    onChange={(e) =>
                      setFormData({ ...formData, lenderName: e.target.value })
                    }
                  />
                </div>

                {formData.principalAmount &&
                  formData.interestRate &&
                  formData.loanTermMonths && (
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Calculated Monthly Payment
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        ₱
                        {calculatedMonthlyPayment.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  )}
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
                    Save Mortgage
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : mortgages.length > 0 ? (
          <div className="space-y-6">
            {mortgages.map((mortgage) => {
              const progressPercent = mortgage.principal_amount > 0
                ? ((mortgage.principal_amount - mortgage.summary.remainingBalance) / mortgage.principal_amount) * 100
                : 0

              return (
                <Card key={mortgage.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Home className="h-5 w-5" />
                          {mortgage.property_name}
                        </CardTitle>
                        <CardDescription>
                          {mortgage.lender_name || 'No lender specified'} • Started {new Date(mortgage.start_date).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRecordPayment(mortgage)}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Record Payment
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMortgage(mortgage.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Loan Progress</span>
                        <span className="font-medium">{progressPercent.toFixed(1)}% paid</span>
                      </div>
                      <Progress value={progressPercent} />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>₱{(mortgage.principal_amount - mortgage.summary.remainingBalance).toLocaleString('en-PH', { minimumFractionDigits: 2 })} paid</span>
                        <span>₱{mortgage.summary.remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} remaining</span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Principal</p>
                        <p className="text-lg font-semibold">
                          ₱{mortgage.principal_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Monthly Payment</p>
                        <p className="text-lg font-semibold">
                          ₱{mortgage.monthly_payment.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Interest Rate</p>
                        <p className="text-lg font-semibold">{mortgage.interest_rate}%</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Payments Made</p>
                        <p className="text-lg font-semibold">
                          {mortgage.summary.paymentsCompleted} / {mortgage.loan_term_months}
                        </p>
                      </div>
                    </div>

                    {/* Payment Breakdown */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground">Total Principal Paid</p>
                        <p className="text-lg font-semibold text-green-600">
                          ₱{mortgage.summary.totalPrincipalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground">Total Interest Paid</p>
                        <p className="text-lg font-semibold text-orange-600">
                          ₱{mortgage.summary.totalInterestPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <Home className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No mortgage added yet</h3>
                <p className="text-muted-foreground mt-1 max-w-md">
                  Add your mortgage details to track your payments, see your
                  amortization schedule, and monitor your progress toward owning
                  your home.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Mortgage
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
