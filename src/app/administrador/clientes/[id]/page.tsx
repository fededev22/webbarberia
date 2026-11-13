import { Cliente } from "@/components/admin/screens"

export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Cliente id={id} />
}
