import mongoose from 'mongoose';
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import path from 'path';

const MONGODB_URI = import.meta.env.MONGODB_URI;

// MongoDB Connection
let isMongoConnected = false;

export async function connectDB() {
  if (MONGODB_URI) {
    try {
      if (isMongoConnected) {
        return true;
      }

      await mongoose.connect(MONGODB_URI);
      isMongoConnected = true;
      console.log('MongoDB connected successfully');
      return true;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      console.log('Falling back to SQLite...');
      return false;
    }
  }

  console.log('No MongoDB URI provided, using SQLite');
  return false;
}

// SQLite Connection (fallback)
let sqliteDb: Database | null = null;

export function getSQLiteDB(): Database {
  if (!sqliteDb) {
    const dataDir = path.resolve('./data');
    mkdirSync(dataDir, { recursive: true });
    sqliteDb = new Database(path.join(dataDir, 'slipverify.db'));

    // Create tables
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        transRef TEXT,
        sendingBank TEXT,
        receivingBank TEXT,
        senderName TEXT,
        receiverName TEXT,
        transDate TEXT,
        transTime TEXT,
        slipData TEXT,
        flagged INTEGER DEFAULT 0,
        flagReason TEXT,
        reviewedBy INTEGER,
        reviewedAt TEXT,
        rejectionReason TEXT,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(userId);
      CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(year, month);
      CREATE INDEX IF NOT EXISTS idx_payments_transref ON payments(transRef);
    `);

    console.log('SQLite database initialized');
  }

  return sqliteDb;
}

export async function getDB() {
  const mongoConnected = await connectDB();

  if (!mongoConnected) {
    return { type: 'sqlite', db: getSQLiteDB() };
  }

  return { type: 'mongodb', db: mongoose.connection };
}
