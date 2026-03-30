import type { APIRoute } from 'astro';
import User from '../../../../models/User';
import { connectDB, getSQLiteDB } from '../../../../lib/db';
import { hashPassword, getSessionFromCookie } from '../../../../lib/auth';

const ALLOWED_ROLES = ['admin', 'user'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

// GET single user
export const GET: APIRoute = async ({ params, request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
    }

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      const user = await User.findById(id, 'email name role createdAt').lean();
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      return new Response(
        JSON.stringify({
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        }),
        { status: 200 }
      );
    } else {
      const db = getSQLiteDB();
      const user = db.prepare('SELECT id, email, name, role, createdAt FROM users WHERE id = ?').get(id) as {
        id: number;
        email: string;
        name: string;
        role: string;
        createdAt: string;
      } | null;

      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      return new Response(JSON.stringify(user), { status: 200 });
    }
  } catch (error) {
    console.error('Get user error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

// UPDATE user
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
    }

    const body = await request.json();
    const { email, name, role, password } = body;

    if (!email && !name && !role && !password) {
      return new Response(JSON.stringify({ error: 'At least one field is required to update' }), { status: 400 });
    }

    if (role && !ALLOWED_ROLES.includes(role as UserRole)) {
      return new Response(JSON.stringify({ error: 'Invalid role. Must be "admin" or "user"' }), { status: 400 });
    }

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      const existingUser = await User.findById(id);
      if (!existingUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      // Check for email conflict
      if (email && email.toLowerCase() !== existingUser.email) {
        const emailConflict = await User.findOne({ email: email.toLowerCase() });
        if (emailConflict) {
          return new Response(JSON.stringify({ error: 'Email already in use' }), { status: 400 });
        }
      }

      // Build update object
      const updateData: Record<string, unknown> = {};
      if (email) updateData.email = email.toLowerCase();
      if (name) updateData.name = name;
      if (role) updateData.role = role;
      if (password) updateData.password = await hashPassword(password);

      const updatedUser = await User.findByIdAndUpdate(id, updateData, { returnDocument: 'after', select: 'email name role createdAt' });

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: updatedUser!._id.toString(),
            email: updatedUser!.email,
            name: updatedUser!.name,
            role: updatedUser!.role,
            createdAt: updatedUser!.createdAt,
          },
        }),
        { status: 200 }
      );
    } else {
      const db = getSQLiteDB();

      const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as {
        id: number;
        email: string;
      } | null;

      if (!existingUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      // Check for email conflict
      if (email && email.toLowerCase() !== existingUser.email) {
        const emailConflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), id);
        if (emailConflict) {
          return new Response(JSON.stringify({ error: 'Email already in use' }), { status: 400 });
        }
      }

      // Build dynamic update query
      const updates: string[] = [];
      const values: unknown[] = [];

      if (email) {
        updates.push('email = ?');
        values.push(email.toLowerCase());
      }
      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      if (role) {
        updates.push('role = ?');
        values.push(role);
      }
      if (password) {
        updates.push('password = ?');
        values.push(await hashPassword(password));
      }
      updates.push('updatedAt = CURRENT_TIMESTAMP');
      values.push(id);

      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const updatedUser = db.prepare('SELECT id, email, name, role, createdAt FROM users WHERE id = ?').get(id);

      return new Response(
        JSON.stringify({
          success: true,
          user: updatedUser,
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Update user error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

// DELETE user
export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
    }

    // Prevent self-deletion
    if (session.userId === id || session.userId === parseInt(id)) {
      return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), { status: 400 });
    }

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      const user = await User.findById(id);
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      await User.findByIdAndDelete(id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User deleted successfully',
        }),
        { status: 200 }
      );
    } else {
      const db = getSQLiteDB();

      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User deleted successfully',
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Delete user error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
