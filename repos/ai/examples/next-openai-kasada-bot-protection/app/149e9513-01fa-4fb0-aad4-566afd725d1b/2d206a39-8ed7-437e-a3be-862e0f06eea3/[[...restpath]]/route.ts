const KASADA_ENDPOINT = 'FILL_IN.kasadapolyform.io';

async function handler(request: Request) {
  const url = new URL(request.url);

  url.protocol = 'https:';
  url.host = KASADA_ENDPOINT;
  url.port = '';
  url.searchParams.delete('restpath');

  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', 'FILL_IN');
  headers.delete('host');
  const r = await fetch(url.toString(), {
    method: request.method,
    body: request.body,
    headers,
    mode: request.mode,
    redirect: 'manual',
    // @ts-expect-error
    duplex: 'half',
  });
  const responseHeaders = new Headers(r.headers);
  responseHeaders.set('cdn-cache-control', 'no-cache');
  return new Response(r.body, {
    status: r.status,
    statusText: r.statusText,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
export const PUT = handler;
