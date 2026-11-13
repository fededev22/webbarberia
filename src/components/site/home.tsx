"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ComponentType, type RefObject } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { motion } from "motion/react"
import type { Catalog } from "@/lib/catalog"
import { money, minutesLabel } from "@/lib/time"
import { useUi } from "./providers"
import { Reveal } from "./reveal"

const LOOKS = [
  { id: "clasico", cat: "clasico", es: "Clásico corto", en: "Short classic", a: "#2a231c", b: "#e0b15a", hair: "M" },
  { id: "fade", cat: "fade", es: "Skin fade", en: "Skin fade", a: "#1a1a1a", b: "#f3eee6", hair: "U" },
  { id: "degrade", cat: "degrade", es: "Degradé medio", en: "Mid fade", a: "#3a2a22", b: "#c4784a", hair: "A" },
  { id: "textura", cat: "clasico", es: "Textura con raya", en: "Side part", a: "#241c18", b: "#d7c4a3", hair: "S" },
  { id: "barba", cat: "barba", es: "Barba cerrada", en: "Full beard", a: "#1c1612", b: "#8d5d16", hair: "B" },
  { id: "perfil", cat: "barba", es: "Perfil de navaja", en: "Razor line", a: "#101010", b: "#ff4d2e", hair: "L" },
  { id: "color", cat: "color", es: "Castaño quieto", en: "Quiet brown", a: "#4a3024", b: "#e7d3b0", hair: "C" },
  { id: "crop", cat: "fade", es: "Crop francés", en: "French crop", a: "#26211c", b: "#f3eee6", hair: "F" },
]

export function Home({ data, rainy }: { data: Catalog; rainy: boolean }) {
  const { t, lang } = useUi()
  const hero = useRef<HTMLElement>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const [Canvas, setCanvas] = useState<ComponentType<{ pointer: RefObject<{ x: number; y: number }> }> | null>(null)
  const [filter, setFilter] = useState("todos")
  const [open, setOpen] = useState<(typeof LOOKS)[number] | null>(null)
  const [cut, setCut] = useState(46)

  useEffect(() => {
    const ok = window.matchMedia("(min-width: 900px) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches
    const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (!ok || save) return
    let dead = false
    import("./hero-canvas").then((mod) => { if (!dead) setCanvas(() => mod.HeroCanvas) })
    return () => { dead = true }
  }, [])

  useGSAP(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) return
    gsap.from(".hero-line", { y: 36, opacity: 0, stagger: 0.08, duration: 0.9, ease: "power3.out" })
  }, { scope: hero })

  const looks = LOOKS.filter((look) => filter === "todos" || look.cat === filter)
  const live = data.live[0]
  return (
    <>
      <section className="hero wrap" ref={hero} onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 }
      }}>
        <div className="hero-grid">
          <div>
            <p className="eyebrow hero-line">{t("Palermo · cuatro sillas · desde 2016", "Palermo · four chairs · since 2016")}</p>
            <h1 className="display hero-line">{t("El corte que se puede repetir.", "A cut you can repeat.")}</h1>
            <p className="lead hero-line">{t("En Thames anotamos el peine, la barba y el tono. La próxima vez no empezás de cero.", "On Thames we write down the guard, the beard and the tone. Next time you don't start over.")}</p>
            <div className="hero-actions hero-line">
              <Link className="btn btn-gold" href="/agendar">{t("Agendar turno", "Book a chair")}</Link>
              <Link className="btn" href="/quiz">{t("Elegí tu estilo", "Find a cut")}</Link>
            </div>
            {live && <p className="hero-line" style={{ marginTop: 22 }}><i style={{ color: "var(--hot)" }}>●</i> {live.state === "now" ? t("Ahora en la silla", "In the chair") : t("Siguiente", "Next")}: {live.barber} · {live.service}</p>}
            <p className="muted hero-line">{t("Hoy la agenda está", "Today the book is")} {data.occupancy.percent}% {t("ocupada", "full")}.</p>
            {rainy && <p className="banner hero-line">{t(`Día de lluvia: ${data.settings.rainPercent}% en turnos de 14 a 17, si no hay un premio mejor.`, `Rain day: ${data.settings.rainPercent}% off chairs from 2 to 5 pm, unless a better reward applies.`)}</p>}
          </div>
          <div className="stage" aria-hidden={Canvas ? undefined : true}>
            {Canvas ? <Canvas pointer={pointer} /> : <div className="pole-fallback" />}
          </div>
        </div>
      </section>
      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {Array.from({ length: 2 }).map((_, loop) => (
            <span key={loop}>{data.services.map((s) => `${lang === "en" ? s.nameEn : s.name} · ${money(s.price)}`).join("     ·     ")}&nbsp;&nbsp;&nbsp;</span>
          ))}
        </div>
      </div>
      <section className="block" id="servicios">
        <div className="wrap">
          <Reveal>
            <p className="eyebrow">{t("La carta", "The menu")}</p>
            <h2 className="display">{t("Servicios con hora y precio.", "Services, with time and price.")}</h2>
            <div className="menu">
              {data.services.filter((s) => s.active).map((s) => (
                <Link key={s.id} href={`/agendar?servicio=${s.id}`}>
                  <span>
                    <b>{lang === "en" ? s.nameEn : s.name}</b>
                    <small className="muted" style={{ display: "block" }}>{lang === "en" ? s.descriptionEn : s.description} · {minutesLabel(s.durationMin)}</small>
                  </span>
                  <span className="price">{s.promoPrice ? <><s className="muted">{money(s.price)}</s> {money(s.promoPrice)}</> : money(s.price)}</span>
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
      <section className="block" id="galeria">
        <div className="wrap">
          <p className="eyebrow">{t("Lookbook", "Lookbook")}</p>
          <h2 className="display">{t("Ocho cortes que salen de esta silla.", "Eight cuts that leave this chair.")}</h2>
          <div className="filters">
            {[["todos", "Todo", "All"], ["clasico", "Clásico", "Classic"], ["fade", "Fade", "Fade"], ["degrade", "Degradé", "Taper"], ["barba", "Barba", "Beard"], ["color", "Color", "Color"]].map(([id, es, en]) => (
              <button key={id} className={`chip ${filter === id ? "on" : ""}`} type="button" onClick={() => setFilter(id)}>{t(es, en)}</button>
            ))}
          </div>
          <div className="gallery">
            {looks.map((look) => (
              <button key={look.id} className="tile zoom" type="button" onClick={() => setOpen(look)}>
                <Art look={look} />
                <span>{lang === "en" ? look.en : look.es}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      {open && (
        <div className="lightbox" role="dialog" aria-modal onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <Art look={open} />
            <div style={{ padding: 18 }}>
              <h3 className="display" style={{ fontSize: 40, margin: "8px 0" }}>{lang === "en" ? open.en : open.es}</h3>
              <Link className="btn btn-gold" href={`/quiz`}>{t("Ver si te queda", "See if it fits")}</Link>
            </div>
          </div>
        </div>
      )}
      <section className="block" id="equipo">
        <div className="wrap">
          <p className="eyebrow">{t("Las sillas", "The chairs")}</p>
          <h2 className="display">{t("Cada barbero tiene su agenda.", "Each barber keeps their own book.")}</h2>
          <div className="team">
            {data.barbers.filter((b) => b.active).map((b) => (
              <article key={b.id} className="person">
                <div>
                  <span className="muted" style={{ color: b.color }}>{lang === "en" ? b.specialtyEn : b.specialty}</span>
                  <strong>{b.name}</strong>
                </div>
                <p className="muted">{lang === "en" ? b.bioEn : b.bio}</p>
                <Link href={`/agendar?barbero=${b.id}`}>{t("Pedir esta silla", "Ask for this chair")}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="block" id="antes">
        <div className="wrap">
          <p className="eyebrow">{t("Antes y después", "Before and after")}</p>
          <h2 className="display">{t("Arrastrá. El flequillo baja.", "Drag. The fringe drops.")}</h2>
          <div className="compare">
            <div className="pane" style={{ background: "linear-gradient(180deg,#3a3128,#1a1612)", clipPath: `inset(0 ${100 - cut}% 0 0)` }}>
              <Head crop={18} label={t("Antes", "Before")} />
            </div>
            <div className="pane" style={{ background: "linear-gradient(180deg,#2a2118,#0c0b0a)" }}>
              <Head crop={62} label={t("Después", "After")} />
            </div>
            <div className="handle" style={{ left: `${cut}%` }} />
            <input type="range" min={8} max={92} value={cut} aria-label={t("Comparar antes y después", "Compare before and after")} onChange={(e) => setCut(Number(e.target.value))} />
          </div>
        </div>
      </section>
      <section className="block" id="resenas">
        <div className="wrap">
          <p className="eyebrow">{t("Reseñas", "Reviews")}</p>
          <h2 className="display">{t("Lo que dijeron al salir.", "What they said on the way out.")}</h2>
          <div className="quotes">
            {data.reviews.map((r) => (
              <motion.blockquote key={r.id} className="quote" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <p>“{r.text}”</p>
                <span className="muted">{r.customerName} · {"★".repeat(r.rating)}</span>
              </motion.blockquote>
            ))}
          </div>
        </div>
      </section>
      <section className="block" id="fidelidad">
        <div className="wrap" style={{ display: "grid", gap: 18 }}>
          <p className="eyebrow">{t("Tarjeta", "Card")}</p>
          <h2 className="display">{t("Diez cortes. El décimo baja solo.", "Ten cuts. The tenth discounts itself.")}</h2>
          <Stamps />
          <p className="muted">{t(`El segundo corte tiene ${data.settings.loyaltySecondPercent}%. El 10º, el 20º y así, ${data.settings.loyaltyTenthPercent}%. Se aplica con el teléfono de siempre. No hace falta una cuenta.`, `The second cut is ${data.settings.loyaltySecondPercent}% off. The 10th, 20th and so on, ${data.settings.loyaltyTenthPercent}%. It uses the phone you already book with.`)}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn-gold" href="/ficha">{t("Ver mi tarjeta", "See my card")}</Link>
            <Link className="btn" href="/quiz">{t("Quiz de estilo", "Style quiz")}</Link>
          </div>
        </div>
      </section>
      <section className="block" id="visita">
        <div className="wrap visit">
          <div>
            <p className="eyebrow">{t("El local", "The shop")}</p>
            <h2 className="display">{data.settings.street}<br />{data.settings.district}</h2>
            <p>{t("Lunes a viernes de 10 a 20. Sábados de 10 a 18. Lila no abre los lunes. Nico entra a las 12.", "Monday to Friday, 10 to 8. Saturdays 10 to 6. Lila is off Mondays. Nico starts at noon.")}</p>
            <p className="muted">{t(`Si cancelás con menos de ${data.settings.cancelHours} horas, el turno se libera igual y queda marcado como cancelación tardía.`, `Cancel with less than ${data.settings.cancelHours} hours and the chair still opens. It is marked as a late cancel.`)}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="btn btn-gold" href={`https://wa.me/${data.settings.whatsapp}`}>WhatsApp</a>
              <a className="btn" href={data.settings.mapsUrl}>{t("Cómo llegar", "Directions")}</a>
            </div>
          </div>
          <iframe title={t("Mapa de Solera", "Map of Solera")} src="https://maps.google.com/maps?q=Thames%20Palermo%20Buenos%20Aires&z=15&output=embed" />
        </div>
      </section>
    </>
  )
}

function Art({ look }: { look: (typeof LOOKS)[number] }) {
  return (
    <div className="art" style={{ background: `linear-gradient(160deg, ${look.a}, #0c0b0a 70%)`, display: "grid", placeItems: "center" }}>
      <svg width="140" height="150" viewBox="0 0 140 150" aria-hidden>
        <ellipse cx="70" cy="78" rx="36" ry="44" fill="#e7d3c4" />
        <path d={look.hair === "U" ? "M34 70 C34 28 106 28 106 74 L106 48 C106 18 34 18 34 52 Z" : look.hair === "S" ? "M30 74 C30 20 100 16 112 60 L90 40 C90 28 40 30 40 62 Z" : "M32 72 C32 24 108 24 108 72 C108 50 90 40 70 40 C50 40 32 50 32 72 Z"} fill={look.b} />
        <rect x="58" y="118" width="24" height="20" rx="6" fill="#c4784a" />
      </svg>
    </div>
  )
}

function Head({ crop, label }: { crop: number; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="180" height="200" viewBox="0 0 180 200" aria-hidden>
        <ellipse cx="90" cy="110" rx="46" ry="56" fill="#e7d3c4" />
        <path d="M40 100 C40 30 140 30 140 100 C140 70 120 55 90 55 C60 55 40 70 40 100 Z" fill="#2a211c" transform={`translate(0 ${crop > 40 ? -8 : 16}) scale(1 ${crop > 40 ? 0.85 : 1.15})`} style={{ transformOrigin: "90px 70px" }} />
        {crop > 40 && <path d="M48 108 H132" stroke="#e0b15a" strokeWidth="3" />}
      </svg>
      <div className="eyebrow">{label}</div>
    </div>
  )
}

function Stamps() {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", border: "1px solid var(--line)", background: i < 7 ? "var(--gold)" : "transparent", color: i < 7 ? "#1a1208" : "var(--muted)" }}>{i + 1}</span>
      ))}
    </div>
  )
}
