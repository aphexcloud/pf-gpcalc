import { auth } from '@/lib/auth';
import { sendInvitationEmail } from '@/lib/email';

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

    const { email, name, tempPassword } = req.body;

    // Validate required fields
    if (!email || !tempPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email and temporary password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Send invitation email
    const result = await sendInvitationEmail(email, name, tempPassword);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Send invitation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send invitation email'
    });
  }
}
