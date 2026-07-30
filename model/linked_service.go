package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// LinkedService tracks external services whose admin credentials are managed
// through ReX API's control plane. Passwords are never stored here; only the
// adapter type, sync status, and a hashed token used by the sync worker.
const (
	LinkedServiceAdapterKiroGo    = "kiro-go"
	LinkedServiceAdapterKiroRs    = "kiro-rs"
	LinkedServiceAdapterOB1       = "ob1"
	LinkedServiceAdapterCodexPool = "codex-pool"
	LinkedServiceAdapterCloudMail = "cloud-mail"

	LinkedServiceStatusOK      = "ok"
	LinkedServiceStatusPending = "pending"
	LinkedServiceStatusFailed  = "failed"
)

type LinkedService struct {
	ID          int64  `json:"id"           gorm:"primaryKey;autoIncrement"`
	Name        string `json:"name"         gorm:"type:varchar(64);uniqueIndex;not null"`
	Adapter     string `json:"adapter"      gorm:"type:varchar(32);not null"`
	AdminURL    string `json:"admin_url"    gorm:"type:varchar(512)"`
	// SyncToken is an HMAC-SHA256 hex token that the sync worker sends to the
	// target service when applying the credential update. It is NOT the admin
	// password. Stored hashed in this column.
	SyncTokenHash string `json:"-" gorm:"type:varchar(128)"`
	Revision      int64  `json:"revision"     gorm:"bigint;default:0"`
	SyncStatus    string `json:"sync_status"  gorm:"type:varchar(32);default:'pending'"`
	SyncError     string `json:"sync_error"   gorm:"type:text"`
	LastSyncAt    int64  `json:"last_sync_at" gorm:"bigint;default:0"`
	CreatedAt     int64  `json:"created_at"   gorm:"bigint;index"`
	UpdatedAt     int64  `json:"updated_at"   gorm:"bigint;index"`
}

func (s *LinkedService) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if s.CreatedAt == 0 {
		s.CreatedAt = now
	}
	if s.UpdatedAt == 0 {
		s.UpdatedAt = now
	}
	return nil
}

func ListLinkedServices() ([]*LinkedService, error) {
	var services []*LinkedService
	err := DB.Order("id asc").Find(&services).Error
	return services, err
}

func GetLinkedServiceByID(id int64) (*LinkedService, error) {
	var s LinkedService
	err := DB.Where("id = ?", id).First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &s, err
}

func GetLinkedServiceByName(name string) (*LinkedService, error) {
	var s LinkedService
	err := DB.Where("name = ?", name).First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &s, err
}

func CreateLinkedService(s *LinkedService) error {
	return DB.Create(s).Error
}

func UpdateLinkedService(s *LinkedService) error {
	s.UpdatedAt = common.GetTimestamp()
	return DB.Save(s).Error
}

func DeleteLinkedService(id int64) error {
	return DB.Where("id = ?", id).Delete(&LinkedService{}).Error
}

// MarkLinkedServiceSynced records a successful sync at the given revision.
func MarkLinkedServiceSynced(id int64, revision int64) error {
	return DB.Model(&LinkedService{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"sync_status": LinkedServiceStatusOK,
			"sync_error":  "",
			"revision":    revision,
			"last_sync_at": common.GetTimestamp(),
			"updated_at":  common.GetTimestamp(),
		}).Error
}

// MarkLinkedServiceFailed records a sync failure.
func MarkLinkedServiceFailed(id int64, errMsg string) error {
	return DB.Model(&LinkedService{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"sync_status": LinkedServiceStatusFailed,
			"sync_error":  errMsg,
			"updated_at":  common.GetTimestamp(),
		}).Error
}
