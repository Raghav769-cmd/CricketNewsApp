# 🔐 Cricket News App - Authentication System

## Overview

A production-ready JWT-based authentication system with role-based access control (RBAC) for the Cricket News App.

## ✨ Features

✅ **User Registration & Login**
- Email-based authentication
- Secure password hashing with bcryptjs
- Role selection during registration (Admin/User)

✅ **JWT Token Authentication**
- 7-day token expiration
- Automatic token persistence in localStorage
- Token verification on protected routes

✅ **Role-Based Access Control**
- **Admin Role**: Can add and delete matches
- **User Role**: View-only access

✅ **Security**
- Password hashing (bcryptjs, 10 salt rounds)
- JWT token verification
- Protected API endpoints
- Role-based authorization middleware

✅ **User Interface**
- Login & Register pages
- User profile dropdown
- Admin badge indicator
- Conditional button visibility based on role

## 🚀 Quick Start

### 1. Setup Backend

```bash
cd apps/api

# Install dependencies
pnpm install

# Run database migrations
pnpm run migrate

# Seed demo users (optional)
pnpm run seed

# Start development server
pnpm run dev
```

### 2. Setup Frontend

```bash
cd apps/web

# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

### 3. Access Application

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## 🔐 Demo Accounts

**Admin User**
- Email: `admin@cricket.com`
- Password: `admin123`

**Regular User**
- Email: `user@cricket.com`
- Password: `user123`

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [AUTHENTICATION.md](./AUTHENTICATION.md) | Complete authentication guide |
| [SETUP_AUTHENTICATION.md](./SETUP_AUTHENTICATION.md) | Quick start setup guide |
| [TESTING_AUTHENTICATION.md](./TESTING_AUTHENTICATION.md) | Testing scenarios & verification |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture & diagrams |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Production deployment guide |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | What was implemented |

## 🏗️ Architecture

```
Frontend (Next.js)
    ↓
AuthContext (React Context API)
    ↓
API Requests (with JWT Token)
    ↓
Backend (Express.js)
    ↓
Auth Middleware
    ↓
Protected Routes
    ↓
Database (PostgreSQL)
```

## 🔑 Key Features by Role

### Admin Features
✅ View all matches
✅ Add new matches
✅ Delete matches
✅ View match details & scorecard
✅ View insights & statistics

### User Features
✅ View all matches
✅ View match details & scorecard
✅ View insights & statistics
❌ Cannot add matches
❌ Cannot delete matches

## 📁 Project Structure

```
apps/
├── api/
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.ts              # Auth middleware
│   │   ├── routes/
│   │   │   └── auth.ts              # Auth endpoints
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   │   └── 001_*.sql        # DB schema
│   │   │   ├── runMigrations.ts    # Migration runner
│   │   │   └── seedUsers.ts        # User seeding
│   │   └── index.ts                 # Entry point
│   ├── .env.example                 # Config template
│   └── package.json
│
└── web/
    ├── context/
    │   └── AuthContext.tsx          # Auth context
    ├── app/
    │   ├── login/page.tsx           # Login page
    │   ├── register/page.tsx        # Register page
    │   ├── layout.tsx               # Provider wrapper
    │   ├── matches/page.tsx         # Auth integration
    │   └── components/
    │       └── Header.tsx           # User dropdown
    └── package.json
```

## 🔄 Authentication Flow

### Login Flow
1. User enters email & password
2. Password validated against hashed value
3. JWT token generated
4. Token stored in localStorage
5. User redirected to dashboard

### API Request Flow
1. Frontend includes token in Authorization header
2. Backend verifies token signature
3. Backend checks token expiration
4. Backend extracts user info from token
5. Backend checks user role for endpoint
6. Request processed or denied

## 🧪 Testing

See [TESTING_AUTHENTICATION.md](./TESTING_AUTHENTICATION.md) for:
- 14 detailed test scenarios
- API verification examples
- Browser console tests
- Performance tests

Quick test:
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cricket.com","password":"admin123"}'

# Access protected route
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer {token}"
```

## ⚙️ Configuration

Create `.env` file in `apps/api`:

```env
DB_HOST=localhost
DB_NAME=cricket
DB_USER=postgres
DB_PASSWORD=your_password
DB_PORT=5432
JWT_SECRET=your-secret-key
PORT=5000
```

⚠️ **Important**: Change `JWT_SECRET` in production!

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/logout` - Logout (protected)

### Matches (Protected)
- `POST /api/matches` - Add match (admin only)
- `DELETE /api/matches/:id` - Delete match (admin only)
- `GET /api/matches` - Get all matches (public)
- `GET /api/matches/:id` - Get match details (public)

## 🔒 Security

✅ Password hashing: bcryptjs (10 salt rounds)
✅ Token security: JWT with 7-day expiration
✅ Authorization: Role-based middleware
✅ Input validation: Email, password, role
✅ Error handling: No sensitive data exposure

## 📈 Performance

- Indexed email column for fast lookups
- Token verification cached in request
- Async password hashing
- No N+1 queries

## 🐛 Troubleshooting

### "No token provided" error
→ Ensure you're logged in and token is in localStorage

### "Invalid token" error
→ Token may be expired. Login again to get a fresh token.

### "Only admins can perform this action"
→ Create an admin account or use demo admin credentials

### Database connection error
→ Check `.env` file and ensure PostgreSQL is running

See [AUTHENTICATION.md](./AUTHENTICATION.md#troubleshooting) for more help.

## 🚀 Deployment

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for:
- Pre-deployment checklist
- Security hardening steps
- Production configuration
- Monitoring setup

## 📞 Support

For issues or questions:
1. Check [AUTHENTICATION.md](./AUTHENTICATION.md)
2. Review [TESTING_AUTHENTICATION.md](./TESTING_AUTHENTICATION.md)
3. Check browser console for errors
4. Review backend logs: `pm2 logs cricket-api`

## 📝 License

Same as main project

## ✅ Status

✅ **Production Ready** (with hardening for production deployment)

---

**Implementation Date**: December 2025
**Status**: Complete and Tested
**Documentation**: Comprehensive
**Ready for**: Development, Testing, Production Deployment
