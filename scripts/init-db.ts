import { connectDB, getSQLiteDB } from '../src/lib/db.ts';
import { hashPassword } from '../src/lib/auth.ts';
import User from '../src/models/User.ts';

async function initializeDatabase() {
  console.log('Initializing database...');

  const mongoConnected = await connectDB();

  const adminEmail = 'admin@slipverify.com';
  const adminPassword = 'admin123';
  const hashedPassword = await hashPassword(adminPassword);

  try {
    if (mongoConnected) {
      // Check if admin exists
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
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const existingAdmin = stmt.get(adminEmail);

      if (!existingAdmin) {
        const insertStmt = db.prepare(`
          INSERT INTO users (email, password, name, role)
          VALUES (?, ?, ?, ?)
        `);

        insertStmt.run(adminEmail, hashedPassword, 'System Admin', 'admin');
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
