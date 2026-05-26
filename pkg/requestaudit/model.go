package requestaudit

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RelayAuditRecord struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	RequestId   string `json:"request_id" gorm:"type:varchar(64);uniqueIndex;not null;default:''"`
	Method      string `json:"method" gorm:"type:varchar(16);not null;default:''"`
	Path        string `json:"path" gorm:"type:varchar(512);not null;default:''"`
	ClientIp    string `json:"client_ip" gorm:"type:varchar(64);not null;default:''"`
	ContentType string `json:"content_type" gorm:"type:varchar(256);not null;default:''"`
	Body        string `json:"body" gorm:"type:text"`
	BodySize    int    `json:"body_size" gorm:"not null;default:0"`
	Truncated   bool   `json:"truncated" gorm:"not null;default:false"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;not null;index"`
}

func (RelayAuditRecord) TableName() string {
	return "relay_audit_records"
}

func saveRecord(db *gorm.DB, record *RelayAuditRecord) error {
	if db == nil || record == nil {
		return nil
	}
	record.CreatedAt = time.Now().Unix()
	return db.Clauses(clause.OnConflict{DoNothing: true}).Create(record).Error
}
