import { NextResponse } from 'next/server';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { upsertMessage } from '@/lib/emailStore';
import { LEADS_CSV } from '@/lib/paths';

async function markLeadContacted(nombre_negocio) {
  if (!fs.existsSync(LEADS_CSV)) return;
  const csvContent = fs.readFileSync(LEADS_CSV, 'utf-8');
  const leads = parse(csvContent, { columns: true, skip_empty_lines: true });
  for (const lead of leads) {
    if (lead.nombre_negocio?.toLowerCase() === nombre_negocio.toLowerCase()) {
      if (lead.estado_pipeline === 'nuevo') {
        lead.estado_pipeline = 'contactado';
      }
      break;
    }
  }
  fs.writeFileSync(LEADS_CSV, stringify(leads, { header: true }), 'utf-8');
}

async function sendViaGmail({ to, subject, body }) {
  const nodemailer = await import('nodemailer');
  const { getGmailCredentials } = await import('@/lib/gmailConfig');
  const { user, pass } = getGmailCredentials();
  const fromName = process.env.GMAIL_FROM_NAME || 'Jesús Omar Martínez · JOM Studio';

  const transporter = nodemailer.default.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject,
    text: body,
  });

  return info.messageId;
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const {
      nombre_negocio,
      to,
      subject,
      body,
      telefono,
      mode = 'auto',
      markContacted = true,
    } = payload;

    if (!nombre_negocio || !to || !subject || !body) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos: nombre_negocio, to, subject, body' },
        { status: 400 }
      );
    }

    const { getGmailCredentials } = await import('@/lib/gmailConfig');
    const gmailReady = getGmailCredentials().ready;
    const useSmtp = mode === 'smtp' || (mode === 'auto' && gmailReady);
    const sentAt = new Date().toISOString();

    let status = 'draft';
    let messageId = null;
    let deliveryMode = 'mailto';

    if (useSmtp) {
      try {
        messageId = await sendViaGmail({ to, subject, body });
        status = 'sent';
        deliveryMode = 'smtp';
      } catch (smtpError) {
        return NextResponse.json(
          { success: false, error: `Error Gmail SMTP: ${smtpError.message}` },
          { status: 500 }
        );
      }
    } else {
      status = 'mailto_pending';
      deliveryMode = 'mailto';
    }

    const message = {
      id: `msg_${Date.now()}`,
      direction: 'outbound',
      subject,
      body,
      to,
      sentAt,
      status,
      messageId,
      deliveryMode,
    };

    const thread = upsertMessage(
      { nombre_negocio, email: to, telefono: telefono || '' },
      message
    );

    if (markContacted && status === 'sent') {
      await markLeadContacted(nombre_negocio);
    }

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    return NextResponse.json({
      success: true,
      message,
      thread,
      deliveryMode,
      mailto: deliveryMode === 'mailto' ? mailto : null,
      gmailConfigured: gmailReady,
    });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}