import { NextResponse } from "next/server"
import type { Database, PendingMessage } from "./types"
import { deliver } from "./notify"

export function originFrom(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/$/, "")
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000"
  const proto = req.headers.get("x-forwarded-proto") || "http"
  return `${proto}://${host}`
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function pushMessages(db: Database, messages: PendingMessage[], origin: string) {
  for (const message of messages) db.messages.push(await deliver(message, origin))
}

export const dynamicFlags = { dynamic: "force-dynamic" as const, runtime: "nodejs" as const }
