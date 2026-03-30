import type { APIRoute } from 'astro';
import User from '../../../models/User';
import { connectDB, getSQLiteDB } from '../../../lib/db';
import { verifyPassword, generateToken } from '../../../lib/auth';
import { checkRateLimit, resetRateLimit, getClientIP, validateEmail } from '../../../lib/security';

export const POST: APIRoute = async ({ request }) => {
  try {
    const clientIP = getClientIP(request);
    const rateLimitKey = `login:${clientIP}`;

    // Check rate limit
    const rateLimit = checkRateLimit(rateLimitKey, 'login');
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: `Too many login attempts. Try again in ${rateLimit.retryAfter} seconds.` }),
        {
          status: 429,
          headers: { 'Retry-After': rateLimit.retryAfter!.toString() },
        }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400 });
    }

    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400 });
    }

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user || !(await verifyPassword(password, user.password))) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
      }

      // Reset rate limit on successful login
      resetRateLimit(rateLimitKey);

      const token = generateToken({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      });

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
          },
        }),
        {
          status: 200,
          headers: {
            'Set-Cookie': `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${import.meta.env.PROD ? '; Secure' : ''}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      const db = getSQLiteDB();
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const user = stmt.get(email.toLowerCase()) as any;

      if (!user || !(await verifyPassword(password, user.password))) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
      }

      // Reset rate limit on successful login
      resetRateLimit(rateLimitKey);

      const token = generateToken({
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      });

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
          },
        }),
        {
          status: 200,
          headers: {
            'Set-Cookie': `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${import.meta.env.PROD ? '; Secure' : ''}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
