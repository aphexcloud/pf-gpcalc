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

const db = new Database(path.join(DATA_DIR, "auth.db"));

// Enable WAL mode and set busy timeout for concurrent access
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Create tables if they don't exist
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
      // For now, log to console - in production, integrate with email service
      console.log(`Password reset for ${user.email}: ${url}`);
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

export { COLUMN_PERMISSIONS };
