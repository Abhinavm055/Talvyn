import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ExtensionUpdateNotice } from './ExtensionUpdateNotice'

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-[#F7F8FC] dark:bg-[#080A12]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <ExtensionUpdateNotice />
        <Outlet />
      </main>
    </div>
  )
}
