# Role-Based Access Control - Quick Reference Guide

## Quick Summary

Three user roles implemented:
- **Superadmin** (Red) - Manages matches (add/delete), approves requests
- **Admin** (Amber) - Handles live scoring, data management
- **User** (Lime) - Views matches only

---

## For Developers

### Adding Role Protection to New Routes

**Backend (Express):**
```typescript
import { verifyToken, isSuperadmin, isAdmin, isAuthenticated } from '../middleware/auth.ts';

// For any authenticated user
router.get('/endpoint', verifyToken, (req, res) => {
  // Access req.user.role
});

// For admin and superadmin only
router.post('/endpoint', verifyToken, isAdmin, (req, res) => {
  // req.user.role is 'admin' or 'superadmin'
});

// For superadmin only
router.delete('/endpoint', verifyToken, isSuperadmin, (req, res) => {
  // req.user.role is 'superadmin'
});
```

**Frontend (React):**
```tsx
import { useAuth } from '@/context/AuthContext';

export default function Component() {
  const { user, isAdmin, isSuperadmin } = useAuth();

  return (
    <>
      {user?.role === 'superadmin' && (
        <button>Superadmin Only</button>
      )}
      {isAdmin && (
        <button>Admin & Superadmin</button>
      )}
      {user && (
        <p>For all authenticated users</p>
      )}
    </>
  );
}
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `apps/api/src/middleware/auth.ts` | Added `isSuperadmin()`, `isAuthenticated()` middleware |
| `apps/api/src/routes/auth.ts` | Updated role type, admin request approval for superadmin only |
| `apps/api/src/routes/matches.ts` | POST/DELETE require superadmin, POST ball requires admin |
| `apps/api/src/routes/simulation.ts` | Added admin auth requirement |
| `apps/api/src/routes/playerDescriptions.ts` | Added admin auth to POST |
| `apps/web/context/AuthContext.tsx` | Added `isSuperadmin` property, updated role type |
| `apps/web/app/components/Header.tsx` | Color-coded role badges, updated dropdown |
| `apps/web/app/matches/page.tsx` | Role-based button visibility, added Live Entry |
| `apps/web/app/ball-entry/page.tsx` | Added admin role check |

---

## Testing the Implementation

### 1. Create Test Accounts

**Superadmin Registration:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@test.com",
    "password": "password123",
    "username": "superadmin",
    "role": "superadmin"
  }'
# Response: Request submitted for approval
# (Approve manually in database or through another superadmin)
```

**Admin Registration:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "password123",
    "username": "admin_user",
    "role": "admin"
  }'
# Response: Request submitted for approval
```

**User Registration:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "password123",
    "username": "regular_user",
    "role": "user"
  }'
# Response: Immediate registration with token
```

### 2. Test Role-Based Access

**Test Add Match (Superadmin only):**
```bash
curl -X POST http://localhost:5000/api/matches \
  -H "Authorization: Bearer {SUPERADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "team1": 1,
    "team2": 2,
    "date": "2024-01-01",
    "venue": "Stadium"
  }'
# Status 201: Success
# With admin token: Status 403: Forbidden
# With user token: Status 403: Forbidden
```

**Test Delete Match (Superadmin only):**
```bash
curl -X DELETE http://localhost:5000/api/matches/1 \
  -H "Authorization: Bearer {SUPERADMIN_TOKEN}"
# Status 200: Success
# With admin token: Status 403: Forbidden
```

**Test Live Scoring (Admin only):**
```bash
curl -X POST http://localhost:5000/api/matches/1/ball \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": 1,
    "overNumber": 1,
    "ballNumber": 1,
    "runs": 2,
    "batsmanId": 1,
    "bowlerId": 2,
    "battingTeamId": 1
  }'
# Status 201: Success
# With superadmin token: Status 403: Forbidden
# With user token: Status 403: Forbidden
```

---

## Database Setup (If Needed)

Ensure `admins` and `admin_requests` tables have role column:

```sql
-- Check existing structure
\d admins
\d admin_requests

-- If role column doesn't exist, add it:
ALTER TABLE admins ADD COLUMN role VARCHAR(20) DEFAULT 'admin';
ALTER TABLE admin_requests ADD COLUMN role VARCHAR(20) DEFAULT 'admin';

-- Create initial superadmin (update as needed)
INSERT INTO admins (email, password, username, role)
VALUES ('superadmin@app.com', 'hashed_password', 'superadmin', 'superadmin');
```

---

## Common Issues & Solutions

### Issue: User can't access admin features after approval
**Solution:** Ensure `role` column is set in `admins` table during approval

### Issue: Role badge not showing in header
**Solution:** Check that user object is properly loaded in AuthContext. Add console.log to verify role

### Issue: Live Scoring button not visible for admins
**Solution:** Verify `user?.role === 'admin' || user?.role === 'superadmin'` condition

### Issue: Superadmin can't approve requests
**Solution:** Ensure request is in `admin_requests` table and status is 'pending'

---

## Performance Considerations

- Role checks are lightweight (single string comparison)
- Middleware runs before route handler (fast fail)
- No database queries for authorization (role in JWT token)
- UI updates based on local state (no extra API calls)

---

## Security Best Practices

✅ **Token-based auth** - Role encoded in JWT  
✅ **Middleware validation** - Server-side checks on all endpoints  
✅ **Client-side UX** - Buttons hidden for unauthorized users  
✅ **Error messages** - Generic 403 error without exposing system info  
✅ **Type safety** - TypeScript prevents role typos  

---

## Future Enhancements

- [ ] Activity logging for superadmin actions
- [ ] Role-based analytics dashboard
- [ ] Scheduled role assignments
- [ ] Audit trail for match operations
- [ ] Rate limiting per role
- [ ] Batch operations for superadmins
