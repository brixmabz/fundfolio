import { createBrowserRouter } from 'react-router-dom'
import { AppLayout, ProtectedRoute } from '@/components/layout'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import IncomePage from '@/pages/Income'
import BillsPage from '@/pages/Bills'
import MortgagePage from '@/pages/Mortgage'
import BudgetPage from '@/pages/Budget'
import SettingsPage from '@/pages/Settings'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/',
            element: <DashboardPage />,
          },
          {
            path: '/income',
            element: <IncomePage />,
          },
          {
            path: '/bills',
            element: <BillsPage />,
          },
          {
            path: '/mortgage',
            element: <MortgagePage />,
          },
          {
            path: '/budget',
            element: <BudgetPage />,
          },
          {
            path: '/settings',
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
])
