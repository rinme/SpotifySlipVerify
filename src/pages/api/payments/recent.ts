import type { APIRoute } from 'astro';
import Payment from '../../../models/Payment';
import { connectDB, getSQLiteDB } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      const payments = await Payment.find({ userId: session.id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      return new Response(
        JSON.stringify(
          payments.map((p) => ({
            id: p._id.toString(),
            amount: p.amount,
            status: p.status,
            transRef: p.transRef,
            sendingBank: p.sendingBank,
            receivingBank: p.receivingBank,
            senderName: p.senderName,
            receiverName: p.receiverName,
            transDate: p.transDate,
            transTime: p.transTime,
            createdAt: p.createdAt,
          }))
        ),
        { status: 200 }
      );
    } else {
      const db = getSQLiteDB();
      const payments = db
        .prepare(
          `
        SELECT id, amount, status, transRef, sendingBank, receivingBank, senderName, receiverName, transDate, transTime, createdAt
        FROM payments
        WHERE userId = ?
        ORDER BY createdAt DESC
        LIMIT 10
      `
        )
        .all(session.id);

      return new Response(JSON.stringify(payments), { status: 200 });
    }
  } catch (error) {
    console.error('Recent payments error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
