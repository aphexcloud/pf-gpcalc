// Server-side storage for app settings
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULT_SETTINGS = {
  gpThresholds: {
    excellent: 50,  // Green: >= 50%
    good: 30,       // Yellow: >= 30%
    low: 0          // Orange: >= 0%, Red: < 0%
  }
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readSettings() {
  try {
    ensureDataDir();
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading settings:', err.message);
  }
  return DEFAULT_SETTINGS;
}

function writeSettings(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing settings:', err.message);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const settings = readSettings();
    return res.status(200).json(settings);
  }

  if (req.method === 'POST') {
    const newSettings = req.body;
    const currentSettings = readSettings();
    const merged = { ...currentSettings, ...newSettings };

    const success = writeSettings(merged);

    if (success) {
      return res.status(200).json({ success: true, settings: merged });
    } else {
      return res.status(500).json({ error: 'Failed to save settings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
