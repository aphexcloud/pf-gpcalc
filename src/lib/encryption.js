// Encryption utilities for sensitive data
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Get or generate encryption key
function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;

  if (envKey) {
    // Use provided key, derive 32 bytes using SHA-256
    return crypto.createHash('sha256').update(envKey).digest();
  }

  // For development: use a consistent derived key
  // In production, you should set ENCRYPTION_KEY environment variable
  const fallbackKey = 'gpcalc-default-encryption-key-please-change-in-production';
  console.warn('[ENCRYPTION] Using fallback encryption key. Set ENCRYPTION_KEY environment variable for production.');
  return crypto.createHash('sha256').update(fallbackKey).digest();
}

/**
 * Encrypt sensitive data
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted data in format: iv:tag:encrypted
 */
export function encrypt(text) {
  if (!text) return '';

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Return format: iv:tag:encrypted (all hex encoded)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('[ENCRYPTION] Error encrypting:', err.message);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Encrypted data in format: iv:tag:encrypted
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encryptedData) {
  if (!encryptedData) return '';

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, tagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[ENCRYPTION] Error decrypting:', err.message);
    // Return empty string if decryption fails (might be unencrypted legacy data)
    return '';
  }
}

/**
 * Check if a string is encrypted (has the iv:tag:encrypted format)
 * @param {string} data - Data to check
 * @returns {boolean}
 */
export function isEncrypted(data) {
  if (!data || typeof data !== 'string') return false;
  const parts = data.split(':');
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}
