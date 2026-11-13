"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useUi } from "./providers"
import type { Catalog } from "@/lib/catalog"

export function Shell({ data, children }: { data: Catalog; children: React.ReactNode }) {
  const { t, lang, setLang, theme, setTheme } = useUi()
  const path = usePathname()
  const home = path === "/"
  const href = (id: string) => (home ? `#${id}` : `/#${id}`)
  const wa = `https://wa.me/${data.settings.whatsapp}?text=${encodeURIComponent(t("Hola Solera, quiero un turno.", "Hi Solera, I want a chair."))}`
  return (
    <>
      <Cursor />
      <header className="wrap nav">
        <Link href="/" className="brand">Solera</Link>
        <nav className="nav-links">
          <a href={href("servicios")}>{t("Servicios", "Services")}</a>
          <a href={href("galeria")}>{t("Cortes", "Cuts")}</a>
          <a href={href("equipo")}>{t("Sillas", "Chairs")}</a>
          <a href={href("visita")}>{t("Visita", "Visit")}</a>
        </nav>
        <div className="nav-tools">
          <button className="icon-btn" type="button" onClick={() => setLang(lang === "es" ? "en" : "es")} aria-label={t("Cambiar idioma", "Change language")}>{lang === "es" ? "EN" : "ES"}</button>
          <button className="icon-btn" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("Cambiar tema", "Change theme")}>{theme === "dark" ? "☀" : "☾"}</button>
          <Link className="btn btn-gold btn-tiny" href="/agendar">{t("Agendar turno", "Book a chair")}</Link>
        </div>
      </header>
      <main>{children}</main>
      <footer className="wrap" style={{ padding: "48px 0 24px" }}>
        <hr className="rule" />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", paddingTop: 18 }}>
          <div>
            <b className="display" style={{ fontSize: 32 }}>Solera</b>
            <p className="muted">{data.settings.street}, {data.settings.district}</p>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <Link href="/ficha">{t("Mi ficha", "My card")}</Link>
            <Link href="/quiz">{t("Elegí tu estilo", "Find a cut")}</Link>
            <a href={data.settings.instagram}>Instagram</a>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>© {new Date().getFullYear()} Solera. {t("Los retratos de la galería son dibujos del local, no fotos de clientes.", "Gallery portraits are drawings, not client photos.")}</p>
      </footer>
      <a className="wa" href={wa} aria-label="WhatsApp">WA</a>
      <div className="dock">
        <span>{t("Cuatro sillas · Thames, Palermo", "Four chairs · Thames, Palermo")}</span>
        <Link className="btn btn-gold btn-tiny" href="/agendar">{t("Agendar turno", "Book a chair")}</Link>
      </div>
    </>
  )
}

function Cursor() {
  const [on, setOn] = useState(false)
  const [pos, setPos] = useState({ x: -40, y: -40 })
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches
    if (!fine) return
    setOn(true)
    document.documentElement.classList.add("has-cursor")
    const move = (e: PointerEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const hide = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
      setPos(hide ? { x: -80, y: -80 } : { x: e.clientX, y: e.clientY })
    }
    window.addEventListener("pointermove", move)
    return () => {
      document.documentElement.classList.remove("has-cursor")
      window.removeEventListener("pointermove", move)
    }
  }, [])
  if (!on) return null
  return <div className="cursor" style={{ left: pos.x, top: pos.y }} />
}
