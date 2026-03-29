import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI = process.env.MONGODB_URI;

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function getSQLiteDB() {
  const dataDir = path.resolve(__dirname, '../data');
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'slipverify.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

async function initializeDatabase() {
  console.log('Initializing database...');

  const adminEmail = 'admin@slipverify.com';
  const adminPassword = 'admin123';
  const hashedPassword = await hashPassword(adminPassword);

  try {
    if (MONGODB_URI) {
      await mongoose.connect(MONGODB_URI);

      const UserSchema = new mongoose.Schema({
        email: { type: String, required: true, unique: true, lowercase: true },
        password: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, enum: ['user', 'admin'], default: 'user' },
      }, { timestamps: true });

      const User = mongoose.models.User || mongoose.model('User', UserSchema);

      const existingAdmin = await User.findOne({ email: adminEmail });

      if (!existingAdmin) {
        const admin = new User({
          email: adminEmail,
          password: hashedPassword,
          name: 'System Admin',
          role: 'admin',
        });
        await admin.save();
        console.log('✅ Admin user created successfully!');
        console.log(`Email: ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);
      } else {
        console.log('ℹ️  Admin user already exists.');
      }
    } else {
      // Use SQLite
      const db = getSQLiteDB();
      const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);

      if (!existingAdmin) {
        db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)').run(
          adminEmail,
          hashedPassword,
          'System Admin',
          'admin'
        );
        console.log('✅ Admin user created successfully!');
        console.log(`Email: ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);
      } else {
        console.log('ℹ️  Admin user already exists.');
      }
    }

    console.log('\n🎉 Database initialization complete!');
    console.log('\nYou can now login with:');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }

  process.exit(0);
}

initializeDatabase();
