# GP Calculator App - Project Context

## Project
- **Name**: GP Calculator (Gross Profit Calculator)
- **Repo**: https://github.com/aphexcloud/pf-gpcalc
- **Framework**: Next.js 16 with Tailwind CSS
- **Purpose**: Display Square inventory with profit analytics

## Square Integration
- **Account**: Providence Foods (AU)
- **Merchant ID**: ML6ZC7JNWT26R
- **Environment**: Production
- **API**: Read-only - never writes to Square

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
- Environment variables:
  - `SQUARE_ACCESS_TOKEN` - Square API token
  - `SQUARE_ENVIRONMENT=production`
- Volume mapping: `gpcalc-data:/app/data`
- Port: 3000

## API Endpoints
- `GET /api/inventory` - Fetch all products from Square
- `GET /api/cost-overrides` - Get saved cost overrides
- `POST /api/cost-overrides` - Save a cost override

## Important Notes
- App is completely READ-ONLY with Square
- Square API uses snake_case (e.g., `item_data`, `price_money`)
- Cost prices come from `item_variation_data.default_unit_cost`
- Archived items are filtered out
