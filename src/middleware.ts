import type { MiddlewareHandler } from 'astro';
import { getSessionFromCookie } from './lib/auth';

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

  return next();
};
