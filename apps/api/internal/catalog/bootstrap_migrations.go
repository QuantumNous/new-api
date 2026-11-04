package channel

import (
	"fmt"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"gorm.io/gorm"
)

// This domain owns channel_model_health, the route table and the gateway config
// revision, so it registers its own post-AutoMigrate steps instead of the
// bootstrap naming them. Registration order matches the previous literal
// sequence in model/main.go: the key-index migration, the route seed, then the
// gateway revision seed.
//
// SeedChannelModelRoutes belongs here rather than in the bootstrap because it
// reads Channel and writes ChannelModelRoute — both owned by this domain — and
// because it must run after AutoMigrate has created channel_model_routes.
func init() {
	dbx.RegisterPostMigration(
		migrateChannelModelHealthKeyIndex,
		seedUnitHealthColumns,
		SeedChannelModelRoutes,
		InitializeGatewayConfigRevision,
	)
}

func migrateChannelModelHealthKeyIndex() error {
	if !dbx.DB.Migrator().HasTable(&ChannelModelHealth{}) {
		return nil
	}
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		var rows []struct {
			Name string `gorm:"column:name"`
			PK   int    `gorm:"column:pk"`
		}
		if err := dbx.DB.Raw("PRAGMA table_info(channel_model_health)").Scan(&rows).Error; err != nil {
			return err
		}
		for _, row := range rows {
			if row.Name == "key_index" && row.PK == 2 {
				return nil
			}
		}
		return dbx.DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(`CREATE TABLE channel_model_health_new (
				channel_id integer NOT NULL,
				key_index integer NOT NULL DEFAULT 0,
				model varchar(255) NOT NULL,
				state varchar(16) NOT NULL DEFAULT 'healthy',
				isolation_level integer NOT NULL DEFAULT 0,
				until bigint,
				version integer NOT NULL DEFAULT 1,
				dormant_disable_count integer NOT NULL DEFAULT 0,
				local_failure_count integer NOT NULL DEFAULT 0,
				upstream_failure_count integer NOT NULL DEFAULT 0,
				last_error_code varchar(64),
				last_error_at bigint,
				last_success_at bigint,
				updated_at bigint,
				PRIMARY KEY (channel_id, key_index, model)
			)`).Error; err != nil {
				return err
			}
			if err := tx.Exec(`INSERT INTO channel_model_health_new (
				channel_id, key_index, model, state, isolation_level, until, version,
				dormant_disable_count, local_failure_count, upstream_failure_count,
				last_error_code, last_error_at, last_success_at, updated_at
			) SELECT channel_id, 0, model, state, isolation_level, until, version,
				dormant_disable_count, local_failure_count, upstream_failure_count,
				last_error_code, last_error_at, last_success_at, updated_at
			FROM channel_model_health`).Error; err != nil {
				return err
			}
			if err := tx.Exec("DROP TABLE channel_model_health").Error; err != nil {
				return err
			}
			return tx.Exec("ALTER TABLE channel_model_health_new RENAME TO channel_model_health").Error
		})
	}
	if common.UsingMainDatabase(common.DatabaseTypeMySQL) {
		var primaryColumns []string
		if err := dbx.DB.Raw("SELECT column_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = 'PRIMARY' ORDER BY seq_in_index", "channel_model_health").Scan(&primaryColumns).Error; err != nil {
			return err
		}
		if len(primaryColumns) == 3 && primaryColumns[1] == "key_index" {
			return nil
		}
		return dbx.DB.Transaction(func(tx *gorm.DB) error {
			if !tx.Migrator().HasColumn(&ChannelModelHealth{}, "key_index") {
				if err := tx.Exec("ALTER TABLE channel_model_health ADD COLUMN key_index integer NOT NULL DEFAULT 0").Error; err != nil {
					return err
				}
			}
			return tx.Exec("ALTER TABLE channel_model_health DROP PRIMARY KEY, ADD PRIMARY KEY (channel_id, key_index, model)").Error
		})
	}
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		var primaryColumns []string
		if err := dbx.DB.Raw(`SELECT attribute.attname
			FROM pg_index index_def
			JOIN pg_class table_def ON table_def.oid = index_def.indrelid
			JOIN pg_attribute attribute ON attribute.attrelid = table_def.oid AND attribute.attnum = ANY(index_def.indkey)
			WHERE table_def.relname = 'channel_model_health' AND index_def.indisprimary
			ORDER BY array_position(index_def.indkey, attribute.attnum)`).Scan(&primaryColumns).Error; err != nil {
			return err
		}
		if len(primaryColumns) == 3 && primaryColumns[1] == "key_index" {
			return nil
		}
		return dbx.DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec("ALTER TABLE channel_model_health ADD COLUMN IF NOT EXISTS key_index integer NOT NULL DEFAULT 0").Error; err != nil {
				return err
			}
			if err := tx.Exec("ALTER TABLE channel_model_health DROP CONSTRAINT channel_model_health_pkey").Error; err != nil {
				return err
			}
			return tx.Exec("ALTER TABLE channel_model_health ADD PRIMARY KEY (channel_id, key_index, model)").Error
		})
	}
	return fmt.Errorf("unsupported database for channel model health migration")
}

// seedUnitHealthColumns is the one-time legacy-to-unit migration of the
// channel_model_health rows. The old ladder (state / isolation_level /
// until / dormancy counters) is superseded by the outcome-driven columns;
// this step maps the only legacy state that still means something and then
// clears the legacy markers, which is what makes the step idempotent on
// later boots:
//
//   - a live isolation deadline (until in the future) becomes
//     cooldown_until_ms = until*1000 with a one-rung cooldown_streak, so
//     the unit stays excluded for the remainder of its old window and then
//     re-enters through the slow-start ramp;
//   - the legacy "disabled" state becomes hard_disabled without the auto
//     marker: those rows were taken out by an explicit operator action or a
//     conclusive key probe, so they are NOT silently revived by the recovery
//     rework — an operator clears them through RecoverUnit;
//   - a row the retired disable-strike ratchet parked at the cap
//     (disable_streak >= UnitProbeFailCap) becomes hard_disabled AND
//     auto_disabled: the ratchet was automation, not an operator decision,
//     so startup auto-recovery (AutoRecoverDisabledUnitHealth) revives it
//     back into rotation once its channel/key is routable. The dead
//     disable_streak column is zeroed so a later read can never resurrect
//     the ratchet;
//   - the calm/dormant ladder rungs and the dormancy/failure counters are
//     DROPPED here: the new model has no ladder levels, and a one-time loss
//     of "how far up the old ladder" is adjudicated acceptable (the unit
//     restarts at the new base rung).
func seedUnitHealthColumns() error {
	if !dbx.DB.Migrator().HasTable(&ChannelModelHealth{}) {
		return nil
	}
	// The outcome columns exist only once AutoMigrate has seen the new
	// struct; on a pre-rework database the columns are missing, so the
	// step is a no-op until the schema catches up.
	if !dbx.DB.Migrator().HasColumn(&ChannelModelHealth{}, "CooldownUntilMs") {
		return nil
	}
	legacyWhere := "until IS NOT NULL OR state = ? OR dormant_disable_count > 0 OR local_failure_count > 0 OR upstream_failure_count > 0"
	updated := map[string]any{
		"cooldown_until_ms": gorm.Expr("COALESCE(until, 0) * 1000"),
		"cooldown_streak":   gorm.Expr("CASE WHEN until IS NOT NULL THEN 1 ELSE cooldown_streak END"),
		"hard_disabled":     gorm.Expr("CASE WHEN state = ? THEN ? ELSE hard_disabled END", "disabled", true),
		// One-time legacy state loss: the ladder markers are consumed.
		"state":                  "healthy",
		"isolation_level":        0,
		"until":                  nil,
		"dormant_disable_count":  0,
		"local_failure_count":    0,
		"upstream_failure_count": 0,
	}
	if err := dbx.DB.Model(&ChannelModelHealth{}).Where(legacyWhere, "disabled").Updates(updated).Error; err != nil {
		return err
	}
	if !dbx.DB.Migrator().HasColumn(&ChannelModelHealth{}, "disable_streak") {
		return nil
	}
	if err := dbx.DB.Model(&ChannelModelHealth{}).
		Where("disable_streak >= ?", UnitProbeFailCap).
		Updates(map[string]any{"hard_disabled": true, "auto_disabled": true}).Error; err != nil {
		return err
	}
	return dbx.DB.Model(&ChannelModelHealth{}).
		Where("disable_streak <> 0").
		Update("disable_streak", 0).Error
}
