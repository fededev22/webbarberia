import { slotsFor } from "@/lib/engine"
import { fail } from "@/lib/http"
import { read } from "@/lib/store"
import { formatTime } from "@/lib/time"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const date = url.searchParams.get("date") || ""
  const services = (url.searchParams.get("services") || "").split(",").filter(Boolean)
  const barber = url.searchParams.get("barber") || "any"
  const duo = url.searchParams.get("duo") === "1"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !services.length) return fail("Fecha y servicios son obligatorios.")
  const slots = await read((db) => {
    const list = slotsFor(db, date, services, barber, duo)
    const tz = db.settings.timezone
    return list.map((slot) => ({
      ...slot,
      label: formatTime(slot.start, tz),
      barberName: db.barbers.find((b) => b.id === slot.barberId)?.name ?? "",
      secondName: slot.secondBarberId ? db.barbers.find((b) => b.id === slot.secondBarberId)?.name ?? "" : "",
    }))
  })
  return NextResponse.json({ slots })
}
