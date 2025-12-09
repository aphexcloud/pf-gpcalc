/**
 * Email Service
 * Handles all email sending functionality using nodemailer
 */
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import {
  invitationTemplate,
  passwordResetTemplate,
  testEmailTemplate
} from './email-templates.js';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

/**
 * Read SMTP settings from settings.json
 * @returns {object|null} SMTP settings or null if not found
 */
function getSmtpSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      return settings.smtp || null;
    }
  } catch (err) {
    console.error('Error reading SMTP settings:', err.message);
  }
  return null;
}

/**
 * Create nodemailer transport from SMTP settings
 * @param {object} smtpSettings - SMTP configuration
 * @returns {object} Nodemailer transport
 */
function createTransport(smtpSettings) {
  const config = {
    host: smtpSettings.host,
    port: smtpSettings.port || 587,
    secure: smtpSettings.secure || false,
  };

  // Add authentication if provided
  if (smtpSettings.auth && smtpSettings.auth.user) {
    config.auth = {
      user: smtpSettings.auth.user,
      pass: smtpSettings.auth.pass || ''
    };
  }

  // Set timeout to 10 seconds
  config.connectionTimeout = 10000;

  return nodemailer.createTransport(config);
}

/**
 * Send email using SMTP settings
 * @param {object} smtpSettings - SMTP configuration (optional, reads from file if not provided)
 * @param {object} mailOptions - Nodemailer mail options
 * @returns {Promise<object>} { success: boolean, messageId?: string, error?: string, fallback?: boolean }
 */
async function sendEmail(smtpSettings, mailOptions) {
  try {
    // If no settings provided, read from file
    if (!smtpSettings) {
      smtpSettings = getSmtpSettings();
    }

    // Check if SMTP is enabled
    if (!smtpSettings || !smtpSettings.enabled) {
      return {
        success: false,
        fallback: true,
        error: 'SMTP not enabled'
      };
    }

    // Validate required fields
    if (!smtpSettings.host || !smtpSettings.port) {
      return {
        success: false,
        error: 'SMTP host and port are required'
      };
    }

    // Set from address
    if (smtpSettings.from && smtpSettings.from.address) {
      mailOptions.from = smtpSettings.from.name
        ? `"${smtpSettings.from.name}" <${smtpSettings.from.address}>`
        : smtpSettings.from.address;
    }

    // Create transport and send
    const transport = createTransport(smtpSettings);
    const info = await transport.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Email send error:', error);

    // Provide user-friendly error messages
    let errorMessage = error.message;

    if (error.code === 'EAUTH' || error.responseCode === 535) {
      errorMessage = 'Invalid SMTP username or password';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Could not connect to SMTP server. Check host and port.';
    } else if (error.code === 'ESOCKET') {
      errorMessage = 'Connection error. Check your SMTP settings and network.';
    } else if (error.message.includes('certificate')) {
      errorMessage = 'TLS/SSL certificate error. Try changing the secure setting or port.';
    }

    return {
      success: false,
      error: errorMessage,
      code: error.code
    };
  }
}

/**
 * Send user invitation email
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient name
 * @param {string} tempPassword - Temporary password
 * @param {string} loginUrl - Login page URL (optional)
 * @returns {Promise<object>} Result object
 */
export async function sendInvitationEmail(email, name, tempPassword, loginUrl) {
  // Use environment variable or default to localhost
  const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  const actualLoginUrl = loginUrl || `${baseUrl}/login`;

  const template = invitationTemplate(name, tempPassword, actualLoginUrl);

  const mailOptions = {
    to: email,
    subject: template.subject,
    text: template.text,
    html: template.html
  };

  return await sendEmail(null, mailOptions);
}

/**
 * Send password reset email
 * @param {string} email - Recipient email address
 * @param {string} resetUrl - Password reset URL
 * @returns {Promise<object>} Result object
 */
export async function sendPasswordResetEmail(email, resetUrl) {
  const template = passwordResetTemplate(resetUrl);

  const mailOptions = {
    to: email,
    subject: template.subject,
    text: template.text,
    html: template.html
  };

  return await sendEmail(null, mailOptions);
}

/**
 * Send test email to verify SMTP configuration
 * @param {object} smtpSettings - SMTP configuration to test
 * @returns {Promise<object>} Result object
 */
export async function sendTestEmail(smtpSettings) {
  if (!smtpSettings || !smtpSettings.testRecipient) {
    return {
      success: false,
      error: 'Test recipient email is required'
    };
  }

  const fromAddress = smtpSettings.from && smtpSettings.from.address
    ? smtpSettings.from.address
    : 'no-reply@example.com';

  const template = testEmailTemplate(fromAddress);

  const mailOptions = {
    to: smtpSettings.testRecipient,
    subject: template.subject,
    text: template.text,
    html: template.html
  };

  return await sendEmail(smtpSettings, mailOptions);
}
