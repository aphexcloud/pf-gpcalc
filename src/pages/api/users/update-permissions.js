import { auth } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get current session
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user || session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { userId, columnPermissions } = req.body;

    if (!userId || !Array.isArray(columnPermissions)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Update user's column permissions using Better Auth's internal database
    // We need to directly update the user in the database
    const db = auth.options.database;

    const stmt = db.prepare(`
      UPDATE user
      SET columnPermissions = ?
      WHERE id = ?
    `);

    stmt.run(JSON.stringify(columnPermissions), userId);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating permissions:', error);
    return res.status(500).json({ error: 'Failed to update permissions' });
  }
}
