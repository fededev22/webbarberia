import { claimFicha } from "@/lib/engine"
import { fail } from "@/lib/http"
import { read } from "@/lib/store"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone") || ""
  if (phone.replace(/\D/g, "").length < 8) return fail("Ingresá el teléfono con el que reservás.")
  const data = await read((db) => {
    const found = claimFicha(db, phone)
    if (!found) return null
    const { notes: _n, ...customer } = found.customer
    void _n
    return { customer, visits: found.visits, tenth: db.settings.loyaltyTenthPercent, second: db.settings.loyaltySecondPercent }
  })
  if (!data) return fail("No hay una ficha con ese teléfono. Reservá una vez y queda creada.", 404)
  return NextResponse.json(data)
}
