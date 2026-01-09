# Cricket News App - Complete Documentation

> **⚠️ DEVELOPMENT ONLY** - Project in active development

---

## 📋 Quick Start (5 minutes)

### Prerequisites
- Node.js (v18+)
- PostgreSQL running
- Git

### Setup Steps
```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment variables
# Backend: apps/api/.env
DB_HOST=localhost
DB_NAME=cricket_db
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=your_jwt_secret
PORT=5000

# Frontend: apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5000

# 3. Start servers
cd apps/api && npm run dev          # Terminal 1 (Backend on port 5000)
cd apps/web && npm run dev          # Terminal 2 (Frontend on port 3000)

# 4. Open browser
# Visit http://localhost:3000
```

### Test Credentials
- **Email**: admin@test.com
- **Password**: admin123
- **Role**: Superadmin

---

## 🏗️ Project Architecture

```
Cricket News App (Monorepo using Turborepo)
├── apps/
│   ├── api/              (Express.js Backend)
│   │   └── src/
│   │       ├── routes/   (API endpoints)
│   │       ├── middleware/ (Auth, validation)
│   │       └── db/       (Database connection)
│   └── web/              (Next.js Frontend)
│       └── app/
│           ├── matches/  (Match pages)
│           ├── teams/    (Team pages)
│           ├── ball-entry/ (Admin form)
│           └── components/ (Reusable UI)
└── packages/
    ├── ui/               (Shared components)
    ├── typescript-config/ (TS config)
    └── eslint-config/    (Lint rules)
```

---

## 🛠️ Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Frontend** | Next.js | 16.0.1 |
| | React | 19 |
| | Tailwind CSS | 4.1.17 |
| | TypeScript | 5.9.3 |
| **Backend** | Express.js | 5.1.0 |
| | Node.js | 18+ |
| **Database** | PostgreSQL | 12+ |
| **Real-time** | Socket.io | 4.8.1 |
| **Authentication** | JWT + bcryptjs | - |
| **State Management** | Zustand | 5.5.5 |
| **Forms** | React Hook Form + Zod | Latest |
| **Build Tool** | Turborepo | - |

---

## 📊 Database Structure

### Core Tables

**teams**
- Team name, location, year founded
- Teams play in matches

**players**
- Player name, role (batsman/bowler/all-rounder), jersey number
- Linked to teams

**matches**
- Team A vs Team B, venue, format (1-Over/T20/ODI/Test)
- Status: pending/ongoing/completed
- Stores inning team IDs for all 4 innings

**overs**
- Linked to matches, over number (1-50)
- Tracks balls in each over

**balls**
- Individual ball data: runs, extras, bowler, batsman, wicket info
- Linked to overs

**player_stats**
- Auto-calculated statistics per player per format
- Runs, balls, wickets, economy, strike rate, centuries

**player_descriptions**
- Admin notes about player performance
- Per match, per player

**stadiums**
- Venue information

**users (Regular Users, Admins)**
- Email, username, password (hashed), role
- JWT authentication

**admin_requests**
- Users requesting admin access
- Superadmin approval needed

---

## 🎯 Core Features

### 1. **Match Management**
- Create new matches (Admin only)
- Auto-format detection: 1-Over (≤1), T20 (≤20), ODI (≤50), Test (>50)
- Live score tracking
- Match status: pending → ongoing → completed

### 2. **Ball-by-Ball Entry** (Admin only)
- Add runs, extras, wickets one ball at a time
- Auto-select batting team for Test cricket (Inning 1,3 = Team A; Inning 2,4 = Team B)
- Auto-calculations:
  - ✅ Runs aggregation
  - ✅ Strike rate: (Runs ÷ Balls) × 100
  - ✅ Economy rate: Runs ÷ Overs bowled
  - ✅ Maiden overs: Over with 0 runs (detected on 6th ball)
  - ✅ All-out detection: 10 wickets = inning ends
  - ✅ Inning transition: Auto-move to next inning

### 3. **Live Scorecard**
- Batting table: Player, Runs, Balls, 4s, 6s, Strike Rate
- Bowling table: Bowler, Balls, Runs, Wickets, Economy Rate
- Team totals: Runs, Wickets, Overs

### 4. **Player Statistics**
- Per format tracking (1-Over, T20, ODI, Test)
- Career stats: Runs, Balls, Strike Rate, 4s, 6s, Centuries
- Bowling stats: Wickets, Runs Conceded, Economy, Maiden Overs

### 5. **Teams & Players**
- Browse teams
- View player roster
- Team statistics across all formats

### 6. **Player Descriptions** (Admin only)
- Write detailed performance notes per match
- Example: "Virat scored 87 off 52 balls with 10 fours and 1 six. Got out at deep square leg."

### 7. **Authentication & Roles**
- **Regular User**: View matches, teams, stats
- **Admin**: Create matches, add balls, write descriptions
- **Superadmin**: Manage users, approve admin requests

### 8. **Real-Time Updates**
- WebSocket (Socket.io) for live score updates
- Instant stat changes
- Inning transitions broadcast

---

## 📱 Pages & Routes

| Route | Purpose | Who Can Access |
|-------|---------|----------------|
| `/` | Home page with featured matches | Everyone |
| `/register` | Create new account | Everyone |
| `/login` | Login page | Everyone |
| `/matches` | Browse all matches | Everyone |
| `/matches/:id` | Match details & scorecard | Everyone |
| `/matches/:id/player-descriptions` | Write player notes | Admin only |
| `/teams` | Browse teams | Everyone |
| `/teams/:teamId` | Team details & roster | Everyone |
| `/ball-entry` | Create match & add balls | Admin only |
| `/admin-requests` | Manage admin approvals | Superadmin only |

---

## 🔐 Authentication

### Registration
```
Email + Username + Password + Name → Account Created
```

### Login
```
Email + Password → JWT Token → Stay Logged In
```

### JWT Token
- Issued on login
- Contains user ID and role
- Stored in browser (secure)
- Used for all API requests
- Auto-logout when expired

### Roles
1. **Regular User** - View-only access
2. **Admin** - Can create matches, add balls
3. **Superadmin** - Full system access

---

## 🎮 How to Use (User Guide)

### For Regular Users

**1. View Home Page**
- See featured matches
- Browse team updates
- Click on match for details

**2. Browse Matches**
- Go to `/matches`
- See all ongoing/completed matches
- Click on any match

**3. View Scorecard**
- See batting and bowling stats
- View player performance
- Read player descriptions (if available)

**4. Check Player Stats**
- Click player name on match page
- See career statistics
- Compare across formats

**5. Browse Teams**
- Go to `/teams`
- See all teams
- View player rosters

### For Admin Users

**1. Create New Match**
- Go to `/ball-entry`
- Select Team A and Team B
- Select Stadium
- Number of overs auto-generates format

**2. Add Balls**
- Select Over (1-50) and Ball (0-5)
- Enter runs (0-6)
- Select bowler and batsman
- Mark if wicket occurred
- Add extras if any (wide, no-ball, etc.)
- System auto-calculates everything

**3. Track Match Progress**
- See live score update
- Monitor batting team
- Check statistics in real-time
- See wicket alerts

**4. Complete Match**
- When overs end or team all-out: System auto-completes inning
- Next batting team auto-selected (Test cricket)
- Match ends when all innings complete

**5. Write Player Descriptions**
- Go to `/matches/:id/player-descriptions`
- Select player
- Write performance notes
- Notes visible to all users

### For Superadmin

**1. Manage Users**
- Go to `/admin-requests`
- See admin approval requests
- Approve or reject

**2. Monitor System**
- View all users
- Track match activities
- System oversight

---

## 📊 Statistics Explained

### Batting Statistics
- **Runs**: Total runs scored
- **Balls**: Total balls faced
- **Strike Rate**: (Runs ÷ Balls) × 100
  - Example: 50 runs, 40 balls = 125.00 strike rate
- **4s**: Boundaries (4-run hits)
- **6s**: Sixes (6-run hits)
- **Centuries**: Score ≥ 100 (counts +1)
- **Half-Centuries**: Score ≥ 50 and < 100

### Bowling Statistics
- **Wickets**: Number of batsmen dismissed
- **Runs Conceded**: Total runs given away
- **Overs**: Balls bowled ÷ 6
- **Economy Rate**: Runs ÷ Overs
  - Example: 24 runs in 4 overs = 6.00 economy
- **Maiden Overs**: Over with 0 runs (detected when 6th ball is bowled with 0 total runs)
- **Best Bowling**: Best performance (wickets-runs format)

---

## 🏏 Cricket Formats

| Format | Overs | Innings | Match Length |
|--------|-------|---------|--------------|
| 1-Over | 1 | 2 | ~5 min |
| T20 | 20 | 2 | ~3 hours |
| ODI | 50 | 2 | ~8 hours |
| Test | >50 | 4 | 5 days |

### Special Rules
- **Test Cricket**: Team bats twice (2 innings each). Auto-team rotation.
  - Inning 1: Team A bats
  - Inning 2: Team B bats
  - Inning 3: Team A bats again
  - Inning 4: Team B bats again
- **All Formats**: Match ends when:
  - All innings complete, OR
  - Team loses 10 wickets

---

## 🔧 Key Bug Fixes & Features

### ✅ Maiden Over Calculation
**Issue**: Maidens not calculating
**Fix**: Only count on 6th ball of over, verify total runs = 0
**Result**: Accurate maiden tracking

### ✅ Test Match Team Selection
**Issue**: Same team appearing in multiple innings
**Fix**: Store inning2_team_id, inning3_team_id, inning4_team_id
**Result**: Correct team auto-selected for each inning

### ✅ Bowling Scorecard Display
**Issue**: Bowling data not visible
**Fix**: Added bowling table alongside batting table
**Result**: Complete scorecard visibility

### ✅ Auto-Select Batting Team
**Issue**: Manual team selection for every ball
**Fix**: Auto-select based on current inning
**Result**: Faster ball entry

---

## 🔌 API Endpoints

### Match Routes
```
POST   /api/matches              Create match
GET    /api/matches              Get all matches
GET    /api/matches/:id          Get match details
GET    /api/matches/:id/scorecard  Get scorecard data
```

### Ball Routes
```
POST   /api/matches/:id/add-ball  Add new ball
```

### Team Routes
```
GET    /api/teams                Get all teams
GET    /api/teams/:id            Get team details
```

### Player Routes
```
GET    /api/players              Get all players
GET    /api/players/:id/stats    Get player stats
```

### Auth Routes
```
POST   /api/auth/register        Create account
POST   /api/auth/login           Login user
```

### Admin Routes
```
GET    /api/admin/requests       Get admin requests
POST   /api/admin/requests/:id/approve  Approve request
POST   /api/admin/requests/:id/reject   Reject request
POST   /api/players/:id/description     Add player description
```

---

## 📁 Project Structure

```
apps/api/src/
├── index.ts              Server entry point
├── server.ts             Express app setup
├── middleware/
│   └── auth.ts          JWT verification
├── routes/
│   ├── auth.ts          Login/Register
│   ├── matches.ts       Match management (ALL LOGIC HERE)
│   ├── teams.ts         Team endpoints
│   ├── players.ts       Player endpoints
│   ├── playerStats.ts   Statistics endpoints
│   ├── stadiums.ts      Stadium data
│   └── simulation.ts    Test data
└── db/
    └── connection.js    PostgreSQL pool

apps/web/app/
├── layout.tsx           Root layout
├── page.tsx             Home page
├── login/               Auth pages
├── register/
├── matches/
│   ├── page.tsx        Match list
│   └── [id]/
│       ├── page.tsx    Match scorecard (MAIN PAGE)
│       └── player-descriptions/page.tsx
├── teams/
│   ├── page.tsx        Team list
│   └── [teamId]/page.tsx Team details
├── ball-entry/
│   ├── page.tsx        Admin form container
│   ├── client.tsx      Form logic (AUTO-SELECT HERE)
│   └── fetch-data.ts   API fetching
└── components/
    ├── Header.tsx      Navigation
    ├── Footer.tsx
    ├── AddMatchForm.tsx Form component
    └── PlayerStatsCard.tsx
```

---

## 🚀 Common Workflows

### Workflow 1: Create & Track Match
1. Admin → `/ball-entry` → Select teams & stadium
2. Match created automatically
3. Admin adds balls one by one
4. Users see live score update instantly
5. When overs end or all-out: Inning auto-completes
6. Next team auto-selected (Test cricket)
7. Admin continues for remaining innings
8. Match ends → Final scorecard displays

### Workflow 2: View Live Match
1. User → `/matches`
2. Click on "Team A vs Team B"
3. See live score at top
4. See batting scorecard
5. See bowling scorecard
6. Click player name for stats
7. Read player descriptions (if written)

### Workflow 3: Request Admin Access
1. User registers as Regular User
2. User goes to home page
3. Click "Request Admin Access"
4. Superadmin reviews request
5. Superadmin approves/rejects
6. User notified
7. If approved: Admin features unlock

---

## ⚙️ Configuration Files

### Backend Configuration
```bash
# apps/api/.env
DB_HOST=localhost
DB_NAME=cricket_db
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=your_secret_key
PORT=5000
NODE_ENV=development
```

### Frontend Configuration
```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Database Setup
PostgreSQL must have these tables:
- teams, players, matches, overs, balls
- player_stats, player_descriptions, stadiums
- regular_users, admins, admin_requests

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| **Port 5000 already in use** | `kill -9 $(lsof -t -i:5000)` or change PORT in .env |
| **Database connection failed** | Check DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in .env |
| **Frontend not connecting to API** | Verify NEXT_PUBLIC_API_URL points to backend URL |
| **Stats not updating** | Check socket.io connection, refresh page |
| **Login not working** | Verify JWT_SECRET is set in .env, check database has users table |
| **Maiden overs showing wrong count** | Ensure you're on latest code, re-run match |
| **Test match team wrong** | Ensure all inning team IDs are set in database |
| **Ball entry form slow** | Check network latency, try refreshing page |

---

## 📈 Performance Tips

- ✅ Use indexed queries on teams, players, matches tables
- ✅ Connection pooling for database (pg-pool)
- ✅ WebSocket for real-time (no polling)
- ✅ Lazy load player stats (on demand)
- ✅ Cache team rosters (if data doesn't change often)

---

## 🔒 Security Checklist

- ✅ Passwords hashed with bcryptjs
- ✅ JWT tokens for authentication
- ✅ Role-based access control
- ✅ Protected admin routes
- ✅ Input validation with Zod
- ✅ CORS enabled for frontend domain
- ✅ SQL injection prevention via parameterized queries

---

## 📋 Development Checklist

Before going to production:

- [ ] All environment variables configured
- [ ] PostgreSQL database running and accessible
- [ ] Frontend and backend both starting without errors
- [ ] Can create match and add balls
- [ ] Statistics calculating correctly
- [ ] Real-time updates working
- [ ] Maiden overs detecting properly
- [ ] Test match innings rotating correctly
- [ ] Player descriptions saving
- [ ] Admin requests working
- [ ] All pages responsive on mobile
- [ ] No console errors in browser
- [ ] API endpoints returning correct data
- [ ] Authentication working (login/register)

---

## 🔄 Git Workflow

```bash
# Clone project
git clone <repo-url>
cd CricketNewsApp

# Install & start
pnpm install
pnpm dev

# Create feature branch
git checkout -b feature/your-feature

# Commit changes
git add .
git commit -m "Add your feature"

# Push & create PR
git push origin feature/your-feature
```

---

## 📞 Quick Commands

```bash
# Install dependencies
pnpm install

# Start all apps (dev mode)
pnpm dev

# Start backend only
cd apps/api && npm run dev

# Start frontend only
cd apps/web && npm run dev

# Build for production
pnpm build

# Run tests (when available)
pnpm test

# Format code
pnpm format

# Check lint errors
pnpm lint
```

---

## 🎓 Learning Resources

### Understanding Cricket Statistics
- **Strike Rate**: How quickly batsman scores (runs per 100 balls)
- **Economy Rate**: How many runs bowler concedes per over
- **Maiden Over**: Bowler bowls 6 balls without conceding runs
- **All-Out**: Team loses all 10 wickets, inning ends

### Understanding Project
1. Read this doc (you're doing it!)
2. Look at database schema (all tables explained)
3. Explore routes in `apps/api/src/routes/matches.ts` (main logic)
4. Check pages in `apps/web/app/` (UI components)
5. View real match data (create test match)

---

## 📊 File Size Reference

| Component | Size | Time to Load |
|-----------|------|--------------|
| Frontend bundle | ~200KB | <2s |
| Match page | ~50KB | <1s |
| API response | ~10-50KB | <500ms |

---

## 🎯 Next Steps

1. **Setup**: Follow Quick Start section above
2. **Test**: Create a test match and add balls
3. **Explore**: Visit all pages in browser
4. **Understand**: Read routes in backend code
5. **Develop**: Make changes to features as needed

---

## 📞 Support

**Having Issues?**
- Check Troubleshooting section above
- Verify all environment variables are set
- Check console errors (browser F12)
- Check server logs (terminal)
- Verify database is running

---

## 📝 Document Info

- **Created**: January 9, 2026
- **Version**: 0.1.0 (Development)
- **Status**: Active Development
- **Last Updated**: January 9, 2026

---

**Ready to start? Run `pnpm install` and `pnpm dev` now!** 🚀
