/**
 * Reglas del negocio, puras sobre el documento.
 * Un turno ocupa [start, end) del barbero. Cancelado y no-show liberan la silla.
 * El descuento automático que gana es el mayor entre fidelidad, cupón, hora dorada y día de lluvia.
 */
import type {
  Appointment,
  Barber,
  Block,
  Campaign,
  Customer,
  Database,
  PendingMessage,
  Quote,
  Segment,
  Service,
  Settings,
  Slot,
} from "./types"
import {
  addDays,
  addMinutes,
  dateKey,
  formatDay,
  formatTime,
  hourInZone,
  money,
  samePhone,
  secretToken,
  todayKey,
  uid,
  weekdayIndex,
  zonedDateTime,
} from "./time"

const BLOCKING: Appointment["status"][] = ["confirmed", "completed"]

export function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1
}

export function activeServices(db: Database): Service[] {
  return db.services.filter((s) => s.active)
}

export function servicePrice(service: Service, now: Date): number {
  if (service.promoPrice != null && service.promoUntil && new Date(service.promoUntil) > now) return service.promoPrice
  return service.price
}

export function durationOf(db: Database, ids: string[]): number {
  return ids.reduce((sum, id) => sum + (db.services.find((s) => s.id === id)?.durationMin ?? 0), 0)
}

export function findCustomer(db: Database, phone: string, email?: string): Customer | undefined {
  return db.customers.find((c) => samePhone(c.phone, phone) || (email && c.email.toLowerCase() === email.toLowerCase()))
}

export function completedOf(db: Database, customerId: string): Appointment[] {
  return db.appointments
    .filter((a) => a.customerId === customerId && a.status === "completed" && a.seat === "a")
    .sort((a, b) => a.start.localeCompare(b.start))
}

export function segmentOf(db: Database, customer: Customer, now = new Date()): Segment {
  const visits = completedOf(db, customer.id)
  const spend = visits.reduce((sum, a) => sum + groupTotal(db, a), 0)
  const last = visits.at(-1)
  const tz = db.settings.timezone
  const ageDays = (now.getTime() - new Date(customer.createdAt).getTime()) / 86_400_000
  const since = last ? (now.getTime() - new Date(last.start).getTime()) / 86_400_000 : ageDays
  if (ageDays <= 21 && visits.length <= 1) return "nuevo"
  if (!last && ageDays > 30) return "inactivo"
  if (last && since > 90) return "inactivo"
  if (last && since > db.settings.winbackDays) return "en_riesgo"
  if (spend >= db.settings.vipSpend || visits.length >= db.settings.vipVisits) return "vip"
  return "activo"
}

export function dueBack(db: Database, customer: Customer, now = new Date()): boolean {
  const visits = completedOf(db, customer.id)
  if (visits.length < 2) return false
  const gaps: number[] = []
  for (let i = 1; i < visits.length; i++) {
    gaps.push((new Date(visits[i].start).getTime() - new Date(visits[i - 1].start).getTime()) / 86_400_000)
  }
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const since = (now.getTime() - new Date(visits.at(-1)!.start).getTime()) / 86_400_000
  const seg = segmentOf(db, customer, now)
  return (seg === "activo" || seg === "vip") && since >= Math.max(14, avg * 0.85)
}

function shiftOf(barber: Barber, date: string, tz: string) {
  if (!barber.active) return null
  if (barber.daysOff.includes(date)) return null
  return barber.week[weekdayIndex(date, tz)]
}

function blocksFor(db: Database, barberId: string): Block[] {
  return db.blocks.filter((b) => b.barberId === "all" || b.barberId === barberId)
}

export function barberFree(db: Database, barberId: string, start: Date, end: Date, ignoreIds: string[] = []): boolean {
  const barber = db.barbers.find((b) => b.id === barberId)
  if (!barber) return false
  const tz = db.settings.timezone
  const date = dateKey(start, tz)
  const shift = shiftOf(barber, date, tz)
  if (!shift) return false
  const open = zonedDateTime(date, shift.start, tz)
  const close = zonedDateTime(date, shift.end, tz)
  if (start < open || end > close) return false
  if (dateKey(end, tz) !== date && end.getTime() !== close.getTime()) {
    // El turno no puede cruzar la medianoche civil.
    if (end > close) return false
  }
  const a0 = start.getTime()
  const a1 = end.getTime()
  for (const block of blocksFor(db, barberId)) {
    if (overlaps(a0, a1, new Date(block.start).getTime(), new Date(block.end).getTime())) return false
  }
  for (const appt of db.appointments) {
    if (appt.barberId !== barberId) continue
    if (!BLOCKING.includes(appt.status)) continue
    if (ignoreIds.includes(appt.id)) continue
    if (overlaps(a0, a1, new Date(appt.start).getTime(), new Date(appt.end).getTime())) return false
  }
  return true
}

function isGolden(db: Database, barberId: string, start: Date): boolean {
  const barber = db.barbers.find((b) => b.id === barberId)
  if (!barber) return false
  const tz = db.settings.timezone
  const date = dateKey(start, tz)
  const shift = shiftOf(barber, date, tz)
  if (!shift) return false
  const close = zonedDateTime(date, shift.end, tz)
  return close.getTime() - start.getTime() <= db.settings.goldenMinutes * 60_000 && close.getTime() > start.getTime()
}

export function slotsFor(db: Database, date: string, serviceIds: string[], barberId: string | "any", duo: boolean, now = new Date()): Slot[] {
  const minutes = durationOf(db, serviceIds)
  if (!minutes || serviceIds.some((id) => !db.services.find((s) => s.id === id && s.active))) return []
  const tz = db.settings.timezone
  const step = db.settings.slotStep
  const pool = db.barbers.filter((b) => b.active && (barberId === "any" || b.id === barberId))
  const slots: Slot[] = []
  const dayStart = zonedDateTime(date, "00:00", tz).getTime()
  if (dayStart + 24 * 3600_000 < now.getTime() - 3600_000) return []

  for (const barber of pool) {
    const shift = shiftOf(barber, date, tz)
    if (!shift) continue
    let cursor = zonedDateTime(date, shift.start, tz)
    const close = zonedDateTime(date, shift.end, tz)
    while (addMinutes(cursor, duo ? minutes : minutes) <= close) {
      const start = new Date(cursor)
      if (start.getTime() > now.getTime() + 5 * 60_000) {
        const end = addMinutes(start, minutes)
        if (!duo && barberFree(db, barber.id, start, end)) {
          slots.push({ start: start.toISOString(), end: end.toISOString(), barberId: barber.id, golden: isGolden(db, barber.id, start) })
        } else if (duo) {
          const others = db.barbers.filter((b) => b.active && b.id !== barber.id && barberFree(db, b.id, start, end) && barberFree(db, barber.id, start, end))
          if (barberFree(db, barber.id, start, end) && others.length) {
            const load = (id: string) => db.appointments.filter((a) => a.barberId === id && a.status === "confirmed" && dateKey(a.start, tz) === date).length
            const second = others.sort((a, b) => load(a.id) - load(b.id))[0]
            slots.push({
              start: start.toISOString(),
              end: end.toISOString(),
              barberId: barber.id,
              secondBarberId: second.id,
              duoMode: "parallel",
              golden: isGolden(db, barber.id, start),
            })
          } else if (barberFree(db, barber.id, start, addMinutes(start, minutes * 2)) && addMinutes(start, minutes * 2) <= close) {
            slots.push({
              start: start.toISOString(),
              end: addMinutes(start, minutes * 2).toISOString(),
              barberId: barber.id,
              duoMode: "sequential",
              golden: isGolden(db, barber.id, start),
            })
          }
        }
      }
      cursor = addMinutes(cursor, step)
    }
  }

  const load = (id: string) => db.appointments.filter((a) => a.barberId === id && a.status === "confirmed" && dateKey(a.start, tz) === date).length
  const ranked = slots.sort((a, b) => a.start.localeCompare(b.start) || Number(b.duoMode === "parallel") - Number(a.duoMode === "parallel") || load(a.barberId) - load(b.barberId))
  const seen = new Set<string>()
  const unique: Slot[] = []
  for (const slot of ranked) {
    if (seen.has(slot.start)) continue
    seen.add(slot.start)
    unique.push(slot)
  }
  return unique
}

function couponPercent(db: Database, code: string | undefined, now: Date): { percent: number; error?: string; couponId?: string } {
  if (!code) return { percent: 0 }
  const coupon = db.coupons.find((c) => c.code.toLowerCase() === code.trim().toLowerCase())
  if (!coupon || !coupon.active) return { percent: 0, error: "Ese código no está activo." }
  if (new Date(coupon.expires) < now) return { percent: 0, error: "Ese código venció." }
  if (coupon.uses >= coupon.maxUses) return { percent: 0, error: "Ese código ya no tiene usos." }
  return { percent: coupon.percent, couponId: coupon.id }
}

export function quoteBooking(
  db: Database,
  input: {
    serviceIds: string[]
    start?: string
    barberId?: string
    duo?: boolean
    products?: { id: string; qty: number }[]
    coupon?: string
    phone?: string
    rainy?: boolean
  },
  now = new Date(),
): Quote & { error?: string } {
  const services = input.serviceIds.map((id) => db.services.find((s) => s.id === id && s.active)).filter(Boolean) as Service[]
  if (services.length !== input.serviceIds.length || !services.length) return emptyQuote("Elegí al menos un servicio activo.")
  const unit = services.reduce((sum, s) => sum + servicePrice(s, now), 0)
  const minutes = services.reduce((sum, s) => sum + s.durationMin, 0)
  const seats = input.duo ? 2 : 1
  const servicesSub = unit * seats
  const productsSub = (input.products ?? []).reduce((sum, line) => {
    const product = db.products.find((p) => p.id === line.id && p.active)
    return sum + (product ? product.price * Math.max(0, line.qty) : 0)
  }, 0)
  const customer = input.phone ? findCustomer(db, input.phone) : undefined
  const loyalty = loyaltyOffer(db, customer)
  const coupon = couponPercent(db, input.coupon, now)
  if (coupon.error) return { ...emptyQuote(coupon.error), servicesSub, productsSub, minutes, seatCount: seats }
  const golden = Boolean(input.start && input.barberId && input.barberId !== "any" && isGolden(db, input.barberId, new Date(input.start)))
  const rainy = Boolean(input.rainy && input.start && hourInZone(input.start, db.settings.timezone) >= 14 && hourInZone(input.start, db.settings.timezone) < 17)
  const options = [
    { p: loyalty.percent, r: loyalty.reason, rank: 4 },
    { p: coupon.percent, r: coupon.percent ? `Cupón ${input.coupon?.toUpperCase()}` : "", rank: 3 },
    { p: golden ? db.settings.goldenPercent : 0, r: "Hora dorada", rank: 2 },
    { p: rainy ? db.settings.rainPercent : 0, r: "Día de lluvia", rank: 1 },
  ]
  options.sort((a, b) => b.p - a.p || b.rank - a.rank)
  const winner = options[0]
  const percent = winner?.p ?? 0
  const discount = Math.round((servicesSub * percent) / 100)
  return {
    servicesSub,
    productsSub,
    percent,
    reason: percent ? winner.r : "",
    discount,
    total: servicesSub + productsSub - discount,
    minutes,
    seatCount: seats,
  }
}

function emptyQuote(error: string): Quote & { error: string } {
  return { servicesSub: 0, productsSub: 0, percent: 0, reason: "", discount: 0, total: 0, minutes: 0, seatCount: 1, error }
}

function loyaltyOffer(db: Database, customer?: Customer): { percent: number; reason: string } {
  const stamps = customer?.stamps ?? 0
  if (stamps > 0 && (stamps + 1) % 10 === 0) return { percent: db.settings.loyaltyTenthPercent, reason: `Corte ${stamps + 1}: premio de fidelidad` }
  if (stamps === 1) return { percent: db.settings.loyaltySecondPercent, reason: "Segundo corte" }
  return { percent: 0, reason: "" }
}

export type BookingInput = {
  serviceIds: string[]
  barberId: string
  secondBarberId?: string
  duoMode?: "parallel" | "sequential"
  start: string
  duo?: boolean
  duoName?: string
  name: string
  email: string
  phone: string
  products?: { id: string; qty: number }[]
  coupon?: string
  marketingOptIn: boolean
  whatsappOptIn: boolean
  referralCode?: string
  campaignId?: string
  company?: string
  rainy?: boolean
}

export function createBooking(db: Database, input: BookingInput, now = new Date()): { ok: true; token: string; quote: Quote } | { ok: false; error: string } {
  if (input.company) return { ok: true, token: "ok", quote: emptyQuote("") }
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  if (name.length < 2) return { ok: false, error: "Necesitamos tu nombre." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "El email no parece válido." }
  if (phoneDigitsSafe(phone) < 8) return { ok: false, error: "El teléfono está incompleto." }
  const services = input.serviceIds.map((id) => db.services.find((s) => s.id === id && s.active)).filter(Boolean) as Service[]
  if (!services.length || services.length !== input.serviceIds.length) return { ok: false, error: "Hay un servicio que ya no está disponible." }
  const minutes = services.reduce((s, x) => s + x.durationMin, 0)
  const start = new Date(input.start)
  if (Number.isNaN(start.getTime()) || start.getTime() < now.getTime()) return { ok: false, error: "Ese horario ya pasó." }
  const duo = Boolean(input.duo)
  const mode = duo ? input.duoMode : undefined
  if (duo && !input.duoName?.trim()) return { ok: false, error: "Decinos el nombre de quien te acompaña." }
  const endA = addMinutes(start, minutes)
  const barber = db.barbers.find((b) => b.id === input.barberId && b.active)
  if (!barber) return { ok: false, error: "Ese barbero no está disponible." }

  if (!duo || mode === "parallel") {
    if (!barberFree(db, barber.id, start, endA)) return { ok: false, error: "Ese horario se acaba de ocupar. Elegí otro." }
  }
  let second: Barber | undefined
  if (duo && mode === "parallel") {
    second = db.barbers.find((b) => b.id === input.secondBarberId && b.active)
    if (!second || !barberFree(db, second.id, start, endA)) return { ok: false, error: "La segunda silla ya no está libre." }
  }
  if (duo && mode === "sequential") {
    if (!barberFree(db, barber.id, start, addMinutes(start, minutes * 2))) return { ok: false, error: "No entra el turno doble en ese hueco." }
  }
  if (duo && !mode) return { ok: false, error: "No pudimos armar el turno doble." }

  const quote = quoteBooking(db, { ...input, duo, rainy: input.rainy }, now)
  if ("error" in quote && quote.error) return { ok: false, error: quote.error }

  let customer = findCustomer(db, phone, email)
  const referred = input.referralCode?.trim().toLowerCase()
  const referrer = referred ? db.customers.find((c) => c.referralCode.toLowerCase() === referred && !samePhone(c.phone, phone)) : undefined
  if (!customer) {
    customer = {
      id: uid("cus"),
      name,
      email,
      phone,
      notes: "",
      recipe: "",
      marketingOptIn: input.marketingOptIn,
      whatsappOptIn: input.whatsappOptIn,
      createdAt: now.toISOString(),
      stamps: 0,
      referralCode: referralCodeFor(name),
      referredBy: referrer?.id,
      unsubToken: secretToken(),
      welcomed: false,
      loyaltyNotices: [],
    }
    db.customers.push(customer)
  } else {
    customer.name = name
    customer.email = email
    customer.phone = phone
    customer.marketingOptIn = customer.marketingOptIn || input.marketingOptIn
    customer.whatsappOptIn = input.whatsappOptIn
    if (!customer.referredBy && referrer) customer.referredBy = referrer.id
  }

  if (input.coupon) {
    const coupon = db.coupons.find((c) => c.code.toLowerCase() === input.coupon!.trim().toLowerCase())
    if (coupon && quote.reason.startsWith("Cupón")) coupon.uses += 1
  }

  const token = secretToken()
  const groupId = duo ? uid("grp") : undefined
  const products = (input.products ?? []).filter((p) => p.qty > 0 && db.products.some((x) => x.id === p.id && x.active))
  const half = duo ? Math.floor(quote.discount / 2) : quote.discount
  const rest = duo ? quote.discount - half : 0
  const unit = quote.servicesSub / (duo ? 2 : 1)

  const make = (seat: "a" | "b", who: Barber, startAt: Date, endAt: Date, discount: number, withProducts: boolean): Appointment => ({
    id: uid("apt"),
    manageToken: token,
    groupId,
    seat,
    duoMode: mode,
    serviceIds: input.serviceIds,
    barberId: who.id,
    start: startAt.toISOString(),
    end: endAt.toISOString(),
    customerId: customer!.id,
    customerName: seat === "b" && mode === "parallel" ? input.duoName!.trim() : name,
    email,
    phone,
    guestName: duo ? input.duoName!.trim() : undefined,
    status: "confirmed",
    products: withProducts ? products : [],
    couponCode: quote.reason.startsWith("Cupón") ? input.coupon?.trim().toUpperCase() : undefined,
    discountReason: quote.reason || undefined,
    discount,
    total: unit + (withProducts ? quote.productsSub : 0) - discount,
    marketingOptIn: input.marketingOptIn,
    whatsappOptIn: input.whatsappOptIn,
    campaignId: input.campaignId,
    reminder24: false,
    reminder2: false,
    createdAt: now.toISOString(),
  })

  if (!duo) db.appointments.push(make("a", barber, start, endA, quote.discount, true))
  else if (mode === "parallel" && second) {
    db.appointments.push(make("a", barber, start, endA, half, true))
    db.appointments.push(make("b", second, start, endA, rest, false))
  } else {
    db.appointments.push(make("a", barber, start, endA, half, true))
    db.appointments.push(make("b", barber, endA, addMinutes(endA, minutes), rest, false))
  }
  return { ok: true, token, quote }
}

function phoneDigitsSafe(phone: string): number {
  return phone.replace(/\D/g, "").length
}

function referralCodeFor(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "SOLERA"
  const n = Math.floor(1000 + Math.random() * 9000)
  return `${base}-${n}`
}

export function groupOf(db: Database, token: string): Appointment[] {
  return db.appointments.filter((a) => a.manageToken === token).sort((a, b) => a.seat.localeCompare(b.seat))
}

export function groupTotal(db: Database, appt: Appointment): number {
  if (!appt.groupId) return appt.total
  return db.appointments.filter((a) => a.groupId === appt.groupId).reduce((s, a) => s + a.total, 0)
}

export function cancelByToken(db: Database, token: string, now = new Date()): { ok: true; late: boolean } | { ok: false; error: string } {
  const group = groupOf(db, token)
  if (!group.length) return { ok: false, error: "No encontramos ese turno." }
  if (group.every((a) => a.status === "cancelled")) return { ok: false, error: "Ese turno ya estaba cancelado." }
  if (group.some((a) => a.status === "completed" || a.status === "noshow")) return { ok: false, error: "Ese turno ya se cerró." }
  const start = new Date(group[0].start)
  const late = start.getTime() - now.getTime() < db.settings.cancelHours * 3600_000
  for (const appt of group) {
    if (appt.status === "confirmed") {
      appt.status = "cancelled"
      appt.lateCancel = late
    }
  }
  releaseCoupon(db, group)
  return { ok: true, late }
}

function releaseCoupon(db: Database, group: Appointment[]) {
  const code = group.find((a) => a.couponCode)?.couponCode
  if (!code) return
  const coupon = db.coupons.find((c) => c.code.toLowerCase() === code.toLowerCase())
  if (coupon && coupon.uses > 0) coupon.uses -= 1
}

export function rescheduleByToken(
  db: Database,
  token: string,
  slot: { start: string; barberId: string; secondBarberId?: string; duoMode?: "parallel" | "sequential" },
  now = new Date(),
): { ok: true } | { ok: false; error: string } {
  const group = groupOf(db, token)
  if (group.length !== 1 && group.length !== 2) return { ok: false, error: "No encontramos ese turno." }
  if (group.some((a) => a.status !== "confirmed")) return { ok: false, error: "Solo se reprograman turnos confirmados." }
  const primary = group[0]
  const minutes = durationOf(db, primary.serviceIds)
  const start = new Date(slot.start)
  const ignore = group.map((a) => a.id)
  const duo = group.length === 2
  const mode = duo ? slot.duoMode ?? primary.duoMode : undefined
  if (!barberFree(db, slot.barberId, start, addMinutes(start, duo && mode === "sequential" ? minutes * 2 : minutes), ignore)) {
    return { ok: false, error: "Ese horario no está libre." }
  }
  if (duo && mode === "parallel") {
    if (!slot.secondBarberId || !barberFree(db, slot.secondBarberId, start, addMinutes(start, minutes), ignore)) {
      return { ok: false, error: "Falta una segunda silla libre." }
    }
  }
  const endA = addMinutes(start, minutes)
  primary.start = start.toISOString()
  primary.end = endA.toISOString()
  primary.barberId = slot.barberId
  primary.duoMode = mode
  primary.reminder24 = false
  primary.reminder2 = false
  if (group[1]) {
    const second = group[1]
    if (mode === "sequential") {
      second.start = endA.toISOString()
      second.end = addMinutes(endA, minutes).toISOString()
      second.barberId = slot.barberId
    } else {
      second.start = start.toISOString()
      second.end = endA.toISOString()
      second.barberId = slot.secondBarberId || second.barberId
    }
    second.duoMode = mode
    second.reminder24 = false
    second.reminder2 = false
  }
  return { ok: true }
}

export function setStatus(db: Database, id: string, status: Appointment["status"], now = new Date(), origin = ""): { ok: true; messages: PendingMessage[] } | { ok: false; error: string } {
  const appt = db.appointments.find((a) => a.id === id)
  if (!appt) return { ok: false, error: "Turno inexistente." }
  const group = appt.groupId ? db.appointments.filter((a) => a.groupId === appt.groupId) : [appt]
  const messages: PendingMessage[] = []
  if (status === "cancelled") {
    for (const item of group) if (item.status === "confirmed" || item.status === "completed") item.status = "cancelled"
    releaseCoupon(db, group)
    return { ok: true, messages }
  }
  for (const item of group) item.status = status
  if (status === "completed") {
    const customer = db.customers.find((c) => c.id === appt.customerId)
    if (customer) {
      customer.stamps += 1
      if (customer.stamps === 1 && customer.referredBy) {
        const host = db.customers.find((c) => c.id === customer.referredBy)
        if (host) host.stamps += 1
      }
      const reviewToken = secretToken()
      appt.reviewToken = reviewToken
      messages.push(...absoluteReviewLinks(reviewMessages(db, customer, appt, reviewToken), origin))
      messages.push(...automationForCustomer(db, customer, now, origin))
    }
  }
  return { ok: true, messages }
}

export function moveAppointment(db: Database, id: string, startIso: string, barberId: string): { ok: true } | { ok: false; error: string } {
  const appt = db.appointments.find((a) => a.id === id)
  if (!appt || appt.status !== "confirmed") return { ok: false, error: "Solo se mueven turnos confirmados." }
  return rescheduleByToken(db, appt.manageToken, {
    start: startIso,
    barberId,
    secondBarberId: appt.groupId ? db.appointments.find((a) => a.groupId === appt.groupId && a.id !== appt.id)?.barberId : undefined,
    duoMode: appt.duoMode,
  })
}

export function submitReview(db: Database, reviewToken: string, rating: number, text: string, now = new Date()): { ok: true } | { ok: false; error: string } {
  const appt = db.appointments.find((a) => a.reviewToken === reviewToken)
  if (!appt) return { ok: false, error: "El enlace de reseña no es válido." }
  if (db.reviews.some((r) => r.appointmentId === appt.id)) return { ok: false, error: "Esta visita ya tiene reseña." }
  const score = Math.max(1, Math.min(5, Math.round(rating)))
  db.reviews.push({
    id: uid("rev"),
    appointmentId: appt.id,
    customerName: appt.customerName.split(" ")[0],
    barberId: appt.barberId,
    rating: score,
    text: text.trim().slice(0, 600),
    published: score >= 4,
    createdAt: now.toISOString(),
  })
  return { ok: true }
}

export function joinWaitlist(db: Database, input: { serviceIds: string[]; barberId: string | "any"; name: string; email: string; phone: string; date: string }, now = new Date()): { ok: true } | { ok: false; error: string } {
  if (input.name.trim().length < 2 || phoneDigitsSafe(input.phone) < 8) return { ok: false, error: "Nombre y teléfono son obligatorios." }
  db.waitlist.push({
    id: uid("wait"),
    serviceIds: input.serviceIds,
    barberId: input.barberId,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    date: input.date,
    createdAt: now.toISOString(),
    notified: false,
  })
  return { ok: true }
}

export function claimFicha(db: Database, phone: string): { customer: Customer; visits: { when: string; services: string; barber: string; total: number }[] } | null {
  const customer = findCustomer(db, phone)
  if (!customer) return null
  const visits = db.appointments
    .filter((a) => a.customerId === customer.id && a.seat === "a" && a.status !== "cancelled")
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((a) => ({
      when: a.start,
      services: a.serviceIds.map((id) => db.services.find((s) => s.id === id)?.name ?? id).join(" + "),
      barber: db.barbers.find((b) => b.id === a.barberId)?.name ?? "",
      total: groupTotal(db, a),
    }))
  return { customer: { ...customer, notes: "" }, visits }
}

export function fillTemplate(db: Database, body: string, customer: Customer): string {
  const last = completedOf(db, customer.id).at(-1)
  const lastName = last ? last.serviceIds.map((id) => db.services.find((s) => s.id === id)?.name ?? "").join(" + ") : "tu último corte"
  const first = customer.name.split(" ")[0]
  return body
    .replaceAll("{nombre}", first)
    .replaceAll("{último_corte}", lastName)
    .replaceAll("{ultimo_corte}", lastName)
    .replaceAll("{descuento}", `${db.settings.loyaltyTenthPercent}%`)
    .replaceAll("{sellos}", String(customer.stamps))
    .replaceAll("{link_reserva}", "/agendar")
    .replaceAll("{codigo}", customer.referralCode)
}

export function customersInSegment(db: Database, segment: Segment | "all", now = new Date()): Customer[] {
  return db.customers.filter((c) => segment === "all" || segmentOf(db, c, now) === segment)
}

export function renderCampaign(db: Database, campaign: Campaign, customer: Customer, origin: string): PendingMessage[] {
  const text = fillTemplate(db, campaign.body, customer).replaceAll("{link_reserva}", `${origin}/agendar?camp=${campaign.id}`)
  const withLink = text.includes(origin) ? text : `${text}\n${origin}/agendar?camp=${campaign.id}`
  const footer = `\n\nSi no querés más mensajes de Solera: ${origin}/baja/${customer.unsubToken}`
  const out: PendingMessage[] = []
  if ((campaign.channel === "email" || campaign.channel === "both") && customer.marketingOptIn && customer.email) {
    out.push({
      channel: "email",
      to: customer.email,
      subject: fillTemplate(db, campaign.subject, customer),
      text: withLink + footer,
      html: emailHtml(db.settings, fillTemplate(db, campaign.subject, customer), withLink + footer, `${origin}/baja/${customer.unsubToken}`),
      kind: "campaign",
      customerId: customer.id,
      campaignId: campaign.id,
    })
  }
  if ((campaign.channel === "whatsapp" || campaign.channel === "both") && customer.marketingOptIn && customer.whatsappOptIn) {
    out.push({
      channel: "whatsapp",
      to: customer.phone,
      text: withLink + footer,
      kind: "campaign",
      customerId: customer.id,
      campaignId: campaign.id,
    })
  }
  return out
}

export function confirmationMessages(db: Database, token: string, origin: string): PendingMessage[] {
  const group = groupOf(db, token)
  if (!group.length) return []
  const primary = group[0]
  const customer = db.customers.find((c) => c.id === primary.customerId)
  const tz = db.settings.timezone
  const services = primary.serviceIds.map((id) => db.services.find((s) => s.id === id)?.name ?? "").join(" + ")
  const who = group.map((a) => db.barbers.find((b) => b.id === a.barberId)?.name).filter(Boolean).join(" y ")
  const when = `${formatDay(primary.start, tz)} ${formatTime(primary.start, tz)}`
  const total = group.reduce((s, a) => s + a.total, 0)
  const text = [
    `Hola ${primary.customerName.split(" ")[0]}, tu turno en ${db.settings.name} quedó confirmado.`,
    `${services} · ${when} · ${who}.`,
    primary.discountReason ? `Descuento aplicado: ${primary.discountReason}.` : "",
    `Total ${money(total)}.`,
    `Para cancelar o cambiar el horario: ${origin}/turno/${token}`,
    `Sumalo a tu calendario: ${origin}/api/bookings/${token}/calendar`,
  ].filter(Boolean).join("\n")
  const messages: PendingMessage[] = [{
    channel: "email",
    to: primary.email,
    subject: db.settings.confirmSubject,
    text,
    html: emailHtml(db.settings, db.settings.confirmSubject, text, customer ? `${origin}/baja/${customer.unsubToken}` : undefined),
    kind: "confirm",
    customerId: customer?.id,
    appointmentId: primary.id,
  }]
  if (primary.whatsappOptIn) {
    messages.push({ channel: "whatsapp", to: primary.phone, text, kind: "confirm", customerId: customer?.id, appointmentId: primary.id })
  }
  return messages
}

function reviewMessages(db: Database, customer: Customer, appt: Appointment, reviewToken: string): PendingMessage[] {
  const origin = ""
  const text = `Hola ${customer.name.split(" ")[0]}, ¿cómo quedó el corte? Tu reseña ayuda a la silla de ${db.barbers.find((b) => b.id === appt.barberId)?.name ?? "tu barbero"}.`
  return [{
    channel: "email",
    to: customer.email,
    subject: db.settings.reviewSubject,
    text: `${text}\n/resena/${reviewToken}`,
    html: emailHtml(db.settings, db.settings.reviewSubject, text, `/baja/${customer.unsubToken}`),
    kind: "review",
    customerId: customer.id,
    appointmentId: appt.id,
  }]
}

export function absoluteReviewLinks(messages: PendingMessage[], origin: string): PendingMessage[] {
  return messages.map((m) => ({
    ...m,
    text: m.text.replace("/resena/", `${origin}/resena/`).replace("/baja/", `${origin}/baja/`),
    html: m.html?.replace('href="/resena/', `href="${origin}/resena/`).replace('href="/baja/', `href="${origin}/baja/`),
  }))
}

export function processDue(db: Database, now: Date, origin: string): PendingMessage[] {
  const messages: PendingMessage[] = []
  for (const appt of db.appointments) {
    if (appt.status !== "confirmed" || appt.seat !== "a") continue
    const ms = new Date(appt.start).getTime() - now.getTime()
    const customer = db.customers.find((c) => c.id === appt.customerId)
    const services = appt.serviceIds.map((id) => db.services.find((s) => s.id === id)?.name ?? "").join(" + ")
    const when = `${formatDay(appt.start, db.settings.timezone)} ${formatTime(appt.start, db.settings.timezone)}`
    if (ms <= 24 * 3600_000 && ms > 2 * 3600_000 && !appt.reminder24) {
      appt.reminder24 = true
      const text = `Recordatorio: tu turno en ${db.settings.name} es el ${when} (${services}). Si no podés venir: ${origin}/turno/${appt.manageToken}`
      messages.push(mail(db, appt, customer, db.settings.reminderSubject, text, "reminder24", origin))
      if (appt.whatsappOptIn) messages.push(wa(appt, customer, text, "reminder24"))
    }
    if (ms <= 2 * 3600_000 && ms > 0 && !appt.reminder2) {
      appt.reminder2 = true
      const text = `En un rato es tu turno en ${db.settings.name}: ${services} a las ${formatTime(appt.start, db.settings.timezone)}. ${origin}/turno/${appt.manageToken}`
      messages.push(mail(db, appt, customer, "Tu turno es en breve", text, "reminder2", origin))
      if (appt.whatsappOptIn) messages.push(wa(appt, customer, text, "reminder2"))
    }
  }
  for (const campaign of db.campaigns) {
    if (campaign.status === "scheduled" && campaign.scheduledAt && new Date(campaign.scheduledAt) <= now) {
      messages.push(...launchCampaign(db, campaign, origin, now))
    }
  }
  for (const customer of db.customers) messages.push(...automationForCustomer(db, customer, now, origin))
  return messages
}

function mail(db: Database, appt: Appointment, customer: Customer | undefined, subject: string, text: string, kind: string, origin: string): PendingMessage {
  return {
    channel: "email",
    to: appt.email,
    subject,
    text,
    html: emailHtml(db.settings, subject, text, customer ? `${origin}/baja/${customer.unsubToken}` : undefined),
    kind,
    customerId: customer?.id,
    appointmentId: appt.id,
  }
}

function wa(appt: Appointment, customer: Customer | undefined, text: string, kind: string): PendingMessage {
  return { channel: "whatsapp", to: appt.phone, text, kind, customerId: customer?.id, appointmentId: appt.id }
}

export function launchCampaign(db: Database, campaign: Campaign, origin: string, now = new Date()): PendingMessage[] {
  const people = customersInSegment(db, campaign.segment, now).filter((c) => c.marketingOptIn)
  const messages = people.flatMap((c) => renderCampaign(db, campaign, c, origin))
  campaign.status = "sent"
  campaign.sentAt = now.toISOString()
  return messages
}

function automationForCustomer(db: Database, customer: Customer, now: Date, origin = ""): PendingMessage[] {
  if (!customer.marketingOptIn) return []
  const messages: PendingMessage[] = []
  const tz = db.settings.timezone
  const today = todayKey(tz, now)
  if (customer.birthday && customer.birthday.slice(5) === today.slice(5) && customer.lastBirthdayYear !== now.getFullYear()) {
    customer.lastBirthdayYear = now.getFullYear()
    messages.push(...auto(db, customer, "Cumpleaños", `Feliz cumple, {nombre}. Esta semana el corte en Solera va con un detalle: mostrá este mensaje en la silla.`, origin, "birthday"))
  }
  const visits = completedOf(db, customer.id)
  if (visits.length === 1 && !customer.welcomed) {
    customer.welcomed = true
    messages.push(...auto(db, customer, "Gracias por el primer corte", `{nombre}, quedó anotada tu receta. El segundo corte tiene ${db.settings.loyaltySecondPercent}% si reservás con el mismo teléfono. {link_reserva}`, origin, "welcome"))
  }
  const last = visits.at(-1)
  if (last) {
    const since = (now.getTime() - new Date(last.start).getTime()) / 86_400_000
    const already = customer.lastWinback && now.getTime() - new Date(customer.lastWinback).getTime() < 30 * 86_400_000
    if (since >= db.settings.winbackDays && !already) {
      customer.lastWinback = now.toISOString()
      messages.push(...auto(db, customer, "Te guardamos la silla", `{nombre}, hace un tiempo no vemos tu {ultimo_corte}. Si querés volver, la agenda tiene huecos esta semana. {link_reserva}`, origin, "winback"))
    }
  }
  for (const mark of [2, 10]) {
    if (customer.stamps >= mark && !customer.loyaltyNotices.includes(mark)) {
      customer.loyaltyNotices.push(mark)
      const off = mark === 10 ? db.settings.loyaltyTenthPercent : db.settings.loyaltySecondPercent
      messages.push(...auto(db, customer, "Sumaste un premio", `{nombre}, llevás {sellos} cortes. El próximo premio es ${off}% y se aplica solo al reservar. Tu código para invitar: {codigo}`, origin, `loyalty-${mark}`))
    }
  }
  return messages
}

function auto(db: Database, customer: Customer, subject: string, body: string, origin: string, kind: string): PendingMessage[] {
  const text = fillTemplate(db, body, customer).replaceAll("{link_reserva}", `${origin}/agendar`)
  const footer = origin ? `\n\nBaja: ${origin}/baja/${customer.unsubToken}` : ""
  const out: PendingMessage[] = []
  if (customer.email) {
    out.push({
      channel: "email",
      to: customer.email,
      subject,
      text: text + footer,
      html: emailHtml(db.settings, subject, text + footer, origin ? `${origin}/baja/${customer.unsubToken}` : undefined),
      kind,
      customerId: customer.id,
      campaignId: `auto:${kind}`,
    })
  }
  if (customer.whatsappOptIn) {
    out.push({ channel: "whatsapp", to: customer.phone, text: text + footer, kind, customerId: customer.id, campaignId: `auto:${kind}` })
  }
  return out
}

export function waitlistForCancellation(db: Database, token: string, origin: string): PendingMessage[] {
  const group = groupOf(db, token)
  if (!group.length) return []
  const date = dateKey(group[0].start, db.settings.timezone)
  const messages: PendingMessage[] = []
  for (const entry of db.waitlist) {
    if (entry.notified || entry.date !== date) continue
    if (entry.barberId !== "any" && !group.some((g) => g.barberId === entry.barberId)) continue
    entry.notified = true
    const text = `Hola ${entry.name.split(" ")[0]}, se liberó un horario el ${formatDay(group[0].start, db.settings.timezone)} en ${db.settings.name}. Entrá a reservar antes de que vuelva a ocuparse: ${origin}/agendar`
    if (entry.email) {
      messages.push({
        channel: "email",
        to: entry.email,
        subject: "Se liberó un turno",
        text,
        html: emailHtml(db.settings, "Se liberó un turno", text),
        kind: "waitlist",
      })
    }
    messages.push({ channel: "whatsapp", to: entry.phone, text, kind: "waitlist" })
  }
  return messages
}

export function unsubscribe(db: Database, token: string): boolean {
  const customer = db.customers.find((c) => c.unsubToken === token)
  if (!customer) return false
  customer.marketingOptIn = false
  customer.whatsappOptIn = false
  return true
}

export function occupancy(db: Database, now = new Date()): { booked: number; capacity: number; percent: number } {
  const tz = db.settings.timezone
  const date = todayKey(tz, now)
  let capacity = 0
  for (const barber of db.barbers.filter((b) => b.active)) {
    const shift = shiftOf(barber, date, tz)
    if (!shift) continue
    const open = zonedDateTime(date, shift.start, tz)
    const close = zonedDateTime(date, shift.end, tz)
    capacity += (close.getTime() - open.getTime()) / 60_000
  }
  const booked = db.appointments
    .filter((a) => (a.status === "confirmed" || a.status === "completed") && dateKey(a.start, tz) === date)
    .reduce((sum, a) => sum + (new Date(a.end).getTime() - new Date(a.start).getTime()) / 60_000, 0)
  const percent = capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0
  return { booked, capacity, percent }
}

export function liveBoard(db: Database, now = new Date()): { barber: string; service: string; state: "now" | "next"; at: string }[] {
  const tz = db.settings.timezone
  const date = todayKey(tz, now)
  const todays = db.appointments
    .filter((a) => a.status === "confirmed" && a.seat === "a" && dateKey(a.start, tz) === date)
    .sort((a, b) => a.start.localeCompare(b.start))
  const rows: { barber: string; service: string; state: "now" | "next"; at: string }[] = []
  for (const appt of todays) {
    const start = new Date(appt.start).getTime()
    const end = new Date(appt.end).getTime()
    const barber = db.barbers.find((b) => b.id === appt.barberId)?.name ?? ""
    const service = appt.serviceIds.map((id) => db.services.find((s) => s.id === id)?.name ?? "").join(" + ")
    if (start <= now.getTime() && now.getTime() < end) rows.push({ barber, service, state: "now", at: appt.start })
  }
  if (!rows.length) {
    const next = todays.find((a) => new Date(a.start) > now)
    if (next) {
      rows.push({
        barber: db.barbers.find((b) => b.id === next.barberId)?.name ?? "",
        service: next.serviceIds.map((id) => db.services.find((s) => s.id === id)?.name ?? "").join(" + "),
        state: "next",
        at: next.start,
      })
    }
  }
  return rows
}

export function gapsToday(db: Database, now = new Date()): { barber: string; from: string; to: string }[] {
  const tz = db.settings.timezone
  const date = todayKey(tz, now)
  const gaps: { barber: string; from: string; to: string }[] = []
  for (const barber of db.barbers.filter((b) => b.active)) {
    const shift = shiftOf(barber, date, tz)
    if (!shift) continue
    const open = zonedDateTime(date, shift.start, tz).getTime()
    const close = zonedDateTime(date, shift.end, tz).getTime()
    const busy = db.appointments
      .filter((a) => a.barberId === barber.id && (a.status === "confirmed" || a.status === "completed") && dateKey(a.start, tz) === date)
      .map((a) => [new Date(a.start).getTime(), new Date(a.end).getTime()] as const)
      .sort((a, b) => a[0] - b[0])
    let cursor = Math.max(open, now.getTime())
    for (const [s, e] of busy) {
      if (s - cursor >= 60 * 60_000) gaps.push({ barber: barber.name, from: new Date(cursor).toISOString(), to: new Date(s).toISOString() })
      cursor = Math.max(cursor, e)
    }
    if (close - cursor >= 60 * 60_000) gaps.push({ barber: barber.name, from: new Date(cursor).toISOString(), to: new Date(close).toISOString() })
  }
  return gaps
}

export function dashboard(db: Database, now = new Date()) {
  const tz = db.settings.timezone
  const today = todayKey(tz, now)
  const inRange = (iso: string, from: string, to: string) => {
    const key = dateKey(iso, tz)
    return key >= from && key <= to
  }
  const weekStart = addDays(today, -((weekdayIndex(today, tz) + 6) % 7))
  const monthStart = `${today.slice(0, 7)}-01`
  const sumTotal = (from: string, to: string, statuses: Appointment["status"][]) =>
    db.appointments.filter((a) => statuses.includes(a.status) && inRange(a.start, from, to)).reduce((s, a) => s + a.total, 0)
  const todays = db.appointments.filter((a) => dateKey(a.start, tz) === today).sort((a, b) => a.start.localeCompare(b.start))
  const since = addDays(today, -30)
  const recent = db.appointments.filter((a) => inRange(a.start, since, today))
  const denom = recent.filter((a) => a.status !== "cancelled" || a.lateCancel).length || 1
  const hours = Array.from({ length: 11 }, (_, i) => ({ hour: 10 + i, count: 0 }))
  for (const appt of recent) {
    if (appt.status === "cancelled") continue
    const h = hourInZone(appt.start, tz)
    const bin = hours.find((x) => x.hour === h)
    if (bin) bin.count += 1
  }
  const serviceCount = new Map<string, number>()
  for (const appt of recent.filter((a) => a.status === "completed" || a.status === "confirmed")) {
    for (const id of appt.serviceIds) serviceCount.set(id, (serviceCount.get(id) ?? 0) + 1)
  }
  const top = [...serviceCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ name: db.services.find((s) => s.id === id)?.name ?? id, count }))
  const weekSeries = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i)
    return { day, total: sumTotal(day, day, ["completed"]) }
  })
  const peopleToday = new Set(todays.filter((a) => a.seat === "a" && a.status !== "cancelled").map((a) => a.customerId))
  let fresh = 0
  let returning = 0
  for (const id of peopleToday) {
    const prior = db.appointments.some((a) => a.customerId === id && a.status === "completed" && dateKey(a.start, tz) < today)
    if (prior) returning += 1
    else fresh += 1
  }
  const commissions = db.barbers.map((b) => {
    const earned = db.appointments
      .filter((a) => a.barberId === b.id && a.status === "completed" && inRange(a.start, monthStart, today))
      .reduce((s, a) => s + a.total, 0)
    return { name: b.name, earned, commission: Math.round((earned * b.commissionPct) / 100) }
  })
  return {
    today: todays,
    income: {
      today: sumTotal(today, today, ["completed"]),
      week: sumTotal(weekStart, today, ["completed"]),
      month: sumTotal(monthStart, today, ["completed"]),
      expectedToday: sumTotal(today, today, ["confirmed"]),
    },
    clients: { fresh, returning },
    top,
    hours,
    weekSeries,
    cancelRate: recent.filter((a) => a.status === "cancelled").length / recent.length || 0,
    noshowRate: recent.filter((a) => a.status === "noshow").length / denom,
    occupancy: occupancy(db, now),
    gaps: gapsToday(db, now),
    due: db.customers.filter((c) => dueBack(db, c, now)).map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    commissions,
    segments: {
      nuevo: customersInSegment(db, "nuevo", now).length,
      activo: customersInSegment(db, "activo", now).length,
      en_riesgo: customersInSegment(db, "en_riesgo", now).length,
      inactivo: customersInSegment(db, "inactivo", now).length,
      vip: customersInSegment(db, "vip", now).length,
    },
  }
}

export function campaignStats(db: Database, campaignId: string) {
  const sent = db.messages.filter((m) => m.campaignId === campaignId)
  const opened = sent.filter((m) => m.opened).length
  const bookings = db.appointments.filter((a) => a.campaignId === campaignId && a.seat === "a" && a.status !== "cancelled").length
  return { sent: sent.length, opened, bookings }
}

export function emailHtml(settings: Settings, title: string, text: string, unsubscribe?: string): string {
  const paragraphs = text.split("\n").map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`).join("")
  const bye = unsubscribe ? `<p style="margin-top:24px;font-size:12px;color:#8a8175"><a href="${unsubscribe}">Darme de baja</a> de novedades y recordatorios comerciales.</p>` : ""
  return `<div style="background:#0c0b0a;padding:32px;font-family:Georgia,serif;color:#f4efe6"><div style="max-width:480px;margin:0 auto"><p style="letter-spacing:.2em;font-size:12px;color:#e0b15a">${escapeHtml(settings.name.toUpperCase())}</p><h1 style="font-weight:400;font-size:28px">${escapeHtml(title)}</h1>${paragraphs}${bye}</div></div>`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function publicSettings(db: Database) {
  const { settings: s } = db
  return {
    name: s.name,
    tagline: s.tagline,
    street: s.street,
    district: s.district,
    city: s.city,
    mapsUrl: s.mapsUrl,
    instagram: s.instagram,
    whatsapp: s.whatsapp,
    email: s.email,
    timezone: s.timezone,
    cancelHours: s.cancelHours,
    goldenPercent: s.goldenPercent,
    rainPercent: s.rainPercent,
    loyaltySecondPercent: s.loyaltySecondPercent,
    loyaltyTenthPercent: s.loyaltyTenthPercent,
  }
}

export function hitRate(db: Database, key: string, limit: number, windowMs: number, now = new Date()): boolean {
  const since = now.getTime() - windowMs
  db.rates = db.rates.filter((r) => new Date(r.at).getTime() > now.getTime() - 6 * 3600_000)
  const count = db.rates.filter((r) => r.key === key && new Date(r.at).getTime() > since).length
  if (count >= limit) return false
  db.rates.push({ key, at: now.toISOString() })
  return true
}

export function serviceNames(db: Database, ids: string[]): string {
  return ids.map((id) => db.services.find((s) => s.id === id)?.name ?? id).join(" + ")
}

export { addDays }
