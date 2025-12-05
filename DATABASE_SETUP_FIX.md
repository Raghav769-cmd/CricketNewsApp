# RBAC Database Setup & Login Fix - Complete Resolution

## Issue Summary
The login endpoint was failing with: `error: column "role" does not exist`

This was because:
1. The `admins` table was missing the `role` column
2. The `admin_requests` table was also missing the `role` column  
3. No superadmin account existed in the database

## Resolution Implemented

### 1. Database Schema Migration ✅

Added `role` column to both tables with PostgreSQL:

```sql
-- Added to admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin';

-- Added to admin_requests table
ALTER TABLE admin_requests 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin';
```

**Result:** Both tables now have role column with default value 'admin'

### 2. Superadmin Account Created ✅

Created initial superadmin account in database:

```sql
INSERT INTO admins (email, password, name, username, role) 
VALUES (
  'superadmin@cricket.com',
  '$2a$10$YIjlrHgF2Y.8d5EqQxs5meJxEqJbANMrz0I7dKVJxfKWFwNW2U3Ui',
  'Super Administrator',
  'superadmin',
  'superadmin'
)
```

**Credentials:**
- Email: `superadmin@cricket.com`
- Password: `admin@123` (bcrypt hashed)
- Username: `superadmin`
- Role: `superadmin`

### 3. Code Fix - auth.ts ✅

Updated login logic to properly use the role from database:

```typescript
// BEFORE
if (adminResult.rows.length > 0) {
  user = adminResult.rows[0];
  role = user.role || 'admin'; // Default to admin if role not specified
}

// AFTER
if (adminResult.rows.length > 0) {
  user = adminResult.rows[0];
  role = user.role as 'superadmin' | 'admin' | 'user'; // Use role from database
}
```

**Why this matters:** 
- Ensures the role from the database (which can be 'superadmin', 'admin', or 'user') is properly typed and used
- Prevents type coercion issues with TypeScript

## Database Structure - Current State

### admins table
```
Column      | Type              | Default
------------|-------------------|------------------
id          | integer           | AUTO_INCREMENT
email       | varchar(255)      | NOT NULL
password    | varchar(255)      | NOT NULL
name        | varchar(255)      | NULL
username    | varchar(100)      | NOT NULL
role        | varchar(20)       | 'admin' ✅ NEW
permissions | text[]            | NULL
created_at  | timestamp         | CURRENT_TIMESTAMP
updated_at  | timestamp         | CURRENT_TIMESTAMP
```

### admin_requests table
```
Column                | Type              | Default
----------------------|-------------------|------------------
id                    | integer           | AUTO_INCREMENT
email                 | varchar(255)      | NOT NULL
password              | varchar(255)      | NOT NULL
name                  | varchar(255)      | NULL
username              | varchar(100)      | NOT NULL
role                  | varchar(20)       | 'admin' ✅ NEW
status                | varchar(50)       | 'pending'
requested_by_email    | varchar(255)      | NULL
approved_by_admin_id  | integer           | NULL
approved_at           | timestamp         | NULL
rejection_reason      | text              | NULL
created_at            | timestamp         | CURRENT_TIMESTAMP
updated_at            | timestamp         | CURRENT_TIMESTAMP
```

## Users in Database

### Admins table:
```
ID | Email                  | Username  | Role
---|------------------------|-----------|----------
1  | admin@cricket.com      | admin_1   | admin
2  | admin1@gmail.com       | admin_2   | admin
3  | superadmin@cricket.com | superadmin| superadmin ✅ NEW
```

## Testing the Fix

### Test Case 1: Superadmin Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"superadmin@cricket.com",
    "password":"admin@123"
  }'
```

**Expected Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "user": {
    "id": 3,
    "email": "superadmin@cricket.com",
    "username": "superadmin",
    "role": "superadmin",
    "name": "Super Administrator"
  }
}
```

### Test Case 2: Admin Registration Request
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"newadmin@example.com",
    "password":"admin@123",
    "username":"newadmin",
    "name":"New Admin",
    "role":"admin"
  }'
```

**Expected Response:**
```json
{
  "message": "Admin request submitted for approval. An existing superadmin must approve your request.",
  "data": {
    "id": 1,
    "email": "newadmin@example.com",
    "username": "newadmin",
    "role": "admin",
    "status": "pending"
  }
}
```

### Test Case 3: Approve Admin Request (Superadmin Only)
```bash
curl -X POST http://localhost:5000/api/auth/admin-requests/1/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <superadmin_token>"
```

## Role-Based Access Matrix

| Feature | Superadmin | Admin | User |
|---------|-----------|-------|------|
| Add Match | ✅ | ❌ | ❌ |
| Delete Match | ✅ | ❌ | ❌ |
| Live Scoring | ❌ | ✅ | ❌ |
| View Matches | ✅ | ✅ | ✅ |
| Approve Requests | ✅ | ❌ | ❌ |
| Player Descriptions | ❌ | ✅ | ❌ |
| Simulations | ❌ | ✅ | ❌ |

## Files Modified in This Fix

1. **Database Migration** (manual via psql)
   - Added `role` column to `admins` table
   - Added `role` column to `admin_requests` table

2. **Backend Code** - `/home/admin1/WORK/CricketNewsApp/apps/api/src/routes/auth.ts`
   - Line 147: Changed from `role = user.role || 'admin'` to `role = user.role as 'superadmin' | 'admin' | 'user'`
   - Ensures proper type casting and role retrieval from database

## Verification

✅ **TypeScript Compilation:** Zero errors in backend
✅ **Database Schema:** role columns added with proper defaults
✅ **Superadmin Account:** Created and verified in database
✅ **Login Logic:** Fixed to use database role properly
✅ **Type Safety:** Proper TypeScript typing enforced

## Next Steps for Deployment

1. **Database Backup** (Recommended before production)
   ```bash
   pg_dump -U postgres -d cricket > backup_$(date +%Y%m%d).sql
   ```

2. **Verify Frontend** 
   - Frontend already updated to support superadmin role
   - Header shows color-coded badges
   - Buttons hidden based on user role

3. **Test All Three Roles**
   - Login as superadmin
   - Register and approve an admin
   - Login as regular user
   - Verify each role's access to features

4. **Documentation**
   - Communicate to users about new superadmin account
   - Document the role hierarchy
   - Provide guides for approving new admins

## Important Notes

- **Superadmin Password:** The password `admin@123` should be changed immediately after first login
- **Role Propagation:** Existing admins default to 'admin' role - no manual change needed
- **Backward Compatibility:** All existing functionality preserved
- **Token Structure:** JWT tokens now properly include role for all three types

## Troubleshooting

If login still fails:

1. **Verify Database Connection:**
   ```bash
   PGPASSWORD=root psql -h localhost -U postgres -d cricket -c "SELECT * FROM admins;"
   ```

2. **Check Password Hashing:**
   ```bash
   PGPASSWORD=root psql -h localhost -U postgres -d cricket \
   -c "SELECT email, role, password FROM admins WHERE email='superadmin@cricket.com';"
   ```

3. **Verify API is Running:**
   ```bash
   curl -s http://localhost:5000/api/auth/me -H "Authorization: Bearer <token>"
   ```

4. **Check Backend Logs:**
   - Look for any database connection errors
   - Verify the role column is being queried correctly
   - Ensure bcrypt comparison is working

---

**Status:** ✅ COMPLETE - All database fixes implemented, superadmin account created, code updated and compiled successfully.
