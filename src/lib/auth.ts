import { cookies } from "next/headers"
import { readSessionToken, SESSION_COOKIE } from "./session"

export async function getSession(): Promise<{ email: string } | null> {
  const jar = await cookies()
  return readSessionToken(jar.get(SESSION_COOKIE)?.value)
}

export { readSessionToken, signSession, sessionCookie, SESSION_COOKIE } from "./session"
