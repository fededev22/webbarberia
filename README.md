# Solera

Barbería en una sola app Next.js: la web pública en `/` y el escritorio en `/administrador`.

En local no hace falta ninguna clave. Los turnos se guardan en `data/db.json` y los emails o WhatsApp quedan anotados en Marketing. En Vercel el disco no persiste: ahí sí hace falta Supabase.

## Probarlo ahora

```bash
npm install
npm run dev
```

- Web: http://localhost:3000
- Reservar: http://localhost:3000/agendar
- Ficha (sin cuenta): http://localhost:3000/ficha con el teléfono `11 5555 2101` (Inés, 9 sellos: el próximo corte tiene 30%)
- Escritorio: http://localhost:3000/administrador
- Demo: `admin@solera.example` / `Solera.2026`

El cupón `BIENVENIDA` es 15%. La hora dorada es el último tramo de cada silla. Si llueve en Palermo, entre las 14 y las 17 entra el descuento de lluvia. Gana el premio más alto, no se acumulan.

Para volver a cargar los datos de ejemplo, borré `data/db.json` y reiniciá el servidor.

## Qué se instaló

| Paquete | Para qué | Licencia |
| --- | --- | --- |
| `three`, `@react-three/fiber`, `@react-three/drei` | Poste y tijera del hero, con parallax de mouse y scroll | MIT |
| `gsap`, `@gsap/react` | Entrada del hero y revelado al scrollear | GSAP Standard (uso comercial permitido) |
| `motion` | Transiciones del turno y reseñas. Es el nombre actual de Framer Motion | MIT |
| `lenis` | Scroll suave en desktop | MIT |
| `bcryptjs`, `jose`, `otpauth`, `qrcode` | Contraseña, sesión y 2FA opcional | MIT |
| `@supabase/supabase-js` | Postgres cuando hay claves | MIT |
| `recharts` | Gráficos del escritorio | MIT |

No hizo falta una librería extra de calendario ni de email: los horarios se calculan en el servidor y Resend / WhatsApp se llaman por HTTP.

## Ponerlo online

1. Creá un proyecto en [Supabase](https://supabase.com). En el SQL editor, pegá y ejecutá `supabase/schema.sql`.
2. En Project Settings → API copiá la URL y la `service_role` key (no la anon key).
3. Subí el repo a GitHub y conectalo en [Vercel](https://vercel.com).
4. En Vercel → Settings → Environment Variables, copiá `.env.example` y completá:

   - `AUTH_SECRET`: una frase de al menos 32 caracteres.
   - `NEXT_PUBLIC_SITE_URL`: `https://tu-dominio.com`
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`: otra frase. Vercel la manda sola al cron de `vercel.json` (cada 15 minutos: recordatorios de 24 h y de 2 h, cumpleaños, campañas programadas y “te extrañamos”).

5. Deploy. El primer request siembra los datos de ejemplo, incluido el admin. Entrá a `/administrador` y cambiá la contraseña en Ajustes.

En el plan Hobby de Vercel el cron puede estar limitado a una vez por día. Si los recordatorios de 2 horas no corren, usá un cron externo (cron-job.org) que haga `GET https://tu-dominio.com/api/cron` con el header `Authorization: Bearer TU_CRON_SECRET`. También podés apretar “Procesar recordatorios ahora” en Ajustes.

## Email (Resend)

1. Creá una cuenta en [Resend](https://resend.com) y verificá el dominio.
2. `RESEND_API_KEY` con la clave.
3. `EMAIL_FROM`, por ejemplo `Solera <reservas@tudominio.com>`.

Sin la clave, la confirmación, el recordatorio y la reseña se guardan igual en Marketing → Mensajes recientes.

## WhatsApp (Cloud API)

1. En [Meta for Developers](https://developers.facebook.com/) creá una app, agregá el producto WhatsApp y un número de prueba o el del negocio.
2. `WHATSAPP_TOKEN`: token de acceso.
3. `WHATSAPP_PHONE_ID`: Phone number ID (no es el teléfono).

Los recordatorios salen solo si la persona dejó tildado WhatsApp al reservar. Las campañas salen solo si además aceptó novedades. Cada mensaje lleva el link de baja `/baja/...`.

## Privacidad

El turno pide consentimiento para guardar nombre, email y teléfono. Las novedades son un tilde aparte. La baja corta el marketing; el turno ya tomado sigue en la agenda.
