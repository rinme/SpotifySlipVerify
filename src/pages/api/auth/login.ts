import type { APIRoute } from 'astro';
import User from '../../../models/User';
import { connectDB, getSQLiteDB } from '../../../lib/db';
import { verifyPassword, generateToken } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400 }
      );
    }

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      // Use MongoDB
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user || !(await verifyPassword(password, user.password))) {
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401 }
        );
      }

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
      // Use SQLite
      const db = getSQLiteDB();
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const user = stmt.get(email.toLowerCase()) as any;

      if (!user || !(await verifyPassword(password, user.password))) {
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401 }
        );
      }

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
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
};
