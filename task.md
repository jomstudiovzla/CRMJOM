# JOM Studio CRM — Task Tracker

## Fase 3: Ghostwriter Autónomo y Scraping Profundo

### Backend
- [x] `generateReplyDraft()` en `src/lib/gemini.js`
- [x] `auditWebsiteForGap()` en `src/lib/gemini.js`
- [x] `guessCompanyDomain()` en `src/lib/gemini.js`
- [x] `src/lib/websiteUtils.js` — fetch HTML + strip texto
- [x] `updateLeadGap()` en `src/lib/leadsStore.js`
- [x] `POST /api/email/draft` — Ghostwriter
- [x] `POST /api/scraper/deep` — Auditoría web profunda
- [x] `POST /api/scraper/resolve-domain` — Búsqueda de dominio
- [x] `POST /api/leads/add` — Acepta `web` + deep audit server-side

### Frontend
- [x] `MailsViewer.js` — Auto-carga borrador IA en `mas_informacion`
- [x] `MailsViewer.css` — Loader `🧠 Escribiendo respuesta...` + botón IA
- [x] `SmartInboxModal.js` — Cadena extract → domain → deep → save
- [x] `SmartInboxModal.css` — Input dominio + animaciones

### Documentación
- [x] `implementation_plan.md`
- [x] `task.md`

### Mejoras Fase 3+ (Jul 2026)
- [x] `AddLeadModal` — lead manual con auditoría web automática
- [x] `AiStatusBanner` — guía para configurar `GEMINI_API_KEY`
- [x] `envHelper.js` — hot-reload de API key desde `.env.local`
- [x] Ghostwriter lee extracto del Playbook B2B en cada borrador
- [x] MailsViewer: caché de borradores, botón Regenerar IA, gap chip, pipeline pill
- [x] SmartInboxModal: preview editable del gap antes de guardar
- [x] LeadManager: botón ➕ Añadir Lead + 🕵️ Auditar por lead con web

### Verificación
- [x] `npm run lint` sin errores
- [x] `npm run build` sin errores (25 rutas, incluye `/api/email/draft`, `/api/scraper/deep`, `/api/scraper/resolve-domain`)
- [ ] Probar en UI: expandir lead `mas_informacion` → textarea pre-llenado (requiere sesión activa + `GEMINI_API_KEY`)

### Variables requeridas
- `GEMINI_API_KEY` — Ghostwriter + Deep Scraper (fallback a plantillas si vacía)
- `GMAIL_USER` + `GMAIL_APP_PASSWORD` — Ya configurado (Fase 2)