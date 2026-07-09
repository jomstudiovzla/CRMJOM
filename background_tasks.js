const cron = require('node-cron');
const { Server } = require('socket.io');
const { ImapFlow } = require('imapflow');

module.exports = function initBackgroundTasks(httpServer) {
  const PORT = process.env.PORT || 3000;
  const localBase = `http://localhost:${PORT}`;

  // 1. Inicializar WebSockets
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  global.io = io;

  io.on('connection', (socket) => {
    console.log('[Socket.io] Cliente conectado:', socket.id);
  });

  // 2. Tarea de fondo: Scraper de Upwork, LinkedIn y Computrabajo (cada 10 minutos)
  cron.schedule('*/10 * * * *', async () => {
    console.log('[Cron] Ejecutando scraper masivo de fondo...');
    try {
      // Llamamos al API de Next.js internamente
      await fetch(`${localBase}/api/scraper`, {
        // Evitamos timeout del cliente fetch para scrapers largos
        signal: AbortSignal.timeout(300000) // 5 minutos
      });
      console.log('[Cron] Scraper finalizado exitosamente.');
      io.emit('leads_updated'); // Notificar a los clientes
    } catch(err) {
      console.error('[Cron] Error en scraper:', err.message);
    }
  });

  // 3. Tarea de fondo: Sync manual periódico por seguridad (cada 5 minutos)
  cron.schedule('*/5 * * * *', async () => {
    try {
      await fetch(`${localBase}/api/email/sync`);
      io.emit('emails_updated');
    } catch(err) {}
  });

  // 4. IMAP IDLE (Correos en tiempo real)
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (user && pass) {
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false
    });

    const startImapIdle = async () => {
      try {
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');
        console.log('[IMAP IDLE] Escuchando nuevos correos en tiempo real...');

        client.on('exists', async (data) => {
          console.log(`[IMAP IDLE] ¡Nuevo correo detectado! (Total: ${data.count})`);
          try {
            // Disparamos el pipeline de procesamiento de correos
            await fetch(`${localBase}/api/email/sync`);
            // Notificamos a la UI para que refresque inmediatamente
            io.emit('emails_updated');
          } catch(err) {
            console.error('[IMAP IDLE] Error procesando correo:', err.message);
          }
        });
      } catch (err) {
        console.error('[IMAP IDLE] Error de conexión:', err.message);
      }
    };

    startImapIdle();
  } else {
    console.warn('[IMAP IDLE] GMAIL_USER o GMAIL_APP_PASSWORD no configurados en .env.local');
  }

  // 5. Auto-detección de Chrome con sesión Google al arrancar el servidor
  setTimeout(async () => {
    try {
      const cdpUrl = 'http://127.0.0.1:9222';
      const res = await fetch(`${cdpUrl}/json/version`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const info = await res.json();
        console.log(`[BrowserManager] ✅ Chrome detectado al arrancar: ${info.Browser}`);

        // Escanear pestañas existentes para detectar sesiones activas
        const tabsRes = await fetch(`${cdpUrl}/json`);
        const tabs = await tabsRes.json();
        const ctTab = tabs.find(t => t.url?.includes('computrabajo.com') && !t.url?.includes('/acceso'));
        const liTab = tabs.find(t => t.url?.includes('linkedin.com') && !t.url?.includes('/login'));

        if (ctTab) console.log('[BrowserManager] ✅ Computrabajo: sesión activa →', ctTab.url);
        if (liTab) console.log('[BrowserManager] ✅ LinkedIn: sesión activa →', liTab.url);

        io.emit('session_updated', {
          running: true,
          sessions: {
            computrabajo: !!ctTab,
            linkedin: !!liTab,
            gmail: tabs.some(t => t.url?.includes('mail.google.com')),
            whatsapp: tabs.some(t => t.url?.includes('web.whatsapp.com')),
          }
        });
      } else {
        console.warn('[BrowserManager] Chrome no detectado al arrancar. Usa "Abrir con Google" en el CRM.');
      }
    } catch {
      console.warn('[BrowserManager] Chrome no activo al arrancar (normal si no está abierto aún).');
    }
  }, 3000); // esperar 3s a que el servidor esté listo

  // 6. Tareas de auto-postulación periódica (opcional — solo si está habilitado)
  // Cada 2 horas, verificar si hay nuevas ofertas y postular automáticamente
  // Desactivado por defecto — el usuario activa manualmente desde el panel
  // cron.schedule('0 */2 * * *', async () => {
  //   console.log('[AutoApply Cron] Verificando nuevas ofertas...');
  //   try {
  //     await fetch(`${localBase}/api/postulaciones/autoapply`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ categorias: ['desarrollador-web', 'diseno-grafico'], maxPerCategoria: 3 }),
  //       signal: AbortSignal.timeout(300000),
  //     });
  //   } catch (err) {
  //     console.error('[AutoApply Cron] Error:', err.message);
  //   }
  // });
};
