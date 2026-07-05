# Plan de Implementación — Fase 3: Ghostwriter Autónomo y Scraping Profundo

**Proyecto:** JOM Studio — Digital Alchemy CRM  
**Fecha:** Julio 2026  
**Estado:** Listo para ejecución

---

## Resumen Ejecutivo

La Fase 3 dota al CRM de **proactividad absoluta**: respuestas de correo redactadas por IA antes de que el usuario escriba, y auditorías web automáticas que detectan gaps comerciales vendibles por JOM Studio.

---

## Arquitectura Actual (Fase 1–2)

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 16 + React 19)                         │
│  ├── MailsViewer.js      → Feed de hilos de correo          │
│  ├── SmartInboxModal.js  → Bandeja IMAP + Extractor         │
│  └── LeadManager.js      → Pipeline de leads                │
├─────────────────────────────────────────────────────────────┤
│  APIs existentes                                            │
│  ├── GET  /api/email/sync      → IMAP + clasificación IA    │
│  ├── POST /api/email/extract   → Empresa real de portales   │
│  ├── POST /api/email/send      → Envío SMTP + threads       │
│  ├── GET  /api/email/threads   → Historial por lead         │
│  └── POST /api/leads/add       → Guardar lead en JSON/CSV   │
├─────────────────────────────────────────────────────────────┤
│  Libs                                                       │
│  ├── gemini.js       → classifyEmailIntent, extractCompany  │
│  ├── leadsStore.js   → mergeAllLeads, updateLeadState       │
│  └── emailStore.js   → threads.json                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Módulo 1: Ghostwriter (Redactor IA)

### Objetivo
Al expandir un hilo en `MailsViewer`, el textarea se pre-llena con un borrador hiper-personalizado generado por Gemini.

### Backend — `POST /api/email/draft`

| Campo entrada | Tipo | Descripción |
|---------------|------|-------------|
| `nombre_negocio` | string | Clave del lead |
| `messages` | array | Historial del hilo (subject, body, status, sentAt) |
| `lead` | object | Datos enriquecidos (gap_detectado, email, etc.) |

**Flujo:**
1. Recibir payload del frontend
2. Llamar `generateReplyDraft()` en `gemini.js`
3. Prompt incluye reglas Playbook JOM: tono directo, persuasivo, auditorías/llamadas 15 min
4. Retornar `{ subject, body, generatedByAi: true }`

**Fallback sin API key:** `buildFollowUpEmail(lead)` de `emailTemplates.js`

### Frontend — `MailsViewer.js`

| Trigger | Condición |
|---------|-----------|
| Auto-draft IA | `estado_pipeline` o `categoria_ia` = `mas_informacion` / `interesado` |
| Template estático | Leads nuevos sin respuesta del cliente |

**UI:**
- Loader: `🧠 Escribiendo respuesta...` (animación pulse violeta)
- Botón primario: `✨ Generado por IA — Click para Enviar`
- Paleta: `#a855f7` / `#3b82f6`, bordes `rgba(255,255,255,0.05)`

---

## Módulo 2: Web Scraper Profundo

### Objetivo
Auditar automáticamente la web de un lead y sobrescribir `gap_detectado`.

### Backend — `POST /api/scraper/deep`

| Campo entrada | Tipo | Descripción |
|---------------|------|-------------|
| `url` | string | URL del sitio web |
| `nombre_negocio` | string | (opcional) Para persistir gap en leadsStore |

**Flujo:**
1. `fetchWebsiteText(url)` → HTML → texto plano (max 12k chars)
2. `auditWebsiteForGap(text, companyName)` en `gemini.js`
3. Gemini evalúa como experto UI/UX + Marketing
4. Retorna `{ gap_detectado, solucion_jom, raw_analysis }`
5. Si `nombre_negocio` presente → `updateLeadGap()` en `leadsStore.js`

### Lib nueva — `websiteUtils.js`
- Normalización de URL (`https://` prefix)
- Fetch con timeout 15s + User-Agent
- Strip HTML → texto principal

### Backend — `POST /api/scraper/resolve-domain`
- Recibe `nombre_negocio`
- Heurística + Gemini para sugerir dominio probable
- Retorna `{ url, confidence }` o `{ url: null }`

### `leadsStore.js` — nueva función
```js
updateLeadGap(nombre_negocio, { gap_detectado, web, solucion_jom })
```
Sobrescribe en CSV + enriched.json por nombre.

---

## Módulo 3: Evolución SmartInboxModal

### Flujo actualizado tras "🔍 Extraer Empresa Real"

```
Extract API → nombre detectado
     ↓
Resolve Domain API (automático)
     ↓
¿URL encontrada? ──No──→ Input manual "Ingresa dominio web"
     ↓ Sí
Deep Scraper API (🕵️ Auditando web...)
     ↓
gap_detectado enriquecido
     ↓
POST /api/leads/add (con web + gap)
```

**Loaders:**
- `🕵️ Leyendo...` (extracción — ya existe)
- `🔎 Buscando dominio...` (nuevo)
- `🕵️ Auditando web...` (deep scraper)

---

## Archivos a Crear / Modificar

| Archivo | Acción |
|---------|--------|
| `src/lib/gemini.js` | +`generateReplyDraft`, `auditWebsiteForGap`, `guessCompanyDomain` |
| `src/lib/websiteUtils.js` | **CREAR** — fetch + strip HTML |
| `src/lib/leadsStore.js` | +`updateLeadGap` |
| `src/app/api/email/draft/route.js` | **CREAR** |
| `src/app/api/scraper/deep/route.js` | **CREAR** |
| `src/app/api/scraper/resolve-domain/route.js` | **CREAR** |
| `src/app/api/leads/add/route.js` | Aceptar `web`, deep scrape opcional server-side |
| `src/app/components/MailsViewer.js` | Ghostwriter auto-load |
| `src/app/components/MailsViewer.css` | Loaders IA + botón brillante |
| `src/app/components/SmartInboxModal.js` | Cadena extract → domain → deep → save |
| `src/app/components/SmartInboxModal.css` | Loaders + input dominio |
| `task.md` | **CREAR** — checklist Fase 3 |

---

## Dependencias y Variables

| Variable | Requerida para |
|----------|----------------|
| `GEMINI_API_KEY` | Ghostwriter + Deep Scraper + Domain resolve |
| `GMAIL_*` | Ya configurado (Fase 2) |

Sin `GEMINI_API_KEY`: fallbacks con templates estáticos y gaps genéricos.

---

## Criterios de Aceptación

- [ ] Expandir lead `mas_informacion` en MailsViewer → textarea pre-llenado por IA
- [ ] Botón `✨ Generado por IA — Click para Enviar` visible y funcional
- [ ] Loader `🧠 Escribiendo respuesta...` durante generación
- [ ] `POST /api/scraper/deep` retorna gap + solución JOM
- [ ] `gap_detectado` persistido en leadsStore tras deep scrape
- [ ] SmartInboxModal encadena extract → domain → audit → save
- [ ] `npm run lint` y `npm run build` sin errores
- [ ] Layout responsivo intacto (Grid/Flexbox, paleta oscura)

---

## Orden de Ejecución

1. Libs (`websiteUtils`, `gemini`, `leadsStore`)
2. APIs (`draft`, `deep`, `resolve-domain`, `leads/add`)
3. Frontend (`MailsViewer`, `SmartInboxModal` + CSS)
4. Verificación (`lint` + `build`)
5. Actualizar `task.md`

---

---

## Mejoras Añadidas (Fase 3+)

| Mejora | Descripción |
|--------|-------------|
| **AddLeadModal** | Formulario manual: nombre + web → deep audit → guardar con gap |
| **AiStatusBanner** | Banner violeta cuando Gmail OK pero falta GEMINI_API_KEY |
| **envHelper.js** | Lee `GEMINI_API_KEY` de `.env.local` sin reiniciar servidor |
| **Playbook en Ghostwriter** | Inyecta extracto de `05-servicios-ofertas-b2b.md` al prompt |
| **Caché de borradores** | No re-genera IA al re-expandir el mismo hilo |
| **Regenerar IA** | Botón 🔄 en MailsViewer para forzar nuevo borrador |
| **Gap preview** | SmartInboxModal muestra gap editable antes de confirmar guardado |
| **Auditar lead** | Botón 🕵️ en tabla de leads para re-auditar web existente |

*Generado por Arquitecto IA — JOM Studio Fase 3*