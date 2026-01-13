-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "admin_requests" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "status" VARCHAR(50) DEFAULT 'pending',
    "requested_by_email" VARCHAR(255),
    "approved_by_admin_id" INTEGER,
    "approved_at" TIMESTAMP(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "username" VARCHAR(100) NOT NULL,
    "role" VARCHAR(20) DEFAULT 'admin',

    CONSTRAINT "admin_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "permissions" TEXT[] DEFAULT ARRAY['manage_matches', 'view_matches', 'manage_users']::TEXT[],
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "username" VARCHAR(100) NOT NULL,
    "role" VARCHAR(20) DEFAULT 'admin',

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balls" (
    "id" BIGSERIAL NOT NULL,
    "over_id" BIGINT NOT NULL,
    "ball_number" INTEGER NOT NULL,
    "runs" INTEGER DEFAULT 0,
    "extras" TEXT DEFAULT '0',
    "event" TEXT,
    "is_wicket" BOOLEAN DEFAULT false,
    "batsman_id" BIGINT,
    "bowler_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" BIGSERIAL NOT NULL,
    "team1" BIGINT,
    "team2" BIGINT,
    "date" TIMESTAMPTZ(6),
    "venue" TEXT,
    "score" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "overs_per_inning" INTEGER DEFAULT 20,
    "current_inning" INTEGER DEFAULT 1,
    "inning1_team_id" INTEGER,
    "inning1_complete" BOOLEAN DEFAULT false,
    "winner_team_id" BIGINT,
    "match_result" VARCHAR(50),
    "is_match_complete" BOOLEAN DEFAULT false,
    "match_status" VARCHAR(50) DEFAULT 'pending',
    "winner" BIGINT,
    "result_description" TEXT,
    "completed_at" TIMESTAMP(6),
    "stadium_id" INTEGER,
    "format" VARCHAR(50) DEFAULT 't20',
    "inning2_complete" BOOLEAN DEFAULT false,
    "inning3_complete" BOOLEAN DEFAULT false,
    "inning4_complete" BOOLEAN DEFAULT false,
    "inning2_team_id" BIGINT,
    "inning3_team_id" BIGINT,
    "inning4_team_id" BIGINT,
    "innings_limit" INTEGER DEFAULT 2,
    "follow_on_enforced" BOOLEAN DEFAULT false,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overs" (
    "id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "over_number" INTEGER NOT NULL,
    "batting_team_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "inning_number" INTEGER NOT NULL,

    CONSTRAINT "overs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_descriptions" (
    "id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "player_id" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "author" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_stats" (
    "id" SERIAL NOT NULL,
    "player_id" BIGINT NOT NULL,
    "team_id" BIGINT NOT NULL,
    "format" VARCHAR(20) NOT NULL,
    "matches_played" INTEGER DEFAULT 0,
    "innings_batted" INTEGER DEFAULT 0,
    "runs_scored" INTEGER DEFAULT 0,
    "balls_faced" INTEGER DEFAULT 0,
    "fours" INTEGER DEFAULT 0,
    "sixes" INTEGER DEFAULT 0,
    "centuries" INTEGER DEFAULT 0,
    "half_centuries" INTEGER DEFAULT 0,
    "highest_score" INTEGER DEFAULT 0,
    "times_out" INTEGER DEFAULT 0,
    "matches_bowled" INTEGER DEFAULT 0,
    "wickets_taken" INTEGER DEFAULT 0,
    "runs_conceded" INTEGER DEFAULT 0,
    "overs_bowled" DECIMAL(10,1) DEFAULT 0,
    "best_bowling" VARCHAR(10) DEFAULT '0/0',
    "maidens" INTEGER DEFAULT 0,
    "dot_balls" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "team_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regular_users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "permissions" TEXT[] DEFAULT ARRAY['view_matches']::TEXT[],
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "username" VARCHAR(100) NOT NULL,

    CONSTRAINT "regular_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stadiums" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "city" VARCHAR(255),
    "country" VARCHAR(255),
    "capacity" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stadiums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_requests_email_key" ON "admin_requests"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_requests_username_key" ON "admin_requests"("username");

-- CreateIndex
CREATE INDEX "idx_admin_requests_email" ON "admin_requests"("email");

-- CreateIndex
CREATE INDEX "idx_admin_requests_status" ON "admin_requests"("status");

-- CreateIndex
CREATE INDEX "idx_admin_requests_username" ON "admin_requests"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE INDEX "idx_admins_email" ON "admins"("email");

-- CreateIndex
CREATE INDEX "idx_admins_username" ON "admins"("username");

-- CreateIndex
CREATE INDEX "idx_balls_batsman_id" ON "balls"("batsman_id");

-- CreateIndex
CREATE INDEX "idx_balls_over_id" ON "balls"("over_id");

-- CreateIndex
CREATE INDEX "idx_balls_wicket" ON "balls"("is_wicket");

-- CreateIndex
CREATE INDEX "idx_matches_is_complete" ON "matches"("is_match_complete");

-- CreateIndex
CREATE INDEX "idx_matches_status" ON "matches"("match_status");

-- CreateIndex
CREATE INDEX "idx_matches_winner" ON "matches"("winner_team_id");

-- CreateIndex
CREATE INDEX "idx_overs_batting_team" ON "overs"("match_id", "batting_team_id", "over_number");

-- CreateIndex
CREATE INDEX "idx_overs_match_id" ON "overs"("match_id");

-- CreateIndex
CREATE INDEX "idx_overs_match_inning" ON "overs"("match_id", "inning_number");

-- CreateIndex
CREATE INDEX "idx_overs_match_inning_batting" ON "overs"("match_id", "inning_number", "batting_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "overs_match_id_over_number_batting_team_id_inning_key" ON "overs"("match_id", "over_number", "batting_team_id", "inning_number");

-- CreateIndex
CREATE UNIQUE INDEX "player_descriptions_match_id_player_id_key" ON "player_descriptions"("match_id", "player_id");

-- CreateIndex
CREATE INDEX "idx_player_stats_player_format" ON "player_stats"("player_id", "format");

-- CreateIndex
CREATE INDEX "idx_player_stats_team_format" ON "player_stats"("team_id", "format");

-- CreateIndex
CREATE UNIQUE INDEX "player_stats_player_id_team_id_format_key" ON "player_stats"("player_id", "team_id", "format");

-- CreateIndex
CREATE INDEX "idx_players_team_id" ON "players"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "regular_users_email_key" ON "regular_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "regular_users_username_key" ON "regular_users"("username");

-- CreateIndex
CREATE INDEX "idx_regular_users_email" ON "regular_users"("email");

-- CreateIndex
CREATE INDEX "idx_regular_users_username" ON "regular_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "stadiums_name_key" ON "stadiums"("name");

-- AddForeignKey
ALTER TABLE "balls" ADD CONSTRAINT "balls_batsman_id_fkey" FOREIGN KEY ("batsman_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "balls" ADD CONSTRAINT "balls_bowler_id_fkey" FOREIGN KEY ("bowler_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "balls" ADD CONSTRAINT "balls_over_id_fkey" FOREIGN KEY ("over_id") REFERENCES "overs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "fk_inning2_team" FOREIGN KEY ("inning2_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "fk_inning3_team" FOREIGN KEY ("inning3_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "fk_inning4_team" FOREIGN KEY ("inning4_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "fk_winner_team" FOREIGN KEY ("winner_team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_stadium_id_fkey" FOREIGN KEY ("stadium_id") REFERENCES "stadiums"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team1_fkey" FOREIGN KEY ("team1") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team2_fkey" FOREIGN KEY ("team2") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_fkey" FOREIGN KEY ("winner") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "overs" ADD CONSTRAINT "overs_batting_team_id_fkey" FOREIGN KEY ("batting_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "overs" ADD CONSTRAINT "overs_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "player_descriptions" ADD CONSTRAINT "player_descriptions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "player_descriptions" ADD CONSTRAINT "player_descriptions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

