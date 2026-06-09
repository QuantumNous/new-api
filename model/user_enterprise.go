package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// ─── UserEnterpriseImage ──────────────────────────────────────────────────────

// UserEnterpriseImage stores the encrypted business-license image plus the
// legal representative's ID card front/back, 1:1 with UserEnterprise. Kept in a
// separate table so the large image blobs don't bloat list-query rows.
//
// The image columns deliberately omit a `type:text` tag so GORM uses its default
// string mapping per dialect — MySQL longtext (4GB) / PostgreSQL text / SQLite
// text — all of which hold ~2MB encrypted base64. An explicit `type:text` would
// cap MySQL at 64KiB and truncate real uploads.
//
// DeletedAt enables soft delete so rows can follow the user-account soft-delete
// lifecycle. Business revocation (user-revoke, admin reset, hard user delete)
// uses Unscoped().Delete to truly remove the row.
type UserEnterpriseImage struct {
	Id            int    `gorm:"primaryKey;autoIncrement"`
	EnterpriseId  int    `gorm:"uniqueIndex;not null"` // 1:1 with user_enterprises.id
	UserId        int    `gorm:"index;not null"`
	LicenseEnc    string `gorm:"not null"` // 营业执照（AES-256-GCM 加密 base64）
	LegalFrontEnc string `gorm:"not null"` // 法人身份证正面
	LegalBackEnc  string `gorm:"not null"` // 法人身份证背面
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     gorm.DeletedAt `gorm:"index"`
}

const (
	EnterpriseStatusPending  = 1
	EnterpriseStatusApproved = 2
	EnterpriseStatusRejected = 3
)

// UserEnterprise holds an enterprise certification record. Sensitive fields
// (USCC, legal-rep ID number) are encrypted; the company name and legal-rep
// name are stored plaintext since admins need to read them directly during
// review. Dedup is keyed on uscc_hash (one社会信用代码 == one legal entity).
type UserEnterprise struct {
	Id            int            `json:"id"                       gorm:"primaryKey;autoIncrement"`
	UserId        int            `json:"user_id"                  gorm:"index;not null"`
	CompanyName   string         `json:"company_name"             gorm:"type:varchar(128);not null"`
	UsccEnc       string         `json:"-"                        gorm:"type:text;column:uscc_enc;not null"`
	UsccHash      string         `json:"-"                        gorm:"type:varchar(64);column:uscc_hash;not null"`
	LegalRepName  string         `json:"legal_rep_name"           gorm:"type:varchar(64);not null"`
	LegalRepIdEnc string         `json:"-"                        gorm:"type:text;column:legal_rep_id_enc;not null"`
	ContactName   string         `json:"contact_name,omitempty"   gorm:"type:varchar(64)"`
	ContactPhone  string         `json:"contact_phone,omitempty"  gorm:"type:varchar(32)"`
	SubmitCount   int            `json:"submit_count"             gorm:"type:int;not null;default:0"`
	Status        int            `json:"status"                   gorm:"type:int;not null;default:1"`
	RejectReason  string         `json:"reject_reason,omitempty"  gorm:"type:varchar(255)"`
	ReviewedBy    int            `json:"reviewed_by,omitempty"    gorm:"type:int;column:reviewed_by"`
	SubmittedAt   *time.Time     `json:"submitted_at,omitempty"`
	VerifiedAt    *time.Time     `json:"verified_at,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"-"                        gorm:"index"`
}

var ErrEnterpriseDuplicateUscc = errors.New("该企业已被其他账号认证")
var ErrEnterpriseSubmitLimitExceeded = errors.New("提交次数已达上限")

func GetEnterpriseByUserId(userId int) (*UserEnterprise, error) {
	var ent UserEnterprise
	err := DB.Where("user_id = ?", userId).First(&ent).Error
	if err != nil {
		return nil, err
	}
	return &ent, nil
}

func GetEnterpriseById(id int) (*UserEnterprise, error) {
	var ent UserEnterprise
	err := DB.First(&ent, id).Error
	if err != nil {
		return nil, err
	}
	return &ent, nil
}

// EnterpriseFields carries the mutable fields written on submit/update so the
// core upsert doesn't take a long positional argument list.
type EnterpriseFields struct {
	CompanyName   string
	UsccEnc       string
	UsccHash      string
	LegalRepName  string
	LegalRepIdEnc string
	ContactName   string
	ContactPhone  string
}

// upsertEnterpriseCore is the tx-aware implementation shared by
// UpsertEnterprise and UpsertEnterpriseWithImages. Cache invalidation is the
// caller's responsibility after the transaction commits.
func upsertEnterpriseCore(db *gorm.DB, userId int, f EnterpriseFields) (*UserEnterprise, error) {
	// B. Cross-account dedup on USCC hash.
	var dupCount int64
	db.Model(&UserEnterprise{}).
		Where("uscc_hash = ? AND status = ? AND user_id != ? AND deleted_at IS NULL", f.UsccHash, EnterpriseStatusApproved, userId).
		Count(&dupCount)
	if dupCount > 0 {
		return nil, ErrEnterpriseDuplicateUscc
	}

	now := time.Now()

	// A. Find latest record for this user (including soft-deleted).
	var existing UserEnterprise
	err := db.Unscoped().Where("user_id = ?", userId).Order("id DESC").First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// C1: first submission.
		ent := &UserEnterprise{
			UserId:        userId,
			CompanyName:   f.CompanyName,
			UsccEnc:       f.UsccEnc,
			UsccHash:      f.UsccHash,
			LegalRepName:  f.LegalRepName,
			LegalRepIdEnc: f.LegalRepIdEnc,
			ContactName:   f.ContactName,
			ContactPhone:  f.ContactPhone,
			SubmitCount:   1,
			Status:        EnterpriseStatusPending,
			SubmittedAt:   &now,
		}
		if err := db.Create(ent).Error; err != nil {
			return nil, err
		}
		if err := db.Model(&User{}).Where("id = ?", userId).Update("enterprise_status", EnterpriseStatusPending).Error; err != nil {
			return nil, err
		}
		return ent, nil
	}

	if existing.DeletedAt.Valid {
		// C3: restore soft-deleted record (submit_count resets to 1).
		existing.DeletedAt = gorm.DeletedAt{}
		existing.SubmitCount = 1
	} else {
		// C2: active record (pending or rejected) — accumulate submit_count.
		newCount := existing.SubmitCount + 1
		if newCount > common.EnterpriseMaxSubmitCount {
			return nil, ErrEnterpriseSubmitLimitExceeded
		}
		existing.SubmitCount = newCount
	}

	existing.CompanyName = f.CompanyName
	existing.UsccEnc = f.UsccEnc
	existing.UsccHash = f.UsccHash
	existing.LegalRepName = f.LegalRepName
	existing.LegalRepIdEnc = f.LegalRepIdEnc
	existing.ContactName = f.ContactName
	existing.ContactPhone = f.ContactPhone
	existing.Status = EnterpriseStatusPending
	existing.RejectReason = ""
	existing.ReviewedBy = 0
	existing.VerifiedAt = nil
	existing.SubmittedAt = &now
	if err := db.Unscoped().Save(&existing).Error; err != nil {
		return nil, err
	}

	if err := db.Model(&User{}).Where("id = ?", userId).Update("enterprise_status", EnterpriseStatusPending).Error; err != nil {
		return nil, err
	}
	return &existing, nil
}

// UpsertEnterpriseWithImages runs the core upsert + image upsert atomically.
func UpsertEnterpriseWithImages(userId int, f EnterpriseFields, licenseEnc, legalFrontEnc, legalBackEnc string) (*UserEnterprise, error) {
	var ent *UserEnterprise
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		ent, err = upsertEnterpriseCore(tx, userId, f)
		if err != nil {
			return err
		}
		return upsertEnterpriseImagesTx(tx, ent.Id, userId, licenseEnc, legalFrontEnc, legalBackEnc)
	})
	if err == nil {
		_ = InvalidateUserCache(userId)
	}
	return ent, err
}

// upsertEnterpriseImagesTx inserts or overwrites the image record within a
// transaction. Uses Unscoped() so a leftover soft-deleted row (held by the
// unique index on enterprise_id) is restored rather than colliding on INSERT.
func upsertEnterpriseImagesTx(db *gorm.DB, enterpriseId, userId int, licenseEnc, legalFrontEnc, legalBackEnc string) error {
	var existing UserEnterpriseImage
	err := db.Unscoped().Where("enterprise_id = ?", enterpriseId).First(&existing).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		return db.Create(&UserEnterpriseImage{
			EnterpriseId: enterpriseId, UserId: userId,
			LicenseEnc: licenseEnc, LegalFrontEnc: legalFrontEnc, LegalBackEnc: legalBackEnc,
		}).Error
	}
	existing.DeletedAt = gorm.DeletedAt{}
	existing.LicenseEnc = licenseEnc
	existing.LegalFrontEnc = legalFrontEnc
	existing.LegalBackEnc = legalBackEnc
	return db.Unscoped().Save(&existing).Error
}

// GetEnterpriseImages returns the encrypted image record for an enterprise entry.
func GetEnterpriseImages(enterpriseId int) (*UserEnterpriseImage, error) {
	var img UserEnterpriseImage
	err := DB.Where("enterprise_id = ?", enterpriseId).First(&img).Error
	if err != nil {
		return nil, err
	}
	return &img, nil
}

// DeleteEnterpriseImagesByEnterpriseId hard-deletes the image record. Used by
// explicit revocation flows: user revoke, admin reset, hard user delete.
func DeleteEnterpriseImagesByEnterpriseId(enterpriseId int) error {
	return DB.Unscoped().Where("enterprise_id = ?", enterpriseId).Delete(&UserEnterpriseImage{}).Error
}

// SoftDeleteEnterpriseImagesByEnterpriseId soft-deletes the image record so it
// follows the user-account soft-delete lifecycle. Used by User.Delete().
func SoftDeleteEnterpriseImagesByEnterpriseId(enterpriseId int) error {
	return DB.Where("enterprise_id = ?", enterpriseId).Delete(&UserEnterpriseImage{}).Error
}

// HasEnterpriseImages reports whether an image record exists for the entry.
func HasEnterpriseImages(enterpriseId int) bool {
	var count int64
	DB.Model(&UserEnterpriseImage{}).Where("enterprise_id = ?", enterpriseId).Count(&count)
	return count > 0
}

func ApproveEnterprise(id int, reviewerId int) error {
	ent, err := GetEnterpriseById(id)
	if err != nil {
		return err
	}
	if ent.Status != EnterpriseStatusPending {
		return errors.New("当前记录状态不是待审核")
	}
	now := time.Now()
	err = DB.Transaction(func(tx *gorm.DB) error {
		// Re-check cross-account dedup inside the tx before approving: two
		// accounts can both submit the same USCC while both are pending
		// (submit-time dedup only looks at already-approved rows). If another
		// account's record for the same USCC got approved while this one waited,
		// refuse — one 统一社会信用代码 maps to one approved enterprise.
		//
		// This shrinks but doesn't fully close a TOCTOU window if two admins
		// approve two same-USCC records at the exact same instant; a DB unique
		// constraint is intentionally avoided (soft-deleted rows would block
		// re-submits), and manual admin approval isn't concurrent at scale.
		var dupCount int64
		tx.Model(&UserEnterprise{}).
			Where("uscc_hash = ? AND status = ? AND user_id != ? AND deleted_at IS NULL", ent.UsccHash, EnterpriseStatusApproved, ent.UserId).
			Count(&dupCount)
		if dupCount > 0 {
			return ErrEnterpriseDuplicateUscc
		}
		if err := tx.Model(ent).Updates(map[string]interface{}{
			"status":      EnterpriseStatusApproved,
			"reviewed_by": reviewerId,
			"verified_at": now,
		}).Error; err != nil {
			return err
		}
		return tx.Model(&User{}).Where("id = ?", ent.UserId).Update("enterprise_status", EnterpriseStatusApproved).Error
	})
	if err != nil {
		return err
	}
	_ = InvalidateUserCache(ent.UserId)
	return nil
}

func RejectEnterprise(id int, reviewerId int, reason string) error {
	ent, err := GetEnterpriseById(id)
	if err != nil {
		return err
	}
	if ent.Status != EnterpriseStatusPending {
		return errors.New("当前记录状态不是待审核")
	}
	updates := map[string]interface{}{
		"status":        EnterpriseStatusRejected,
		"reviewed_by":   reviewerId,
		"reject_reason": reason,
	}
	if err := DB.Model(ent).Updates(updates).Error; err != nil {
		return err
	}
	if err := DB.Model(&User{}).Where("id = ?", ent.UserId).Update("enterprise_status", EnterpriseStatusRejected).Error; err != nil {
		return err
	}
	_ = InvalidateUserCache(ent.UserId)
	return nil
}

// ResetEnterprise hard-deletes the record back to the unverified (0) state. The
// user must re-submit all info; images are removed by the caller beforehand.
// reviewerId is unused; kept for API symmetry with the KYC layer.
func ResetEnterprise(id int, reviewerId int) error {
	ent, err := GetEnterpriseById(id)
	if err != nil {
		return err
	}
	if err := DB.Unscoped().Delete(ent).Error; err != nil {
		return err
	}
	if err := DB.Model(&User{}).Where("id = ?", ent.UserId).Update("enterprise_status", 0).Error; err != nil {
		return err
	}
	_ = InvalidateUserCache(ent.UserId)
	return nil
}

func DeleteEnterpriseByUserId(userId int) error {
	ent, err := GetEnterpriseByUserId(userId)
	if err != nil {
		return err
	}
	if ent.Status != EnterpriseStatusPending {
		return errors.New("只有待审核状态可以撤销")
	}
	if err := DB.Delete(ent).Error; err != nil {
		return err
	}
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("enterprise_status", 0).Error; err != nil {
		return err
	}
	_ = InvalidateUserCache(userId)
	return nil
}

// EnterpriseAdminRow is the JOIN result shape for the admin list: a
// UserEnterprise plus denormalized username and reviewer username.
type EnterpriseAdminRow struct {
	UserEnterprise
	Username     string `gorm:"column:username"`
	ReviewerName string `gorm:"column:reviewer_name"`
}

// GetEnterpriseList returns paginated enterprise records joined with usernames.
// status=0 means all statuses. Only unquoted lowercase identifiers are used in
// the JOIN, so no dialect-specific quoting is needed (CLAUDE.md Rule 2).
func GetEnterpriseList(status int, keyword string, page, pageSize int) ([]*EnterpriseAdminRow, int64, error) {
	var rows []*EnterpriseAdminRow
	var total int64

	baseQuery := DB.Model(&UserEnterprise{}).
		Joins("LEFT JOIN users u1 ON u1.id = user_enterprises.user_id")
	if status != 0 {
		baseQuery = baseQuery.Where("user_enterprises.status = ?", status)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		baseQuery = baseQuery.Where("u1.username LIKE ? OR user_enterprises.company_name LIKE ?", like, like)
	}

	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	query := DB.Model(&UserEnterprise{}).
		Select("user_enterprises.*, u1.username AS username, u2.username AS reviewer_name").
		Joins("LEFT JOIN users u1 ON u1.id = user_enterprises.user_id").
		Joins("LEFT JOIN users u2 ON u2.id = user_enterprises.reviewed_by")
	if status != 0 {
		query = query.Where("user_enterprises.status = ?", status)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("u1.username LIKE ? OR user_enterprises.company_name LIKE ?", like, like)
	}

	offset := (page - 1) * pageSize
	if err := query.Order("user_enterprises.id DESC").Offset(offset).Limit(pageSize).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}
