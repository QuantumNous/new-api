package skillmodel

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SkillRating.Status values. Plain string constants rather than an enums type,
// matching SkillPurchaseStatus* in purchase.go: four values with one consumer.
//
// Deliberately NOT enums.ReviewStatus. That enum (open/assigned/escalated/
// resolved/reopened) belongs to the ops moderation queue spec'd as skill_reviews,
// and the marketplace reader filters status IN ('approved','published') — the two
// vocabularies intersect at exactly zero values, so reusing it would make every
// rating summary read zero forever with no error and no failing test. See the
// PRD's D1.
const (
	// SkillRatingStatusApproved is the DEFAULT. There is no rating-moderation
	// queue in the product, so defaulting to pending would ship a table whose
	// every row is invisible.
	SkillRatingStatusApproved = "approved"
	SkillRatingStatusPending  = "pending"
	SkillRatingStatusRejected = "rejected"
	SkillRatingStatusHidden   = "hidden"
)

// SkillRating is a user's 1-5 star rating of a skill
// (Module3 P1, docs/tasks/skill-creator-data-model-prd.md).
//
// ⚠️ The column names skill_id / rating / status are load-bearing.
// publicRatingSource() in internal/skill/handler/skills.go duck-types onto a
// table carrying exactly those three, probing "skill_ratings" before
// "skill_reviews". Renaming any of them silently severs the marketplace's
// social-proof read path — no error, the summaries just go back to zero.
//
// Table name is skill_ratings, not skill_reviews: the latter is already spec'd
// in docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md §4.6 as the ops
// moderation queue, and is where enums.ReviewStatus comes from.
type SkillRating struct {
	ID string `gorm:"column:id;type:char(36);primaryKey;not null"`

	// The unique index is how "one user, one rating per skill" is enforced —
	// at the database, not in a handler that a future caller might bypass.
	SkillID string `gorm:"column:skill_id;type:char(36);not null;uniqueIndex:idx_skill_ratings_skill_user,priority:1;index:idx_skill_ratings_skill_status,priority:1"`
	UserID  int64  `gorm:"column:user_id;type:bigint;not null;uniqueIndex:idx_skill_ratings_skill_user,priority:2"`

	TenantID int64 `gorm:"column:tenant_id;type:bigint;not null"`

	Rating  int     `gorm:"column:rating;type:integer;not null;check:chk_skill_ratings_rating,rating BETWEEN 1 AND 5"`
	Comment *string `gorm:"column:comment;type:text"`

	Status string `gorm:"column:status;type:varchar(32);not null;default:approved;check:chk_skill_ratings_status,status IN ('approved','pending','rejected','hidden');index:idx_skill_ratings_skill_status,priority:2"`

	CreatedAt time.Time `gorm:"column:created_at;not null;autoCreateTime"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null;autoUpdateTime"`
}

func (SkillRating) TableName() string { return "skill_ratings" }

func (r *SkillRating) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	if r.Status == "" {
		r.Status = SkillRatingStatusApproved
	}
	return nil
}

// MigrateSkillRatings creates the user-rating table.
//
// Creating it changes no behaviour on its own: publicRatingSource() currently
// finds no table and every skill reports {0, 0}; afterwards it finds an empty
// table and the GROUP BY returns no rows, so every skill still reports {0, 0}.
// The first observable change comes when P7 writes the first row.
func MigrateSkillRatings(db *gorm.DB) error {
	if err := db.AutoMigrate(&SkillRating{}); err != nil {
		return fmt.Errorf("AutoMigrate skill_ratings: %w", err)
	}
	return nil
}
