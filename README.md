# GP Calculator - Gross Profit Dashboard

A Next.js application for tracking inventory, pricing, and profit margins from Square POS.

## Features

- View products from Square inventory
- Track sell prices, cost prices, and profit margins
- Calculate GP% (Gross Profit Percentage) with color-coded indicators
- Manual cost price overrides
- Column-level permissions for different users
- Admin user management
- SMTP email integration for user invitations

## Initial Setup

### First-Time Deployment

When you first deploy the application, a default admin account is automatically created:

**Default Credentials:**
- Email: `admin@localhost`
- Password: `admin123`

### Security Setup (IMPORTANT)

⚠️ **You must complete these steps after first deployment:**

1. **Log in** with the default credentials above
2. **Configure SMTP** (optional but recommended):
   - Go to Settings
   - Configure your SMTP server details
   - Test the configuration
3. **Create your admin account**:
   - Go to User Management
   - Click "Invite User"
   - Enter your real email address
   - Set role to "Admin"
   - If SMTP is configured, you'll receive an email
   - If not, copy the temporary password shown
4. **Log out** and log in with your new account
5. **Delete the default admin**:
   - Go to User Management
   - Find the "DEFAULT" admin account (admin@localhost)
   - Click Delete

### Environment Variables

Create a `.env.local` file with:

```env
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_ENVIRONMENT=production
BETTER_AUTH_SECRET=your-super-secret-key-at-least-32-chars-long-here
BETTER_AUTH_URL=http://localhost:3000
```

### Installation

```bash
npm install
npm run dev
```

### Docker Deployment

```bash
docker-compose up -d
```

The application will be available at `http://localhost:3000`

## User Management

- **Public signup is disabled** for security
- Only admins can invite new users
- Admins can set column-level permissions for each user
- Users receive email invitations (if SMTP is configured)

## Data Storage

- Cost overrides: `/app/data/cost-overrides.json`
- Settings: `/app/data/settings.json`
- User database: `/app/data/auth.db`
- Docker volume: `gpcalc-data` for persistence

## API Endpoints

- `GET /api/inventory` - Fetch products from Square
- `GET /api/cost-overrides` - Get saved cost overrides
- `POST /api/cost-overrides` - Save a cost override
- `DELETE /api/cost-overrides` - Remove a cost override
- `GET /api/settings` - Get application settings
- `POST /api/settings` - Update settings
- `/api/auth/*` - Authentication endpoints

## Tech Stack

- Next.js 16 (Pages Router)
- Better Auth for authentication
- Square API for inventory data
- SQLite for user database
- Tailwind CSS for styling
- Docker for deployment

## License

Proprietary
