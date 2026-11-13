import { quoteBooking } from "@/lib/engine"
import { fail } from "@/lib/http"
import { read } from "@/lib/store"
import { isRainy } from "@/lib/weather"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body?.serviceIds?.length) return fail("Elegí un servicio.")
  const rainy = await isRainy()
  const quote = await read((db) => quoteBooking(db, { ...body, rainy }))
  if (quote.error) return fail(quote.error)
  return NextResponse.json({ ...quote, rainy })
}
