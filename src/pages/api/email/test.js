import { auth } from '@/lib/auth';
import { sendTestEmail } from '@/lib/email';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin authentication
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user || session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { smtpSettings } = req.body;

    if (!smtpSettings) {
      return res.status(400).json({ error: 'SMTP settings are required' });
    }

    // Validate required fields
    if (!smtpSettings.host || !smtpSettings.port) {
      return res.status(400).json({
        success: false,
        error: 'SMTP host and port are required'
      });
    }

    if (!smtpSettings.testRecipient) {
      return res.status(400).json({
        success: false,
        error: 'Test recipient email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(smtpSettings.testRecipient)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid test recipient email format'
      });
    }

    // Send test email
    const result = await sendTestEmail(smtpSettings);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Test email error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send test email'
    });
  }
}
