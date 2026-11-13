/** Modelo de Solera. Las fechas viajan en ISO; la hora local se calcula con la zona del negocio. */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Shift = { start: string; end: string } | null

export type Service = {
  id: string
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  durationMin: number
  price: number
  active: boolean
  category: "corte" | "barba" | "color" | "tratamiento" | "combo"
  promoPrice?: number
  promoUntil?: string
}

export type Product = {
  id: string
  name: string
  nameEn: string
  price: number
  active: boolean
  blurb: string
}

export type Barber = {
  id: string
  name: string
  specialty: string
  specialtyEn: string
  bio: string
  bioEn: string
  active: boolean
  commissionPct: number
  week: Shift[]
  daysOff: string[]
  color: string
}

export type AppointmentStatus = "confirmed" | "completed" | "cancelled" | "noshow"

export type Appointment = {
  id: string
  manageToken: string
  groupId?: string
  seat: "a" | "b"
  duoMode?: "parallel" | "sequential"
  serviceIds: string[]
  barberId: string
  start: string
  end: string
  customerId: string
  customerName: string
  email: string
  phone: string
  guestName?: string
  status: AppointmentStatus
  products: { id: string; qty: number }[]
  couponCode?: string
  discountReason?: string
  discount: number
  total: number
  marketingOptIn: boolean
  whatsappOptIn: boolean
  campaignId?: string
  reminder24: boolean
  reminder2: boolean
  reviewToken?: string
  lateCancel?: boolean
  createdAt: string
}

export type Customer = {
  id: string
  name: string
  email: string
  phone: string
  notes: string
  recipe: string
  marketingOptIn: boolean
  whatsappOptIn: boolean
  createdAt: string
  stamps: number
  referralCode: string
  referredBy?: string
  birthday?: string
  unsubToken: string
  welcomed: boolean
  lastWinback?: string
  lastBirthdayYear?: number
  loyaltyNotices: number[]
}

export type Review = {
  id: string
  appointmentId?: string
  customerName: string
  barberId?: string
  rating: number
  text: string
  published: boolean
  createdAt: string
}

export type WaitlistEntry = {
  id: string
  serviceIds: string[]
  barberId: string | "any"
  name: string
  email: string
  phone: string
  date: string
  createdAt: string
  notified: boolean
}

export type Coupon = {
  id: string
  code: string
  percent: number
  expires: string
  maxUses: number
  uses: number
  active: boolean
}

export type Campaign = {
  id: string
  name: string
  channel: "email" | "whatsapp" | "both"
  segment: Segment | "all"
  subject: string
  body: string
  scheduledAt?: string
  sentAt?: string
  status: "draft" | "scheduled" | "sent"
  createdAt: string
}

export type Template = {
  id: string
  name: string
  channel: "email" | "whatsapp" | "both"
  subject: string
  body: string
}

export type Block = {
  id: string
  barberId: string | "all"
  start: string
  end: string
  reason: string
  type: "block" | "holiday" | "vacation"
}

export type MessageLog = {
  id: string
  at: string
  channel: "email" | "whatsapp"
  to: string
  subject?: string
  body: string
  kind: string
  customerId?: string
  campaignId?: string
  appointmentId?: string
  ok: boolean
  detail: string
  opened: boolean
}

export type Admin = {
  id: string
  email: string
  passwordHash: string
  totpSecret: string | null
  totpPending: string | null
  totpEnabled: boolean
}

export type Attempt = { email: string; at: string; ok: boolean }

export type RateHit = { key: string; at: string }

export type Settings = {
  name: string
  tagline: string
  street: string
  district: string
  city: string
  mapsUrl: string
  instagram: string
  whatsapp: string
  email: string
  timezone: string
  cancelHours: number
  winbackDays: number
  slotStep: number
  goldenMinutes: number
  goldenPercent: number
  rainPercent: number
  loyaltySecondPercent: number
  loyaltyTenthPercent: number
  vipSpend: number
  vipVisits: number
  confirmSubject: string
  reminderSubject: string
  reviewSubject: string
}

export type Segment = "nuevo" | "activo" | "en_riesgo" | "inactivo" | "vip"

export type Database = {
  version: 1
  services: Service[]
  products: Product[]
  barbers: Barber[]
  appointments: Appointment[]
  customers: Customer[]
  reviews: Review[]
  waitlist: WaitlistEntry[]
  coupons: Coupon[]
  campaigns: Campaign[]
  templates: Template[]
  blocks: Block[]
  messages: MessageLog[]
  admins: Admin[]
  attempts: Attempt[]
  rates: RateHit[]
  settings: Settings
}

export type Slot = {
  start: string
  end: string
  barberId: string
  secondBarberId?: string
  duoMode?: "parallel" | "sequential"
  golden: boolean
}

export type Quote = {
  servicesSub: number
  productsSub: number
  percent: number
  reason: string
  discount: number
  total: number
  minutes: number
  seatCount: number
}

export type PendingMessage = {
  channel: "email" | "whatsapp"
  to: string
  subject?: string
  text: string
  html?: string
  kind: string
  customerId?: string
  campaignId?: string
  appointmentId?: string
}
