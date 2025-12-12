// Server-side storage for app settings
import fs from 'fs';
import path from 'path';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const BRANDING_DIR = path.join(DATA_DIR, 'branding');

const DEFAULT_SETTINGS = {
  gpThresholds: {
    excellent: 50,  // Green: >= 50%
    good: 30,       // Yellow: >= 30%
    low: 0          // Orange: >= 0%, Red: < 0%
  },
  smtp: {
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    from: {
      name: '',
      address: ''
    },
    auth: {
      user: '',
      pass: ''
    },
    testRecipient: ''
  },
  square: {
    accessToken: '',      // Encrypted in storage
    environment: 'sandbox'  // 'production' or 'sandbox'
  },
  branding: {
    hasLogo: false,
    hasFavicon: false
  }
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function checkBrandingFiles() {
  const branding = {
    hasLogo: false,
    hasFavicon: false
  };

  if (fs.existsSync(BRANDING_DIR)) {
    const files = fs.readdirSync(BRANDING_DIR);
    branding.hasLogo = files.some(f => f.startsWith('logo.'));
    branding.hasFavicon = files.some(f => f.startsWith('favicon.'));
  }

  return branding;
}

function readSettings() {
  try {
    ensureDataDir();
    let settings = DEFAULT_SETTINGS;

    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }

    // Decrypt sensitive fields for client use
    if (settings.square?.accessToken && isEncrypted(settings.square.accessToken)) {
      try {
        settings.square.accessToken = decrypt(settings.square.accessToken);
      } catch (err) {
        console.error('[SETTINGS] Failed to decrypt Square access token:', err.message);
        settings.square.accessToken = '';
      }
    }

    if (settings.smtp?.auth?.pass && isEncrypted(settings.smtp.auth.pass)) {
      try {
        settings.smtp.auth.pass = decrypt(settings.smtp.auth.pass);
      } catch (err) {
        console.error('[SETTINGS] Failed to decrypt SMTP password:', err.message);
        settings.smtp.auth.pass = '';
      }
    }

    // Always check for branding files
    settings.branding = checkBrandingFiles();

    return settings;
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
    try {
      const newSettings = req.body;
      const currentSettings = readSettings();

      // Merge settings
      const merged = { ...currentSettings, ...newSettings };

      // Encrypt sensitive fields before saving
      const toSave = JSON.parse(JSON.stringify(merged)); // Deep clone

      // Encrypt Square access token if changed and not empty
      if (toSave.square?.accessToken) {
        // Only encrypt if it's not already encrypted (i.e., it's a new/changed value)
        if (!isEncrypted(toSave.square.accessToken)) {
          toSave.square.accessToken = encrypt(toSave.square.accessToken);
        }
      }

      // Encrypt SMTP password if changed and not empty
      if (toSave.smtp?.auth?.pass) {
        if (!isEncrypted(toSave.smtp.auth.pass)) {
          toSave.smtp.auth.pass = encrypt(toSave.smtp.auth.pass);
        }
      }

      const success = writeSettings(toSave);

      if (success) {
        // Return decrypted version to client
        return res.status(200).json({ success: true, settings: merged });
      } else {
        return res.status(500).json({ error: 'Failed to save settings' });
      }
    } catch (err) {
      console.error('[SETTINGS] Error saving:', err);
      return res.status(500).json({ error: 'Failed to save settings: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
