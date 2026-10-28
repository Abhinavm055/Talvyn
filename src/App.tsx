import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

import { queryClient } from './lib/queryClient'
import { initializeAuth } from './api/initializeAuth'

export default function App() {
  useEffect(() => {
    void initializeAuth()
    const check = () => { void initializeAuth() }
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
