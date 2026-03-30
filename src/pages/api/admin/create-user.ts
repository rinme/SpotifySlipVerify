import type { APIRoute } from 'astro';
import User from '../../../models/User';
import { connectDB, getSQLiteDB } from '../../../lib/db';
import { hashPassword, getSessionFromCookie } from '../../../lib/auth';
import { checkRateLimit, getClientIP, validateEmail, validatePassword, sanitizeString } from '../../../lib/security';

const ALLOWED_ROLES = ['admin', 'user'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

export const POST: APIRoute = async ({ request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`createUser:${clientIP}`, 'createUser');
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.` }),
        { status: 429, headers: { 'Retry-After': rateLimit.retryAfter!.toString() } }
      );
    }

    const { email, password, name, role } = await request.json();

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: 'Email, password, and name are required' }), { status: 400 });
    }

    // Validate email
    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400 });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return new Response(JSON.stringify({ error: passwordValidation.errors.join('. ') }), { status: 400 });
    }

    // Sanitize name
    const sanitizedName = sanitizeString(name);
    if (sanitizedName.length < 2) {
      return new Response(JSON.stringify({ error: 'Name must be at least 2 characters' }), { status: 400 });
    }

    const userRole: UserRole = role || 'user';
    if (!ALLOWED_ROLES.includes(userRole)) {
      return new Response(JSON.stringify({ error: 'Invalid role. Must be "admin" or "user"' }), { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    const mongoConnected = await connectDB();

    if (mongoConnected) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });

      if (existingUser) {
        return new Response(JSON.stringify({ error: 'User already exists' }), { status: 400 });
      }

      const user = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        name: sanitizedName,
        role: userRole,
      });

      await user.save();

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
        { status: 201 }
      );
    } else {
      const db = getSQLiteDB();
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const existingUser = stmt.get(email.toLowerCase());

      if (existingUser) {
        return new Response(JSON.stringify({ error: 'User already exists' }), { status: 400 });
      }

      const insertStmt = db.prepare(`
        INSERT INTO users (email, password, name, role)
        VALUES (?, ?, ?, ?)
      `);

      const result = insertStmt.run(email.toLowerCase(), hashedPassword, sanitizedName, userRole);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: result.lastInsertRowid,
            email: email.toLowerCase(),
            name: sanitizedName,
            role: userRole,
          },
        }),
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Create user error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
