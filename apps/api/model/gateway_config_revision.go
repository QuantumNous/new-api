package model

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// gatewayConfigRevisionID is the primary key of the single revision row. The
// routing revision is a global commit watermark, not a per-entity version, so
// exactly one row exists for the whole deployment.
const gatewayConfigRevisionID = 1

var (
	// ErrGatewayRevisionMissing means the singleton row is absent, so no
	// commit watermark can be advanced. Callers must not fall back to a
	// zero revision, because consumers treat 0 as "never published".
	ErrGatewayRevisionMissing = errors.New("gateway config revision row is missing")
	// ErrGatewayRevisionInvalid means the stored watermark is NULL, zero or
	// negative and therefore cannot be published to consumers.
	ErrGatewayRevisionInvalid = errors.New("gateway config revision is not positive")
)

// GatewayConfigRevision stores the global routing commit watermark. Every
// route-visible configuration mutation advances it exactly once inside the same
// transaction that writes the domain rows.
type GatewayConfigRevision struct {
	ID              int   `json:"id" gorm:"primaryKey"`
	RoutingRevision int64 `json:"routing_revision" gorm:"not null"`
}

// GatewayConfigOutbox records that a routing revision was committed so a
// wake-up notice can be published (and retried) after commit. It intentionally
// carries no configuration payload: no option value, channel key, proxy
// credential or header/parameter override is ever written here.
type GatewayConfigOutbox struct {
	ID                    int        `json:"id" gorm:"primaryKey"`
	RoutingRevision       int64      `json:"routing_revision" gorm:"not null;uniqueIndex"`
	CreatedAt             time.Time  `json:"created_at"`
	PublishedAt           *time.Time `json:"published_at"`
	PublishAttempts       int        `json:"publish_attempts" gorm:"not null"`
	LastPublishErrorClass string     `json:"last_publish_error_class" gorm:"type:varchar(64)"`
}

// InitializeGatewayConfigRevision creates the singleton row when the table is
// empty. It runs after AutoMigrate on both empty and upgraded databases and
// never resets or duplicates an existing watermark, because consumers would
// otherwise see the revision move backwards.
func InitializeGatewayConfigRevision() error {
	var existing int64
	if err := DB.Model(&GatewayConfigRevision{}).Count(&existing).Error; err != nil {
		return err
	}
	if existing == 0 {
		return DB.Create(&GatewayConfigRevision{ID: gatewayConfigRevisionID, RoutingRevision: 1}).Error
	}
	var row GatewayConfigRevision
	if err := DB.Where("id = ?", gatewayConfigRevisionID).Take(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("%w: singleton id %d is absent from non-empty table", ErrGatewayRevisionMissing, gatewayConfigRevisionID)
		}
		return err
	}
	if row.RoutingRevision <= 0 {
		return fmt.Errorf("%w: got %d", ErrGatewayRevisionInvalid, row.RoutingRevision)
	}
	return nil
}

// BumpGatewayRoutingRevision advances the singleton watermark inside tx, reads
// the committed value back through the same transaction and records one outbox
// row for it. The atomic single-row UPDATE serialises concurrent mutations on
// MySQL/PostgreSQL through the row lock it already takes, so no explicit
// SELECT ... FOR UPDATE is required (SQLite has no such syntax anyway).
func BumpGatewayRoutingRevision(tx *gorm.DB) (int64, error) {
	if tx == nil {
		return 0, errors.New("gateway routing revision requires a transaction")
	}
	result := tx.Model(&GatewayConfigRevision{}).
		Where("id = ?", gatewayConfigRevisionID).
		Update("routing_revision", gorm.Expr("routing_revision + ?", 1))
	if result.Error != nil {
		return 0, result.Error
	}
	if result.RowsAffected != 1 {
		return 0, fmt.Errorf("%w: updated %d rows", ErrGatewayRevisionMissing, result.RowsAffected)
	}

	var revision GatewayConfigRevision
	if err := tx.Where("id = ?", gatewayConfigRevisionID).Take(&revision).Error; err != nil {
		return 0, err
	}
	if revision.RoutingRevision <= 0 {
		return 0, fmt.Errorf("%w: got %d", ErrGatewayRevisionInvalid, revision.RoutingRevision)
	}

	if err := tx.Create(&GatewayConfigOutbox{RoutingRevision: revision.RoutingRevision}).Error; err != nil {
		return 0, err
	}
	return revision.RoutingRevision, nil
}

// MutateGatewayRouting owns the single outer transaction for one route-visible
// configuration change: the domain writes performed by mutator, the revision
// bump and the outbox row commit together or roll back together. Callers must
// not nest it inside another MutateGatewayRouting, because one logical mutation
// must produce exactly one revision.
func MutateGatewayRouting(mutator func(tx *gorm.DB) error) (int64, error) {
	if mutator == nil {
		return 0, errors.New("gateway routing mutation requires a mutator")
	}
	var revision int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := mutator(tx); err != nil {
			return err
		}
		var bumpErr error
		revision, bumpErr = BumpGatewayRoutingRevision(tx)
		return bumpErr
	})
	if err != nil {
		return 0, err
	}
	return revision, nil
}

// ListPendingGatewayConfigOutbox returns the oldest unpublished revisions. It
// exposes only the metadata needed by the dispatcher.
func ListPendingGatewayConfigOutbox(limit int) ([]GatewayConfigOutbox, error) {
	if limit <= 0 {
		return nil, errors.New("outbox limit must be positive")
	}
	var rows []GatewayConfigOutbox
	err := DB.Where("published_at IS NULL").
		Order("routing_revision ASC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}

// RecordGatewayConfigOutboxAttempt increments the attempt count once and
// stores only a bounded error class, never provider error text.
func RecordGatewayConfigOutboxAttempt(id int, errorClass string) error {
	if id <= 0 || errorClass == "" || len(errorClass) > 64 {
		return errors.New("invalid outbox publish attempt")
	}
	return DB.Model(&GatewayConfigOutbox{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"publish_attempts":         gorm.Expr("publish_attempts + ?", 1),
			"last_publish_error_class": errorClass,
		}).Error
}

func IncrementGatewayConfigOutboxAttempt(id int, errorClass string) error {
	return RecordGatewayConfigOutboxAttempt(id, errorClass)
}

// MarkGatewayConfigOutboxPublished is idempotent and never overwrites the
// first successful publication timestamp, so a duplicate publisher only causes
// a duplicate notice instead of rewriting history.
func MarkGatewayConfigOutboxPublished(id int, publishedAt time.Time) error {
	if id <= 0 || publishedAt.IsZero() {
		return errors.New("invalid outbox published marker")
	}
	return DB.Model(&GatewayConfigOutbox{}).
		Where("id = ? AND published_at IS NULL", id).
		Update("published_at", publishedAt).Error
}
