# Slip Verification (OCR) System

A modern web application for managing and verifying payment slips using OCR technology. Built with Astro, Tailwind CSS, and supports both MongoDB and SQLite databases.

## Features

- 🔐 **Secure Authentication**: Invite-only system with admin-created accounts
- 💰 **Financial Dashboard**: Track monthly, yearly, and total payments
- 📄 **OCR Integration**: Ready-to-integrate slip upload with OCR processing
- 👥 **User Management**: Role-based access control (Admin/User)
- 📊 **Admin Monitoring**: Global revenue tracking and user management
- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS
- 💾 **Flexible Database**: MongoDB primary with SQLite fallback

## Prerequisites

- Node.js >= 22.12.0
- MongoDB (optional - SQLite will be used if not configured)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd SpotifySlipVerify
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set your configuration:
- `AUTH_SECRET`: Generate with `openssl rand -base64 32`
- `MONGODB_URI`: (Optional) Your MongoDB connection string
- `PUBLIC_APP_URL`: Your application URL

4. Initialize the database and create admin user:
```bash
npm run init-db
```

This will create an admin user with:
- Email: `admin@slipverify.com`
- Password: `admin123`

⚠️ **IMPORTANT**: Change the admin password after first login!

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:4321`

## Build for Production

```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
/
├── src/
│   ├── layouts/           # Layout components
│   │   ├── Layout.astro          # Base layout
│   │   └── DashboardLayout.astro # Dashboard layout
│   ├── pages/             # Pages and API routes
│   │   ├── index.astro           # Home page
│   │   ├── login.astro           # Login page
│   │   ├── dashboard/            # User dashboard
│   │   ├── admin/                # Admin dashboard
│   │   └── api/                  # API endpoints
│   │       ├── auth/             # Authentication APIs
│   │       ├── admin/            # Admin APIs
│   │       └── payments/         # Payment APIs
│   ├── lib/               # Utilities
│   │   ├── db.ts                 # Database configuration
│   │   └── auth.ts               # Authentication utilities
│   ├── models/            # Database models
│   │   ├── User.ts               # User model
│   │   └── Payment.ts            # Payment model
│   ├── styles/            # Global styles
│   └── middleware.ts      # Authentication middleware
├── data/                  # SQLite database (auto-created)
└── scripts/               # Utility scripts
    └── init-db.js         # Database initialization
```

## User Roles

### Admin
- Create and manage users
- View global revenue statistics
- Monitor all payment activities
- Access admin dashboard

### User
- Upload payment slips
- View personal payment history
- Track monthly/yearly/total payments
- Access user dashboard

## Database

The application supports two database configurations:

### MongoDB (Primary)
Set `MONGODB_URI` in `.env` to use MongoDB:
```
MONGODB_URI=mongodb://localhost:27017/slipverify
```

### SQLite (Fallback)
If `MONGODB_URI` is not set, the application automatically uses SQLite.
Database file: `./data/slipverify.db`

## OCR Integration

The application includes a placeholder function `processSlipOCR()` for OCR integration.

**To integrate with an OCR service:**

1. Implement the `processSlipOCR()` function in `src/pages/dashboard/index.astro`
2. Add your OCR API credentials to `.env`
3. Parse the OCR response and extract payment information
4. Create a payment record in the database

Example OCR services:
- Tesseract.js
- Google Cloud Vision API
- AWS Textract
- Azure Computer Vision

## Security Notes

- All passwords are hashed using bcryptjs
- Authentication uses JWT tokens stored in HttpOnly cookies
- Middleware protects dashboard and admin routes
- Admin endpoints require admin role verification
- CSRF protection via SameSite cookies

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Admin
- `POST /api/admin/create-user` - Create new user (admin only)
- `GET /api/admin/users` - List all users (admin only)
- `GET /api/admin/stats` - Get global statistics (admin only)

### Payments
- `GET /api/payments/summary` - Get user payment summary

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | No | SQLite | MongoDB connection string |
| `AUTH_SECRET` | Yes | - | JWT secret key |
| `PUBLIC_APP_URL` | Yes | http://localhost:4321 | Application URL |

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
