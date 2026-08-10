import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { url, key } = await request.json();
    const envPath = path.join(process.cwd(), '.env.local');
    
    if (url && key) {
      const envContent = `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${key}\n`;
      fs.writeFileSync(envPath, envContent, 'utf8');
      return NextResponse.json({ success: true, message: '.env.local written successfully' });
    } else {
      if (fs.existsSync(envPath)) {
        fs.unlinkSync(envPath);
      }
      return NextResponse.json({ success: true, message: '.env.local removed successfully' });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
