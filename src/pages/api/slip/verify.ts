import type { APIRoute } from 'astro';
import Payment from '../../../models/Payment';
import { connectDB, getSQLiteDB } from '../../../lib/db';
import { getSessionFromCookie } from '../../../lib/auth';
import { checkRateLimit, getClientIP } from '../../../lib/security';

const SLIPOK_BRANCH_ID = import.meta.env.SLIPOK_BRANCH_ID;
const SLIPOK_API_KEY = import.meta.env.SLIPOK_API_KEY;

interface SlipOKResponse {
  success: boolean;
  data?: {
    transRef: string;
    date: string;
    time: string;
    sender: {
      bank: { name: string; short: string };
      account: { name: { th: string; en: string }; bank: { type: string; account: string } };
    };
    receiver: {
      bank: { name: string; short: string };
      account: { name: { th: string; en: string }; bank: { type: string; account: string } };
    };
    amount: number;
    ref1?: string;
    ref2?: string;
    ref3?: string;
  };
  code?: string;
  message?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const cookieHeader = request.headers.get('cookie');
    const session = getSessionFromCookie(cookieHeader);

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Rate limiting: 10 verifications per minute per user
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`slip:${session.id}:${clientIP}`, 'createUser');
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.` }),
        { status: 429, headers: { 'Retry-After': rateLimit.retryAfter!.toString() } }
      );
    }

    // Check if SlipOK is configured
    if (!SLIPOK_BRANCH_ID || !SLIPOK_API_KEY) {
      return new Response(JSON.stringify({ error: 'Slip verification service not configured' }), { status: 503 });
    }

    const body = await request.json();
    const { qrData } = body;

    if (!qrData || typeof qrData !== 'string') {
      return new Response(JSON.stringify({ error: 'QR data is required' }), { status: 400 });
    }

    // Call SlipOK API
    const slipResponse = await fetch(`https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': SLIPOK_API_KEY,
      },
      body: JSON.stringify({
        data: qrData,
        log: true,
      }),
    });

    const slipResult = (await slipResponse.json()) as SlipOKResponse;

    if (!slipResponse.ok || !slipResult.success) {
      return new Response(
        JSON.stringify({
          error: slipResult.message || 'Invalid slip',
          code: slipResult.code,
        }),
        { status: 400 }
      );
    }

    const slipData = slipResult.data!;
    const now = new Date();

    const mongoConnected = await connectDB();

    if (mongoConnected) {
      // Check for existing payment with this transRef
      const existingPayment = await Payment.findOne({ transRef: slipData.transRef });
      
      let flagged = false;
      let flagReason = '';

      if (existingPayment) {
        if (existingPayment.status === 'approved') {
          return new Response(JSON.stringify({ error: 'This slip has already been approved' }), { status: 400 });
        }
        if (existingPayment.status === 'pending') {
          return new Response(JSON.stringify({ error: 'This slip is already pending review' }), { status: 400 });
        }
        // Previously rejected - allow resubmission but flag for admin
        flagged = true;
        flagReason = `Previously rejected. Original rejection reason: ${existingPayment.rejectionReason || 'Not specified'}`;
      }

      // Create payment record with pending status
      const payment = new Payment({
        userId: session.id,
        amount: slipData.amount,
        status: 'pending',
        transRef: slipData.transRef,
        sendingBank: slipData.sender.bank.short,
        receivingBank: slipData.receiver.bank.short,
        senderName: slipData.sender.account.name.th || slipData.sender.account.name.en,
        receiverName: slipData.receiver.account.name.th || slipData.receiver.account.name.en,
        transDate: slipData.date,
        transTime: slipData.time,
        slipData: JSON.stringify(slipData),
        flagged,
        flagReason,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });

      await payment.save();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Slip submitted for admin approval',
          payment: {
            id: payment._id.toString(),
            amount: payment.amount,
            transRef: payment.transRef,
            senderName: payment.senderName,
            receiverName: payment.receiverName,
            sendingBank: payment.sendingBank,
            receivingBank: payment.receivingBank,
            transDate: payment.transDate,
            transTime: payment.transTime,
            status: payment.status,
            flagged: payment.flagged,
          },
        }),
        { status: 201 }
      );
    } else {
      // SQLite
      const db = getSQLiteDB();

      // Check for existing payment
      const existingPayment = db.prepare('SELECT id, status, rejectionReason FROM payments WHERE transRef = ?').get(slipData.transRef) as {
        id: number;
        status: string;
        rejectionReason?: string;
      } | null;

      let flagged = 0;
      let flagReason = '';

      if (existingPayment) {
        if (existingPayment.status === 'approved') {
          return new Response(JSON.stringify({ error: 'This slip has already been approved' }), { status: 400 });
        }
        if (existingPayment.status === 'pending') {
          return new Response(JSON.stringify({ error: 'This slip is already pending review' }), { status: 400 });
        }
        // Previously rejected - allow resubmission but flag
        flagged = 1;
        flagReason = `Previously rejected. Original rejection reason: ${existingPayment.rejectionReason || 'Not specified'}`;
      }

      const insertStmt = db.prepare(`
        INSERT INTO payments (userId, amount, status, transRef, sendingBank, receivingBank, senderName, receiverName, transDate, transTime, slipData, flagged, flagReason, month, year)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertStmt.run(
        session.id,
        slipData.amount,
        'pending',
        slipData.transRef,
        slipData.sender.bank.short,
        slipData.receiver.bank.short,
        slipData.sender.account.name.th || slipData.sender.account.name.en,
        slipData.receiver.account.name.th || slipData.receiver.account.name.en,
        slipData.date,
        slipData.time,
        JSON.stringify(slipData),
        flagged,
        flagReason,
        now.getMonth() + 1,
        now.getFullYear()
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Slip submitted for admin approval',
          payment: {
            id: result.lastInsertRowid,
            amount: slipData.amount,
            transRef: slipData.transRef,
            senderName: slipData.sender.account.name.th || slipData.sender.account.name.en,
            receiverName: slipData.receiver.account.name.th || slipData.receiver.account.name.en,
            sendingBank: slipData.sender.bank.short,
            receivingBank: slipData.receiver.bank.short,
            transDate: slipData.date,
            transTime: slipData.time,
            status: 'pending',
            flagged: flagged === 1,
          },
        }),
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Slip verification error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
