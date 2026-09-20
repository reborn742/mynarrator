// Server-side proxy for the Gemini API.
//
// Purpose: the browser must never see the Gemini API key. This Edge Function
// sits between the app and Google, injects the real key from a server-only
// environment variable, and forwards the request/response untouched
// (including streamed responses) so nothing in geminiService.ts has to
// change its request/response handling — only where it points.
//
// Set GEMINI_API_KEY in Vercel Project Settings -> Environment Variables
// (Production, Preview, and Development). It is never exposed to the client.

export const config = { runtime: 'edge' };

const GOOGLE_BASE = 'https://generativelanguage.googleapis.com';

export default async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'Server is missing GEMINI_API_KEY.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const incomingUrl = new URL(req.url);

  // Strip the "/api/gemini" prefix; everything after it is the real Gemini path,
  // e.g. "/v1beta/models/gemini-3.8-flash:streamGenerateContent".
  const targetPath = incomingUrl.pathname.replace(/^\/api\/gemini/, '');
  const targetUrl = new URL(GOOGLE_BASE + targetPath);

  // Copy any other query params the SDK sent, but never trust a key from the client.
  incomingUrl.searchParams.forEach((value, key) => {
    if (key.toLowerCase() !== 'key') targetUrl.searchParams.set(key, value);
  });

  // Copy incoming headers, then always overwrite with our server-side key.
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('x-goog-api-key');
  headers.delete('content-length');
  headers.set('x-goog-api-key', apiKey);

  const hasBody = !['GET', 'HEAD'].includes(req.method);

  const googleResponse = await fetch(targetUrl.toString(), {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // Required by the fetch spec when streaming a request body in Edge runtimes.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);

  // Stream the response straight back (needed for streamGenerateContent).
  const responseHeaders = new Headers(googleResponse.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  return new Response(googleResponse.body, {
    status: googleResponse.status,
    statusText: googleResponse.statusText,
    headers: responseHeaders,
  });
}
