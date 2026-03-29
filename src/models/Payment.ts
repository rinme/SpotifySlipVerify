import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  status: 'pending' | 'verified' | 'rejected';
  slipUrl?: string;
  ocrData?: string;
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
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    slipUrl: {
      type: String,
    },
    ocrData: {
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

// Prevent model recompilation in development
export default mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
