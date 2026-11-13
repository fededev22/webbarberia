import { groupOf, serviceNames } from "@/lib/engine"
import { read } from "@/lib/store"
import { icsFor } from "@/lib/time"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const ics = await read((db) => {
    const group = groupOf(db, token)
    if (!group.length) return null
    const primary = group[0]
    const last = group[group.length - 1]
    const title = `Solera · ${serviceNames(db, primary.serviceIds)}`
    const where = `${db.settings.street}, ${db.settings.district}, ${db.settings.city}`
    return icsFor(title, new Date(primary.start), new Date(last.end), `Cambiar o cancelar: ${new URL(req.url).origin}/turno/${token}`, where)
  })
  if (!ics) return new NextResponse("No encontrado", { status: 404 })
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=solera.ics",
    },
  })
}
