import { NextResponse } from 'next/server';

export async function GET() {
  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) return NextResponse.json({ error: 'INSTAGRAM_APP_ID 없음' }, { status: 500 });

  const redirectUri = 'https://insta-card-dashboard.vercel.app/api/instagram/callback';
  const scope = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_messages';

  const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;

  return NextResponse.redirect(authUrl);
}
