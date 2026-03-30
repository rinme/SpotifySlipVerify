import type { APIRoute } from 'astro';
import Payment from '../../../../models/Payment';
import { connectDB, getSQLiteDB } from '../../../../lib/db';
import { getSessionFromCookie } from '../../../../lib/auth';

// Approve payment
export const POST: APIRoute = async ({ params, request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Payment ID is required' }), { status: 400 });
    }

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      const payment = await Payment.findById(id);
      if (!payment) {
        return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404 });
      }

      if (payment.status !== 'pending') {
        return new Response(JSON.stringify({ error: `Payment is already ${payment.status}` }), { status: 400 });
      }

      payment.status = 'approved';
      payment.reviewedBy = session.id as any;
      payment.reviewedAt = new Date();
      await payment.save();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment approved successfully',
          payment: {
            id: payment._id.toString(),
            status: payment.status,
          },
        }),
        { status: 200 }
      );
    } else {
      const db = getSQLiteDB();

      const payment = db.prepare('SELECT id, status FROM payments WHERE id = ?').get(id) as { id: number; status: string } | null;
      if (!payment) {
        return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404 });
      }

      if (payment.status !== 'pending') {
        return new Response(JSON.stringify({ error: `Payment is already ${payment.status}` }), { status: 400 });
      }

      db.prepare('UPDATE payments SET status = ?, reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(
        'approved',
        session.id,
        id
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment approved successfully',
          payment: { id, status: 'approved' },
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Approve payment error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

// Reject payment
export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session || session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Payment ID is required' }), { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || '';

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      const payment = await Payment.findById(id);
      if (!payment) {
        return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404 });
      }

      if (payment.status !== 'pending') {
        return new Response(JSON.stringify({ error: `Payment is already ${payment.status}` }), { status: 400 });
      }

      payment.status = 'rejected';
      payment.rejectionReason = reason;
      payment.reviewedBy = session.id as any;
      payment.reviewedAt = new Date();
      await payment.save();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment rejected',
          payment: {
            id: payment._id.toString(),
            status: payment.status,
          },
        }),
        { status: 200 }
      );
    } else {
      const db = getSQLiteDB();

      const payment = db.prepare('SELECT id, status FROM payments WHERE id = ?').get(id) as { id: number; status: string } | null;
      if (!payment) {
        return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404 });
      }

      if (payment.status !== 'pending') {
        return new Response(JSON.stringify({ error: `Payment is already ${payment.status}` }), { status: 400 });
      }

      db.prepare(
        'UPDATE payments SET status = ?, rejectionReason = ?, reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
      ).run('rejected', reason, session.id, id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment rejected',
          payment: { id, status: 'rejected' },
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Reject payment error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
