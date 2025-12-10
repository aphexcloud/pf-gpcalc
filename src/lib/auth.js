import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Use DATA_DIR for persistence (same as settings/cost-overrides)
const DATA_DIR = process.env.DATA_DIR || '/app/data';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, "auth.db");

// Create database with immediate timeout and exclusive locking disabled
const db = new Database(dbPath, {
  fileMustExist: false,
});

// Configure for concurrent access
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 1000');
db.pragma('foreign_keys = ON');
db.pragma('temp_store = MEMORY');

// Create tables if they don't exist (use IF NOT EXISTS to be idempotent)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      emailVerified INTEGER,
      image TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      role TEXT,
      banned INTEGER,
      banReason TEXT,
      banExpires INTEGER,
      columnPermissions TEXT,
      invitedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expiresAt INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL REFERENCES user(id),
      impersonatedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      userId TEXT NOT NULL REFERENCES user(id),
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt INTEGER,
      refreshTokenExpiresAt INTEGER,
      scope TEXT,
      password TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER,
      updatedAt INTEGER
    );
  `);
} catch (e) {
  // Tables might already exist or be locked - that's ok
  console.log('Database init:', e.message);
}

// Custom column permissions - stored in user metadata
const COLUMN_PERMISSIONS = ['sell', 'cost', 'gp', 'margin', 'gst', 'lastSold', 'stock'];

// Helper to check if any users exist
function isFirstUser() {
  try {
    const stmt = db.prepare("SELECT COUNT(*) as count FROM user");
    const result = stmt.get();
    return result.count === 0;
  } catch {
    // Table might not exist yet
    return true;
  }
}

export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url, token }, request) => {
      try {
        // Import email service dynamically
        const { sendPasswordResetEmail } = await import('./email.js');

        const result = await sendPasswordResetEmail(user.email, url);

        if (result.success) {
          console.log(`Password reset email sent to ${user.email}`);
        } else if (result.fallback) {
          console.log(`Password reset for ${user.email}: ${url} (SMTP not configured)`);
        } else {
          console.error(`Failed to send password reset to ${user.email}:`, result.error);
          console.log(`Password reset URL: ${url}`);
        }
      } catch (err) {
        console.error('Error sending password reset email:', err);
        console.log(`Password reset for ${user.email}: ${url}`);
      }
    },
  },
  user: {
    additionalFields: {
      columnPermissions: {
        type: "string",
        defaultValue: JSON.stringify(COLUMN_PERMISSIONS), // All columns by default
        input: false,
      },
      invitedBy: {
        type: "string",
        defaultValue: null,
        input: false,
      },
    },
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
  ],
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Make first user an admin
          if (isFirstUser()) {
            console.log(`First user ${user.email} - granting admin role`);
            return {
              data: {
                ...user,
                role: "admin",
              },
            };
          }
          return { data: user };
        },
      },
    },
  },
});

// Initialize default admin account on startup if no users exist
(async () => {
  try {
    const { initializeDefaultAdmin } = await import('./init-default-admin.js');
    await initializeDefaultAdmin();
  } catch (err) {
    // Ignore errors during init - they'll be logged in the init function
  }
})();

export { COLUMN_PERMISSIONS };
