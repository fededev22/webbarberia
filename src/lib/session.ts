import { SignJWT, jwtVerify } from "jose"

const COOKIE = "solera_session"

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET || "dev-solera-secret-change-me-please-32b"
  return new TextEncoder().encode(value)
}

export async function signSession(email: string): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret())
}

export async function readSessionToken(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.role !== "admin" || typeof payload.sub !== "string") return null
    return { email: payload.sub }
  } catch {
    return null
  }
}

export function sessionCookie(token: string, secure: boolean) {
  return {
    name: COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      path: "/",
      maxAge: 60 * 60 * 12,
    },
  }
}

/** En Vercel el proto llega por el proxy. En `next start` local es http y la cookie no puede ser Secure. */
export function requestIsSecure(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto")
  if (forwarded) return forwarded.split(",")[0].trim() === "https"
  return new URL(req.url).protocol === "https:"
}

export const SESSION_COOKIE = COOKIE
