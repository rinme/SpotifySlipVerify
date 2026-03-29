import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
        'Content-Type': 'application/json',
      },
    }
  );
};
