import { unsubscribe } from "@/lib/engine"
import { fail } from "@/lib/http"
import { update } from "@/lib/store"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const ok = await update((db) => unsubscribe(db, String(body?.token || "")))
  if (!ok) return fail("No encontramos esa baja.", 404)
  return NextResponse.json({ ok: true })
}
