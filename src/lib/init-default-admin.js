import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const dbPath = path.join(DATA_DIR, "auth.db");

// Default admin credentials
const DEFAULT_ADMIN = {
  email: "admin@localhost",
  password: "admin123",
  name: "Default Admin",
};

/**
 * Hash password using scrypt (same as Better Auth)
 */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Initialize default admin account if no users exist
 * This runs on server startup
 */
export async function initializeDefaultAdmin() {
  try {
    const db = new Database(dbPath, { fileMustExist: false });
    db.pragma('journal_mode = WAL');

    // Check if any users exist
    const userCount = db.prepare("SELECT COUNT(*) as count FROM user").get();

    if (userCount.count === 0) {
      console.log('No users found. Creating default admin account...');

      // Hash the password
      const hashedPassword = await hashPassword(DEFAULT_ADMIN.password);
      const userId = crypto.randomUUID();
      const accountId = crypto.randomUUID();
      const now = Date.now();

      // Insert user
      db.prepare(`
        INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt, role, columnPermissions, invitedBy)
        VALUES (?, ?, ?, 0, ?, ?, 'admin', ?, 'system')
      `).run(
        userId,
        DEFAULT_ADMIN.name,
        DEFAULT_ADMIN.email,
        now,
        now,
        JSON.stringify(['sell', 'cost', 'gp', 'margin', 'gst', 'lastSold', 'stock'])
      );

      // Insert account with password
      db.prepare(`
        INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
        VALUES (?, ?, 'credential', ?, ?, ?, ?)
      `).run(
        accountId,
        DEFAULT_ADMIN.email,
        userId,
        hashedPassword,
        now,
        now
      );

      console.log('✓ Default admin account created successfully');
      console.log('  Email:', DEFAULT_ADMIN.email);
      console.log('  Password:', DEFAULT_ADMIN.password);
      console.log('');
      console.log('⚠️  IMPORTANT: Please log in and:');
      console.log('  1. Configure SMTP settings');
      console.log('  2. Create a new admin account');
      console.log('  3. Delete this default admin account');
      console.log('');
    }

    db.close();
    return true;
  } catch (err) {
    console.error('Failed to initialize default admin:', err);
    return false;
  }
}
