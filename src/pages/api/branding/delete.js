import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const BRANDING_DIR = path.join(DATA_DIR, 'branding');

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type } = req.body;

    if (!type || !['logo', 'favicon'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    // Check if branding directory exists
    if (!fs.existsSync(BRANDING_DIR)) {
      return res.status(200).json({ success: true, message: 'Nothing to delete' });
    }

    // Find and delete the file
    const files = fs.readdirSync(BRANDING_DIR);
    const file = files.find(f => f.startsWith(`${type}.`));

    if (file) {
      const filepath = path.join(BRANDING_DIR, file);
      fs.unlinkSync(filepath);
    }

    return res.status(200).json({ success: true, message: `${type} deleted` });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: 'Failed to delete file: ' + err.message });
  }
}
