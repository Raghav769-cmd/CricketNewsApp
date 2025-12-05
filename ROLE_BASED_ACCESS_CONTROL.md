# Role-Based Access Control (RBAC) Implementation

## Overview
Implemented a three-tier role-based access control system for the Cricket News App with the following user types:

### 1. **Superadmin**
- **Color Badge**: Red (#EF4444)
- **Can**:
  - Add new matches
  - Delete matches
  - View match details and scorecards
  - Approve/reject admin and superadmin registration requests
  - Access all features
- **Cannot**:
  - Access live scoring/ball entry
- **Key Endpoints**:
  - `POST /api/matches` - Add match
  - `DELETE /api/matches/:id` - Delete match
  - `GET /api/auth/admin-requests/pending` - View pending requests
  - `POST /api/auth/admin-requests/:id/approve` - Approve requests
  - `POST /api/auth/admin-requests/:id/reject` - Reject requests

### 2. **Admin**
- **Color Badge**: Amber (#FBBF24)
- **Can**:
  - View all matches and scorecards
  - Access live scoring/ball entry
  - Add balls to matches
  - Create player descriptions
  - Run match simulations
- **Cannot**:
  - Add or delete matches
  - Approve admin requests
- **Key Endpoints**:
  - `GET /api/matches` - View all matches
  - `POST /api/matches/:matchId/ball` - Add ball (live scoring)
  - `POST /api/matches/:matchId/simulate` - Simulate match
  - `POST /api/player-descriptions/matches/:matchId/players/:playerId/description` - Add descriptions

### 3. **Normal User (User)**
- **Color Badge**: Lime (#A3E635)
- **Can**:
  - View all matches
  - View match details and scorecards
  - View insights and statistics
- **Cannot**:
  - Add or delete matches
  - Access live scoring/ball entry
  - Add descriptions
  - Approve requests

---

## Changes Made

### Backend Changes

#### 1. **Authentication Middleware** (`apps/api/src/middleware/auth.ts`)
- Updated role type from `'admin' | 'user'` to `'superadmin' | 'admin' | 'user'`
- Added new middleware functions:
  - `isSuperadmin()` - Check if user is superadmin
  - Updated `isAdmin()` - Now checks for both admin and superadmin
  - `isAuthenticated()` - Check if user is authenticated (any role)
  - Updated `isAdminOrOwner()` - Now includes superadmin
- Updated token generation to support all three roles

#### 2. **Auth Routes** (`apps/api/src/routes/auth.ts`)
- Updated registration validation to accept `'superadmin' | 'admin' | 'user'`
- Updated login logic to handle superadmin role from database
- Changed admin request approval/rejection:
  - Now only superadmins can approve/reject
  - Requests now include the `role` field
  - New admins can be assigned either `admin` or `superadmin` role

#### 3. **Matches Routes** (`apps/api/src/routes/matches.ts`)
- `POST /api/matches` - Changed from `isAdmin` to `isSuperadmin` (add match)
- `DELETE /api/matches/:id` - Changed from `isAdmin` to `isSuperadmin` (delete match)
- `POST /api/matches/:matchId/ball` - Added `isAdmin` check (live scoring - admin only)

#### 4. **Other Routes**
- **Simulation** (`apps/api/src/routes/simulation.ts`):
  - Added `verifyToken` and `isAdmin` middleware to simulate endpoint
  
- **Player Descriptions** (`apps/api/src/routes/playerDescriptions.ts`):
  - Added `verifyToken` and `isAdmin` middleware to POST endpoint

### Frontend Changes

#### 1. **Auth Context** (`apps/web/context/AuthContext.tsx`)
- Updated `User` interface to include `'superadmin' | 'admin' | 'user'` roles
- Added `isSuperadmin` property to AuthContextType
- Updated `isAdmin` to return true for both admin and superadmin
- Updated registration messages for role-specific approval text

#### 2. **Header Component** (`apps/web/app/components/Header.tsx`)
- Role badges now display:
  - Red badge with "Super Admin" for superadmin
  - Amber badge with "Administrator" for admin
  - Lime badge with "User" for normal users
- Admin menu items visible for both admin and superadmin
- User info display in dropdown updated with role-specific colors

#### 3. **Matches Page** (`apps/web/app/matches/page.tsx`)
- "Add Match" button:
  - Now only visible to superadmins
  - Updated both top button and empty state button
  
- "Delete" button:
  - Now only visible to superadmins
  - Styled with red border
  
- "Live Entry" button:
  - Added new button for admin and superadmin users
  - Styled with orange gradient
  - Routes to `/matches/:id/ball-entry`
  - Visible alongside scorecard button

#### 4. **Ball Entry Page** (`apps/web/app/ball-entry/page.tsx`)
- Updated auth check to require admin or superadmin role
- Redirects non-admin users to login

---

## Database Changes (Future/Optional)

If not already present, ensure `admins` table has a `role` column:

```sql
ALTER TABLE admins ADD COLUMN role VARCHAR(20) DEFAULT 'admin';
ALTER TABLE admin_requests ADD COLUMN role VARCHAR(20) DEFAULT 'admin';
```

---

## Role Hierarchy

```
┌─────────────────────────────────────┐
│        Feature Access Matrix        │
├─────────────────────┬───────┬───────┤
│ Feature             │ Admin │ Super │
├─────────────────────┼───────┼───────┤
│ View Matches        │  ✓    │  ✓    │
│ View Scorecard      │  ✓    │  ✓    │
│ View Insights       │  ✓    │  ✓    │
│ Live Scoring        │  ✓    │  ✗    │
│ Add Match           │  ✗    │  ✓    │
│ Delete Match        │  ✗    │  ✓    │
│ Approve Requests    │  ✗    │  ✓    │
│ Player Descriptions │  ✓    │  ✗    │
│ Run Simulations     │  ✓    │  ✗    │
└─────────────────────┴───────┴───────┘
```

---

## Registration Flow

### Normal User
- Registers with role `user`
- Immediately gets access
- Can view matches only

### Admin
- Registers with role `admin`
- Request sent for superadmin approval
- Upon approval, becomes admin
- Can access live scoring and manage match data

### Superadmin
- Registers with role `superadmin`
- Request sent for superadmin approval
- Upon approval, becomes superadmin
- Can manage matches (add/delete) and approve requests
- Cannot access live scoring

---

## API Authentication

All protected endpoints now use:

```typescript
// For viewing only (any authenticated user)
router.get('/endpoint', verifyToken, ...)

// For admin features (admin + superadmin)
router.post('/endpoint', verifyToken, isAdmin, ...)

// For superadmin features (superadmin only)
router.delete('/endpoint', verifyToken, isSuperadmin, ...)
```

---

## Testing Recommendations

1. **Register as each role** and verify:
   - UI shows correct buttons and badges
   - Navigating to restricted pages redirects appropriately
   - API calls return correct 403 errors

2. **Test Superadmin**:
   - Can add/delete matches
   - Cannot access live scoring
   - Can approve admin requests
   - Badge shows as Red "Super Admin"

3. **Test Admin**:
   - Cannot add/delete matches
   - Can access live scoring
   - Cannot approve requests
   - Badge shows as Amber "Administrator"

4. **Test User**:
   - Can only view matches and scorecards
   - Cannot see Live Scoring button
   - Cannot see Add/Delete buttons
   - Badge shows as Lime "User"

---

## Clean Code Principles Applied

✅ **Single Responsibility** - Each middleware has one job  
✅ **DRY** - Reusable middleware across routes  
✅ **Type Safety** - Strong typing with TypeScript  
✅ **Consistency** - Uniform error handling and response formats  
✅ **Clarity** - Clear role definitions and permissions  
✅ **Maintainability** - Centralized role checking logic  
