package model

import (
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// TestHwAssistantRecordHitDatabaseMatrix counts the same key twice on every
// database the product runs on. PostgreSQL rejected the increment with
// "column reference \"hits\" is ambiguous" because ON CONFLICT DO UPDATE sees
// the column in the target row and in excluded; SQLite accepted it, so the
// controller test could never catch it. The table name has to stay the real
// one: the counter expression in hw_assistant_hit.go names the table.
func TestHwAssistantRecordHitDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dialector gorm.Dialector
			switch dialect {
			case "sqlite":
				dialector = sqlite.Open("file:hw_assistant_hit_matrix?mode=memory&cache=shared")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				dialector = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				dialector = postgres.Open(dsn)
			}
			db, err := gorm.Open(dialector, &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			previousDB, previousType := DB, common.MainDatabaseType()
			DB = db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			initCol()
			prefix := "q:matrix " + dialect
			key := prefix + " teller"
			t.Cleanup(func() {
				require.NoError(t, db.Where(commonKeyCol+" = ?", key).Delete(&HwAssistantHit{}).Error)
				DB = previousDB
				common.SetMainDatabaseType(previousType)
				initCol()
				require.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(&HwAssistantHit{}))
			require.NoError(t, db.Where(commonKeyCol+" = ?", key).Delete(&HwAssistantHit{}).Error)

			require.NoError(t, HwAssistantRecordHit(db, key, 100))
			require.NoError(t, HwAssistantRecordHit(db, key, 200), "the second hit updates the existing counter")

			rows, err := HwAssistantHitsByPrefix(db, "q:matrix "+dialect, 10)
			require.NoError(t, err)
			require.Len(t, rows, 1)
			assert.Equal(t, 2, rows[0].Hits)
			assert.Equal(t, int64(200), rows[0].LastAt)
			assert.Equal(t, "teller", strings.TrimPrefix(rows[0].Key, " "))
		})
	}
}

func TestHwAssistantFeedbackStoreSkipsPersonalAndListsNewestFirst(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:hw_assistant_feedback?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&HwAssistantFeedback{}))

	cases := []struct {
		question, correction string
		stored               bool
	}{
		{"how do I get an api key", "", true},
		{"see https://api.hisarweb.be/docs for the base url", "", true},
		{"what is api.hisarweb.be", "", true},
		{"mail me at a@b.nl", "", false},
		{"my number is 0612345678", "", false},
		{"see https://evil.example.com/x", "", false},
		{"http://api.hisarweb.be.evil.com is that you", "", false},
		{"clean question", "write to me@example.com", false},
	}
	for index, tc := range cases {
		stored, err := HwAssistantStoreFeedback(db, HwAssistantFeedback{
			Channel: "widget", Question: tc.question, Answer: "a", Rating: 1, Correction: tc.correction, CreatedAt: int64(100 + index),
		})
		require.NoError(t, err, tc.question)
		assert.Equal(t, tc.stored, stored, tc.question)
	}

	_, err = HwAssistantStoreFeedback(db, HwAssistantFeedback{Question: "bad one", Answer: "a", Rating: -1, CreatedAt: 500})
	require.NoError(t, err)
	recent, err := HwAssistantRecentFeedback(db, 10)
	require.NoError(t, err)
	require.Len(t, recent, 4)
	assert.Equal(t, "bad one", recent[0].Question, "newest first")
	down, err := HwAssistantListFeedback(db, -1, "", 10)
	require.NoError(t, err)
	require.Len(t, down, 1)

	_, err = HwAssistantStoreFeedback(db, HwAssistantFeedback{Channel: "admin", Question: "admin row", Answer: "a", Rating: 1, CreatedAt: 600})
	require.NoError(t, err)
	open, err := HwAssistantListFeedback(db, 0, HwAssistantReviewOpen, 10)
	require.NoError(t, err)
	require.Len(t, open, 4, "customer rows only, admin row excluded")

	assert.Error(t, HwAssistantReviewFeedback(db, recent[0].ID, "maybe"))
	require.NoError(t, HwAssistantReviewFeedback(db, recent[0].ID, HwAssistantReviewApproved))
	require.NoError(t, HwAssistantReviewFeedback(db, recent[1].ID, HwAssistantReviewAbuse))
	assert.ErrorIs(t, HwAssistantReviewFeedback(db, 999999, HwAssistantReviewRejected), gorm.ErrRecordNotFound)
	var admin HwAssistantFeedback
	require.NoError(t, db.Where("channel = ?", "admin").First(&admin).Error)
	assert.ErrorIs(t, HwAssistantReviewFeedback(db, admin.ID, HwAssistantReviewAbuse), gorm.ErrRecordNotFound, "admin rows are not reviewed")

	open, err = HwAssistantListFeedback(db, 0, HwAssistantReviewOpen, 10)
	require.NoError(t, err)
	assert.Len(t, open, 2)
	abuse, err := HwAssistantListFeedback(db, 0, HwAssistantReviewAbuse, 10)
	require.NoError(t, err)
	require.Len(t, abuse, 1)
	learnable, err := HwAssistantLearnableFeedback(db, 10)
	require.NoError(t, err)
	require.Len(t, learnable, 2, "admin row and the approved customer row")
	assert.Equal(t, "admin row", learnable[0].Question)
	assert.Equal(t, recent[0].ID, learnable[1].ID)
}

// TestHwPricingFeedbackDatabaseMatrix stores, dedups and cards /pricing
// reports on every database the product runs on: the new table migrates
// twice without change, the boolean and empty-string filters of the card
// query select the same rows everywhere, and a carded row is never carded
// again.
func TestHwPricingFeedbackDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dialector gorm.Dialector
			switch dialect {
			case "sqlite":
				dialector = sqlite.Open("file:hw_pricing_feedback_matrix?mode=memory&cache=shared")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				dialector = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				dialector = postgres.Open(dsn)
			}
			db, err := gorm.Open(dialector, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "hw_pf_matrix_"}})
			require.NoError(t, err)
			if dialect == "mysql" {
				// Production refuses to start on a schema that is not
				// utf8mb4-capable (checkMySQLChineseSupport in main.go); the CI
				// schema is latin1, so the table states the charset itself.
				db = db.Set("gorm:table_options", "CHARSET=utf8mb4")
			}
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			t.Cleanup(func() {
				assert.NoError(t, db.Migrator().DropTable(&HwPricingFeedback{}))
				assert.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.Migrator().DropTable(&HwPricingFeedback{}))
			require.NoError(t, db.AutoMigrate(&HwPricingFeedback{}))
			indexes, err := db.Migrator().GetIndexes(&HwPricingFeedback{})
			require.NoError(t, err)
			require.NoError(t, db.AutoMigrate(&HwPricingFeedback{}), "a restart migrates again without change")
			again, err := db.Migrator().GetIndexes(&HwPricingFeedback{})
			require.NoError(t, err)
			assert.Len(t, again, len(indexes))

			first := HwPricingFeedback{Kind: HwPricingFeedbackKindPrice, Model: "Matrix-Model", Message: "çok pahalı", Lang: "tr"}
			require.NoError(t, HwNormalizePricingFeedback(&first))
			require.NoError(t, HwStorePricingFeedback(db, &first, 1_000))
			second := HwPricingFeedback{Kind: HwPricingFeedbackKindPrice, Model: "matrix-model", Message: "same again", Email: "dup@example.com", Lang: "en"}
			require.NoError(t, HwNormalizePricingFeedback(&second))
			require.NoError(t, HwStorePricingFeedback(db, &second, 2_000))
			assert.False(t, first.Duplicate)
			assert.True(t, second.Duplicate, "same model and kind inside the window")

			rows, err := HwPricingFeedbackToCard(db)
			require.NoError(t, err)
			require.Len(t, rows, 1)
			assert.Equal(t, first.ID, rows[0].ID)
			assert.Equal(t, "çok pahalı", rows[0].Message, "utf-8 survives the round trip")

			require.NoError(t, HwMarkPricingFeedbackCarded(db, []int{first.ID}, "HIS-1"))
			require.NoError(t, HwMarkPricingFeedbackCarded(db, []int{first.ID}, "HIS-2"), "a carded row keeps its card")
			rows, err = HwPricingFeedbackToCard(db)
			require.NoError(t, err)
			assert.Empty(t, rows)
			var stored HwPricingFeedback
			require.NoError(t, db.First(&stored, first.ID).Error)
			assert.Equal(t, "HIS-1", stored.Card)

			require.NoError(t, HwForgetOldPricingFeedback(db, 2_000+HwPricingFeedbackRetentionSeconds+1))
			var aged []HwPricingFeedback
			require.NoError(t, db.Order("id asc").Find(&aged).Error)
			require.Len(t, aged, 2)
			for _, row := range aged {
				assert.Empty(t, row.Email, "retention clears carded and duplicate reports alike (id %d)", row.ID)
				assert.Empty(t, row.Message, "retention clears carded and duplicate reports alike (id %d)", row.ID)
			}
		})
	}
}

func TestHwPricingFeedbackOtherKindKeysOnTheText(t *testing.T) {
	first := HwPricingFeedback{Kind: HwPricingFeedbackKindOther, Model: "Matrix-Model", Message: "the context size is wrong"}
	second := HwPricingFeedback{Kind: HwPricingFeedbackKindOther, Model: "matrix-model", Message: "the model is listed twice"}
	require.NoError(t, HwNormalizePricingFeedback(&first))
	require.NoError(t, HwNormalizePricingFeedback(&second))
	assert.NotEqual(t, first.DedupKey, second.DedupKey, "a different 'other' text about the same model is a new report")

	price := HwPricingFeedback{Kind: HwPricingFeedbackKindPrice, Model: "matrix-model", Message: "another text"}
	again := HwPricingFeedback{Kind: HwPricingFeedbackKindPrice, Model: "Matrix-Model", Message: "too cheap"}
	require.NoError(t, HwNormalizePricingFeedback(&price))
	require.NoError(t, HwNormalizePricingFeedback(&again))
	assert.Equal(t, price.DedupKey, again.DedupKey, "a price report per model stays one report")
}
