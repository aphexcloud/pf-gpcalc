import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const BRANDING_DIR = path.join(DATA_DIR, 'branding');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type } = req.query;

    if (!type || !['logo', 'favicon'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type parameter' });
    }

    // Check if branding directory exists
    if (!fs.existsSync(BRANDING_DIR)) {
      return res.status(404).json({ error: 'No branding files found' });
    }

    // Find the file with any extension
    const files = fs.readdirSync(BRANDING_DIR);
    const file = files.find(f => f.startsWith(`${type}.`));

    if (!file) {
      return res.status(404).json({ error: `${type} not found` });
    }

    const filepath = path.join(BRANDING_DIR, file);
    const fileBuffer = fs.readFileSync(filepath);

    // Determine mime type from extension
    const ext = path.extname(file).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    // Set cache headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    return res.send(fileBuffer);
  } catch (err) {
    console.error('Serve error:', err);
    return res.status(500).json({ error: 'Failed to serve file' });
  }
}
