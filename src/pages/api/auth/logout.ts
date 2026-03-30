import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  const cookie =
    'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' +
    (import.meta.env?.PROD ? '; Secure' : '');

  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        'Set-Cookie': cookie,
        'Content-Type': 'application/json',
      },
    }
  );
};
