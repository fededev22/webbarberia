import { confirmationMessages, createBooking, hitRate } from "@/lib/engine"
import { fail, originFrom, pushMessages } from "@/lib/http"
import { update } from "@/lib/store"
import { formatDay, formatTime, googleCalendarUrl } from "@/lib/time"
import { isRainy } from "@/lib/weather"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return fail("No leímos el formulario.")
  if (body.company) return NextResponse.json({ ok: true, token: "recibido" })
  const rainy = await isRainy()
  const origin = originFrom(req)
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim()
  const result = await update(async (db) => {
    if (!hitRate(db, `book:${ip}`, 8, 3600_000)) return { error: "Demasiadas reservas desde esta conexión. Probá en un rato." as const }
    const booked = createBooking(db, { ...body, rainy, marketingOptIn: Boolean(body.marketingOptIn), whatsappOptIn: body.whatsappOptIn !== false })
    if (!booked.ok) return { error: booked.error }
    if (booked.token === "ok") return { fake: true as const }
    const messages = confirmationMessages(db, booked.token, origin)
    await pushMessages(db, messages, origin)
    const group = db.appointments.filter((a) => a.manageToken === booked.token)
    const primary = group[0]
    const tz = db.settings.timezone
    const location = `${db.settings.street}, ${db.settings.district}`
    const title = `Solera · ${primary.serviceIds.map((id) => db.services.find((s) => s.id === id)?.name).join(" + ")}`
    return {
      token: booked.token,
      quote: booked.quote,
      when: `${formatDay(primary.start, tz)} · ${formatTime(primary.start, tz)}`,
      barbers: group.map((a) => db.barbers.find((b) => b.id === a.barberId)?.name).filter(Boolean),
      google: googleCalendarUrl(title, new Date(group[0].start), new Date(group[group.length - 1].end), `Gestionar: ${origin}/turno/${booked.token}`, location),
      total: group.reduce((s, a) => s + a.total, 0),
    }
  })
  if ("error" in result && result.error) return fail(result.error)
  if ("fake" in result) return NextResponse.json({ ok: true, token: "recibido" })
  return NextResponse.json({ ok: true, ...result })
}
