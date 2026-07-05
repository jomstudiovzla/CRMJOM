import { NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { getGmailCredentials } from '@/lib/gmailConfig';

export const runtime = 'nodejs';

export async function POST(request) {
  const { user, pass, ready } = getGmailCredentials();

  if (!ready) {
    return NextResponse.json({ success: false, error: 'Gmail IMAP no configurado' }, { status: 400 });
  }

  let uids = [];
  try {
    const body = await request.json();
    if (body.uids && Array.isArray(body.uids)) {
      uids = body.uids;
    } else if (body.uid) {
      uids = [body.uid];
    } else {
      throw new Error('Faltan uids');
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Petición inválida' }, { status: 400 });
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Borrar todos los uids
      for (const uid of uids) {
        await client.messageDelete(uid.toString());
      }
    } finally {
      lock.release();
    }
    
    await client.mailboxClose(); 
    await client.logout();

    return NextResponse.json({ success: true, message: `Borrados ${uids.length} correos` });
  } catch (error) {
    console.error('[JOM IMAP Delete] Error:', error);
    try { await client.logout(); } catch { /* ignore */ }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
