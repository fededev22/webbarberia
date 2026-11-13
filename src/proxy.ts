import { NextResponse, type NextRequest } from "next/server"
import { readSessionToken } from "@/lib/session"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await readSessionToken(request.cookies.get("solera_session")?.value)
  if (pathname.startsWith("/api/admin") && !session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  if (pathname !== "/administrador" && pathname.startsWith("/administrador") && !session) {
    return NextResponse.redirect(new URL("/administrador", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/administrador", "/administrador/:path*", "/api/admin/:path*"],
}
