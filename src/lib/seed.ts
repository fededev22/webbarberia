import bcrypt from "bcryptjs"
import type { Appointment, Customer, Database, Service } from "./types"
import { addDays, secretToken, todayKey, uid, zonedDateTime } from "./time"

const TZ = "America/Argentina/Buenos_Aires"

function at(day: number, hh: number, mm: number): string {
  const date = addDays(todayKey(TZ), day)
  const time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
  return zonedDateTime(date, time, TZ).toISOString()
}

function end(start: string, service: Service): string {
  return new Date(new Date(start).getTime() + service.durationMin * 60_000).toISOString()
}

export async function buildSeed(): Promise<Database> {
  const passwordHash = await bcrypt.hash("Solera.2026", 10)
  const corte: Service = { id: "corte", name: "Corte", nameEn: "Cut", description: "Tijera o máquina, con lavado y el peinado de salida.", descriptionEn: "Scissors or clippers, wash and finish.", durationMin: 45, price: 18000, active: true, category: "corte" }
  const fade: Service = { id: "fade", name: "Fade", nameEn: "Fade", description: "Degradé limpio, línea marcada y control de volumen arriba.", descriptionEn: "Clean fade, defined line, weight on top.", durationMin: 45, price: 20000, active: true, category: "corte" }
  const barba: Service = { id: "barba", name: "Barba", nameEn: "Beard", description: "Toalla caliente, perfil y aceite.", descriptionEn: "Hot towel, shape and oil.", durationMin: 30, price: 12000, active: true, category: "barba" }
  const combo: Service = { id: "combo", name: "Corte + barba", nameEn: "Cut + beard", description: "Las dos cosas, en una sola sentada.", descriptionEn: "Both, in one sitting.", durationMin: 75, price: 28000, active: true, category: "combo" }
  const perfil: Service = { id: "perfil", name: "Perfilado", nameEn: "Line-up", description: "Bordes, patillas y nuca. Entra justo antes de una reunión.", descriptionEn: "Edges, sideburns and neck.", durationMin: 20, price: 8000, active: true, category: "barba" }
  const color: Service = { id: "color", name: "Color", nameEn: "Color", description: "Canas o un tono. Prueba de mecha si es la primera vez.", descriptionEn: "Grey coverage or a tone. Strand test the first time.", durationMin: 90, price: 35000, active: true, category: "color", promoPrice: 31000, promoUntil: at(30, 23, 0) }
  const trata: Service = { id: "trata", name: "Tratamiento", nameEn: "Treatment", description: "Cuero cabelludo y brillo. No es un corte.", descriptionEn: "Scalp and shine. Not a cut.", durationMin: 40, price: 16000, active: true, category: "tratamiento" }
  const nino: Service = { id: "nino", name: "Corte niño", nameEn: "Kids cut", description: "Hasta 12 años. Si se aburre, paramos y seguimos otro día.", descriptionEn: "Up to age 12.", durationMin: 30, price: 14000, active: true, category: "corte" }
  const navaja: Service = { id: "navaja", name: "Afeitado a navaja", nameEn: "Straight-razor shave", description: "Afeitado completo, piel calma al salir.", descriptionEn: "Full shave, calm skin on the way out.", durationMin: 30, price: 14000, active: true, category: "barba" }
  const services = [corte, fade, barba, combo, perfil, color, trata, nino, navaja]

  const customers: Customer[] = [
    person("cus_ines", "Inés Kalber", "ines.kalber@solera.example", "11 5555 2101", 9, "Degradé 2, flequillo corto, sin polvo.", at(-400, 11, 0), true, todayKey(TZ).slice(0, 4) + todayKey(TZ).slice(4)),
    person("cus_pablo", "Pablo Duarte", "pablo.duarte@solera.example", "11 5555 2102", 4, "Barba cerrada, no rebajar patillas.", at(-200, 11, 0)),
    person("cus_sara", "Sara Molina", "sara.molina@solera.example", "11 5555 2103", 2, "Solo tijera. Le molesta la máquina en la nuca.", at(-500, 11, 0), false),
    person("cus_teo", "Teo Ibáñez", "teo.ibanez@solera.example", "11 5555 2104", 1, "", at(-6, 12, 0)),
    person("cus_juana", "Juana Rivas", "juana.rivas@solera.example", "11 5555 2105", 5, "Textura, raya al costado, mucho brillo.", at(-180, 11, 0)),
    person("cus_ciro", "Ciro Beltrán", "ciro.beltran@solera.example", "11 5555 2106", 3, "Siempre llega 10 minutos antes.", at(-90, 11, 0)),
    person("cus_elena", "Elena Vázquez", "elena.vazquez@solera.example", "11 5555 2107", 6, "Color 6.1, raíces cada 5 semanas.", at(-220, 11, 0), true, undefined, true),
    person("cus_martin", "Martín Lago", "martin.lago@solera.example", "11 5555 2108", 2, "Clásico, oreja descubierta.", at(-40, 11, 0)),
  ]
  customers[1].marketingOptIn = true
  customers[2].marketingOptIn = false

  const appt = (
    id: string,
    customer: Customer,
    service: Service,
    barberId: string,
    start: string,
    status: Appointment["status"],
  ): Appointment => ({
    id,
    manageToken: secretToken(),
    seat: "a",
    serviceIds: [service.id],
    barberId,
    start,
    end: end(start, service),
    customerId: customer.id,
    customerName: customer.name,
    email: customer.email,
    phone: customer.phone,
    status,
    products: [],
    discount: 0,
    total: service.price,
    marketingOptIn: customer.marketingOptIn,
    whatsappOptIn: customer.whatsappOptIn,
    reminder24: status !== "confirmed" || new Date(start).getTime() - Date.now() < 20 * 3600_000,
    reminder2: status !== "confirmed" || new Date(start).getTime() - Date.now() < 90 * 60_000,
    createdAt: at(-2, 9, 0),
  })

  const appointments: Appointment[] = [
    appt("apt_m1", customers[7], corte, "renzo", at(0, 10, 0), "completed"),
    appt("apt_e1", customers[6], color, "lila", at(0, 11, 30), "confirmed"),
    appt("apt_j1", customers[4], fade, "nico", at(0, 16, 0), "confirmed"),
    appt("apt_t1", customers[3], corte, "mateo", at(0, 18, 0), "confirmed"),
    appt("apt_p1", customers[1], combo, "renzo", at(-50, 15, 0), "completed"),
    appt("apt_s1", customers[2], trata, "lila", at(-120, 12, 0), "completed"),
    appt("apt_c1", customers[5], barba, "mateo", at(-10, 17, 0), "noshow"),
    appt("apt_i1", customers[0], fade, "nico", at(-18, 12, 0), "completed"),
    appt("apt_x1", customers[4], perfil, "renzo", at(1, 12, 30), "confirmed"),
    appt("apt_x2", customers[7], barba, "mateo", at(2, 19, 0), "confirmed"),
    appt("apt_x3", customers[5], corte, "nico", at(-3, 11, 0), "cancelled"),
  ]
  // Historial para que los sellos y los segmentos tengan de dónde salir.
  for (let i = 0; i < 8; i++) appointments.push(appt(`apt_ih${i}`, customers[0], fade, i % 2 ? "nico" : "renzo", at(-30 - i * 21, 13, 0), "completed"))
  for (let i = 0; i < 3; i++) appointments.push(appt(`apt_ph${i}`, customers[1], combo, "renzo", at(-70 - i * 25, 16, 0), "completed"))
  appointments.push(appt("apt_sh", customers[2], corte, "lila", at(-140, 11, 0), "completed"))
  for (let i = 0; i < 4; i++) appointments.push(appt(`apt_jh${i}`, customers[4], fade, "nico", at(-40 - i * 28, 15, 0), "completed"))
  for (let i = 0; i < 5; i++) appointments.push(appt(`apt_eh${i}`, customers[6], color, "lila", at(-40 - i * 35, 11, 0), "completed"))
  appointments.push(appt("apt_mh", customers[7], corte, "mateo", at(-25, 18, 0), "completed"))
  for (let i = 0; i < 2; i++) appointments.push(appt(`apt_ch${i}`, customers[5], barba, "mateo", at(-40 - i * 20, 17, 0), "completed"))

  for (const customer of customers) {
    customer.stamps = appointments.filter((a) => a.customerId === customer.id && a.status === "completed").length
  }

  const db: Database = {
    version: 1,
    services,
    products: [
      { id: "pomada", name: "Pomada Solera", nameEn: "Solera pomade", price: 9000, active: true, blurb: "Brillo bajo, se lava con agua." },
      { id: "aceite", name: "Aceite de barba", nameEn: "Beard oil", price: 8500, active: true, blurb: "Cedro y naranja. Unas gotas." },
      { id: "arcilla", name: "Arcilla mate", nameEn: "Matte clay", price: 9500, active: true, blurb: "Agarre para pelo grueso." },
    ],
    barbers: [
      { id: "renzo", name: "Renzo Viale", specialty: "Degradé y clásico", specialtyEn: "Fades and classic cuts", bio: "Anota el número de peine en la ficha. Si volvés a los 20 días, sale igual.", bioEn: "Writes the guard number on your card.", active: true, commissionPct: 40, color: "#e0b15a", daysOff: [], week: week("10:00", "20:00", "10:00", "18:00") },
      { id: "lila", name: "Lila Costa", specialty: "Color y textura", specialtyEn: "Color and texture", bio: "Hace la prueba de mecha antes de prometer un tono. Los lunes no atiende.", bioEn: "Strand test before promising a tone. Off on Mondays.", active: true, commissionPct: 40, color: "#ff4d2e", daysOff: [], week: [null, null, { start: "12:00", end: "20:00" }, { start: "12:00", end: "20:00" }, { start: "12:00", end: "20:00" }, { start: "12:00", end: "20:00" }, { start: "10:00", end: "16:00" }] },
      { id: "mateo", name: "Mateo Ruiz", specialty: "Barba y navaja", specialtyEn: "Beards and razor", bio: "Toalla caliente, silencio y el borde derecho un milímetro más corto. Así lo pide la mitad de la agenda.", bioEn: "Hot towel and a quieter chair.", active: true, commissionPct: 35, color: "#c4784a", daysOff: [], week: week("12:00", "20:00", "10:00", "14:00") },
      { id: "nico", name: "Nico Ferreyra", specialty: "Skin fade", specialtyEn: "Skin fades", bio: "Entra a las 12. El fade alto es su firma; el bajo, si se lo pedís dos veces.", bioEn: "Starts at noon. High fades are the signature.", active: true, commissionPct: 40, color: "#f4efe6", daysOff: [addDays(todayKey(TZ), 3)], week: [{ start: "12:00", end: "18:00" }, { start: "12:00", end: "20:00" }, { start: "12:00", end: "20:00" }, { start: "12:00", end: "20:00" }, { start: "12:00", end: "20:00" }, { start: "12:00", end: "20:00" }, null] },
    ],
    appointments,
    customers,
    reviews: [
      { id: "rev1", customerName: "Inés", barberId: "nico", rating: 5, text: "Me anotó el peine 2 y a las tres semanas el degradé salió igual, sin explicarle de nuevo.", published: true, createdAt: at(-18, 14, 0) },
      { id: "rev2", customerName: "Juana", barberId: "renzo", rating: 5, text: "Fui por un perfilado de 20 minutos antes de una reunión. Entré con el nudo y salí con la nuca derecha.", published: true, createdAt: at(-12, 13, 0) },
      { id: "rev3", customerName: "Elena", barberId: "lila", rating: 5, text: "Le dije 'un castaño que no grite'. Hizo la prueba de mecha y el color se ve como pelo, no como tintura.", published: true, createdAt: at(-40, 12, 0) },
      { id: "rev4", customerName: "Martín", barberId: "mateo", rating: 4, text: "La barba quedó cerrada y me dejó el aceite. La sala de espera es chica: llegué justo.", published: true, createdAt: at(-25, 19, 0) },
      { id: "rev5", customerName: "Pablo", barberId: "renzo", rating: 5, text: "Pedí corte y barba juntos. No me vendió el combo más caro: me dijo que con perfilado alcanzaba.", published: true, createdAt: at(-50, 17, 0) },
    ],
    waitlist: [],
    coupons: [
      { id: "cup1", code: "BIENVENIDA", percent: 15, expires: at(90, 23, 0), maxUses: 100, uses: 4, active: true },
      { id: "cup2", code: "LLUVIA", percent: 15, expires: at(20, 23, 0), maxUses: 40, uses: 0, active: true },
    ],
    campaigns: [
      { id: "camp_seed", name: "Huecos de la semana", channel: "both", segment: "en_riesgo", subject: "{nombre}, hay silla esta semana", body: "Hola {nombre}. Tu {ultimo_corte} ya tiene unas semanas. Si reservás ahora, el premio de la tarjeta se aplica solo.\n{link_reserva}", scheduledAt: undefined, sentAt: at(-3, 10, 0), status: "sent", createdAt: at(-3, 9, 0) },
    ],
    templates: [
      { id: "tpl1", name: "Te extrañamos", channel: "both", subject: "{nombre}, te guardamos la silla", body: "Hola {nombre}. Hace un rato que no hacemos tu {ultimo_corte}. Esta semana hay huecos reales, no una lista de espera imaginaria.\n{link_reserva}" },
      { id: "tpl2", name: "Premio de sellos", channel: "email", subject: "Llevás {sellos} cortes", body: "{nombre}, en la tarjeta van {sellos}. El premio grande es {descuento} y se descuenta solo cuando reservás.\n{link_reserva}" },
    ],
    blocks: [
      { id: "blk1", barberId: "all", start: at(6, 0, 0), end: at(6, 23, 59), reason: "Feriado del local", type: "holiday" },
      { id: "blk2", barberId: "mateo", start: at(4, 12, 0), end: at(4, 20, 0), reason: "Mateo de vacaciones ese día", type: "vacation" },
    ],
    messages: [
      { id: "msg1", at: at(-3, 10, 0), channel: "email", to: "pablo.duarte@solera.example", subject: "Pablo, hay silla esta semana", body: "Campaña de muestra.", kind: "campaign", customerId: "cus_pablo", campaignId: "camp_seed", ok: true, detail: "ejemplo", opened: true },
    ],
    admins: [{ id: "admin", email: "admin@solera.example", passwordHash, totpSecret: null, totpPending: null, totpEnabled: false }],
    attempts: [],
    rates: [],
    settings: {
      name: "Solera",
      tagline: "Barbería de cuatro sillas en Palermo.",
      street: "Thames",
      district: "Palermo",
      city: "Buenos Aires",
      mapsUrl: "https://maps.google.com/?q=Thames+Palermo+Buenos+Aires",
      instagram: "https://instagram.com/",
      whatsapp: "5491155550190",
      email: "hola@solera.example",
      timezone: TZ,
      cancelHours: 6,
      winbackDays: 45,
      slotStep: 15,
      goldenMinutes: 90,
      goldenPercent: 15,
      rainPercent: 15,
      loyaltySecondPercent: 10,
      loyaltyTenthPercent: 30,
      vipSpend: 150000,
      vipVisits: 8,
      confirmSubject: "Tu turno en Solera quedó confirmado",
      reminderSubject: "Mañana te esperamos en Solera",
      reviewSubject: "¿Cómo quedó el corte?",
    },
  }
  return db
}

function person(id: string, name: string, email: string, phone: string, _stamps: number, recipe: string, createdAt: string, marketing = true, birthday?: string, whatsapp = true): Customer {
  const first = name.split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  const n = 2000 + phone.slice(-2)
  return {
    id,
    name,
    email,
    phone,
    notes: recipe ? `Nota de silla: ${recipe}` : "",
    recipe,
    marketingOptIn: marketing,
    whatsappOptIn: whatsapp,
    createdAt,
    stamps: 0,
    referralCode: `${first}-${n}`,
    unsubToken: secretToken(),
    welcomed: true,
    loyaltyNotices: [],
    birthday,
  }
}

function week(wdStart: string, wdEnd: string, satStart: string, satEnd: string) {
  const day = { start: wdStart, end: wdEnd }
  const sat = { start: satStart, end: satEnd }
  return [null, day, day, day, day, day, sat]
}

void uid
