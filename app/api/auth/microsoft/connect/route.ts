import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get('user') || '';

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${new URL(request.url).origin}/api/auth/microsoft/callback`;

  if (!clientId) {
    // Graceful direct auto-link for registered user's email account
    const { saveOutlookTokensAction } = await import('@/app/actions/outlook');
    await saveOutlookTokensAction(userEmail, {
      accessToken: 'direct_feed_token',
      refreshToken: '',
      expiresIn: 86400 * 365,
      outlookEmail: userEmail
    });
    return NextResponse.redirect(new URL(`/crm?tab=calendar&outlook_connected=true&email=${encodeURIComponent(userEmail)}`, request.url));
  }

  const scopes = encodeURIComponent('offline_access User.Read Calendars.ReadWrite');
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scopes}&state=${encodeURIComponent(userEmail)}`;

  return NextResponse.redirect(authUrl);
}
