import { NextResponse } from 'next/server';
import { extractCompanyFromEmail } from '@/lib/gemini';

export async function POST(request) {
  try {
    const { emailBody } = await request.json();
    
    if (!emailBody) {
      return NextResponse.json({ success: false, error: 'Falta el cuerpo del correo' }, { status: 400 });
    }

    const companyData = await extractCompanyFromEmail(emailBody);
    
    return NextResponse.json({ 
      success: true, 
      data: companyData,
      message: '✅ IA extrajo la información original con éxito.'
    });

  } catch (error) {
    console.error('Error in /api/email/extract:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
