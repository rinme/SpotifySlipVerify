import type { APIRoute } from 'astro';
import Payment from '../../../models/Payment';
import { connectDB, getSQLiteDB } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';
import mongoose from 'mongoose';

export const GET: APIRoute = async ({ request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      // Use MongoDB - convert session.id string to ObjectId for matching
      let userObjectId: mongoose.Types.ObjectId;
      try {
        userObjectId = new mongoose.Types.ObjectId(session.id);
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid user ID' }),
          { status: 400 }
        );
      }

      const [monthlyPayments, yearlyPayments, totalPayments] = await Promise.all([
        Payment.aggregate([
          {
            $match: {
              userId: userObjectId,
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
              userId: userObjectId,
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
              userId: userObjectId,
              status: 'approved'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' }
            }
          }
        ])
      ]);

      return new Response(
        JSON.stringify({
          monthly: monthlyPayments[0]?.total || 0,
          yearly: yearlyPayments[0]?.total || 0,
          total: totalPayments[0]?.total || 0
        }),
        { status: 200 }
      );
    } else {
      // Use SQLite
      const db = getSQLiteDB();

      const monthly = db.prepare(`
        SELECT SUM(amount) as total FROM payments
        WHERE userId = ? AND month = ? AND year = ? AND status = 'approved'
      `).get(session.id, currentMonth, currentYear) as { total: number | null };

      const yearly = db.prepare(`
        SELECT SUM(amount) as total FROM payments
        WHERE userId = ? AND year = ? AND status = 'approved'
      `).get(session.id, currentYear) as { total: number | null };

      const total = db.prepare(`
        SELECT SUM(amount) as total FROM payments
        WHERE userId = ? AND status = 'approved'
      `).get(session.id) as { total: number | null };

      return new Response(
        JSON.stringify({
          monthly: monthly.total || 0,
          yearly: yearly.total || 0,
          total: total.total || 0
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Payment summary error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
};
