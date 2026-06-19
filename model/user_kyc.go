package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// ─── UserKYCImage ─────────────────────────────────────────────────────────────

// UserKYCImage stores encrypted front/back ID card images, 1:1 with UserKYC.
// Kept in a separate table so large TEXT columns don't affect list-query performance.
//
// DeletedAt enables soft delete so the image row can follow the user-account
// soft-delete lifecycle. Business-level revocation operations (user-revoke,
// admin reset, hard user delete) still use Unscoped().Delete to truly remove
// the row.
type UserKYCImage struct {
	Id        int            `gorm:"primaryKey;autoIncrement"`
	KYCId     int            `gorm:"uniqueIndex;not null"` // 1:1 with user_kycs.id
	UserId    int            `gorm:"index;not null"`
	FrontEnc  string         `gorm:"type:text;not null"` // AES-256-GCM encrypted base64
	BackEnc   string         `gorm:"type:text;not null"` // AES-256-GCM encrypted base64
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

const (
	KYCStatusPending  = 1
	KYCStatusApproved = 2
	KYCStatusRejected = 3

	KYCIdTypeIDCard   = "id_card"
	KYCIdTypePassport = "passport"
	KYCIdTypeOther    = "other"
)

type UserKYC struct {
	Id           int            `json:"id"                      gorm:"primaryKey;autoIncrement"`
	UserId       int            `json:"user_id"                 gorm:"index;not null"`
	RealName     string         `json:"real_name"               gorm:"type:varchar(64);not null"`
	IdType       string         `json:"id_type"                 gorm:"type:varchar(32);not null;default:'id_card'"`
	IdNumberEnc  string         `json:"-"                       gorm:"type:text;column:id_number_enc;not null"`
	IdNumberHash string         `json:"-"                       gorm:"type:varchar(64);column:id_number_hash;not null"`
	SubmitCount  int            `json:"submit_count"            gorm:"type:int;not null;default:0"`
	Status       int            `json:"status"                  gorm:"type:int;not null;default:1;index"`
	RejectReason string         `json:"reject_reason,omitempty" gorm:"type:varchar(255)"`
	ReviewedBy   int            `json:"reviewed_by,omitempty"   gorm:"type:int;column:reviewed_by"`
	SubmittedAt  *time.Time     `json:"submitted_at,omitempty"`
	VerifiedAt   *time.Time     `json:"verified_at,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-"                       gorm:"index"`
}

var ErrKYCDuplicateID = errors.New("该证件已被其他账号使用")
var ErrKYCSubmitLimitExceeded = errors.New("提交次数已达上限")

func GetKYCByUserId(userId int) (*UserKYC, error) {
	var kyc UserKYC
	err := DB.Where("user_id = ?", userId).First(&kyc).Error
	if err != nil {
		return nil, err
	}
	return &kyc, nil
}

func GetKYCById(id int) (*UserKYC, error) {
	var kyc UserKYC
	err := DB.First(&kyc, id).Error
	if err != nil {
		return nil, err
	}
	return &kyc, nil
}

// upsertKYCCore is the tx-aware implementation shared by UpsertKYC and
// UpsertKYCWithImages. Cache invalidation must be done by the caller after
// the transaction commits.
func upsertKYCCore(db *gorm.DB, userId int, realName, idType, idNumberEnc, idNumberHash string) (*UserKYC, error) {
	// B. Cross-account dedup
	var dupCount int64
	db.Model(&UserKYC{}).
		Where("id_number_hash = ? AND status = ? AND user_id != ? AND deleted_at IS NULL", idNumberHash, KYCStatusApproved, userId).
		Count(&dupCount)
	if dupCount > 0 {
		return nil, ErrKYCDuplicateID
	}

	now := time.Now()

	// A. Find latest record for this user (including soft-deleted)
	var existing UserKYC
	err := db.Unscoped().Where("user_id = ?", userId).Order("id DESC").First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	noRecord := errors.Is(err, gorm.ErrRecordNotFound)

	if noRecord {
		// C1: first submission
		kyc := &UserKYC{
			UserId:       userId,
			RealName:     realName,
			IdType:       idType,
			IdNumberEnc:  idNumberEnc,
			IdNumberHash: idNumberHash,
			SubmitCount:  1,
			Status:       KYCStatusPending,
			SubmittedAt:  &now,
		}
		if err := db.Create(kyc).Error; err != nil {
			return nil, err
		}
		if err := db.Model(&User{}).Where("id = ?", userId).Update("kyc_status", KYCStatusPending).Error; err != nil {
			return nil, err
		}
		return kyc, nil
	}

	if existing.DeletedAt.Valid {
		// C3: restore soft-deleted record
		existing.DeletedAt = gorm.DeletedAt{}
		existing.RealName = realName
		existing.IdType = idType
		existing.IdNumberEnc = idNumberEnc
		existing.IdNumberHash = idNumberHash
		existing.SubmitCount = 1
		existing.Status = KYCStatusPending
		existing.RejectReason = ""
		existing.ReviewedBy = 0
		existing.VerifiedAt = nil
		existing.SubmittedAt = &now
		if err := db.Unscoped().Save(&existing).Error; err != nil {
			return nil, err
		}
	} else {
		// C2: active record (pending or rejected)
		newCount := existing.SubmitCount + 1
		if newCount > common.KYCMaxSubmitCount {
			return nil, ErrKYCSubmitLimitExceeded
		}
		existing.SubmitCount = newCount
		existing.RealName = realName
		existing.IdType = idType
		existing.IdNumberEnc = idNumberEnc
		existing.IdNumberHash = idNumberHash
		existing.Status = KYCStatusPending
		existing.RejectReason = ""
		existing.ReviewedBy = 0
		existing.VerifiedAt = nil
		existing.SubmittedAt = &now
		if err := db.Save(&existing).Error; err != nil {
			return nil, err
		}
	}

	if err := db.Model(&User{}).Where("id = ?", userId).Update("kyc_status", KYCStatusPending).Error; err != nil {
		return nil, err
	}
	return &existing, nil
}

// UpsertKYC creates or updates a KYC record (no images).
func UpsertKYC(userId int, realName, idType, idNumberEnc, idNumberHash string) (*UserKYC, error) {
	kyc, err := upsertKYCCore(DB, userId, realName, idType, idNumberEnc, idNumberHash)
	if err == nil {
		_ = InvalidateUserCache(userId)
	}
	return kyc, err
}

// UpsertKYCWithImages runs UpsertKYC + UpsertKYCImages in a single transaction.
func UpsertKYCWithImages(userId int, realName, idType, idNumberEnc, idNumberHash, frontEnc, backEnc string) (*UserKYC, error) {
	var kyc *UserKYC
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		kyc, err = upsertKYCCore(tx, userId, realName, idType, idNumberEnc, idNumberHash)
		if err != nil {
			return err
		}
		return upsertKYCImagesTx(tx, kyc.Id, userId, frontEnc, backEnc)
	})
	if err == nil {
		_ = InvalidateUserCache(userId)
	}
	return kyc, err
}

// upsertKYCImagesTx inserts or overwrites the image record within a transaction.
//
// Uses Unscoped() to also see soft-deleted rows: with the unique index on
// kyc_id, a leftover soft-deleted row would otherwise block a fresh INSERT.
// If found, restore (clear DeletedAt) and overwrite the encrypted blobs.
func upsertKYCImagesTx(db *gorm.DB, kycId, userId int, frontEnc, backEnc string) error {
	var existing UserKYCImage
	err := db.Unscoped().Where("kyc_id = ?", kycId).First(&existing).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		return db.Create(&UserKYCImage{
			KYCId: kycId, UserId: userId,
			FrontEnc: frontEnc, BackEnc: backEnc,
		}).Error
	}
	existing.DeletedAt = gorm.DeletedAt{}
	existing.FrontEnc = frontEnc
	existing.BackEnc = backEnc
	return db.Unscoped().Save(&existing).Error
}

// UpsertKYCImages inserts or overwrites the image record (non-transactional helper).
func UpsertKYCImages(kycId, userId int, frontEnc, backEnc string) error {
	return upsertKYCImagesTx(DB, kycId, userId, frontEnc, backEnc)
}

// GetKYCImages returns the encrypted image record for a KYC entry.
func GetKYCImages(kycId int) (*UserKYCImage, error) {
	var img UserKYCImage
	err := DB.Where("kyc_id = ?", kycId).First(&img).Error
	if err != nil {
		return nil, err
	}
	return &img, nil
}

// DeleteKYCImagesByKYCId hard-deletes the image record for the given KYC ID.
// Used by explicit revocation flows: user revoke, admin reset, hard user delete.
// Uses Unscoped() so the row is truly removed regardless of soft-delete state.
func DeleteKYCImagesByKYCId(kycId int) error {
	return DB.Unscoped().Where("kyc_id = ?", kycId).Delete(&UserKYCImage{}).Error
}

// SoftDeleteKYCImagesByKYCId soft-deletes the image record so it follows the
// user-account soft-delete lifecycle. Used by User.Delete().
func SoftDeleteKYCImagesByKYCId(kycId int) error {
	return DB.Where("kyc_id = ?", kycId).Delete(&UserKYCImage{}).Error
}

// HasKYCImages reports whether any image record exists for the given KYC ID.
func HasKYCImages(kycId int) bool {
	var count int64
	DB.Model(&UserKYCImage{}).Where("kyc_id = ?", kycId).Count(&count)
	return count > 0
}

func ApproveKYC(id int, reviewerId int) error {
	kyc, err := GetKYCById(id)
	if err != nil {
		return err
	}
	if kyc.Status != KYCStatusPending {
		return errors.New("当前记录状态不是待审核")
	}
	now := time.Now()
	updates := map[string]interface{}{
		"status":      KYCStatusApproved,
		"reviewed_by": reviewerId,
		"verified_at": now,
	}
	if err := DB.Model(kyc).Updates(updates).Error; err != nil {
		return err
	}
	if err := DB.Model(&User{}).Where("id = ?", kyc.UserId).Update("kyc_status", KYCStatusApproved).Error; err != nil {
		return err
	}
	_ = InvalidateUserCache(kyc.UserId)
	return nil
}

func RejectKYC(id int, reviewerId int, reason string) error {
	kyc, err := GetKYCById(id)
	if err != nil {
		return err
	}
	if kyc.Status != KYCStatusPending {
		return errors.New("当前记录状态不是待审核")
	}
	updates := map[string]interface{}{
		"status":        KYCStatusRejected,
		"reviewed_by":   reviewerId,
		"reject_reason": reason,
	}
	if err := DB.Model(kyc).Updates(updates).Error; err != nil {
		return err
	}
	if err := DB.Model(&User{}).Where("id = ?", kyc.UserId).Update("kyc_status", KYCStatusRejected).Error; err != nil {
		return err
	}
	_ = InvalidateUserCache(kyc.UserId)
	return nil
}

// ResetKYC fully reverts the KYC record back to the unverified (0) state so
// the user must re-submit name, ID number, and images. The user_kycs row is
// hard-deleted (Unscoped) — soft-delete provides no real audit value here
// since the next submit's UpsertKYC C3 path would overwrite all in-row audit
// fields anyway. User must re-POST to create a fresh row (C1 path).
//
// reviewerId is unused; kept in the signature for API stability.
func ResetKYC(id int, reviewerId int) error {
	kyc, err := GetKYCById(id)
	if err != nil {
		return err
	}
	if err := DB.Unscoped().Delete(kyc).Error; err != nil {
		return err
	}
	if err := DB.Model(&User{}).Where("id = ?", kyc.UserId).Update("kyc_status", 0).Error; err != nil {
		return err
	}
	_ = InvalidateUserCache(kyc.UserId)
	return nil
}

func DeleteKYCByUserId(userId int) error {
	kyc, err := GetKYCByUserId(userId)
	if err != nil {
		return err
	}
	if kyc.Status != KYCStatusPending {
		return errors.New("只有待审核状态可以撤销")
	}
	if err := DB.Delete(kyc).Error; err != nil {
		return err
	}
	if err := DB.Model(&User{}).Where("id = ?", userId).Update("kyc_status", 0).Error; err != nil {
		return err
	}
	_ = InvalidateUserCache(userId)
	return nil
}

// KYCAdminRow is the result shape of the admin-list JOIN query: a UserKYC
// record plus the denormalized username and reviewer username. Used to avoid
// N+1 user lookups when rendering the admin list.
type KYCAdminRow struct {
	UserKYC
	Username     string `gorm:"column:username"`
	ReviewerName string `gorm:"column:reviewer_name"`
}

// GetKYCList returns paginated KYC records joined with usernames in a single
// query. status=0 means all statuses.
//
// Cross-DB note: only unquoted lowercase identifiers are used in the JOIN, so
// no PostgreSQL/MySQL/SQLite dialect divergence is needed (per CLAUDE.md Rule 2).
func GetKYCList(status int, keyword string, page, pageSize int) ([]*KYCAdminRow, int64, error) {
	var rows []*KYCAdminRow
	var total int64

	// Build base query with JOIN so keyword can filter on username.
	baseQuery := DB.Model(&UserKYC{}).
		Joins("LEFT JOIN users u1 ON u1.id = user_kycs.user_id")
	if status != 0 {
		baseQuery = baseQuery.Where("user_kycs.status = ?", status)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		baseQuery = baseQuery.Where("u1.username LIKE ? OR user_kycs.real_name LIKE ?", like, like)
	}

	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	query := DB.Model(&UserKYC{}).
		Select("user_kycs.*, u1.username AS username, u2.username AS reviewer_name").
		Joins("LEFT JOIN users u1 ON u1.id = user_kycs.user_id").
		Joins("LEFT JOIN users u2 ON u2.id = user_kycs.reviewed_by")
	if status != 0 {
		query = query.Where("user_kycs.status = ?", status)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("u1.username LIKE ? OR user_kycs.real_name LIKE ?", like, like)
	}

	offset := (page - 1) * pageSize
	if err := query.Order("user_kycs.id DESC").Offset(offset).Limit(pageSize).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// CountPendingKYC 待审核实名认证数（status=待审核）。
func CountPendingKYC() (int64, error) {
	var n int64
	err := DB.Model(&UserKYC{}).
		Where("status = ?", KYCStatusPending).Count(&n).Error
	return n, err
}
