// Change Password API - Allows users to change their password

import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import { promisify } from "util";
import { auth } from '@/lib/auth';

const scrypt = promisify(crypto.scrypt);

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const dbPath = path.join(DATA_DIR, "auth.db");

/**
 * Hash password using scrypt (same as Better Auth)
 */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify password against hash
 */
async function verifyPassword(password, hash) {
  const [salt, key] = hash.split(':');
  const derivedKey = await scrypt(password, salt, 64);
  return key === derivedKey.toString('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const db = new Database(dbPath, { fileMustExist: false });
    db.pragma('journal_mode = WAL');

    // Get current password hash from account table
    const account = db.prepare(`
      SELECT * FROM account
      WHERE userId = ? AND providerId = 'credential'
    `).get(session.user.id);

    if (!account) {
      db.close();
      return res.status(404).json({ error: 'Account not found' });
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, account.password);

    if (!isValid) {
      db.close();
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    const now = Date.now();

    // Update password
    db.prepare(`
      UPDATE account
      SET password = ?, updatedAt = ?
      WHERE userId = ? AND providerId = 'credential'
    `).run(hashedPassword, now, session.user.id);

    db.close();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
}
