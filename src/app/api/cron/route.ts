import { processDue } from "@/lib/engine"
import { originFrom, pushMessages } from "@/lib/http"
import { update } from "@/lib/store"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (process.env.NODE_ENV === "production") {
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
  }
  const origin = originFrom(req)
  const count = await update(async (db) => {
    const messages = processDue(db, new Date(), origin)
    await pushMessages(db, messages, origin)
    return messages.length
  })
  return NextResponse.json({ ok: true, sent: count })
}
