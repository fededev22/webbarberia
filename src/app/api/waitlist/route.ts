import { joinWaitlist } from "@/lib/engine"
import { fail } from "@/lib/http"
import { update } from "@/lib/store"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return fail("Faltan datos.")
  const result = await update((db) => joinWaitlist(db, body))
  if (!result.ok) return fail(result.error)
  return NextResponse.json({ ok: true })
}
