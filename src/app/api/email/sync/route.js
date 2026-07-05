import { NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { classifyEmailIntent } from '@/lib/gemini';
import { updateLeadByEmail } from '@/lib/leadsStore';
import { checkPhase2Env } from '@/lib/envCheck';
import { getGmailCredentials, gmailSetupResponse } from '@/lib/gmailConfig';

export const runtime = 'nodejs';

export async function GET() {
  checkPhase2Env();

  const { user, pass, ready } = getGmailCredentials();

  if (!ready) {
    return NextResponse.json(gmailSetupResponse(), { status: 200 });
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  let processedCount = 0;
  const results = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const allUids = await client.search({ all: true });
      const recentUids = allUids.slice(-20); // Últimos 20 correos

      if (!recentUids.length) {
        return NextResponse.json({
          success: true,
          processed: 0,
          inbox: [],
          message: '✅ Conexión IMAP OK. La bandeja está vacía.',
        });
      }

      const fs = require('fs');
      const path = require('path');
      const cacheFile = path.join(process.cwd(), 'ejecutar', 'comunicaciones', 'email_categories.json');
      
      let catCache = {};
      try {
        if (fs.existsSync(cacheFile)) {
          catCache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        }
      } catch(e) {}

      for await (const message of client.fetch(recentUids, { source: true, envelope: true, uid: true })) {
        const uid = message.uid.toString();
        const parsed = await simpleParser(message.source);
        const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase();
        const fromName = parsed.from?.value?.[0]?.name || fromEmail;
        const subject = parsed.subject || '(Sin Asunto)';
        const bodyText = parsed.text || parsed.html || '';
        const preview = bodyText.replace(/\s+/g, ' ').trim().slice(0, 150);

        if (!fromEmail) continue;

        let categoria_ia = catCache[uid];
        if (!categoria_ia) {
          try {
            categoria_ia = await classifyEmailIntent(bodyText);
            catCache[uid] = categoria_ia;
          } catch(e) {
            console.error('Gemini rate limit error on UID', uid);
            categoria_ia = 'desconocido';
          }
        }

        // Si es un lead que ya existe, lo actualizamos también
        const matched = updateLeadByEmail(fromEmail, {
          estado_pipeline: categoria_ia !== 'spam' && categoria_ia !== 'importante' ? categoria_ia : undefined,
          ultimo_correo_recibido: preview,
          fecha_actualizacion: new Date().toISOString(),
        });
        
        if (matched > 0 && categoria_ia !== 'spam') {
          processedCount += matched;
        }

        results.push({
          uid,
          from: fromEmail,
          fromName,
          subject,
          preview,
          body: bodyText, // Necesario para la extracción de leads con IA
          categoria_ia,
          date: parsed.date || new Date()
        });
      }

      fs.writeFileSync(cacheFile, JSON.stringify(catCache, null, 2));
    } finally {
      lock.release();
    }

    await client.logout();

    // Ordenar los resultados del más reciente al más antiguo
    results.sort((a, b) => new Date(b.date) - new Date(a.date));

    return NextResponse.json({
      success: true,
      processed: processedCount,
      inbox: results,
      message: `✅ IA escaneó la bandeja y clasificó los correos.`,
    });
  } catch (error) {
    console.error('[JOM IMAP] Error:', error);
    try { await client.logout(); } catch { /* ignore */ }

    const msg = error.message || '';
    const isAuth = /auth|credentials|login|password|invalid/i.test(msg);

    return NextResponse.json({
      success: false,
      code: isAuth ? 'GMAIL_AUTH_FAILED' : 'IMAP_ERROR',
      error: isAuth
        ? 'Contraseña de aplicación incorrecta o expirada. Genera una nueva en Google.'
        : `Error IMAP: ${msg}`,
      steps: isAuth ? gmailSetupResponse().steps : undefined,
      setupUrl: 'https://myaccount.google.com/apppasswords',
    }, { status: 200 });
  }
}