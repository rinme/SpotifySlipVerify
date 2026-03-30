import type { APIRoute } from 'astro';
import User from '../../../models/User';
import { connectDB, getSQLiteDB } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

interface UserData {
  id: string | number;
  email: string;
  name: string;
  role: string;
  createdAt: string | Date;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));
    const search = url.searchParams.get('search')?.trim().toLowerCase() || '';
    const roleFilter = url.searchParams.get('role') || '';

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      // Build MongoDB query
      const query: Record<string, unknown> = {};

      if (search) {
        query.$or = [{ email: { $regex: search, $options: 'i' } }, { name: { $regex: search, $options: 'i' } }];
      }

      if (roleFilter && (roleFilter === 'admin' || roleFilter === 'user')) {
        query.role = roleFilter;
      }

      const total = await User.countDocuments(query);
      const totalPages = Math.ceil(total / limit);
      const skip = (page - 1) * limit;

      const users = await User.find(query, 'email name role createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

      return new Response(
        JSON.stringify({
          users: users.map((user) => ({
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        }),
        { status: 200 }
      );
    } else {
      // Use SQLite with search and filtering
      const db = getSQLiteDB();

      // Build WHERE clause
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (search) {
        conditions.push('(LOWER(email) LIKE ? OR LOWER(name) LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      if (roleFilter && (roleFilter === 'admin' || roleFilter === 'user')) {
        conditions.push('role = ?');
        params.push(roleFilter);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = db.prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`).get(...params) as { count: number };
      const total = countResult.count;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;

      // Get paginated users
      const users = db
        .prepare(
          `
        SELECT id, email, name, role, createdAt
        FROM users
        ${whereClause}
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?
      `
        )
        .all(...params, limit, offset) as UserData[];

      return new Response(
        JSON.stringify({
          users,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Users list error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
