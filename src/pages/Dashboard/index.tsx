import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Wallet,
  PiggyBank,
  Receipt,
  Home,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { getDashboardStats, getUpcomingBills, getRecentSalaries } from '@/services/dashboard'
import { getBudgetSummary } from '@/services/budget'

interface DashboardData {
  totalIncome: number
  totalIncomeUsd: number
  totalExpenses: number
  savings: number
  mortgageBalance: number
}

interface UpcomingBill {
  id: number
  name: string
  amount: number
  dueDay: number
  categoryName: string | null
  categoryColor: string | null
}

interface BudgetData {
  totalBudget: number
  totalSpent: number
  remaining: number
}

interface RecentSalary {
  id: number
  sourceName: string
  amountPhp: number
  amountUsd: number
  paymentDate: string
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<DashboardData>({
    totalIncome: 0,
    totalIncomeUsd: 0,
    totalExpenses: 0,
    savings: 0,
    mortgageBalance: 0,
  })
  const [upcomingBills, setUpcomingBills] = useState<UpcomingBill[]>([])
  const [budgetData, setBudgetData] = useState<BudgetData>({ totalBudget: 0, totalSpent: 0, remaining: 0 })
  const [recentSalaries, setRecentSalaries] = useState<RecentSalary[]>([])
  const [isLoading, setIsLoading] = useState(false)

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
      const [dashboardStats, bills, budget, salaries] = await Promise.all([
        getDashboardStats(user.id, currentYear, currentMonth),
        getUpcomingBills(user.id),
        getBudgetSummary(user.id, currentYear, currentMonth),
        getRecentSalaries(user.id, 5),
      ])
      setStats(dashboardStats)
      setUpcomingBills(bills)
      setBudgetData(budget)
      setRecentSalaries(salaries)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Total Income',
      value: `₱${stats.totalIncome.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      subtext: `$${stats.totalIncomeUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
      trend: stats.totalIncome > 0 ? 'up' : 'neutral',
      icon: Wallet,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Expenses',
      value: `₱${stats.totalExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      subtext: 'This month',
      trend: 'neutral',
      icon: Receipt,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Savings',
      value: `₱${stats.savings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      subtext: 'Income - Expenses',
      trend: stats.savings > 0 ? 'up' : stats.savings < 0 ? 'down' : 'neutral',
      icon: PiggyBank,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Mortgage Balance',
      value: `₱${stats.mortgageBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      subtext: 'Remaining',
      trend: 'neutral',
      icon: Home,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ]

  const quickActions = [
    { label: 'Add Income', icon: Plus, href: '/income' },
    { label: 'Add Bill', icon: Plus, href: '/bills' },
    { label: 'Record Payment', icon: ArrowUpRight, href: '/mortgage' },
  ]

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Dashboard" subtitle={monthYearLabel} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Dashboard"
        subtitle={monthYearLabel}
        actions={
          <Button size="sm" asChild>
            <Link to="/income">
              <Plus className="h-4 w-4 mr-2" />
              Quick Add
            </Link>
          </Button>
        }
      />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <stat.icon className={cn('h-4 w-4', stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  {stat.trend === 'up' && (
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                  )}
                  {stat.trend === 'down' && (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={cn(
                      'text-xs',
                      stat.trend === 'up' && 'text-green-500',
                      stat.trend === 'down' && 'text-red-500',
                      stat.trend === 'neutral' && 'text-muted-foreground'
                    )}
                  >
                    {stat.subtext}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks you can do</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="w-full justify-start"
                  asChild
                >
                  <Link to={action.href}>
                    <action.icon className="h-4 w-4 mr-2" />
                    {action.label}
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming Bills */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Bills</CardTitle>
              <CardDescription>Bills due soon</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingBills.length > 0 ? (
                <div className="space-y-3">
                  {upcomingBills.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: bill.categoryColor || '#6b7280' }}
                        />
                        <div>
                          <p className="text-sm font-medium">{bill.name}</p>
                          <p className="text-xs text-muted-foreground">Due day {bill.dueDay}</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium">
                        ₱{bill.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <Button variant="link" className="w-full mt-2" asChild>
                    <Link to="/bills">View all bills</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No bills added yet
                  </p>
                  <Button variant="link" className="mt-2" asChild>
                    <Link to="/bills">Add your first bill</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Budget Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Overview</CardTitle>
              <CardDescription>Monthly spending progress</CardDescription>
            </CardHeader>
            <CardContent>
              {budgetData.totalBudget > 0 ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Spent</span>
                      <span className="font-medium">
                        ₱{budgetData.totalSpent.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / ₱{budgetData.totalBudget.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          budgetData.totalSpent > budgetData.totalBudget ? 'bg-red-500' : 'bg-primary'
                        )}
                        style={{ width: `${Math.min((budgetData.totalSpent / budgetData.totalBudget) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className={cn('font-medium', budgetData.remaining < 0 ? 'text-red-500' : 'text-green-500')}>
                      ₱{budgetData.remaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <Button variant="link" className="w-full" asChild>
                    <Link to="/budget">View budget details</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <PiggyBank className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No budgets set yet
                  </p>
                  <Button variant="link" className="mt-2" asChild>
                    <Link to="/budget">Set up your budget</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Income */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Income</CardTitle>
            <CardDescription>Your latest recorded income</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSalaries.length > 0 ? (
              <div className="space-y-3">
                {recentSalaries.map((salary) => (
                  <div key={salary.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{salary.sourceName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(salary.paymentDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        ₱{salary.amountPhp.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${salary.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
                <Button variant="link" className="w-full" asChild>
                  <Link to="/income">View all income</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Start adding income to see your trends
                </p>
                <Button className="mt-4" asChild>
                  <Link to="/income">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Income
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
