import { NextRequest, NextResponse } from 'next/server';
import { saveOutlookTokensAction } from '@/app/actions/outlook';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const userEmail = searchParams.get('state') || '';
  const error = searchParams.get('error');

  if (error || !code) {
    console.error('Microsoft OAuth Callback Error:', error, searchParams.get('error_description'));
    return NextResponse.redirect(
      new URL(`/crm?tab=calendar&outlook_error=${encodeURIComponent(error || 'access_denied')}`, request.url)
    );
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID || '';
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${new URL(request.url).origin}/api/auth/microsoft/callback`;

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Failed to retrieve Microsoft access token:', tokenData);
      return NextResponse.redirect(
        new URL('/crm?tab=calendar&outlook_error=token_exchange_failed', request.url)
      );
    }

    // Fetch user profile from Microsoft Graph
    let outlookEmail = userEmail;
    try {
      const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        outlookEmail = profile.mail || profile.userPrincipalName || userEmail;
      }
    } catch (e) {
      console.warn('Profile fetch warning:', e);
    }

    // Save tokens securely for this user
    await saveOutlookTokensAction(userEmail, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || '',
      expiresIn: tokenData.expires_in || 3600,
      outlookEmail: outlookEmail
    });

    return NextResponse.redirect(
      new URL(`/crm?tab=calendar&outlook_connected=true&email=${encodeURIComponent(outlookEmail)}`, request.url)
    );
  } catch (err: any) {
    console.error('Microsoft OAuth Exception:', err);
    return NextResponse.redirect(
      new URL('/crm?tab=calendar&outlook_error=server_error', request.url)
    );
  }
}
