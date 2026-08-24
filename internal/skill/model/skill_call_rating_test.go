package skillmodel

import (
	"testing"

	"gorm.io/gorm"
)

func migrateNewTables(t *testing.T) *gorm.DB {
	t.Helper()
	db := openSQLiteDB(t)
	if err := MigrateSkillCalls(db); err != nil {
		t.Fatalf("MigrateSkillCalls: %v", err)
	}
	if err := MigrateSkillRatings(db); err != nil {
		t.Fatalf("MigrateSkillRatings: %v", err)
	}
	return db
}

func validSkillCall(skillID string) SkillCall {
	return SkillCall{
		SkillID: skillID, UserID: 10, TenantID: 10, CreatorID: 42,
		BaseQuota: 1000, MarkupQuota: 100, CommissionQuota: 80, PlatformQuota: 20,
		MarkupBps: 1000,
	}
}

// --- skill_calls ---

func TestSkillCall_RoundTripAndDefaults(t *testing.T) {
	db := migrateNewTables(t)
	c := validSkillCall("skill-1")
	if err := db.Create(&c).Error; err != nil {
		t.Fatal(err)
	}
	if c.ID == "" {
		t.Error("BeforeCreate must assign a UUID")
	}
	if c.CalledAt.IsZero() {
		t.Error("BeforeCreate must default called_at rather than storing a zero time")
	}
	var got SkillCall
	if err := db.First(&got, "id = ?", c.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.CommissionQuota+got.PlatformQuota != got.MarkupQuota {
		t.Errorf("commission + platform must equal markup, got %d + %d != %d",
			got.CommissionQuota, got.PlatformQuota, got.MarkupQuota)
	}
	if got.RequestID != nil || got.SkillVersionID != nil || got.LogID != nil {
		t.Error("optional references must stay NULL when unset")
	}
}

// TestSkillCall_RequestIDPreventsDoubleBilling is the guard P6 relies on: a retry
// that reuses the request id must not create a second charge.
func TestSkillCall_RequestIDPreventsDoubleBilling(t *testing.T) {
	db := migrateNewTables(t)
	rid := "req-abc-123"
	first := validSkillCall("skill-1")
	first.RequestID = &rid
	if err := db.Create(&first).Error; err != nil {
		t.Fatal(err)
	}
	dup := validSkillCall("skill-1")
	dup.RequestID = &rid
	if err := db.Create(&dup).Error; err == nil {
		t.Error("a second row with the same request_id must be rejected by the unique index")
	}
}

// TestSkillCall_NullRequestIDsCoexist: rows without a request id are legitimate
// (backfills, internal calls) and must not collide under the unique index. This
// is why the column is *string rather than a defaulted empty string.
func TestSkillCall_NullRequestIDsCoexist(t *testing.T) {
	db := migrateNewTables(t)
	for i := 0; i < 3; i++ {
		c := validSkillCall("skill-1")
		if err := db.Create(&c).Error; err != nil {
			t.Fatalf("row %d with a NULL request_id must be accepted: %v", i, err)
		}
	}
}

func TestSkillCall_MarkupBpsRange(t *testing.T) {
	db := migrateNewTables(t)
	for _, bps := range []int{-1, 10001} {
		c := validSkillCall("skill-1")
		c.MarkupBps = bps
		if err := db.Create(&c).Error; err == nil {
			t.Errorf("markup_bps=%d must be rejected (valid range is 0..10000)", bps)
		}
	}
	for _, bps := range []int{0, 10000} {
		c := validSkillCall("skill-1")
		c.MarkupBps = bps
		if err := db.Create(&c).Error; err != nil {
			t.Errorf("markup_bps=%d is a boundary value and must be accepted: %v", bps, err)
		}
	}
}

// --- skill_ratings ---

// TestSkillRating_BindsPublicRatingSource locks the duck-typing contract in
// handler/skills.go: publicRatingSource looks for a table carrying exactly
// skill_id, rating and status. Renaming any of them silently returns the
// marketplace to zero ratings, with no error anywhere.
func TestSkillRating_BindsPublicRatingSource(t *testing.T) {
	db := migrateNewTables(t)
	cols, err := db.Migrator().ColumnTypes(&SkillRating{})
	if err != nil {
		t.Fatal(err)
	}
	have := map[string]bool{}
	for _, c := range cols {
		have[c.Name()] = true
	}
	for _, required := range []string{"skill_id", "rating", "status"} {
		if !have[required] {
			t.Errorf("skill_ratings.%s is required by publicRatingSource() in "+
				"internal/skill/handler/skills.go — renaming it silently breaks "+
				"marketplace social proof", required)
		}
	}
}

func TestSkillRating_StatusDefaultsToApproved(t *testing.T) {
	db := migrateNewTables(t)
	r := SkillRating{SkillID: "skill-1", UserID: 1, TenantID: 1, Rating: 5}
	if err := db.Create(&r).Error; err != nil {
		t.Fatal(err)
	}
	var got SkillRating
	if err := db.First(&got, "id = ?", r.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.Status != SkillRatingStatusApproved {
		t.Errorf("a rating must default to %q — defaulting to pending would ship a "+
			"table whose every row is invisible, since there is no moderation queue; got %q",
			SkillRatingStatusApproved, got.Status)
	}
}

func TestSkillRating_RatingRange(t *testing.T) {
	db := migrateNewTables(t)
	for i, rating := range []int{0, 6, -1} {
		r := SkillRating{SkillID: "skill-1", UserID: int64(100 + i), TenantID: 1, Rating: rating}
		if err := db.Create(&r).Error; err == nil {
			t.Errorf("rating=%d must be rejected (valid range is 1..5)", rating)
		}
	}
	for i, rating := range []int{1, 5} {
		r := SkillRating{SkillID: "skill-1", UserID: int64(200 + i), TenantID: 1, Rating: rating}
		if err := db.Create(&r).Error; err != nil {
			t.Errorf("rating=%d is a boundary value and must be accepted: %v", rating, err)
		}
	}
}

// TestSkillRating_OneRatingPerUserPerSkill delivers P7's "a user rating the same
// skill twice must not create two rows" at the database layer.
func TestSkillRating_OneRatingPerUserPerSkill(t *testing.T) {
	db := migrateNewTables(t)
	first := SkillRating{SkillID: "skill-1", UserID: 7, TenantID: 1, Rating: 5}
	if err := db.Create(&first).Error; err != nil {
		t.Fatal(err)
	}
	dup := SkillRating{SkillID: "skill-1", UserID: 7, TenantID: 1, Rating: 3}
	if err := db.Create(&dup).Error; err == nil {
		t.Error("the same user rating the same skill twice must be rejected")
	}
	// A different skill, and a different user on the same skill, are both fine.
	if err := db.Create(&SkillRating{SkillID: "skill-2", UserID: 7, TenantID: 1, Rating: 4}).Error; err != nil {
		t.Errorf("the same user must be able to rate a different skill: %v", err)
	}
	if err := db.Create(&SkillRating{SkillID: "skill-1", UserID: 8, TenantID: 1, Rating: 4}).Error; err != nil {
		t.Errorf("a different user must be able to rate the same skill: %v", err)
	}
}

func TestSkillRating_StatusIsConstrained(t *testing.T) {
	db := migrateNewTables(t)
	r := SkillRating{SkillID: "skill-1", UserID: 1, TenantID: 1, Rating: 5, Status: "published"}
	if err := db.Create(&r).Error; err == nil {
		t.Error(`"published" is not a skill_ratings status — the reader accepts it for ` +
			`compatibility with the ops-queue schema, but this table's vocabulary is ` +
			`approved/pending/rejected/hidden`)
	}
}
