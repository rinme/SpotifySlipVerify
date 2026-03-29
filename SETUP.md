# Quick Setup Guide

This guide will help you get the Slip Verification System up and running quickly.

## Quick Start (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
The repository includes a `.env` file with development defaults. For production:

```bash
# Generate a secure secret
openssl rand -base64 32

# Update .env file with the generated secret
# Set MONGODB_URI if you want to use MongoDB (optional)
```

### 3. Initialize Database
Create the first admin user:

```bash
npm run init-db
```

This creates:
- Email: `admin@slipverify.com`
- Password: `admin123`

### 4. Start Development Server
```bash
npm run dev
```

Visit: http://localhost:4321

### 5. Login
1. Click "Go to Dashboard" or navigate to `/login`
2. Use the admin credentials created in step 3
3. **Important**: Change the password after first login!

## First Steps After Login

### As Admin

1. **Change Your Password** (recommended)
   - Currently, password changes must be done via API or database
   - Will be added to UI in future updates

2. **Create Users**
   - Go to Admin Dashboard
   - Use "Create New User" form
   - Users will receive their credentials to login

3. **Test OCR Upload** (currently a placeholder)
   - Go to Dashboard
   - Try uploading a slip image
   - See the placeholder message for OCR integration

## Database Options

### Option 1: SQLite (Default - No Setup Required)
The application automatically creates a SQLite database at `./data/slipverify.db`.

**Pros:**
- No installation required
- Works out of the box
- Perfect for development and small deployments

**Cons:**
- Not ideal for high-traffic production
- No built-in replication

### Option 2: MongoDB (Recommended for Production)

1. Install MongoDB or use a cloud service (MongoDB Atlas)

2. Update `.env`:
```bash
MONGODB_URI=mongodb://localhost:27017/slipverify
# or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/slipverify
```

3. Restart the application

The app will automatically:
- Connect to MongoDB
- Create collections
- Switch from SQLite

## Integrating OCR

The application includes a placeholder function ready for OCR integration.

### Steps to Add OCR:

1. **Choose an OCR Service**
   - Tesseract.js (free, runs in browser)
   - Google Cloud Vision API
   - AWS Textract
   - Azure Computer Vision

2. **Update the processSlipOCR() function**

   Location: `src/pages/dashboard/index.astro`

   Example with Tesseract.js:
   ```javascript
   async function processSlipOCR(file: File): Promise<void> {
     const formData = new FormData();
     formData.append('slip', file);

     const response = await fetch('/api/ocr/process', {
       method: 'POST',
       body: formData
     });

     const data = await response.json();
     // Handle OCR results
   }
   ```

3. **Create OCR API Endpoint**

   Create `src/pages/api/ocr/process.ts`:
   ```typescript
   import type { APIRoute } from 'astro';
   // Import your OCR library

   export const POST: APIRoute = async ({ request }) => {
     // Extract file from request
     // Process with OCR
     // Parse payment information
     // Save to database
     // Return results
   };
   ```

## Production Deployment

### 1. Build the Application
```bash
npm run build
```

### 2. Environment Variables
Set these in production:
```bash
AUTH_SECRET=<your-secure-secret>
MONGODB_URI=<your-mongodb-uri>  # optional
PUBLIC_APP_URL=https://yourdomain.com
```

### 3. Start Production Server
```bash
npm run preview
# or use a process manager like PM2:
# pm2 start npm --name "slip-verify" -- run preview
```

### 4. Reverse Proxy (Nginx Example)
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:4321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Build Errors
If you encounter TypeScript errors:
```bash
npm run astro check
```

### Database Connection Issues
- **SQLite**: Ensure `./data` directory has write permissions
- **MongoDB**: Check connection string and network access

### Authentication Not Working
1. Check `.env` file exists and has `AUTH_SECRET`
2. Clear browser cookies
3. Restart the development server

### Port Already in Use
```bash
# Change the port in astro.config.mjs or:
npm run dev -- --port 3000
```

## Default Credentials

**⚠️ Security Warning**: Always change default credentials in production!

- **Admin User**
  - Email: `admin@slipverify.com`
  - Password: `admin123`

## Next Steps

1. ✅ Change admin password
2. ✅ Create test users
3. ✅ Explore the dashboards
4. ✅ Test file upload UI
5. ⬜ Integrate OCR service
6. ⬜ Deploy to production
7. ⬜ Set up SSL/HTTPS
8. ⬜ Configure backups

## Support

For issues or questions:
- Check the main [README.md](./README.md)
- Review API documentation in README
- Open an issue on GitHub

## Security Checklist

Before going to production:

- [ ] Changed default admin password
- [ ] Generated secure `AUTH_SECRET`
- [ ] Configured HTTPS
- [ ] Set up database backups
- [ ] Reviewed user permissions
- [ ] Tested authentication flow
- [ ] Configured CORS if needed
- [ ] Set up monitoring/logging
