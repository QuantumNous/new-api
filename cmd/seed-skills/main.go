// Command seed-skills seeds the R2 demo Skills (DR-51) into the configured
// database as published, packaged, downloadable Skills.
//
// It boots the same way the gateway does (loads .env, InitEnv, InitDB — which
// runs migrations including skill_versions), then runs the idempotent seeder.
//
// Usage:
//
//	go run ./cmd/seed-skills [-created-by <user_id>]
//
// Reads SQL_DSN (and friends) from the environment / .env, exactly like the
// server. Safe to run repeatedly: existing Skills are upserted, and a new active
// version is created only when the template or tier whitelist changed.
//
// Note: on SQLite, re-running against an existing database file hits a known
// glebarez/sqlite AutoMigrate-over-IN()-CHECK driver bug at the migration layer
// (same limitation the gateway has; see internal/skill/model integration tests).
// Production runs on PostgreSQL, where re-runs are clean. The seeder logic itself
// is idempotent regardless (proven by internal/skill/seed tests).
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/seed"
	"github.com/QuantumNous/new-api/model"
	"github.com/joho/godotenv"
)

func main() {
	createdBy := flag.Int64("created-by", 1, "platform user id recorded as the Skill author (default: root user 1)")
	flag.Parse()

	if err := godotenv.Load(".env"); err != nil {
		// .env is optional; environment variables may already be set.
		common.SysLog("seed-skills: no .env loaded (" + err.Error() + "), relying on environment")
	}
	common.InitEnv()

	if err := model.InitDB(); err != nil {
		fmt.Fprintln(os.Stderr, "seed-skills: failed to initialize database:", err)
		os.Exit(1)
	}
	// InitLogDB points LOG_DB at the main DB when LOG_SQL_DSN is unset; required
	// so model.CloseDB() does not dereference a nil LOG_DB on shutdown.
	if err := model.InitLogDB(); err != nil {
		fmt.Fprintln(os.Stderr, "seed-skills: failed to initialize log database:", err)
		os.Exit(1)
	}
	defer func() { _ = model.CloseDB() }()

	if model.DB == nil {
		fmt.Fprintln(os.Stderr, "seed-skills: database is not initialized")
		os.Exit(1)
	}

	result, err := seed.SeedDemoSkills(model.DB, *createdBy)
	if err != nil {
		fmt.Fprintln(os.Stderr, "seed-skills: seeding failed:", err)
		os.Exit(1)
	}

	fmt.Println("seed-skills: done")
	for _, o := range result.Outcomes {
		fmt.Printf("  %-20s %-11s skill=%s version=v%d (%s)\n", o.Slug, o.Action, o.SkillID, o.VersionNumber, o.VersionID)
	}
}
