// Server-side storage for cost price overrides
// Stores in a JSON file on the server - never touches Square

import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const COST_FILE = path.join(DATA_DIR, 'cost-overrides.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Read cost overrides from file
function readCostOverrides() {
  try {
    ensureDataDir();
    if (fs.existsSync(COST_FILE)) {
      const data = fs.readFileSync(COST_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading cost overrides:', err.message);
  }
  return {};
}

// Write cost overrides to file
function writeCostOverrides(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(COST_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing cost overrides:', err.message);
    return false;
  }
}

export default async function handler(req, res) {
  // GET - retrieve all cost overrides
  if (req.method === 'GET') {
    const overrides = readCostOverrides();
    return res.status(200).json(overrides);
  }

  // POST - save a cost override
  if (req.method === 'POST') {
    const { id, cost } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing item id' });
    }

    const overrides = readCostOverrides();

    if (cost === null || cost === undefined || cost === '') {
      // Remove override
      delete overrides[id];
    } else {
      // Set override
      overrides[id] = parseFloat(cost);
    }

    const success = writeCostOverrides(overrides);

    if (success) {
      return res.status(200).json({ success: true, overrides });
    } else {
      return res.status(500).json({ error: 'Failed to save cost override' });
    }
  }

  // DELETE - remove a cost override
  if (req.method === 'DELETE') {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing item id' });
    }

    const overrides = readCostOverrides();
    delete overrides[id];

    const success = writeCostOverrides(overrides);

    if (success) {
      return res.status(200).json({ success: true, overrides });
    } else {
      return res.status(500).json({ error: 'Failed to delete cost override' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
