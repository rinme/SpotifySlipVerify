import type { MiddlewareHandler } from 'astro';
import { getSessionFromCookie } from './lib/auth';
import { getSecurityHeaders } from './lib/security';

export const onRequest: MiddlewareHandler = async ({ request, locals, redirect }, next) => {
  const cookieHeader = request.headers.get('cookie');
  const session = getSessionFromCookie(cookieHeader);

  // Set user in locals for use in pages
  locals.user = session;

  const pathname = new URL(request.url).pathname;

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    if (!session) {
      return redirect('/login');
    }

    // Admin-only routes
    if (pathname.startsWith('/admin') && session.role !== 'admin') {
      return redirect('/dashboard');
    }
  }

  // Redirect logged-in users away from login
  if (pathname === '/login' && session) {
    if (session.role === 'admin') {
      return redirect('/admin');
    }
    return redirect('/dashboard');
  }

  // Continue to the route handler
  const response = await next();

  // Add security headers to all responses
  const securityHeaders = getSecurityHeaders();
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
};
