import { getSession } from "@/lib/auth"
import { AdminProvider } from "@/components/admin/provider"
import { AdminShell } from "@/components/admin/shell"

export const dynamic = "force-dynamic"

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) return children
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  )
}
