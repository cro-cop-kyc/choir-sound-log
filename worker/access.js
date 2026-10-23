export const protectionHeaders = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};

// All page, asset, API and media handlers must pass this guard first.
export function guard(request, secret) {
  if (!secret || secret.length < 32) {
    return new Response('공유 접근 설정을 준비 중입니다.', {status: 503, headers: protectionHeaders});
  }
  const url = new URL(request.url);
  if (url.pathname === '/s/' + secret && request.method === 'GET') {
    return new Response(null, {status: 303, headers: {
      ...protectionHeaders, Location: '/',
      'Set-Cookie': `choir_access=${secret}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`
    }});
  }
  const authorized = (request.headers.get('Cookie') || '').split(';')
    .some(part => part.trim() === 'choir_access=' + secret);
  if (!authorized) return new Response('공유받은 전체 링크로 접속해 주세요.', {status: 404, headers: protectionHeaders});
  if (!['GET','HEAD'].includes(request.method) && request.headers.get('Origin') !== url.origin) {
    return new Response('다른 사이트에서 보낸 요청입니다.', {status: 403, headers: protectionHeaders});
  }
  return null;
}
