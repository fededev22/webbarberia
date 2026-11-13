/** Hora civil del negocio. Argentina no usa DST desde 2009; igual resolvemos el offset con Intl. */

export function zonedDateTime(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number)
  const [hh, mm] = time.split(":").map(Number)
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0)
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]))
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return new Date(utcGuess - (asUTC - utcGuess))
}

export function dateKey(input: string | Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(new Date(input))
}

export function todayKey(tz: string, now = new Date()): string {
  return dateKey(now, tz)
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function weekdayIndex(date: string, tz: string): number {
  const dt = zonedDateTime(date, "12:00", tz)
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(dt)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[name] ?? 0
}

export function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

export function formatDay(iso: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso))
}

export function hourInZone(iso: string, tz: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso))
  return Number(h)
}

export function money(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

export function minutesLabel(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function uid(prefix = ""): string {
  const n = crypto.randomUUID().replace(/-/g, "").slice(0, 10)
  return prefix ? `${prefix}_${n}` : n
}

export function secretToken(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "")
}

export function samePhone(a: string, b: string): boolean {
  const da = phoneDigits(a)
  const db = phoneDigits(b)
  if (da.length < 6 || db.length < 6) return false
  return da.endsWith(db.slice(-8)) || db.endsWith(da.slice(-8))
}

export function googleCalendarUrl(title: string, start: Date, end: Date, details: string, location: string): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details,
    location,
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

export function icsFor(title: string, start: Date, end: Date, details: string, location: string): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Solera//Turnos//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${details.replace(/\n/g, "\\n")}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}
