# CRM Home — Portal JOM Studio

Portal web para operar el playbook: dashboard, leads y **comunicaciones estilo Gmail**.

## Inicio rápido

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Pestañas

| Tab | Función |
|-----|---------|
| Dashboard | KPIs y funnel CAMP-01 |
| **Comunicaciones** | Inbox Gmail — enviar emails a leads |
| Leads | Tabla + marcar estados |
| Playbook | Documentación integrada |

## Gmail integrado

1. Copia `.env.local.example` → `.env.local`
2. Añade `GMAIL_USER` y `GMAIL_APP_PASSWORD` (contraseña de aplicación Google)
3. Reinicia `npm run dev`
4. Comunicaciones → selecciona lead → Enviar

Sin `.env.local`: abre tu cliente de correo con mensaje prellenado (mailto).

Guía completa: [../ejecutar/SETUP-GMAIL-CRM.md](../ejecutar/SETUP-GMAIL-CRM.md)

## APIs

- `GET /api/leads` — CSV + JSON enriquecido
- `POST /api/leads/update` — actualizar estado pipeline
- `POST /api/email/send` — enviar + guardar historial
- `GET /api/email/threads` — conversaciones por lead
- `GET /api/email/status` — Gmail conectado o mailto

## Datos

Lee/escribe en `../ejecutar/` (CSV leads, threads JSON).