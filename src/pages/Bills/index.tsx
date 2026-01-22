import { useState, useEffect } from 'react'
import { Plus, Receipt, Loader2, Check, Trash2, Pencil, RotateCcw } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/authStore'
import {
  getBills,
  getBillCategories,
  createBill,
  createBillPayment,
  getBillsSummary,
  deleteBill,
  updateBill,
  getInactiveBills,
  restoreBill,
  getBillPaymentsForMonth,
} from '@/services/bills'
import type { Bill, BillCategory } from '@/types/database'

export default function BillsPage() {
  const { user } = useAuthStore()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [deletedBills, setDeletedBills] = useState<Bill[]>([])
  const [showDeleted, setShowDeleted] = useState(false)
  const [paidBillIds, setPaidBillIds] = useState<Set<number>>(new Set())
  const [categories, setCategories] = useState<BillCategory[]>([])
  const [summary, setSummary] = useState({
    totalMonthly: 0,
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    amount: '',
    dueDay: '',
    isRecurring: true,
    notes: '',
  })

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  useEffect(() => {
    loadData()
  }, [user?.id])

  async function loadData() {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const [billsData, categoriesData, summaryData, paymentsData, inactiveBills] = await Promise.all([
        getBills(user.id),
        getBillCategories(),
        getBillsSummary(user.id, currentYear, currentMonth),
        getBillPaymentsForMonth(user.id, currentYear, currentMonth),
        getInactiveBills(user.id),
      ])
      setBills(billsData)
      setCategories(categoriesData)
      setSummary(summaryData)
      setDeletedBills(inactiveBills)
      // Create a Set of bill IDs that have been paid this month
      const paidIds = new Set<number>(paymentsData.map((p) => p.bill_id))
      setPaidBillIds(paidIds)
    } catch (error) {
      console.error('Failed to load bills data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveBill(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id || !formData.name || !formData.amount) return

    setIsSaving(true)
    try {
      await createBill({
        user_id: user.id,
        category_id: formData.category ? parseInt(formData.category) : undefined,
        name: formData.name,
        amount: parseFloat(formData.amount),
        due_day: formData.dueDay ? parseInt(formData.dueDay) : undefined,
        is_recurring: formData.isRecurring,
        notes: formData.notes || undefined,
      })

      setFormData({
        name: '',
        category: '',
        amount: '',
        dueDay: '',
        isRecurring: true,
        notes: '',
      })
      setIsAddDialogOpen(false)
      await loadData()
    } catch (error) {
      console.error('Failed to save bill:', error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleMarkPaid(bill: Bill) {
    if (!user?.id) return
    try {
      await createBillPayment(
        bill.id,
        bill.amount,
        new Date().toISOString().split('T')[0],
        'paid'
      )
      await loadData()
    } catch (error) {
      console.error('Failed to mark bill as paid:', error)
    }
  }

  async function handleDeleteBill(billId: number) {
    try {
      await deleteBill(billId)
      await loadData()
    } catch (error) {
      console.error('Failed to delete bill:', error)
    }
  }

  async function handleRestoreBill(billId: number) {
    try {
      await restoreBill(billId)
      await loadData()
    } catch (error) {
      console.error('Failed to restore bill:', error)
    }
  }

  function openEditDialog(bill: Bill) {
    setEditingBill(bill)
    setFormData({
      name: bill.name,
      category: bill.category_id?.toString() || '',
      amount: bill.amount.toString(),
      dueDay: bill.due_day?.toString() || '',
      isRecurring: bill.is_recurring,
      notes: bill.notes || '',
    })
    setIsEditDialogOpen(true)
  }

  async function handleUpdateBill(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBill || !formData.name || !formData.amount) return

    setIsSaving(true)
    try {
      await updateBill(editingBill.id, {
        name: formData.name,
        category_id: formData.category ? parseInt(formData.category) : undefined,
        amount: parseFloat(formData.amount),
        due_day: formData.dueDay ? parseInt(formData.dueDay) : undefined,
        is_recurring: formData.isRecurring,
        notes: formData.notes || undefined,
      })

      setFormData({
        name: '',
        category: '',
        amount: '',
        dueDay: '',
        isRecurring: true,
        notes: '',
      })
      setIsEditDialogOpen(false)
      setEditingBill(null)
      await loadData()
    } catch (error) {
      console.error('Failed to update bill:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Bills"
        subtitle="Manage your monthly bills"
        actions={
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Bill</DialogTitle>
                <DialogDescription>
                  Add a new recurring or one-time bill to track.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSaveBill}>
                <div className="space-y-2">
                  <Label htmlFor="name">Bill Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Electric Bill"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (PHP)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDay">Due Day (of month)</Label>
                    <Input
                      id="dueDay"
                      type="number"
                      min="1"
                      max="31"
                      placeholder="15"
                      value={formData.dueDay}
                      onChange={(e) =>
                        setFormData({ ...formData, dueDay: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Recurring</Label>
                    <div className="flex items-center space-x-2 pt-2">
                      <Switch
                        checked={formData.isRecurring}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, isRecurring: checked })
                        }
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.isRecurring ? 'Monthly' : 'One-time'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input
                    id="notes"
                    placeholder="Additional notes..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
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
                    Save Bill
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Monthly
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱{summary.totalMonthly.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                ₱{summary.totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                ₱{summary.totalPending.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                ₱{summary.totalOverdue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bills List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Your Bills</CardTitle>
                <CardDescription>
                  Manage your recurring and one-time bills
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="show-deleted" className="text-sm text-muted-foreground">
                  Show Deleted
                </Label>
                <Switch
                  id="show-deleted"
                  checked={showDeleted}
                  onCheckedChange={setShowDeleted}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : bills.length > 0 ? (
              <div className="space-y-2">
                {bills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: bill.category_color || '#6b7280' }}
                      />
                      <div>
                        <p className="font-medium">{bill.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {bill.category_name || 'Uncategorized'} • Due: Day {bill.due_day || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-medium">
                          ₱{bill.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                        <Badge variant={bill.is_recurring ? 'secondary' : 'outline'}>
                          {bill.is_recurring ? 'Monthly' : 'One-time'}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        {paidBillIds.has(bill.id) ? (
                          <Badge className="bg-green-500 text-white px-3 py-1">
                            <Check className="h-3 w-3 mr-1" />
                            Paid
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaid(bill)}
                            title="Mark as paid"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(bill)}
                          title="Edit bill"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteBill(bill.id)}
                          title="Delete bill"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Receipt className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No bills added yet</h3>
                <p className="text-muted-foreground mt-1">
                  Add your first bill to start tracking your expenses.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bill
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deleted Bills Section */}
        {showDeleted && deletedBills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground">Deleted Bills</CardTitle>
              <CardDescription>
                These bills have been deleted but can be restored
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deletedBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full opacity-50"
                        style={{ backgroundColor: bill.category_color || '#6b7280' }}
                      />
                      <div>
                        <p className="font-medium text-muted-foreground">{bill.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {bill.category_name || 'Uncategorized'} • Due: Day {bill.due_day || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-muted-foreground">
                        ₱{bill.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreBill(bill.id)}
                        title="Restore bill"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Bill Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Bill</DialogTitle>
            <DialogDescription>
              Update the bill details.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdateBill}>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Bill Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Electric Bill"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
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
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Amount (PHP)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-dueDay">Due Day (of month)</Label>
                <Input
                  id="edit-dueDay"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="15"
                  value={formData.dueDay}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDay: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Recurring</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    checked={formData.isRecurring}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isRecurring: checked })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.isRecurring ? 'Monthly' : 'One-time'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes (optional)</Label>
              <Input
                id="edit-notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditingBill(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Bill
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
