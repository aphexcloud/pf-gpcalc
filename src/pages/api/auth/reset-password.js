// Password Reset API - Generates temporary password and emails it to user

import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import { promisify } from "util";

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
 * Generate temporary password
 */
function generateTempPassword() {
  // Generate a random 12-character password with uppercase, lowercase, number, and special char
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$';

  let password = '';
  password += upperChars[Math.floor(Math.random() * upperChars.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = 0; i < 9; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const db = new Database(dbPath, { fileMustExist: false });
    db.pragma('journal_mode = WAL');

    // Check if user exists
    const user = db.prepare("SELECT * FROM user WHERE email = ?").get(email);

    if (!user) {
      // For security, don't reveal if email exists or not
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a temporary password has been sent.'
      });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const now = Date.now();

    // Update password in account table
    const account = db.prepare("SELECT * FROM account WHERE userId = ? AND providerId = 'credential'").get(user.id);

    if (account) {
      db.prepare(`
        UPDATE account
        SET password = ?, updatedAt = ?
        WHERE userId = ? AND providerId = 'credential'
      `).run(hashedPassword, now, user.id);
    } else {
      // Create account if it doesn't exist
      const accountId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
        VALUES (?, ?, 'credential', ?, ?, ?, ?)
      `).run(accountId, email, user.id, hashedPassword, now, now);
    }

    db.close();

    // Send email with temporary password
    try {
      const { sendEmail } = await import('@/lib/email.js');

      const subject = 'Password Reset - Temporary Password';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset</h2>
          <p>Hello ${user.name || 'there'},</p>
          <p>You requested a password reset. Here is your temporary password:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <code style="font-size: 18px; color: #0066cc; font-weight: bold;">${tempPassword}</code>
          </div>
          <p><strong>Important:</strong></p>
          <ul>
            <li>Use this temporary password to log in</li>
            <li>Change your password immediately after logging in</li>
            <li>Go to Settings → Change Password</li>
          </ul>
          <p>If you didn't request this reset, please contact your administrator.</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">This is an automated message from Profit Dashboard.</p>
        </div>
      `;

      const result = await sendEmail(email, subject, html);

      if (result.success) {
        return res.status(200).json({
          success: true,
          message: 'A temporary password has been sent to your email.'
        });
      } else if (result.fallback) {
        // SMTP not configured - return temp password directly (for development)
        console.log(`Temporary password for ${email}: ${tempPassword}`);
        return res.status(200).json({
          success: true,
          message: `Email not configured. Temporary password: ${tempPassword}\n\nPlease change it after logging in.`,
          tempPassword: tempPassword // Only when SMTP is not configured
        });
      } else {
        // Email failed but password was reset
        console.log(`Failed to send email, but password reset for ${email}: ${tempPassword}`);
        return res.status(200).json({
          success: true,
          message: 'Password has been reset, but email failed to send. Please contact your administrator.'
        });
      }
    } catch (emailError) {
      console.error('Email error:', emailError);
      console.log(`Password reset for ${email}, temp password: ${tempPassword}`);
      return res.status(200).json({
        success: true,
        message: 'Password has been reset, but email failed to send. Please contact your administrator.'
      });
    }

  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
}
