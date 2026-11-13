import { getSession } from "@/lib/auth"
import { LoginForm } from "@/components/admin/login"
import { Dashboard } from "@/components/admin/screens"

export const dynamic = "force-dynamic"

export default async function Page() {
  const session = await getSession()
  if (!session) return <LoginForm showHint={process.env.NODE_ENV !== "production"} />
  return <Dashboard />
}
