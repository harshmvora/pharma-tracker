import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext, useAuthState } from './hooks/useAuth'
import AuthPage       from './components/auth/AuthPage'
import Layout         from './components/layout/Layout'
import Dashboard      from './components/dashboard/Dashboard'
import ProjectDetail  from './components/projects/ProjectDetail'
import ProductsPage   from './components/products/ProductsPage'
import QuickTodos     from './components/todos/QuickTodos'
import MyTasks        from './components/todos/MyTasks'

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function AuthGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuthState()

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (!auth.user) return <AuthPage />

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthGuard>
          <Routes>
            <Route element={<Layout />}>
              <Route index              element={<Dashboard />}     />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="products"    element={<ProductsPage />}  />
              <Route path="todos"       element={<QuickTodos />}    />
              <Route path="my-tasks"    element={<MyTasks />}       />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthGuard>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
