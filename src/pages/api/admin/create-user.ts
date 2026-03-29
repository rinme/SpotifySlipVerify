import type { APIRoute } from 'astro';
import User from '../../../models/User';
import { connectDB, getSQLiteDB } from '../../../lib/db';
import { hashPassword } from '../../../lib/auth';
import { getSessionFromCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403 }
      );
    }

    const { email, password, name, role } = await request.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: 'Email, password, and name are required' }),
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const mongoConnected = await connectDB();

    if (mongoConnected) {
      // Use MongoDB
      const existingUser = await User.findOne({ email: email.toLowerCase() });

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'User already exists' }),
          { status: 400 }
        );
      }

      const user = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: role || 'user',
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
      // Use SQLite
      const db = getSQLiteDB();
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const existingUser = stmt.get(email.toLowerCase());

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'User already exists' }),
          { status: 400 }
        );
      }

      const insertStmt = db.prepare(`
        INSERT INTO users (email, password, name, role)
        VALUES (?, ?, ?, ?)
      `);

      const result = insertStmt.run(
        email.toLowerCase(),
        hashedPassword,
        name,
        role || 'user'
      );

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: result.lastInsertRowid,
            email: email.toLowerCase(),
            name,
            role: role || 'user',
          },
        }),
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Create user error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
};
