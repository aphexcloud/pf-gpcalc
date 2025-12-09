/**
 * Email Templates
 * Provides HTML and plain text templates for various email types
 */

/**
 * User Invitation Email Template
 * @param {string} name - User's name
 * @param {string} tempPassword - Temporary password
 * @param {string} loginUrl - Login page URL
 * @returns {object} - { html, text, subject }
 */
export function invitationTemplate(name, tempPassword, loginUrl) {
  const subject = 'You\'ve been invited to GP Calculator';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(to bottom, #f8f9fa, #ffffff); padding: 30px 20px; text-align: center; border-bottom: 2px solid #e9ecef; }
    .header h1 { margin: 0; font-size: 24px; color: #1a1a1a; font-weight: 500; }
    .content { padding: 30px 20px; background: #ffffff; }
    .button { display: inline-block; padding: 12px 30px; background: #000000; color: #ffffff !important; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .credentials { background: #f8f9fa; padding: 15px; border-left: 3px solid #000000; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GP Calculator</h1>
    </div>
    <div class="content">
      <p>Hi ${name || 'there'},</p>

      <p>You've been invited to join GP Calculator. Your account has been created and you can now log in to start managing your inventory and profit calculations.</p>

      <div class="credentials">
        <strong>Your Login Credentials:</strong><br>
        <strong>Temporary Password:</strong> ${tempPassword}<br>
        <em>Please change your password after your first login.</em>
      </div>

      <p style="text-align: center;">
        <a href="${loginUrl}" class="button">Log In Now</a>
      </p>

      <p>If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${loginUrl}">${loginUrl}</a></p>

      <p>If you have any questions or need assistance, please contact your administrator.</p>

      <p>Welcome aboard!</p>
    </div>
    <div class="footer">
      <p>This is an automated message from GP Calculator. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
GP Calculator - User Invitation

Hi ${name || 'there'},

You've been invited to join GP Calculator. Your account has been created and you can now log in to start managing your inventory and profit calculations.

YOUR LOGIN CREDENTIALS
Temporary Password: ${tempPassword}
Please change your password after your first login.

LOG IN HERE:
${loginUrl}

If you have any questions or need assistance, please contact your administrator.

Welcome aboard!

---
This is an automated message from GP Calculator. Please do not reply to this email.
  `.trim();

  return { html, text, subject };
}

/**
 * Password Reset Email Template
 * @param {string} resetUrl - Password reset URL
 * @returns {object} - { html, text, subject }
 */
export function passwordResetTemplate(resetUrl) {
  const subject = 'Reset your GP Calculator password';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(to bottom, #f8f9fa, #ffffff); padding: 30px 20px; text-align: center; border-bottom: 2px solid #e9ecef; }
    .header h1 { margin: 0; font-size: 24px; color: #1a1a1a; font-weight: 500; }
    .content { padding: 30px 20px; background: #ffffff; }
    .button { display: inline-block; padding: 12px 30px; background: #000000; color: #ffffff !important; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .warning { background: #fff3cd; padding: 15px; border-left: 3px solid #ffc107; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GP Calculator</h1>
    </div>
    <div class="content">
      <p>Hello,</p>

      <p>We received a request to reset your password for your GP Calculator account.</p>

      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>

      <p>If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}">${resetUrl}</a></p>

      <div class="warning">
        <strong>Important:</strong> This password reset link will expire soon. If you didn't request this reset, you can safely ignore this email.
      </div>

      <p>If you continue to have problems, please contact your administrator.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from GP Calculator. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
GP Calculator - Password Reset

Hello,

We received a request to reset your password for your GP Calculator account.

RESET YOUR PASSWORD:
${resetUrl}

IMPORTANT: This password reset link will expire soon. If you didn't request this reset, you can safely ignore this email.

If you continue to have problems, please contact your administrator.

---
This is an automated message from GP Calculator. Please do not reply to this email.
  `.trim();

  return { html, text, subject };
}

/**
 * Test Email Template
 * @param {string} fromAddress - The sender email address
 * @returns {object} - { html, text, subject }
 */
export function testEmailTemplate(fromAddress) {
  const subject = 'GP Calculator - SMTP Test Email';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(to bottom, #f8f9fa, #ffffff); padding: 30px 20px; text-align: center; border-bottom: 2px solid #e9ecef; }
    .header h1 { margin: 0; font-size: 24px; color: #1a1a1a; font-weight: 500; }
    .content { padding: 30px 20px; background: #ffffff; }
    .success { background: #d4edda; padding: 15px; border-left: 3px solid #28a745; margin: 20px 0; color: #155724; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GP Calculator</h1>
    </div>
    <div class="content">
      <div class="success">
        <strong>Success!</strong> Your SMTP configuration is working correctly.
      </div>

      <p>This is a test email to confirm that your email settings are configured properly.</p>

      <p><strong>From:</strong> ${fromAddress}</p>
      <p><strong>Sent:</strong> ${new Date().toLocaleString()}</p>

      <p>You can now use GP Calculator to send user invitations and password reset emails.</p>
    </div>
    <div class="footer">
      <p>This is an automated test message from GP Calculator.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
GP Calculator - SMTP Test Email

SUCCESS! Your SMTP configuration is working correctly.

This is a test email to confirm that your email settings are configured properly.

From: ${fromAddress}
Sent: ${new Date().toLocaleString()}

You can now use GP Calculator to send user invitations and password reset emails.

---
This is an automated test message from GP Calculator.
  `.trim();

  return { html, text, subject };
}
