"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

const LINKS = [
  ["/administrador", "Hoy"],
  ["/administrador/turnos", "Turnos"],
  ["/administrador/clientes", "Clientes"],
  ["/administrador/marketing", "Promo"],
  ["/administrador/servicios", "Servicios"],
  ["/administrador/equipo", "Equipo"],
  ["/administrador/configuracion", "Ajustes"],
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const on = (href: string) => (href === "/administrador" ? path === href : path.startsWith(href))
  return (
    <div className="admin">
      <aside className="side">
        <b className="display" style={{ fontSize: 28 }}>Solera</b>
        {LINKS.map(([href, label]) => <Link key={href} href={href} className={on(href) ? "on" : ""}>{label}</Link>)}
        <button className="btn btn-tiny" type="button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/administrador"); router.refresh() }}>Salir</button>
      </aside>
      <div>{children}</div>
      <nav className="tabbar">
        {LINKS.slice(0, 5).map(([href, label]) => <Link key={href} href={href} className={on(href) ? "on" : ""}>{label}</Link>)}
      </nav>
    </div>
  )
}
