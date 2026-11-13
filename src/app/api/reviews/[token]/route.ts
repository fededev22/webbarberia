import { submitReview } from "@/lib/engine"
import { fail } from "@/lib/http"
import { read, update } from "@/lib/store"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const data = await read((db) => {
    const appt = db.appointments.find((a) => a.reviewToken === token)
    if (!appt) return null
    const done = db.reviews.some((r) => r.appointmentId === appt.id)
    return { name: appt.customerName.split(" ")[0], barber: db.barbers.find((b) => b.id === appt.barberId)?.name ?? "", done }
  })
  if (!data) return fail("Ese enlace no corresponde a una visita.", 404)
  return NextResponse.json(data)
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const body = await req.json().catch(() => null)
  const result = await update((db) => submitReview(db, token, Number(body?.rating) || 0, String(body?.text || "")))
  if (!result.ok) return fail(result.error)
  return NextResponse.json({ ok: true })
}
