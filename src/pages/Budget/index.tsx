import { useState, useEffect } from 'react'
import { Plus, PiggyBank, Loader2, Trash2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import {
  getBudgetWithSpending,
  getBudgetSummary,
  getCategories,
  createBudget,
  deleteBudget,
} from '@/services/budget'
import type { Budget, BillCategory } from '@/types/database'

export default function BudgetPage() {
  const { user } = useAuthStore()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [budgets, setBudgets] = useState<(Budget & { spent_amount: number })[]>([])
  const [categories, setCategories] = useState<BillCategory[]>([])
  const [summary, setSummary] = useState({ totalBudget: 0, totalSpent: 0, remaining: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    category: '',
    limit: '',
  })

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const monthYearLabel = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    loadData()
  }, [user?.id])

  async function loadData() {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const [budgetsData, categoriesData, summaryData] = await Promise.all([
        getBudgetWithSpending(user.id, currentYear, currentMonth),
        getCategories(),
        getBudgetSummary(user.id, currentYear, currentMonth),
      ])
      setBudgets(budgetsData)
      setCategories(categoriesData)
      setSummary(summaryData)
    } catch (error) {
      console.error('Failed to load budget data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id || !formData.category || !formData.limit) return

    setIsSaving(true)
    try {
      await createBudget({
        user_id: user.id,
        category_id: parseInt(formData.category),
        month: currentMonth,
        year: currentYear,
        limit_amount: parseFloat(formData.limit),
      })

      setFormData({ category: '', limit: '' })
      setIsAddDialogOpen(false)
      await loadData()
    } catch (error) {
      console.error('Failed to save budget:', error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteBudget(budgetId: number) {
    try {
      await deleteBudget(budgetId)
      await loadData()
    } catch (error) {
      console.error('Failed to delete budget:', error)
    }
  }

  // Filter out categories that already have budgets
  const availableCategories = categories.filter(
    (cat) => !budgets.some((b) => b.category_id === cat.id)
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Budget"
        subtitle={monthYearLabel}
        actions={
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Set Budget
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Set Category Budget</DialogTitle>
                <DialogDescription>
                  Set a spending limit for a category this month.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSaveBudget}>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limit">Budget Limit (PHP)</Label>
                  <Input
                    id="limit"
                    type="number"
                    placeholder="5,000"
                    value={formData.limit}
                    onChange={(e) =>
                      setFormData({ ...formData, limit: e.target.value })
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
                    Save Budget
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Budget
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱{summary.totalBudget.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Spent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱{summary.totalSpent.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
              <Progress
                value={summary.totalBudget > 0 ? (summary.totalSpent / summary.totalBudget) * 100 : 0}
                className="mt-2"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Remaining
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.remaining >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ₱{summary.remaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budget Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Category Budgets</CardTitle>
            <CardDescription>
              Track spending against your category limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : budgets.length > 0 ? (
              <div className="space-y-4">
                {budgets.map((budget) => {
                  const percentage = budget.limit_amount > 0
                    ? (budget.spent_amount / budget.limit_amount) * 100
                    : 0
                  const isOverBudget = budget.spent_amount > budget.limit_amount

                  return (
                    <div key={budget.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{budget.category_name}</p>
                          <p className="text-sm text-muted-foreground">
                            ₱{budget.spent_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} of ₱{budget.limit_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isOverBudget ? 'text-red-500' : 'text-muted-foreground'}`}>
                            {percentage.toFixed(0)}%
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteBudget(budget.id)}
                            title="Delete budget"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Progress
                        value={Math.min(percentage, 100)}
                        className={isOverBudget ? '[&>div]:bg-red-500' : ''}
                      />
                      {isOverBudget && (
                        <p className="text-xs text-red-500 mt-1">
                          Over budget by ₱{(budget.spent_amount - budget.limit_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <PiggyBank className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No budgets set yet</h3>
                <p className="text-muted-foreground mt-1 max-w-md">
                  Set budget limits for different categories to track your
                  spending and stay on top of your finances.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Set Your First Budget
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
