import { requestIsSecure, sessionCookie, signSession } from "@/lib/session"
import { update } from "@/lib/store"
import { TOTP } from "otpauth"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || "").trim().toLowerCase()
  const password = String(body.password || "")
  const code = String(body.code || "")
  const result = await update((db) => {
    const since = Date.now() - 15 * 60_000
    const fails = db.attempts.filter((a) => a.email === email && !a.ok && new Date(a.at).getTime() > since).length
    if (fails >= 5) return { status: 429, error: "Demasiados intentos. Esperá 15 minutos." }
    const admin = db.admins.find((a) => a.email === email)
    if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
      db.attempts.push({ email, at: new Date().toISOString(), ok: false })
      return { status: 401, error: "Email o contraseña incorrectos." }
    }
    if (admin.totpEnabled) {
      if (!code) return { status: 200, needTotp: true as const }
      const totp = new TOTP({ secret: admin.totpSecret || "" })
      if (totp.validate({ token: code, window: 1 }) === null) {
        db.attempts.push({ email, at: new Date().toISOString(), ok: false })
        return { status: 401, error: "El código de la app no coincide." }
      }
    }
    db.attempts.push({ email, at: new Date().toISOString(), ok: true })
    return { status: 200, ok: true as const, email }
  })
  if ("error" in result && result.error) return NextResponse.json({ error: result.error }, { status: result.status })
  if ("needTotp" in result && result.needTotp) return NextResponse.json({ needTotp: true })
  const sessionEmail = "email" in result ? result.email : undefined
  if (!sessionEmail) return NextResponse.json({ error: "No se pudo entrar." }, { status: 401 })
  const token = await signSession(sessionEmail)
  const cookie = sessionCookie(token, requestIsSecure(req))
  const res = NextResponse.json({ ok: true })
  res.cookies.set(cookie.name, cookie.value, cookie.options)
  return res
}
