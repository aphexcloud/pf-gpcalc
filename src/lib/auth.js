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

// Custom column permissions - stored in user metadata
const COLUMN_PERMISSIONS = ['sell', 'cost', 'gp', 'margin', 'gst', 'lastSold', 'stock'];

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
});

export { COLUMN_PERMISSIONS };
