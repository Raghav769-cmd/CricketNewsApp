# Cricket News App - Database Structure

## Overview

This document describes the PostgreSQL database structure used by the Cricket News App. The database is named `cricket` and manages all data related to cricket matches, players, teams, stadiums, and user authentication.

## Database Connection

- **Type**: PostgreSQL
- **Default Database Name**: `cricket`
- **Default Host**: `localhost`
- **Default Port**: `5432`
- **Default User**: `postgres`

### Connection Configuration

Configuration is managed via environment variables:
- `DB_HOST` - Database host address
- `DB_NAME` - Database name
- `DB_PORT` - Database port
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password

---

## Core Tables

### 1. **teams**

Stores information about cricket teams.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique team identifier |
| `name` | VARCHAR | NOT NULL | Name of the team |

**Operations**: CREATE, READ, UPDATE, DELETE

---

### 2. **players**

Stores information about individual cricket players.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique player identifier |
| `name` | VARCHAR | NOT NULL | Name of the player |
| `team_id` | INTEGER | FOREIGN KEY (teams.id) | Associated team |

**Foreign Keys**:
- `team_id` → `teams(id)` - Links player to their team

**Operations**: CREATE, READ, UPDATE, DELETE

---

### 3. **stadiums**

Stores information about cricket stadiums/venues.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique stadium identifier |
| `name` | VARCHAR | NOT NULL | Name of the stadium |
| `city` | VARCHAR | | City where stadium is located |
| `country` | VARCHAR | | Country where stadium is located |
| `capacity` | INTEGER | | Seating capacity of the stadium |

**Operations**: READ (Get all stadiums, Get stadium by ID)

---

### 4. **matches**

Stores information about cricket matches.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique match identifier |
| `team1_id` | INTEGER | FOREIGN KEY (teams.id) | First team ID |
| `team2_id` | INTEGER | FOREIGN KEY (teams.id) | Second team ID |
| `stadium_id` | INTEGER | FOREIGN KEY (stadiums.id) | Venue ID |
| `format` | VARCHAR | | Match format (1over, t20, odi, test) |
| `overs_per_inning` | INTEGER | | Number of overs per inning |
| `status` | VARCHAR | | Match status (ongoing, completed, etc.) |
| `inning1_complete` | BOOLEAN | DEFAULT FALSE | First inning completion status |
| `inning2_complete` | BOOLEAN | DEFAULT FALSE | Second inning completion status |
| `inning3_complete` | BOOLEAN | DEFAULT FALSE | Third inning completion status (if applicable) |
| `inning4_complete` | BOOLEAN | DEFAULT FALSE | Fourth inning completion status (if applicable) |
| `winner_id` | INTEGER | FOREIGN KEY (teams.id) | Winning team ID |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Match creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Foreign Keys**:
- `team1_id` → `teams(id)`
- `team2_id` → `teams(id)`
- `stadium_id` → `stadiums(id)`
- `winner_id` → `teams(id)` (nullable)

**Format Values**: `1over`, `t20`, `odi`, `test`

---

### 5. **overs**

Stores information about overs bowled in matches.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique over identifier |
| `match_id` | INTEGER | FOREIGN KEY (matches.id) | Associated match |
| `inning_number` | INTEGER | | Inning number (1, 2, 3, or 4) |
| `over_number` | INTEGER | | Over number within the inning |
| `bowler_id` | INTEGER | FOREIGN KEY (players.id) | Player bowling the over |
| `batting_team_id` | INTEGER | FOREIGN KEY (teams.id) | Team batting during this over |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Over creation time |

**Foreign Keys**:
- `match_id` → `matches(id)`
- `bowler_id` → `players(id)`
- `batting_team_id` → `teams(id)`

---

### 6. **balls**

Stores detailed information about each ball bowled in a match.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique ball identifier |
| `over_id` | INTEGER | FOREIGN KEY (overs.id) | Associated over |
| `ball_number` | INTEGER | | Ball number within the over (1-6) |
| `batsman_id` | INTEGER | FOREIGN KEY (players.id) | Batsman facing the ball |
| `bowler_id` | INTEGER | FOREIGN KEY (players.id) | Bowler delivering the ball |
| `runs` | INTEGER | DEFAULT 0 | Runs scored on this ball |
| `extras` | VARCHAR | | Extra runs (wide, wd, no-ball, nb, etc.) |
| `event` | VARCHAR | | Special event (wide, wd, no-ball, nb, etc.) |
| `is_wicket` | BOOLEAN | DEFAULT FALSE | Whether the ball resulted in a wicket |
| `dismissal` | VARCHAR | | Type of dismissal (if wicket) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Ball creation time |

**Foreign Keys**:
- `over_id` → `overs(id)`
- `batsman_id` → `players(id)`
- `bowler_id` → `players(id)`

---

### 7. **player_stats**

Aggregated statistics for players across different formats.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique record identifier |
| `player_id` | INTEGER | FOREIGN KEY (players.id) | Player ID |
| `team_id` | INTEGER | FOREIGN KEY (teams.id) | Team ID |
| `format` | VARCHAR | | Match format (1over, t20, odi, test) |
| `matches_played` | INTEGER | DEFAULT 0 | Total matches played |
| `runs_scored` | INTEGER | DEFAULT 0 | Total runs scored (batting) |
| `balls_faced` | INTEGER | DEFAULT 0 | Total balls faced |
| `fours` | INTEGER | DEFAULT 0 | Number of fours hit |
| `sixes` | INTEGER | DEFAULT 0 | Number of sixes hit |
| `centuries` | INTEGER | DEFAULT 0 | Number of centuries scored |
| `half_centuries` | INTEGER | DEFAULT 0 | Number of half-centuries scored |
| `highest_score` | INTEGER | DEFAULT 0 | Highest individual score |
| `times_out` | INTEGER | DEFAULT 0 | Number of times dismissed |
| `wickets_taken` | INTEGER | DEFAULT 0 | Total wickets taken (bowling) |
| `runs_conceded` | INTEGER | DEFAULT 0 | Total runs conceded (bowling) |
| `overs_bowled` | NUMERIC | DEFAULT 0 | Total overs bowled |
| `best_bowling` | VARCHAR | DEFAULT '0/0' | Best bowling figures (format: w/r) |
| `maidens` | INTEGER | DEFAULT 0 | Number of maiden overs |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Foreign Keys**:
- `player_id` → `players(id)`
- `team_id` → `teams(id)`

**Unique Constraint**: (player_id, team_id, format) - One record per player per team per format

---

### 8. **player_descriptions**

Stores detailed match-specific player descriptions/performance notes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique record identifier |
| `match_id` | INTEGER | FOREIGN KEY (matches.id) | Associated match |
| `player_id` | INTEGER | FOREIGN KEY (players.id) | Player being described |
| `description` | TEXT | | Detailed description/notes about player performance |
| `author` | VARCHAR | | Author of the description (admin user) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Foreign Keys**:
- `match_id` → `matches(id)`
- `player_id` → `players(id)`

**Unique Constraint**: (match_id, player_id) - One description per player per match

---

## Authentication Tables

### 9. **regular_users**

Stores regular user account information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique user identifier |
| `email` | VARCHAR | UNIQUE, NOT NULL | User email address |
| `password` | VARCHAR | NOT NULL | Hashed password (bcrypt) |
| `name` | VARCHAR | | User's display name |
| `username` | VARCHAR | UNIQUE, NOT NULL | Unique username |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation time |

**Role**: Regular user with read-only access to most data

---

### 10. **admins**

Stores admin user account information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique admin identifier |
| `email` | VARCHAR | UNIQUE, NOT NULL | Admin email address |
| `password` | VARCHAR | NOT NULL | Hashed password (bcrypt) |
| `name` | VARCHAR | | Admin's display name |
| `username` | VARCHAR | UNIQUE, NOT NULL | Unique username |
| `role` | VARCHAR | | Admin role (superadmin or admin) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation time |

**Roles**:
- `superadmin` - Full system access, can approve admin requests
- `admin` - Can create match data, player descriptions

---

### 11. **admin_requests**

Stores pending admin account requests awaiting approval.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique request identifier |
| `email` | VARCHAR | NOT NULL | Email of the person requesting admin access |
| `password` | VARCHAR | NOT NULL | Hashed password (bcrypt) |
| `name` | VARCHAR | | Full name of the applicant |
| `username` | VARCHAR | NOT NULL | Requested username |
| `status` | VARCHAR | DEFAULT 'pending' | Request status (pending, approved, rejected) |
| `requested_by_email` | VARCHAR | | Email of the person making the request |
| `role` | VARCHAR | | Requested role (superadmin or admin) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Request creation time |

---

## Data Flow Diagram

```
┌─────────────────┐
│     matches     │ ◄─────────────────┐
└────────┬────────┘                   │
         │                            │
         ├────────────┬───────────┬────┴───────┐
         │            │           │            │
         ▼            ▼           ▼            ▼
    ┌────────┐  ┌──────────┐ ┌────────┐ ┌──────────┐
    │ overs  │  │  teams   │ │stadium │ │ player_  │
    │        │  │ (team1,  │ │  (id)  │ │descriptions
    └────┬───┘  │  team2)  │ └────────┘ └──────────┘
         │      └──────────┘
         │            │
         ▼            ▼
    ┌────────┐  ┌──────────┐
    │ balls  │  │ players  │
    │        │  │(team_id) │
    └───┬────┘  └─────┬────┘
        │             │
        │             ▼
        │        ┌──────────────┐
        └───────►│player_stats  │
                 │(format-wise) │
                 └──────────────┘
```

---

## Key Relationships

### Match Data Relationships
- **matches** has one team1 and team2 from **teams**
- **matches** has one **stadium**
- **overs** belongs to a **match** and has a bowling **player** and **batting_team**
- **balls** belongs to an **over** and has **batsman** and **bowler** players

### Player Statistics
- **player_stats** aggregates data per player, team, and format combination
- Statistics are automatically updated when match data (overs and balls) are created/modified
- Tracks batting stats (runs, balls, fours, sixes, centuries, highest_score, etc.)
- Tracks bowling stats (wickets, runs, overs, best_bowling, maidens, etc.)

### User Authentication
- **regular_users** - Normal users with read-only access
- **admins** - Administrative users who can create/modify match data
- **admin_requests** - Pending requests for admin access requiring superadmin approval

### Match-Specific Notes
- **player_descriptions** stores admin-written descriptions/analysis for specific players in specific matches
- Unique constraint ensures one description per player per match

---

## Match Format

Matches are categorized into four formats based on overs per inning:

| Format | Overs Per Inning | Category |
|--------|------------------|----------|
| `1over` | ≤ 1 | Ultra-short |
| `t20` | ≤ 20 | T20 Cricket |
| `odi` | ≤ 50 | One Day International |
| `test` | > 50 | Test Cricket |

---

## Indexing Strategy

For optimal query performance, consider adding indexes on:

```sql
-- Match queries
CREATE INDEX idx_matches_team1 ON matches(team1_id);
CREATE INDEX idx_matches_team2 ON matches(team2_id);
CREATE INDEX idx_matches_status ON matches(status);

-- Player queries
CREATE INDEX idx_players_team ON players(team_id);

-- Over queries
CREATE INDEX idx_overs_match ON overs(match_id);
CREATE INDEX idx_overs_bowler ON overs(bowler_id);
CREATE INDEX idx_overs_batting_team ON overs(batting_team_id);

-- Ball queries
CREATE INDEX idx_balls_over ON balls(over_id);
CREATE INDEX idx_balls_batsman ON balls(batsman_id);
CREATE INDEX idx_balls_bowler ON balls(bowler_id);

-- Player stats queries
CREATE INDEX idx_player_stats_player ON player_stats(player_id);
CREATE INDEX idx_player_stats_format ON player_stats(format);
CREATE INDEX idx_player_stats_composite ON player_stats(player_id, team_id, format);

-- User queries
CREATE INDEX idx_regular_users_email ON regular_users(email);
CREATE INDEX idx_regular_users_username ON regular_users(username);
CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_username ON admins(username);
```

---

## Common Queries

### Get Player Statistics for a Format
```sql
SELECT * FROM player_stats 
WHERE player_id = $1 AND format = $2;
```

### Get All Batsmen Performance in a Match Inning
```sql
SELECT DISTINCT b.batsman_id, p.name, 
       SUM(b.runs) as runs,
       COUNT(*) as balls
FROM balls b
JOIN overs o ON b.over_id = o.id
JOIN players p ON b.batsman_id = p.id
WHERE o.match_id = $1 AND o.batting_team_id = $2 AND o.inning_number = $3
GROUP BY b.batsman_id, p.name;
```

### Get Bowler's Best Performance
```sql
SELECT SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) as wickets,
       SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as runs
FROM balls b
JOIN overs o ON b.over_id = o.id
WHERE b.bowler_id = $1 AND o.match_id = $2;
```

### Get Match Status and Completion
```sql
SELECT id, status, 
       inning1_complete, inning2_complete, 
       inning3_complete, inning4_complete,
       winner_id
FROM matches WHERE id = $1;
```

---

## Maintenance Considerations

### Data Integrity
- Foreign key constraints ensure referential integrity
- Cascading deletes should be configured appropriately for sensitive relationships
- Unique constraints prevent duplicate entries (e.g., player-team-format combinations)

### Performance
- Regular stats aggregation might need optimization for high-volume matches
- Consider archiving old match data periodically
- Monitor query execution plans for frequently accessed data

### Backup Strategy
- Regular backups recommended for production environments
- Transaction logging enabled for point-in-time recovery
- Test restore procedures regularly

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial database documentation for Cricket News App |

