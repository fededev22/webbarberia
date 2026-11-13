import { update } from "@/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await update((db) => {
    const message = db.messages.find((m) => m.id === id)
    if (message) message.opened = true
  })
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } })
}
