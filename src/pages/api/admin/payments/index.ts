import type { APIRoute } from 'astro';
import Payment from '../../../../models/Payment';
import { connectDB, getSQLiteDB } from '../../../../lib/db';
import { getSessionFromCookie } from '../../../../lib/auth';

// GET pending payments for admin review
export const GET: APIRoute = async ({ request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const flaggedOnly = url.searchParams.get('flagged') === 'true';

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      const query: Record<string, unknown> = { status };
      if (flaggedOnly) query.flagged = true;

      const payments = await Payment.find(query)
        .populate('userId', 'name email')
        .sort({ flagged: -1, createdAt: -1 })
        .limit(50)
        .lean();

      return new Response(
        JSON.stringify(
          payments.map((p) => ({
            id: p._id.toString(),
            userId: p.userId?._id?.toString() || p.userId,
            userName: (p.userId as any)?.name || 'Unknown',
            userEmail: (p.userId as any)?.email || 'Unknown',
            amount: p.amount,
            status: p.status,
            transRef: p.transRef,
            sendingBank: p.sendingBank,
            receivingBank: p.receivingBank,
            senderName: p.senderName,
            receiverName: p.receiverName,
            transDate: p.transDate,
            transTime: p.transTime,
            flagged: p.flagged,
            flagReason: p.flagReason,
            createdAt: p.createdAt,
          }))
        ),
        { status: 200 }
      );
    } else {
      const db = getSQLiteDB();

      let query = `
        SELECT p.*, u.name as userName, u.email as userEmail
        FROM payments p
        LEFT JOIN users u ON p.userId = u.id
        WHERE p.status = ?
      `;
      const params: unknown[] = [status];

      if (flaggedOnly) {
        query += ' AND p.flagged = 1';
      }

      query += ' ORDER BY p.flagged DESC, p.createdAt DESC LIMIT 50';

      const payments = db.prepare(query).all(...params);

      return new Response(JSON.stringify(payments), { status: 200 });
    }
  } catch (error) {
    console.error('Admin payments list error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
