# GP Calculator App - Project Context

## Project
- **Name**: GP Calculator (Gross Profit Calculator)
- **Repo**: https://github.com/aphexcloud/pf-gpcalc
- **Framework**: Next.js 16 with Tailwind CSS
- **Purpose**: Display Square inventory with profit analytics

## Initial Setup (First-Time Deployment)

When deploying for the first time, a default admin account is automatically created:

- **Email**: `admin@localhost`
- **Password**: `admin123`

**⚠️ IMPORTANT SECURITY STEPS:**
1. Log in with the default credentials
2. Go to Settings → Configure SMTP (optional but recommended for user invitations)
3. Go to User Management → Invite a new admin with your real email
4. Log out and log in with your new admin account
5. Delete the default admin account (`admin@localhost`)

**Note**: Public signup is disabled. Only admins can invite new users.

## Square Integration
- **Account**: Providence Foods (AU)
- **Merchant ID**: ML6ZC7JNWT26R
- **API**: Read-only - never writes to Square
- **Configuration**: Can be configured via Settings page (recommended) or environment variables
  - Settings page: Admin → Settings → Square Integration
  - Access token is encrypted using AES-256-GCM before storage
  - Environment dropdown: Production or Sandbox
  - Settings override environment variables if both are present

## Features
- Product listing with search
- Sell price (from Square)
- Cost price (from Square's `default_unit_cost` field)
- GP% (Gross Profit Percentage) - color coded
- Margin in dollars
- GST status (from Square tax_ids)
- Last sold date (from inventory changes API)
- Stock count
- Manual cost override (saved server-side)
- White/glassy UI theme

## Data Storage
- Cost overrides stored in `/app/data/cost-overrides.json` on server
- Docker volume `gpcalc-data` for persistence
- NOT stored in browser localStorage

## Deployment (Portainer)
- Build from: https://github.com/aphexcloud/pf-gpcalc
- Environment variables (optional if configured via Settings page):
  - `SQUARE_ACCESS_TOKEN` - Square API token (can be configured in Settings instead)
  - `SQUARE_ENVIRONMENT=production` - Environment mode (can be configured in Settings instead)
  - `ENCRYPTION_KEY` - (Optional) Custom encryption key for sensitive data. If not set, uses a default key.
- Volume mapping: `gpcalc-data:/app/data` (required for persistence)
- Port: 3000

**Note**: Square credentials configured via the Settings page will override environment variables. It's recommended to configure credentials via Settings for better security (encrypted storage) and easier management.

## API Endpoints
- `GET /api/inventory` - Fetch all products from Square
- `GET /api/cost-overrides` - Get saved cost overrides
- `POST /api/cost-overrides` - Save a cost override

## Important Notes
- App is completely READ-ONLY with Square
- Square API uses snake_case (e.g., `item_data`, `price_money`)
- Cost prices come from `item_variation_data.default_unit_cost`
- Archived items are filtered out
