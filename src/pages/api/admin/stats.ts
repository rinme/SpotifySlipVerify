import type { APIRoute } from 'astro';
import Payment from '../../../models/Payment';
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

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      // Use MongoDB - only count approved payments
      const [monthlyPayments, yearlyPayments, totalPayments, userCount, pendingCount] = await Promise.all([
        Payment.aggregate([
          {
            $match: {
              month: currentMonth,
              year: currentYear,
              status: 'approved'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' }
            }
          }
        ]),
        Payment.aggregate([
          {
            $match: {
              year: currentYear,
              status: 'approved'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' }
            }
          }
        ]),
        Payment.aggregate([
          {
            $match: {
              status: 'approved'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' }
            }
          }
        ]),
        User.countDocuments(),
        Payment.countDocuments({ status: 'pending' })
      ]);

      return new Response(
        JSON.stringify({
          monthly: monthlyPayments[0]?.total || 0,
          yearly: yearlyPayments[0]?.total || 0,
          total: totalPayments[0]?.total || 0,
          userCount,
          pendingCount
        }),
        { status: 200 }
      );
    } else {
      // Use SQLite - only count approved payments
      const db = getSQLiteDB();

      const monthly = db.prepare(`
        SELECT SUM(amount) as total FROM payments
        WHERE month = ? AND year = ? AND status = 'approved'
      `).get(currentMonth, currentYear) as { total: number | null };

      const yearly = db.prepare(`
        SELECT SUM(amount) as total FROM payments
        WHERE year = ? AND status = 'approved'
      `).get(currentYear) as { total: number | null };

      const total = db.prepare(`
        SELECT SUM(amount) as total FROM payments
        WHERE status = 'approved'
      `).get() as { total: number | null };

      const userCount = db.prepare(`
        SELECT COUNT(*) as count FROM users
      `).get() as { count: number };

      const pendingCount = db.prepare(`
        SELECT COUNT(*) as count FROM payments WHERE status = 'pending'
      `).get() as { count: number };

      return new Response(
        JSON.stringify({
          monthly: monthly.total || 0,
          yearly: yearly.total || 0,
          total: total.total || 0,
          userCount: userCount.count,
          pendingCount: pendingCount.count
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Admin stats error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
};
