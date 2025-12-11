import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const BRANDING_DIR = path.join(DATA_DIR, 'branding');

// Ensure branding directory exists
function ensureBrandingDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BRANDING_DIR)) {
    fs.mkdirSync(BRANDING_DIR, { recursive: true });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, base64Data } = req.body;

    if (!type || !base64Data) {
      return res.status(400).json({ error: 'Missing type or base64Data' });
    }

    if (!['logo', 'favicon'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "logo" or "favicon"' });
    }

    // Extract the base64 data and mime type
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid base64 data format' });
    }

    const mimeType = matches[1];
    const base64Content = matches[2];

    // Validate mime type
    const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/x-icon'];
    if (!validMimeTypes.includes(mimeType)) {
      return res.status(400).json({ error: 'Invalid image type. Supported: PNG, JPEG, GIF, SVG, ICO' });
    }

    // Get file extension
    const ext = mimeType.split('/')[1].replace('svg+xml', 'svg').replace('x-icon', 'ico');

    // Create filename
    const filename = `${type}.${ext}`;
    const filepath = path.join(BRANDING_DIR, filename);

    // Ensure directory exists
    ensureBrandingDir();

    // Save file
    const buffer = Buffer.from(base64Content, 'base64');

    // Check file size (max 2MB)
    if (buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 2MB' });
    }

    fs.writeFileSync(filepath, buffer);

    return res.status(200).json({
      success: true,
      filename,
      path: `/api/branding/serve?type=${type}`
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Failed to upload file: ' + err.message });
  }
}
