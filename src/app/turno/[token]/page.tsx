import { Manage } from "@/components/site/manage"
import { catalog } from "@/lib/catalog"

export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <Manage data={await catalog()} token={token} />
}
