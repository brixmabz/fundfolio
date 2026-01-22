import { useState, useEffect } from 'react'
import { Settings, Moon, Sun, Monitor, DollarSign, Save, Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import {
  getDeelMarkup,
  getUpworkMarkup,
  setDeelMarkup,
  setUpworkMarkup,
} from '@/services/settings'

export default function SettingsPage() {
  const { theme, setTheme } = useThemeStore()
  const { user } = useAuthStore()
  const [deelMarkup, setDeelMarkupState] = useState('1.5')
  const [upworkMarkup, setUpworkMarkupState] = useState('2.5')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [user?.id])

  async function loadSettings() {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const [deel, upwork] = await Promise.all([
        getDeelMarkup(user.id),
        getUpworkMarkup(user.id),
      ])
      setDeelMarkupState(deel.toString())
      setUpworkMarkupState(upwork.toString())
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    if (!user?.id) return
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      await Promise.all([
        setDeelMarkup(user.id, parseFloat(deelMarkup) || 1.5),
        setUpworkMarkup(user.id, parseFloat(upworkMarkup) || 2.5),
      ])
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Settings" subtitle="Manage your preferences" />

      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-2xl">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how FundFolio looks on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose your preferred theme or let it follow your system
                settings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Currency Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Currency Conversion
            </CardTitle>
            <CardDescription>
              Configure exchange rate markups for different income sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deelMarkup">Deel Markup (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="deelMarkup"
                        type="number"
                        step="0.1"
                        value={deelMarkup}
                        onChange={(e) => setDeelMarkupState(e.target.value)}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        below market rate
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Deel typically offers rates 1-2% below market rate.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="upworkMarkup">Upwork Markup (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="upworkMarkup"
                        type="number"
                        step="0.1"
                        value={upworkMarkup}
                        onChange={(e) => setUpworkMarkupState(e.target.value)}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        below market rate
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Upwork typically offers rates 2-3% below market rate.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {saveSuccess && (
                    <span className="text-sm text-green-600">Settings saved!</span>
                  )}
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              About
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span>1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Built with</span>
              <span>React + Vite + TailwindCSS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Database</span>
              <span>Turso (SQLite)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
