import { getSession } from "@/lib/auth"
import {
  campaignStats,
  createBooking,
  dashboard,
  dueBack,
  launchCampaign,
  moveAppointment,
  processDue,
  segmentOf,
  setStatus,
} from "@/lib/engine"
import { fail, originFrom, pushMessages } from "@/lib/http"
import { update } from "@/lib/store"
import { uid } from "@/lib/time"
import { Secret, TOTP } from "otpauth"
import QRCode from "qrcode"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import type { Barber, Campaign, Coupon, Database, Product, Service, Template } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function snapshot(db: Database) {
  return {
    settings: db.settings,
    services: db.services,
    products: db.products,
    barbers: db.barbers,
    appointments: db.appointments,
    customers: db.customers.map((c) => ({ ...c, segment: segmentOf(db, c), due: dueBack(db, c) })),
    reviews: db.reviews,
    waitlist: db.waitlist,
    coupons: db.coupons,
    campaigns: db.campaigns.map((c) => ({ ...c, stats: campaignStats(db, c.id) })),
    templates: db.templates,
    blocks: db.blocks,
    messages: [...db.messages].slice(-300).reverse(),
    dashboard: dashboard(db),
    integrations: {
      email: Boolean(process.env.RESEND_API_KEY),
      whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    admin: db.admins.map((a) => ({ email: a.email, totpEnabled: a.totpEnabled })),
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return fail("No autorizado", 401)
  const data = await update((db) => snapshot(db))
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return fail("No autorizado", 401)
  const body = await req.json().catch(() => null)
  if (!body?.action) return fail("Falta la acción.")
  const origin = originFrom(req)
  const extra: Record<string, unknown> = {}
  const result = await update(async (db) => {
    const admin = db.admins.find((a) => a.email === session.email) || db.admins[0]
    switch (body.action as string) {
      case "status": {
        const changed = setStatus(db, String(body.id), body.status, new Date(), origin)
        if (!changed.ok) return { error: changed.error }
        await pushMessages(db, changed.messages, origin)
        return null
      }
      case "move": {
        const moved = moveAppointment(db, String(body.id), String(body.start), String(body.barberId))
        if (!moved.ok) return { error: moved.error }
        return null
      }
      case "create": {
        const booked = createBooking(db, {
          serviceIds: body.serviceIds,
          barberId: body.barberId,
          secondBarberId: body.secondBarberId,
          duoMode: body.duoMode,
          start: body.start,
          duo: Boolean(body.duo),
          duoName: body.duoName,
          name: body.name,
          email: body.email,
          phone: body.phone,
          products: [],
          marketingOptIn: false,
          whatsappOptIn: Boolean(body.whatsappOptIn),
        })
        if (!booked.ok) return { error: booked.error }
        return null
      }
      case "block": {
        db.blocks.push({
          id: uid("blk"),
          barberId: body.barberId || "all",
          start: body.start,
          end: body.end,
          reason: String(body.reason || "Bloqueo"),
          type: body.type || "block",
        })
        return null
      }
      case "deleteBlock": {
        db.blocks = db.blocks.filter((b) => b.id !== body.id)
        return null
      }
      case "customer": {
        const customer = db.customers.find((c) => c.id === body.id)
        if (!customer) return { error: "No está ese cliente." }
        customer.notes = String(body.notes ?? customer.notes)
        customer.recipe = String(body.recipe ?? customer.recipe)
        customer.stamps = Number(body.stamps ?? customer.stamps)
        customer.marketingOptIn = Boolean(body.marketingOptIn)
        customer.whatsappOptIn = Boolean(body.whatsappOptIn)
        customer.birthday = body.birthday || customer.birthday
        return null
      }
      case "service": {
        const incoming = body.service as Service
        const index = db.services.findIndex((s) => s.id === incoming.id)
        if (index >= 0) db.services[index] = { ...db.services[index], ...incoming }
        else db.services.push({ ...incoming, id: incoming.id || uid("srv") })
        return null
      }
      case "product": {
        const incoming = body.product as Product
        const index = db.products.findIndex((s) => s.id === incoming.id)
        if (index >= 0) db.products[index] = { ...db.products[index], ...incoming }
        else db.products.push({ ...incoming, id: incoming.id || uid("prd") })
        return null
      }
      case "barber": {
        const incoming = body.barber as Barber
        const index = db.barbers.findIndex((s) => s.id === incoming.id)
        if (index >= 0) db.barbers[index] = { ...db.barbers[index], ...incoming }
        else db.barbers.push({ ...incoming, id: incoming.id || uid("bar") })
        return null
      }
      case "settings": {
        db.settings = { ...db.settings, ...body.settings }
        return null
      }
      case "coupon": {
        const incoming = body.coupon as Coupon
        const index = db.coupons.findIndex((c) => c.id === incoming.id)
        const coupon = { ...incoming, code: incoming.code.toUpperCase(), id: incoming.id || uid("cup") }
        if (index >= 0) db.coupons[index] = { ...db.coupons[index], ...coupon }
        else db.coupons.push({ ...coupon, uses: 0 })
        return null
      }
      case "deleteCoupon": {
        db.coupons = db.coupons.filter((c) => c.id !== body.id)
        return null
      }
      case "template": {
        const incoming = body.template as Template
        const index = db.templates.findIndex((t) => t.id === incoming.id)
        const template = { ...incoming, id: incoming.id || uid("tpl") }
        if (index >= 0) db.templates[index] = template
        else db.templates.push(template)
        return null
      }
      case "deleteTemplate": {
        db.templates = db.templates.filter((t) => t.id !== body.id)
        return null
      }
      case "campaign": {
        const incoming = body.campaign as Campaign
        const campaign: Campaign = {
          ...incoming,
          id: incoming.id || uid("camp"),
          status: incoming.scheduledAt ? "scheduled" : "draft",
          createdAt: incoming.createdAt || new Date().toISOString(),
        }
        const index = db.campaigns.findIndex((c) => c.id === campaign.id)
        if (index >= 0) db.campaigns[index] = { ...db.campaigns[index], ...campaign, status: db.campaigns[index].status === "sent" ? "sent" : campaign.status }
        else db.campaigns.push(campaign)
        return null
      }
      case "sendCampaign": {
        const campaign = db.campaigns.find((c) => c.id === body.id)
        if (!campaign) return { error: "No está esa campaña." }
        if (campaign.status === "sent") return { error: "Esa campaña ya se envió." }
        await pushMessages(db, launchCampaign(db, campaign, origin), origin)
        return null
      }
      case "review": {
        const review = db.reviews.find((r) => r.id === body.id)
        if (!review) return { error: "No está esa reseña." }
        review.published = Boolean(body.published)
        return null
      }
      case "fillGaps": {
        const campaign: Campaign = {
          id: uid("camp"),
          name: `Huecos ${new Date().toISOString().slice(0, 10)}`,
          channel: "both",
          segment: "en_riesgo",
          subject: "{nombre}, se abrió una silla",
          body: "Hola {nombre}. Hoy quedó un hueco en Solera para tu {ultimo_corte}. Si te sirve, reservá con el mismo teléfono y el premio de la tarjeta se aplica solo.\n{link_reserva}",
          status: "draft",
          createdAt: new Date().toISOString(),
        }
        db.campaigns.push(campaign)
        await pushMessages(db, launchCampaign(db, campaign, origin), origin)
        return null
      }
      case "process": {
        await pushMessages(db, processDue(db, new Date(), origin), origin)
        return null
      }
      case "password": {
        if (!admin || !bcrypt.compareSync(String(body.current || ""), admin.passwordHash)) return { error: "La contraseña actual no coincide." }
        if (String(body.next || "").length < 8) return { error: "La nueva contraseña necesita 8 caracteres." }
        admin.passwordHash = bcrypt.hashSync(String(body.next), 10)
        return null
      }
      case "totp-setup": {
        if (!admin) return { error: "No hay administrador." }
        const secret = new Secret({ size: 20 })
        admin.totpPending = secret.base32
        extra.otpauth = new TOTP({ issuer: "Solera", label: admin.email, secret }).toString()
        return null
      }
      case "totp-enable": {
        if (!admin?.totpPending) return { error: "Primero generá el secreto." }
        const totp = new TOTP({ secret: admin.totpPending })
        if (totp.validate({ token: String(body.code || ""), window: 1 }) === null) return { error: "Ese código no sirve." }
        admin.totpSecret = admin.totpPending
        admin.totpEnabled = true
        admin.totpPending = null
        return null
      }
      case "totp-disable": {
        if (!admin?.totpSecret) return { error: "No hay segundo factor." }
        const totp = new TOTP({ secret: admin.totpSecret })
        if (totp.validate({ token: String(body.code || ""), window: 1 }) === null) return { error: "Ese código no sirve." }
        admin.totpEnabled = false
        admin.totpSecret = null
        return null
      }
      default:
        return { error: "Acción desconocida." }
    }
  })
  if (result && "error" in result && result.error) return fail(result.error)
  if (extra.otpauth) extra.qr = await QRCode.toDataURL(String(extra.otpauth))
  const data = await update((db) => snapshot(db))
  return NextResponse.json({ ...data, ...extra })
}
