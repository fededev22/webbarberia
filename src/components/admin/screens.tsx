"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useAdmin } from "./provider"
import { formatDay, formatTime, money } from "@/lib/time"
import type { Barber, Service } from "@/lib/types"

function useDesk() {
  const api = useAdmin()
  return { ...api, tz: api.data?.settings.timezone || "America/Argentina/Buenos_Aires" }
}

export function Dashboard() {
  const { data, act, error } = useDesk()
  const [msg, setMsg] = useState("")
  if (!data) return <p>{error || "Cargando el día…"}</p>
  const d = data.dashboard
  return (
    <div>
      <h1>Hoy</h1>
      <div className="kpis">
        <div className="kpi"><span>Cobrado hoy</span><b>{money(d.income.today)}</b></div>
        <div className="kpi"><span>Semana</span><b>{money(d.income.week)}</b></div>
        <div className="kpi"><span>Mes</span><b>{money(d.income.month)}</b></div>
        <div className="kpi"><span>Todavía en agenda</span><b>{money(d.income.expectedToday)}</b></div>
        <div className="kpi"><span>Nuevos / de siempre</span><b>{d.clients.fresh} / {d.clients.returning}</b></div>
        <div className="kpi"><span>Cancelaciones 30 días</span><b>{Math.round(d.cancelRate * 100)}%</b></div>
        <div className="kpi"><span>No vinieron</span><b>{Math.round(d.noshowRate * 100)}%</b></div>
        <div className="kpi"><span>Ocupación de hoy</span><b>{d.occupancy.percent}%</b></div>
      </div>
      <h2>Semana cobrada</h2>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d.weekSeries}>
            <XAxis dataKey="day" tickFormatter={(v) => String(v).slice(8)} />
            <YAxis hide />
            <Tooltip formatter={(v) => money(Number(v))} />
            <Bar dataKey="total" fill="#e0b15a" radius={6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <h2>Horas pico</h2>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d.hours}>
            <XAxis dataKey="hour" />
            <Tooltip />
            <Bar dataKey="count" fill="#c4784a" radius={6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <h2>Turnos de hoy</h2>
      <ApptTable rows={d.today} tz={data.settings.timezone} onStatus={(id, status) => act("status", { id, status })} />
      <h2>Les toca volver</h2>
      <ul>{d.due.map((c) => <li key={c.id}><Link href={`/administrador/clientes/${c.id}`}>{c.name}</Link> · {c.phone}</li>)}</ul>
      <h2>Huecos de más de una hora</h2>
      <ul>{d.gaps.map((g, i) => <li key={i}>{g.barber}: {formatTime(g.from, data.settings.timezone)}–{formatTime(g.to, data.settings.timezone)}</li>)}</ul>
      <button className="btn btn-gold" type="button" onClick={async () => { await act("fillGaps"); setMsg("Se escribió a quienes están en riesgo.") }}>Ofrecer los huecos al segmento en riesgo</button>
      {msg && <p>{msg}</p>}
      <h2>Segmentos</h2>
      <p>{Object.entries(d.segments).map(([k, n]) => `${k}: ${n}`).join(" · ")}</p>
      <h2>Más pedidos</h2>
      <ul>{d.top.map((s) => <li key={s.name}>{s.name} · {s.count}</li>)}</ul>
    </div>
  )
}

export function Turnos() {
  const { data, act } = useDesk()
  const [view, setView] = useState<"dia" | "semana" | "mes">("dia")
  const [cursor, setCursor] = useState(() => new Date().toISOString().slice(0, 10))
  const [barber, setBarber] = useState("all")
  const [form, setForm] = useState({ name: "", email: "", phone: "", serviceId: "corte", barberId: "renzo", date: cursor, time: "15:00" })
  const [block, setBlock] = useState({ barberId: "all", date: cursor, start: "13:00", end: "15:00", reason: "Bloqueo", type: "block" })
  if (!data) return <p>Cargando…</p>
  const tz = data.settings.timezone
  const rows = data.appointments.filter((a) => {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(a.start))
    if (barber !== "all" && a.barberId !== barber) return false
    if (view === "dia") return day === cursor
    if (view === "semana") return Math.abs(new Date(day).getTime() - new Date(cursor).getTime()) < 7 * 86400000
    return day.slice(0, 7) === cursor.slice(0, 7)
  })
  return (
    <div>
      <h1>Turnos</h1>
      <div className="filters">
        {(["dia", "semana", "mes"] as const).map((v) => <button key={v} className={`chip ${view === v ? "on" : ""}`} type="button" onClick={() => setView(v)}>{v}</button>)}
        <input type="date" value={cursor} onChange={(e) => setCursor(e.target.value)} />
        <select value={barber} onChange={(e) => setBarber(e.target.value)}>
          <option value="all">Todas las sillas</option>
          {data.barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      {view === "mes" && <Month cursor={cursor} rows={data.appointments} tz={tz} onPick={setCursor} />}
      <ApptTable rows={rows} tz={tz} onStatus={(id, status) => act("status", { id, status })} data={data} onMove={(id, start, barberId) => act("move", { id, start, barberId })} />
      <h2>Nuevo turno</h2>
      <div className="kpis">
        {(["name", "email", "phone"] as const).map((key) => <label key={key} className="field">{key}<input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
        <label className="field">Servicio<select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>{data.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field">Barbero<select value={form.barberId} onChange={(e) => setForm({ ...form, barberId: e.target.value })}>{data.barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="field">Fecha<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label className="field">Hora<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
      </div>
      <button className="btn btn-gold" type="button" onClick={async () => {
        const start = await civilToIso(form.date, form.time, tz)
        await act("create", { serviceIds: [form.serviceId], barberId: form.barberId, start, name: form.name, email: form.email, phone: form.phone, whatsappOptIn: true })
      }}>Crear</button>
      <h2>Bloquear, feriado o vacaciones</h2>
      <div className="filters">
        <select value={block.barberId} onChange={(e) => setBlock({ ...block, barberId: e.target.value })}>
          <option value="all">Todo el local</option>
          {data.barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value })} />
        <input type="time" value={block.start} onChange={(e) => setBlock({ ...block, start: e.target.value })} />
        <input type="time" value={block.end} onChange={(e) => setBlock({ ...block, end: e.target.value })} />
        <input value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} />
        <select value={block.type} onChange={(e) => setBlock({ ...block, type: e.target.value })}>
          <option value="block">Bloqueo</option>
          <option value="holiday">Feriado</option>
          <option value="vacation">Vacaciones</option>
        </select>
        <button className="btn" type="button" onClick={async () => act("block", { barberId: block.barberId, start: await civilToIso(block.date, block.start, tz), end: await civilToIso(block.date, block.end, tz), reason: block.reason, type: block.type })}>Bloquear</button>
      </div>
      <ul>
        {data.blocks.map((b) => <li key={b.id}>{b.type} · {b.reason} · {formatDay(b.start, tz)} <button type="button" onClick={() => act("deleteBlock", { id: b.id })}>quitar</button></li>)}
      </ul>
      <p><a href="/api/admin/export?kind=appointments&format=csv">CSV</a> · <a href="/api/admin/export?kind=appointments&format=xls">Excel</a></p>
    </div>
  )
}

function Month({ cursor, rows, tz, onPick }: { cursor: string; rows: { start: string }[]; tz: string; onPick: (day: string) => void }) {
  const [y, m] = cursor.split("-").map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lead = first.getUTCDay()
  return (
    <div className="cal">
      {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
      {Array.from({ length: days }, (_, i) => {
        const day = `${cursor.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`
        const count = rows.filter((a) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(a.start)) === day).length
        return <button key={day} type="button" className={day === cursor ? "on" : ""} onClick={() => onPick(day)}>{i + 1}{count ? ` · ${count}` : ""}</button>
      })}
    </div>
  )
}

function ApptTable({ rows, tz, onStatus, data, onMove }: { rows: { id: string; start: string; customerName: string; phone: string; serviceIds: string[]; barberId: string; status: string; total: number }[]; tz: string; onStatus: (id: string, status: string) => void; data?: { services: Service[]; barbers: Barber[] }; onMove?: (id: string, start: string, barberId: string) => void }) {
  const [move, setMove] = useState<string | null>(null)
  const [when, setWhen] = useState("15:00")
  const [who, setWho] = useState("")
  return (
    <table className="table">
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td>{formatDay(a.start, tz)} {formatTime(a.start, tz)}</td>
            <td>{a.customerName}<br /><span className="muted">{a.phone}</span></td>
            <td>{a.serviceIds.join(", ")} · {a.status}<br />{money(a.total)}</td>
            <td>
              {a.status === "confirmed" && (
                <div className="filters">
                  <button className="btn btn-tiny" type="button" onClick={() => onStatus(a.id, "completed")}>Vino</button>
                  <button className="btn btn-tiny" type="button" onClick={() => onStatus(a.id, "noshow")}>No vino</button>
                  <button className="btn btn-tiny" type="button" onClick={() => onStatus(a.id, "cancelled")}>Cancelar</button>
                  {onMove && data && <button className="btn btn-tiny" type="button" onClick={() => { setMove(a.id); setWho(a.barberId) }}>Mover</button>}
                </div>
              )}
              {move === a.id && data && onMove && (
                <div className="filters">
                  <select value={who} onChange={(e) => setWho(e.target.value)}>{data.barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                  <input type="time" value={when} onChange={(e) => setWhen(e.target.value)} />
                  <button className="btn btn-tiny" type="button" onClick={async () => {
                    const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(a.start))
                    onMove(a.id, await civilToIso(day, when, tz), who)
                    setMove(null)
                  }}>Guardar</button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Clientes({ filter = "todos" }: { filter?: string }) {
  const { data } = useDesk()
  const [q, setQ] = useState("")
  const [seg, setSeg] = useState(filter)
  if (!data) return <p>Cargando…</p>
  const list = data.customers.filter((c) => {
    const blob = `${c.name} ${c.email} ${c.phone}`.toLowerCase()
    if (q && !blob.includes(q.toLowerCase())) return false
    if (seg === "volver") return c.due
    if (seg !== "todos") return c.segment === seg
    return true
  })
  return (
    <div>
      <h1>Clientes</h1>
      <input placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="filters">
        {["todos", "nuevo", "activo", "en_riesgo", "inactivo", "vip", "volver"].map((id) => <button key={id} className={`chip ${seg === id ? "on" : ""}`} type="button" onClick={() => setSeg(id)}>{id}</button>)}
      </div>
      <table className="table">
        <tbody>
          {list.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/administrador/clientes/${c.id}`}>{c.name}</Link><br /><span className="muted">{c.segment}{c.due ? " · le toca volver" : ""}</span></td>
              <td>{c.phone}<br />{c.email}</td>
              <td>{c.stamps} sellos</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><a href="/api/admin/export?kind=customers&format=csv">CSV</a> · <a href="/api/admin/export?kind=customers&format=xls">Excel</a></p>
    </div>
  )
}

export function Cliente({ id }: { id: string }) {
  const { data, act } = useDesk()
  const customer = data?.customers.find((c) => c.id === id)
  const [notes, setNotes] = useState(customer?.notes || "")
  const [recipe, setRecipe] = useState(customer?.recipe || "")
  const [stamps, setStamps] = useState(customer?.stamps || 0)
  useEffect(() => {
    if (!customer) return
    setNotes(customer.notes)
    setRecipe(customer.recipe)
    setStamps(customer.stamps)
  }, [customer])
  const visits = useMemo(() => data?.appointments.filter((a) => a.customerId === id) || [], [data, id])
  if (!data || !customer) return <p>Cargando…</p>
  const spend = visits.filter((a) => a.status === "completed").reduce((s, a) => s + a.total, 0)
  return (
    <div>
      <h1>{customer.name}</h1>
      <p>{customer.email} · {customer.phone}</p>
      <p>Segmento {customer.segment}. Gasto en visitas completas {money(spend)}. Sellos {customer.stamps}. Código {customer.referralCode}.</p>
      <label className="field">Notas privadas<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} /></label>
      <label className="field">Receta que ve el cliente<textarea value={recipe} onChange={(e) => setRecipe(e.target.value)} rows={3} /></label>
      <label className="field">Sellos<input type="number" value={stamps} onChange={(e) => setStamps(Number(e.target.value))} /></label>
      <label className="check"><input type="checkbox" defaultChecked={customer.marketingOptIn} id="mkt" /> Marketing</label>
      <label className="check"><input type="checkbox" defaultChecked={customer.whatsappOptIn} id="wa" /> WhatsApp</label>
      <button className="btn btn-gold" type="button" onClick={() => act("customer", {
        id,
        notes,
        recipe,
        stamps,
        marketingOptIn: (document.getElementById("mkt") as HTMLInputElement).checked,
        whatsappOptIn: (document.getElementById("wa") as HTMLInputElement).checked,
      })}>Guardar ficha</button>
      <h2>Historial</h2>
      <ul>{visits.map((a) => <li key={a.id}>{formatDay(a.start, data.settings.timezone)} {formatTime(a.start, data.settings.timezone)} · {a.status} · {money(a.total)}</li>)}</ul>
    </div>
  )
}

export function Marketing() {
  const { data, act } = useDesk()
  const blank = { id: "", name: "", channel: "both" as "email" | "whatsapp" | "both", segment: "en_riesgo" as "all" | "nuevo" | "activo" | "en_riesgo" | "inactivo" | "vip", subject: "{nombre}, hay silla", body: "Hola {nombre}. Tu {ultimo_corte} puede repetirse esta semana.\n{link_reserva}", scheduledAt: "" }
  const [draft, setDraft] = useState(blank)
  const [coupon, setCoupon] = useState({ id: "", code: "", percent: 10, expires: "", maxUses: 20, uses: 0, active: true })
  const [tpl, setTpl] = useState({ id: "", name: "", channel: "email" as "email" | "whatsapp" | "both", subject: "", body: "" })
  if (!data) return <p>Cargando…</p>
  return (
    <div>
      <h1>Marketing</h1>
      <p className="muted">Variables: {"{nombre}"} {"{ultimo_corte}"} {"{descuento}"} {"{sellos}"} {"{codigo}"} {"{link_reserva}"}</p>
      <h2>Campaña</h2>
      <label className="field">Nombre<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <label className="field">Asunto<input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
      <label className="field">Mensaje<textarea rows={5} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
      <div className="filters">
        <select value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as "both" })}>
          <option value="both">Email y WhatsApp</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select value={draft.segment} onChange={(e) => setDraft({ ...draft, segment: e.target.value as "en_riesgo" })}>
          {["all", "nuevo", "activo", "en_riesgo", "inactivo", "vip"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <input type="datetime-local" value={draft.scheduledAt} onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })} />
      </div>
      <div className="filters">
        <button className="btn" type="button" onClick={() => act("campaign", { campaign: { ...draft, scheduledAt: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : undefined, status: draft.scheduledAt ? "scheduled" : "draft" } })}>Guardar</button>
        <button className="btn btn-gold" type="button" onClick={async () => {
          const saved = await act("campaign", { campaign: { ...draft, status: "draft" } })
          const created = saved.campaigns.find((c) => c.name === draft.name && c.status !== "sent")
          if (created) await act("sendCampaign", { id: created.id })
        }}>Enviar ahora</button>
      </div>
      <ul>
        {data.campaigns.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => setDraft({ id: c.id, name: c.name, channel: c.channel, segment: c.segment, subject: c.subject, body: c.body, scheduledAt: c.scheduledAt?.slice(0, 16) || "" })}>{c.name}</button>
            {" "}· {c.status} · enviados {c.stats.sent} · abiertos {c.stats.opened} · turnos {c.stats.bookings}
            {c.status !== "sent" && <button type="button" onClick={() => act("sendCampaign", { id: c.id })}> enviar</button>}
          </li>
        ))}
      </ul>
      <h2>Plantillas</h2>
      <label className="field">Nombre<input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} /></label>
      <label className="field">Asunto<input value={tpl.subject} onChange={(e) => setTpl({ ...tpl, subject: e.target.value })} /></label>
      <label className="field">Cuerpo<textarea value={tpl.body} onChange={(e) => setTpl({ ...tpl, body: e.target.value })} /></label>
      <button className="btn" type="button" onClick={() => act("template", { template: tpl })}>Guardar plantilla</button>
      <ul>{data.templates.map((item) => <li key={item.id}><button type="button" onClick={() => { setTpl(item); setDraft({ ...draft, subject: item.subject, body: item.body, channel: item.channel }) }}>{item.name}</button> <button type="button" onClick={() => act("deleteTemplate", { id: item.id })}>borrar</button></li>)}</ul>
      <h2>Cupones</h2>
      <div className="filters">
        <input placeholder="CODIGO" value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value })} />
        <input type="number" value={coupon.percent} onChange={(e) => setCoupon({ ...coupon, percent: Number(e.target.value) })} />
        <input type="date" value={coupon.expires.slice(0, 10)} onChange={(e) => setCoupon({ ...coupon, expires: new Date(e.target.value).toISOString() })} />
        <input type="number" value={coupon.maxUses} onChange={(e) => setCoupon({ ...coupon, maxUses: Number(e.target.value) })} />
        <button className="btn" type="button" onClick={() => act("coupon", { coupon })}>Guardar cupón</button>
      </div>
      <ul>{data.coupons.map((c) => <li key={c.id}>{c.code} · {c.percent}% · {c.uses}/{c.maxUses} <button type="button" onClick={() => act("deleteCoupon", { id: c.id })}>borrar</button></li>)}</ul>
      <h2>Automáticas</h2>
      <p>Cumpleaños, bienvenida al primer corte, “te extrañamos” a los {data.settings.winbackDays} días y aviso al 2º y 10º sello. Se disparan con el cron o con el botón de procesar en Ajustes. Solo a quien aceptó novedades.</p>
      <h2>Mensajes recientes</h2>
      <ul>{data.messages.slice(0, 12).map((m) => <li key={m.id}>{m.channel} · {m.to} · {m.kind} · {m.ok ? "ok" : "falló"} · {m.opened ? "abierto" : "sin abrir"} · {m.detail}</li>)}</ul>
    </div>
  )
}

export function Servicios() {
  const { data, act } = useDesk()
  const [edit, setEdit] = useState<Service | null>(null)
  if (!data) return <p>Cargando…</p>
  return (
    <div>
      <h1>Servicios y precios</h1>
      <button className="btn" type="button" onClick={() => setEdit({ id: "", name: "", nameEn: "", description: "", descriptionEn: "", durationMin: 30, price: 10000, active: true, category: "corte" })}>Nuevo</button>
      <ul>
        {data.services.map((s) => (
          <li key={s.id}>
            {s.name} · {money(s.price)} · {s.durationMin} min · {s.active ? "activo" : "oculto"}
            <button type="button" onClick={() => setEdit(s)}> editar</button>
            <button type="button" onClick={() => act("service", { service: { ...s, active: !s.active } })}> {s.active ? "desactivar" : "activar"}</button>
          </li>
        ))}
      </ul>
      {edit && <ServiceForm value={edit} onChange={setEdit} onSave={() => act("service", { service: edit })} />}
      <h2>Productos de mostrador</h2>
      <ul>
        {data.products.map((p) => (
          <li key={p.id}>{p.name} · {money(p.price)}
            <button type="button" onClick={() => act("product", { product: { ...p, active: !p.active } })}>{p.active ? " ocultar" : " mostrar"}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ServiceForm({ value, onChange, onSave }: { value: Service; onChange: (s: Service) => void; onSave: () => void }) {
  return (
    <div>
      <label className="field">Nombre<input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} /></label>
      <label className="field">Nombre en inglés<input value={value.nameEn} onChange={(e) => onChange({ ...value, nameEn: e.target.value })} /></label>
      <label className="field">Descripción<input value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} /></label>
      <label className="field">Minutos<input type="number" value={value.durationMin} onChange={(e) => onChange({ ...value, durationMin: Number(e.target.value) })} /></label>
      <label className="field">Precio<input type="number" value={value.price} onChange={(e) => onChange({ ...value, price: Number(e.target.value) })} /></label>
      <label className="field">Promo<input type="number" value={value.promoPrice || 0} onChange={(e) => onChange({ ...value, promoPrice: Number(e.target.value) || undefined })} /></label>
      <label className="field">Promo hasta<input type="date" value={value.promoUntil?.slice(0, 10) || ""} onChange={(e) => onChange({ ...value, promoUntil: new Date(e.target.value).toISOString() })} /></label>
      <button className="btn btn-gold" type="button" onClick={onSave}>Guardar servicio</button>
    </div>
  )
}

export function Equipo() {
  const { data, act } = useDesk()
  const [barber, setBarber] = useState<Barber | null>(null)
  if (!data) return <p>Cargando…</p>
  return (
    <div>
      <h1>Equipo</h1>
      {data.barbers.map((b) => (
        <article key={b.id} className="person" style={{ marginBottom: 12 }}>
          <strong>{b.name}</strong>
          <p>{b.specialty} · comisión {b.commissionPct}% · {b.active ? "activa" : "inactiva"}</p>
          <p className="muted">{b.week.map((shift, i) => shift ? `${"DLMXJVS"[i]} ${shift.start}-${shift.end}` : `${"DLMXJVS"[i]} libre`).join(" · ")}</p>
          <p>Este mes: {money(data.dashboard.commissions.find((c) => c.name === b.name)?.commission || 0)} de comisión sobre {money(data.dashboard.commissions.find((c) => c.name === b.name)?.earned || 0)}</p>
          <button className="btn btn-tiny" type="button" onClick={() => setBarber(b)}>Editar horarios</button>
        </article>
      ))}
      {barber && (
        <div>
          <label className="field">Comisión %<input type="number" value={barber.commissionPct} onChange={(e) => setBarber({ ...barber, commissionPct: Number(e.target.value) })} /></label>
          {barber.week.map((shift, index) => (
            <div key={index} className="filters">
              <span>{"Dom Lun Mar Mié Jue Vie Sáb".split(" ")[index]}</span>
              <input type="time" value={shift?.start || ""} onChange={(e) => {
                const week = [...barber.week]
                week[index] = { start: e.target.value, end: shift?.end || "20:00" }
                setBarber({ ...barber, week })
              }} />
              <input type="time" value={shift?.end || ""} onChange={(e) => {
                const week = [...barber.week]
                week[index] = { start: shift?.start || "10:00", end: e.target.value }
                setBarber({ ...barber, week })
              }} />
              <button type="button" onClick={() => { const week = [...barber.week]; week[index] = null; setBarber({ ...barber, week }) }}>Franco</button>
            </div>
          ))}
          <button className="btn btn-gold" type="button" onClick={() => act("barber", { barber })}>Guardar</button>
        </div>
      )}
    </div>
  )
}

export function Ajustes() {
  const { data, act } = useDesk()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [code, setCode] = useState("")
  const [qr, setQr] = useState("")
  const [msg, setMsg] = useState("")
  if (!data) return <p>Cargando…</p>
  const s = data.settings
  return (
    <div>
      <h1>Configuración</h1>
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const settings = Object.fromEntries(fd.entries()); act("settings", { settings: { ...s, ...settings, cancelHours: Number(settings.cancelHours), winbackDays: Number(settings.winbackDays), goldenPercent: Number(settings.goldenPercent), rainPercent: Number(settings.rainPercent), loyaltySecondPercent: Number(settings.loyaltySecondPercent), loyaltyTenthPercent: Number(settings.loyaltyTenthPercent) } }) }}>
        {(["name", "tagline", "street", "district", "city", "whatsapp", "email", "instagram", "mapsUrl"] as const).map((key) => (
          <label key={key} className="field">{key}<input name={key} defaultValue={s[key]} /></label>
        ))}
        <label className="field">Horas para cancelar<input name="cancelHours" type="number" defaultValue={s.cancelHours} /></label>
        <label className="field">Días para “te extrañamos”<input name="winbackDays" type="number" defaultValue={s.winbackDays} /></label>
        <label className="field">% hora dorada<input name="goldenPercent" type="number" defaultValue={s.goldenPercent} /></label>
        <label className="field">% día de lluvia<input name="rainPercent" type="number" defaultValue={s.rainPercent} /></label>
        <label className="field">% segundo corte<input name="loyaltySecondPercent" type="number" defaultValue={s.loyaltySecondPercent} /></label>
        <label className="field">% corte 10<input name="loyaltyTenthPercent" type="number" defaultValue={s.loyaltyTenthPercent} /></label>
        <button className="btn btn-gold" type="submit">Guardar negocio</button>
      </form>
      <h2>Integraciones</h2>
      <p>Email {data.integrations.email ? "conectado" : "sin clave: los mensajes quedan en Marketing"}. WhatsApp {data.integrations.whatsapp ? "conectado" : "sin clave"}. Supabase {data.integrations.supabase ? "conectado" : "archivo local"}.</p>
      <button className="btn" type="button" onClick={async () => { await act("process"); setMsg("Recordatorios, cumpleaños y campañas programadas procesados.") }}>Procesar recordatorios ahora</button>
      {msg && <p>{msg}</p>}
      <h2>Contraseña</h2>
      <label className="field">Actual<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
      <label className="field">Nueva<input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
      <button className="btn" type="button" onClick={async () => { await act("password", { current, next }); setMsg("Contraseña actualizada.") }}>Cambiar</button>
      <h2>Segundo factor</h2>
      <p>{data.admin[0]?.totpEnabled ? "Activo." : "Opcional."}</p>
      <button className="btn" type="button" onClick={async () => { const res = await act("totp-setup"); setQr(res.qr || "") }}>Generar código</button>
      {qr && <img src={qr} alt="Código QR para la app de autenticación" width={180} height={180} />}
      <label className="field">Código de 6 dígitos<input value={code} onChange={(e) => setCode(e.target.value)} /></label>
      <div className="filters">
        <button className="btn btn-gold" type="button" onClick={() => act("totp-enable", { code })}>Activar</button>
        <button className="btn" type="button" onClick={() => act("totp-disable", { code })}>Apagar</button>
      </div>
      <h2>Reseñas</h2>
      <ul>{data.reviews.map((r) => <li key={r.id}>{r.customerName}: {r.text} <button type="button" onClick={() => act("review", { id: r.id, published: !r.published })}>{r.published ? "ocultar" : "publicar"}</button></li>)}</ul>
      <h2>Lista de espera</h2>
      <ul>{data.waitlist.map((w) => <li key={w.id}>{w.name} · {w.date} · {w.notified ? "avisado" : "en espera"}</li>)}</ul>
    </div>
  )
}

async function civilToIso(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number)
  const [hh, mm] = time.split(":").map(Number)
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm)
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]))
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return new Date(utcGuess - (asUTC - utcGuess)).toISOString()
}
