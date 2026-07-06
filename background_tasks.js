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
};
