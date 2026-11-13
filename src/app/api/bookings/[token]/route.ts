import { cancelByToken, groupOf, rescheduleByToken, serviceNames, waitlistForCancellation } from "@/lib/engine"
import { fail, originFrom, pushMessages } from "@/lib/http"
import { read, update } from "@/lib/store"
import { formatDay, formatTime, googleCalendarUrl } from "@/lib/time"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const data = await read((db) => {
    const group = groupOf(db, token)
    if (!group.length) return null
    const tz = db.settings.timezone
    const primary = group[0]
    return {
      status: primary.status,
      when: `${formatDay(primary.start, tz)} · ${formatTime(primary.start, tz)}`,
      start: primary.start,
      services: serviceNames(db, primary.serviceIds),
      serviceIds: primary.serviceIds,
      barbers: group.map((a) => db.barbers.find((b) => b.id === a.barberId)?.name).filter(Boolean),
      duo: group.length > 1,
      total: group.reduce((s, a) => s + a.total, 0),
      cancelHours: db.settings.cancelHours,
      name: primary.customerName,
    }
  })
  if (!data) return fail("No encontramos ese turno.", 404)
  return NextResponse.json(data)
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const body = await req.json().catch(() => null)
  const origin = originFrom(req)
  const result = await update(async (db) => {
    if (body?.action === "cancel") {
      const cancelled = cancelByToken(db, token)
      if (!cancelled.ok) return { error: cancelled.error }
      await pushMessages(db, waitlistForCancellation(db, token, origin), origin)
      return { ok: true as const, late: cancelled.late }
    }
    if (body?.action === "reschedule") {
      const moved = rescheduleByToken(db, token, body.slot)
      if (!moved.ok) return { error: moved.error }
      const group = groupOf(db, token)
      const tz = db.settings.timezone
      return { ok: true as const, when: `${formatDay(group[0].start, tz)} · ${formatTime(group[0].start, tz)}`, google: googleCalendarUrl("Solera", new Date(group[0].start), new Date(group.at(-1)!.end), `${origin}/turno/${token}`, `${db.settings.street}, ${db.settings.district}`) }
    }
    return { error: "Acción desconocida." }
  })
  if ("error" in result && result.error) return fail(result.error)
  return NextResponse.json(result)
}
