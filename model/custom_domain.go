package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-sql-driver/mysql"

	"gorm.io/gorm"
)

var (
	ErrCustomDomainInvalidLabel       = errors.New("custom domain label is invalid")
	ErrCustomDomainReservedLabel      = errors.New("custom domain label is reserved")
	ErrCustomDomainOwnerNotFound      = errors.New("custom domain owner was not found")
	ErrCustomDomainAlreadyAssigned    = errors.New("custom domain label is already assigned")
	ErrCustomDomainOwnerAlreadyActive = errors.New("custom domain owner already has an active domain")
	ErrCustomDomainNotFound           = errors.New("custom domain was not found")
)

// NormalizeCustomDomainLabel returns the canonical, single DNS label used to
// build a trusted custom-domain host. Callers provide the already-normalized
// reserved-label set so policy remains outside the database model.
func NormalizeCustomDomainLabel(raw string, reserved map[string]struct{}) (string, error) {
	label, err := common.NormalizeDNSLabel(raw)
	if err != nil {
		return "", ErrCustomDomainInvalidLabel
	}
	if _, found := reserved[label]; found {
		return "", ErrCustomDomainReservedLabel
	}
	return label, nil
}

// CustomDomain is a permanent label-to-user assignment. A disabled record is
// retained as a tombstone, so its owner cannot be changed or reassigned.
type CustomDomain struct {
	Id            int64      `json:"id" gorm:"primaryKey"`
	Label         string     `json:"label" gorm:"type:varchar(63);not null;uniqueIndex:idx_custom_domains_label"`
	OwnerUserID   int        `json:"owner_user_id" gorm:"not null;index"`
	ActiveOwnerID *int       `json:"-" gorm:"uniqueIndex:idx_custom_domains_active_owner"`
	Enabled       bool       `json:"enabled" gorm:"not null;default:false"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	DisabledAt    *time.Time `json:"disabled_at"`
}

func (CustomDomain) TableName() string {
	return "custom_domains"
}

func CreateCustomDomain(rawLabel string, ownerUserID int) (*CustomDomain, error) {
	if ownerUserID <= 0 {
		return nil, ErrCustomDomainOwnerNotFound
	}
	label, err := NormalizeCustomDomainLabel(rawLabel, nil)
	if err != nil {
		return nil, err
	}

	domain := &CustomDomain{Label: label, OwnerUserID: ownerUserID}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var owner User
		if err := tx.Select("id").First(&owner, "id = ?", ownerUserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCustomDomainOwnerNotFound
			}
			return err
		}

		var existing CustomDomain
		err := tx.Where("label = ?", label).First(&existing).Error
		if err == nil {
			return ErrCustomDomainAlreadyAssigned
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := tx.Create(domain).Error; err != nil {
			if isDatabaseDuplicatedKey(tx, err) {
				return ErrCustomDomainAlreadyAssigned
			}
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return domain, nil
}

func GetCustomDomainByLabel(rawLabel string) (*CustomDomain, error) {
	label, err := NormalizeCustomDomainLabel(rawLabel, nil)
	if err != nil {
		return nil, err
	}
	domain := &CustomDomain{}
	if err := DB.Where("label = ?", label).First(domain).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCustomDomainNotFound
		}
		return nil, err
	}
	return domain, nil
}

func GetCustomDomainByID(id int64) (*CustomDomain, error) {
	if id <= 0 {
		return nil, ErrCustomDomainNotFound
	}
	domain := &CustomDomain{}
	if err := DB.First(domain, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCustomDomainNotFound
		}
		return nil, err
	}
	return domain, nil
}

func ListCustomDomains(enabled *bool) ([]CustomDomain, error) {
	query := DB.Order("label asc")
	if enabled != nil {
		query = query.Where("enabled = ?", *enabled)
	}
	var domains []CustomDomain
	if err := query.Find(&domains).Error; err != nil {
		return nil, err
	}
	return domains, nil
}

func EnableCustomDomain(rawLabel string) (*CustomDomain, error) {
	label, err := NormalizeCustomDomainLabel(rawLabel, nil)
	if err != nil {
		return nil, err
	}

	domain := &CustomDomain{}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("label = ?", label).First(domain).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCustomDomainNotFound
			}
			return err
		}
		if domain.Enabled {
			return nil
		}

		var active CustomDomain
		err := lockForUpdate(tx).Where("active_owner_id = ?", domain.OwnerUserID).First(&active).Error
		if err == nil && active.Id != domain.Id {
			return ErrCustomDomainOwnerAlreadyActive
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		ownerID := domain.OwnerUserID
		domain.Enabled = true
		domain.ActiveOwnerID = &ownerID
		domain.DisabledAt = nil
		if err := tx.Model(domain).Updates(map[string]any{
			"enabled":         true,
			"active_owner_id": ownerID,
			"disabled_at":     nil,
		}).Error; err != nil {
			if isDatabaseDuplicatedKey(tx, err) {
				return ErrCustomDomainOwnerAlreadyActive
			}
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return domain, nil
}

func isDatabaseDuplicatedKey(db *gorm.DB, err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	var mysqlError *mysql.MySQLError
	if errors.As(err, &mysqlError) && mysqlError.Number == 1062 {
		return true
	}
	if db != nil {
		if translator, ok := db.Dialector.(gorm.ErrorTranslator); ok {
			return errors.Is(translator.Translate(err), gorm.ErrDuplicatedKey)
		}
	}
	return false
}

func DisableCustomDomain(rawLabel string) (*CustomDomain, error) {
	label, err := NormalizeCustomDomainLabel(rawLabel, nil)
	if err != nil {
		return nil, err
	}

	domain := &CustomDomain{}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("label = ?", label).First(domain).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCustomDomainNotFound
			}
			return err
		}
		if !domain.Enabled {
			return nil
		}

		now := time.Now()
		domain.Enabled = false
		domain.ActiveOwnerID = nil
		domain.DisabledAt = &now
		return tx.Model(domain).Updates(map[string]any{
			"enabled":         false,
			"active_owner_id": nil,
			"disabled_at":     now,
		}).Error
	})
	if err != nil {
		return nil, err
	}
	return domain, nil
}
