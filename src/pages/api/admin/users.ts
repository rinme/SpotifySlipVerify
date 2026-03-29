import type { APIRoute } from 'astro';
import User from '../../../models/User';
import { connectDB, getSQLiteDB } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403 }
      );
    }

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      // Use MongoDB
      const users = await User.find({}, 'email name role createdAt')
        .sort({ createdAt: -1 })
        .lean();

      return new Response(
        JSON.stringify(users.map(user => ({
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt
        }))),
        { status: 200 }
      );
    } else {
      // Use SQLite
      const db = getSQLiteDB();
      const users = db.prepare(`
        SELECT id, email, name, role, createdAt
        FROM users
        ORDER BY createdAt DESC
      `).all();

      return new Response(
        JSON.stringify(users),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Users list error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
};
