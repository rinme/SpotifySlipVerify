import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  transRef?: string;
  sendingBank?: string;
  receivingBank?: string;
  senderName?: string;
  receiverName?: string;
  transDate?: string;
  transTime?: string;
  slipData?: string;
  flagged?: boolean;
  flagReason?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  month: number;
  year: number;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    transRef: {
      type: String,
    },
    sendingBank: {
      type: String,
    },
    receivingBank: {
      type: String,
    },
    senderName: {
      type: String,
    },
    receiverName: {
      type: String,
    },
    transDate: {
      type: String,
    },
    transTime: {
      type: String,
    },
    slipData: {
      type: String,
    },
    flagged: {
      type: Boolean,
      default: false,
    },
    flagReason: {
      type: String,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for faster queries
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ year: 1, month: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ transRef: 1 });
PaymentSchema.index({ flagged: 1 });

// Prevent model recompilation in development
export default mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
