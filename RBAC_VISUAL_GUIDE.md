# Role-Based Access Control - Visual Guide

## User Role Hierarchy

```
                    ┌─────────────────────┐
                    │     Superadmin      │
                    │   [RED BADGE]       │
                    │   🔴 All Authority  │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
          ┌─────────▼──────────┐  ┌──────▼──────────┐
          │      Admin         │  │      User       │
          │  [AMBER BADGE]     │  │  [LIME BADGE]   │
          │  🟠 Live Ops       │  │  🟢 Read Only   │
          └────────────────────┘  └─────────────────┘
```

---

## Features & Permissions Overview

### 🔴 Superadmin (Red)

**Primary Role**: Match Management & System Administration

#### Dashboard Access
- View all matches ✅
- View scorecards ✅
- View insights & statistics ✅
- Admin panel ✅

#### Match Operations
```
┌─────────────────────────────────┐
│ Match Management                │
├─────────────────────────────────┤
│ ✅ Add new matches              │
│ ✅ Delete matches               │
│ ❌ Live ball entry              │
│ ❌ Player descriptions          │
└─────────────────────────────────┘
```

#### Administrative Functions
```
┌─────────────────────────────────┐
│ System Administration           │
├─────────────────────────────────┤
│ ✅ View pending requests        │
│ ✅ Approve admin requests       │
│ ✅ Reject admin requests        │
│ ✅ Create superadmin accounts   │
└─────────────────────────────────┘
```

#### Badge Display
```
┌──────────────────┐
│ 🔴 SUPER ADMIN   │  Red background
│                  │  High authority
└──────────────────┘
```

---

### 🟠 Admin (Amber)

**Primary Role**: Live Operations & Data Management

#### Dashboard Access
- View all matches ✅
- View scorecards ✅
- View insights & statistics ✅

#### Match Operations
```
┌─────────────────────────────────┐
│ Match Management                │
├─────────────────────────────────┤
│ ❌ Add new matches              │
│ ❌ Delete matches               │
│ ✅ Live ball entry              │
│ ✅ Player descriptions          │
│ ✅ Match simulations            │
└─────────────────────────────────┘
```

#### Live Scoring Features
```
┌─────────────────────────────────┐
│ Live Operations                 │
├─────────────────────────────────┤
│ ✅ Add ball entries             │
│ ✅ Record wickets               │
│ ✅ Track extras                 │
│ ✅ Create player insights       │
│ ✅ Run simulations              │
└─────────────────────────────────┘
```

#### Badge Display
```
┌──────────────────┐
│ 🟠 ADMIN         │  Amber background
│                  │  Data ops authority
└──────────────────┘
```

---

### 🟢 User (Lime)

**Primary Role**: Viewing & Analysis (Read-Only)

#### Dashboard Access
- View all matches ✅
- View scorecards ✅
- View insights & statistics ✅

#### Match Operations
```
┌─────────────────────────────────┐
│ Match Management                │
├─────────────────────────────────┤
│ ❌ Add new matches              │
│ ❌ Delete matches               │
│ ❌ Live ball entry              │
│ ❌ Player descriptions          │
│ ❌ Match simulations            │
│ ✅ View everything              │
└─────────────────────────────────┘
```

#### Read-Only Features
```
┌─────────────────────────────────┐
│ Available Features              │
├─────────────────────────────────┤
│ ✅ View match details           │
│ ✅ View full scorecards         │
│ ✅ View player stats            │
│ ✅ View team information        │
│ ✅ View live updates (view only)│
└─────────────────────────────────┘
```

#### Badge Display
```
┌──────────────────┐
│ 🟢 USER          │  Lime background
│                  │  Viewer access
└──────────────────┘
```

---

## UI Component Visibility

### Header Dropdown Menu

```
Authenticated User
├── User Info Card
│   ├── Avatar
│   ├── Username
│   └── [Role Badge]
│       ├── 🔴 Super Administrator (Superadmin)
│       ├── 🟠 Administrator (Admin)
│       └── 🟢 User (Regular User)
├── [Conditional] Admin Request Link
│   └── ✅ Shown for Superadmin & Admin
└── Logout Button
```

### Matches Page Buttons

#### No Matches State
```
┌─────────────────────────────────────┐
│         No Matches Available        │
├─────────────────────────────────────┤
│                                     │
│  [+] Add Match                      │  ← Only Superadmin
│                                     │
└─────────────────────────────────────┘
```

#### Match Card Actions
```
┌─────────────────────────────────────────────┐
│ Team A vs Team B                            │
├─────────────────────────────────────────────┤
│                                             │
│ [📊 View Insights] [📋 Full Scorecard]     │
│ [🔥 Live Entry]            [🗑️ Delete]     │
│                                             │
│ Notes:                                      │
│ - 🔥 Live Entry: Admin & Superadmin only   │
│ - 🗑️ Delete: Superadmin only               │
│ - 📊 & 📋: All authenticated users         │
│                                             │
└─────────────────────────────────────────────┘
```

---

## API Endpoint Access Matrix

```
╔════════════════════════════════╦════════════╦═════════╦══════╗
║ Endpoint                       ║ Superadmin ║ Admin   ║ User ║
╠════════════════════════════════╬════════════╬═════════╬══════╣
║ GET /api/matches               ║     ✅     ║    ✅   ║  ✅  ║
║ GET /api/matches/:id           ║     ✅     ║    ✅   ║  ✅  ║
║ GET /api/matches/:id/scorecard ║     ✅     ║    ✅   ║  ✅  ║
║ GET /api/matches/:id/insights  ║     ✅     ║    ✅   ║  ✅  ║
║ POST /api/matches              ║     ✅     ║    ❌   ║  ❌  ║
║ DELETE /api/matches/:id        ║     ✅     ║    ❌   ║  ❌  ║
║ POST /api/matches/:id/ball     ║     ❌     ║    ✅   ║  ❌  ║
║ POST /api/matches/:id/simulate ║     ❌     ║    ✅   ║  ❌  ║
║ POST /api/auth/admin-requests  ║     ❌     ║    ❌   ║  ❌  ║
║ GET /api/auth/admin-requests   ║     ✅     ║    ❌   ║  ❌  ║
║ POST /api/auth/.../approve     ║     ✅     ║    ❌   ║  ❌  ║
║ POST /api/auth/.../reject      ║     ✅     ║    ❌   ║  ❌  ║
║ POST /api/player-descriptions  ║     ❌     ║    ✅   ║  ❌  ║
╚════════════════════════════════╩════════════╩═════════╩══════╝
```

---

## User Journey

### Superadmin Flow
```
1. Register as Superadmin
        ↓
2. Request sent to existing Superadmin
        ↓
3. Superadmin approves request
        ↓
4. Account created, login
        ↓
5. Can add/delete matches and manage system
        ↓
6. Cannot access live scoring page
```

### Admin Flow
```
1. Register as Admin
        ↓
2. Request sent to Superadmin
        ↓
3. Superadmin approves request
        ↓
4. Account created, login
        ↓
5. Can access live scoring & manage data
        ↓
6. Cannot add/delete matches
```

### User Flow
```
1. Register as User
        ↓
2. Immediately approved (no request needed)
        ↓
3. Login with credentials
        ↓
4. Access matches dashboard
        ↓
5. View matches, scorecards, insights
        ↓
6. Cannot modify any data
```

---

## Color Coding System

```
Authentication Level    Color    Hex       Badge Style
─────────────────────   ──────   ────────  ────────────────────
Superadmin              Red      #EF4444   🔴 Super Admin
Admin                   Amber    #FBBF24   🟠 Administrator
User                    Lime     #A3E635   🟢 User

Additional Colors
─────────────────────────────────────────────────────────────
Live (Active)           Green    #22C55E   🟩 LIVE
Restricted              Red      #DC2626   🔴 Restricted
Warning                 Orange   #F97316   🟠 Warning
Success                 Emerald  #10B981   ✅ Success
```

---

## Navigation & Access Control

### Main Navigation Bar
```
┌──────────────────────────────────────────────────┐
│ CricketLive | Home | Matches | Teams | Live ... │
├──────────────────────────────────────────────────┤
│                          [User Dropdown] [LIVE]  │
└──────────────────────────────────────────────────┘

Notes:
- "Live Scoring" nav link only shows for Admin/Superadmin
- User dropdown always accessible for authenticated users
- [LIVE] indicator shows app is active
```

### Conditional Navigation
```
Superadmin sees:
└── /admin-requests (Approve pending requests)

Admin sees:
└── /admin-requests (View only - disabled/hidden)

User sees:
└── (No admin links)
```

---

## Response Codes & Messages

```
┌────┬─────────────────────────────────┬─────────────────────┐
│Code│ Scenario                        │ Message             │
├────┼─────────────────────────────────┼─────────────────────┤
│200 │ Success                         │ OK                  │
│201 │ Resource created                │ Created             │
│401 │ Not authenticated               │ No token provided   │
│403 │ Authenticated but unauthorized  │ Insufficient perms  │
│404 │ Resource not found              │ Not found           │
│500 │ Server error                    │ Server error        │
└────┴─────────────────────────────────┴─────────────────────┘
```

---

## Registration Decision Tree

```
User clicks Register
        ↓
Choose role:
├── [User]
│   ├── Fills form
│   ├── Immediate registration
│   └── Gets token + login
│
├── [Admin]
│   ├── Fills form
│   ├── Request sent to superadmin
│   ├── Superadmin approves/rejects
│   └── Account created if approved
│
└── [Superadmin]
    ├── Fills form
    ├── Request sent to existing superadmin
    ├── Superadmin approves/rejects
    └── Account created if approved
```

---

## Summary Table

```
╔═══════════════════════════════════════════════════════════╗
║                    ROLE CAPABILITIES                      ║
╠════════════════════╦══════════════╦═════════════╦═════════╣
║ Capability         ║  Superadmin  ║    Admin    ║  User   ║
╠════════════════════╬══════════════╬═════════════╬═════════╣
║ View Matches       ║      ✅      ║     ✅      ║   ✅    ║
║ View Scorecard     ║      ✅      ║     ✅      ║   ✅    ║
║ View Insights      ║      ✅      ║     ✅      ║   ✅    ║
║ Add Match          ║      ✅      ║     ❌      ║   ❌    ║
║ Delete Match       ║      ✅      ║     ❌      ║   ❌    ║
║ Live Scoring       ║      ❌      ║     ✅      ║   ❌    ║
║ Admin Requests     ║      ✅      ║     ❌      ║   ❌    ║
║ Player Desc        ║      ❌      ║     ✅      ║   ❌    ║
║ Run Simulations    ║      ❌      ║     ✅      ║   ❌    ║
╚════════════════════╩══════════════╩═════════════╩═════════╝
```

---

## Visual Wireframe: Matches Page

```
┌─────────────────────────────────────────────────────────┐
│ ⚡ CricketLive │ Home │ Matches │ Teams │ Live Scoring  │
│                                            [User] [LIVE]│
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Match Center                  [✨ ADD MATCH] (Superadmin)
│ 🔴 Live Matches                                          │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐│
│ │ Team A    45/2                                       ││
│ │ vs                                                   ││
│ │ Team B    38/1                                       ││
│ │                                                      ││
│ │ [📊] [📋] [🔥] [🗑️]                                  ││
│ │       (Only shown if admin/superadmin)              ││
│ └──────────────────────────────────────────────────────┘│
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

✅ **Clear Role Definition** - Each role has distinct responsibilities  
✅ **Visual Distinction** - Color coding makes roles immediately obvious  
✅ **Intuitive UI** - Buttons appear/disappear based on role  
✅ **Secure Backend** - All authorization checked server-side  
✅ **Consistent Flow** - Registration, login, and access follow logical patterns  

