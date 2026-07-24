package model

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const invitationCodePrefixLength = 8

var (
	ErrInvitationCodeNotProvided = errors.New("invitation code not provided")
	ErrInvitationCodeInvalid     = errors.New("invalid invitation code")
	ErrInvitationCodeUsed        = errors.New("invitation code has been used")
	ErrInvitationCodeExpired     = errors.New("invitation code has expired")
	ErrInvitationCodeDisabled    = errors.New("invitation code has been disabled")
)

type InvitationCode struct {
	Id           int            `json:"id"`
	Name         string         `json:"name" gorm:"index"`
	CodeHash     string         `json:"-" gorm:"type:char(64);uniqueIndex"`
	CodePrefix   string         `json:"code_prefix" gorm:"type:varchar(8);index"`
	Status       int            `json:"status" gorm:"index"`
	State        string         `json:"state" gorm:"-:all"`
	CreatedBy    int            `json:"created_by" gorm:"index"`
	UsedUserId   int            `json:"used_user_id" gorm:"index"`
	UsedUsername string         `json:"used_username" gorm:"-:all"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	UsedTime     int64          `json:"used_time" gorm:"bigint"`
	ExpiredTime  int64          `json:"expired_time" gorm:"bigint;index"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
}

func NormalizeInvitationCode(rawCode string) string {
	return strings.ToUpper(strings.TrimSpace(rawCode))
}

func HashInvitationCode(rawCode string) string {
	sum := sha256.Sum256([]byte(NormalizeInvitationCode(rawCode)))
	return fmt.Sprintf("%x", sum)
}

func CreateInvitationCodes(name string, count int, createdBy int, expiredTime int64) ([]string, error) {
	if count <= 0 || count > 100 {
		return nil, errors.New("invitation code count must be between 1 and 100")
	}

	name = strings.TrimSpace(name)
	codes := make([]string, 0, count)
	err := DB.Transaction(func(tx *gorm.DB) error {
		for i := 0; i < count; i++ {
			randomBytes := make([]byte, 20)
			if _, err := rand.Read(randomBytes); err != nil {
				return err
			}
			rawCode := "INV-" + base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(randomBytes)
			invitationCode := &InvitationCode{
				Name:        name,
				CodeHash:    HashInvitationCode(rawCode),
				CodePrefix:  rawCode[:invitationCodePrefixLength],
				Status:      common.InvitationCodeStatusEnabled,
				CreatedBy:   createdBy,
				CreatedTime: common.GetTimestamp(),
				ExpiredTime: expiredTime,
			}
			if err := tx.Create(invitationCode).Error; err != nil {
				return err
			}
			codes = append(codes, rawCode)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return codes, nil
}

func GetAllInvitationCodes(startIdx int, num int) ([]*InvitationCode, int64, error) {
	return SearchInvitationCodes("", "", startIdx, num)
}

func SearchInvitationCodes(keyword string, status string, startIdx int, num int) (codes []*InvitationCode, total int64, err error) {
	query := DB.Model(&InvitationCode{})
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		likeKeyword := keyword + "%"
		normalizedCode := NormalizeInvitationCode(keyword)
		if id, parseErr := strconv.Atoi(keyword); parseErr == nil {
			query = query.Where(
				"id = ? OR name LIKE ? OR code_prefix LIKE ? OR code_hash = ?",
				id,
				likeKeyword,
				normalizedCode+"%",
				HashInvitationCode(normalizedCode),
			)
		} else {
			query = query.Where(
				"name LIKE ? OR code_prefix LIKE ? OR code_hash = ?",
				likeKeyword,
				normalizedCode+"%",
				HashInvitationCode(normalizedCode),
			)
		}
	}

	now := common.GetTimestamp()
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "enabled", strconv.Itoa(common.InvitationCodeStatusEnabled):
		query = query.Where(
			"status = ? AND (expired_time = 0 OR expired_time > ?)",
			common.InvitationCodeStatusEnabled,
			now,
		)
	case "disabled", strconv.Itoa(common.InvitationCodeStatusDisabled):
		query = query.Where("status = ?", common.InvitationCodeStatusDisabled)
	case "used", strconv.Itoa(common.InvitationCodeStatusUsed):
		query = query.Where("status = ?", common.InvitationCodeStatusUsed)
	case "expired":
		query = query.Where(
			"status = ? AND expired_time != 0 AND expired_time <= ?",
			common.InvitationCodeStatusEnabled,
			now,
		)
	}

	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&codes).Error; err != nil {
		return nil, 0, err
	}
	if err = populateInvitationCodeDisplayFields(DB, codes); err != nil {
		return nil, 0, err
	}
	return codes, total, nil
}

func GetInvitationCodeById(id int) (*InvitationCode, error) {
	if id <= 0 {
		return nil, errors.New("invalid invitation code id")
	}
	code := &InvitationCode{}
	if err := DB.First(code, "id = ?", id).Error; err != nil {
		return nil, err
	}
	if err := populateInvitationCodeDisplayFields(DB, []*InvitationCode{code}); err != nil {
		return nil, err
	}
	return code, nil
}

func UpdateInvitationCode(id int, name string, status int, expiredTime int64, statusOnly bool) (*InvitationCode, error) {
	code, err := GetInvitationCodeById(id)
	if err != nil {
		return nil, err
	}
	if statusOnly {
		if status != common.InvitationCodeStatusEnabled && status != common.InvitationCodeStatusDisabled {
			return nil, errors.New("invalid invitation code status")
		}
		if code.Status == common.InvitationCodeStatusUsed {
			return nil, ErrInvitationCodeUsed
		}
		if code.Status != common.InvitationCodeStatusEnabled && code.Status != common.InvitationCodeStatusDisabled {
			return nil, ErrInvitationCodeInvalid
		}
		if code.Status == status {
			return code, nil
		}
		result := DB.Model(&InvitationCode{}).
			Where("id = ? AND status IN ?", id, []int{
				common.InvitationCodeStatusEnabled,
				common.InvitationCodeStatusDisabled,
			}).
			Update("status", status)
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected == 0 {
			latest, latestErr := GetInvitationCodeById(id)
			if latestErr != nil {
				return nil, latestErr
			}
			if latest.Status == common.InvitationCodeStatusUsed {
				return nil, ErrInvitationCodeUsed
			}
			return nil, errors.New("invitation code status changed concurrently")
		}
	} else {
		name = strings.TrimSpace(name)
		if err := DB.Model(&InvitationCode{}).Where("id = ?", id).Updates(map[string]interface{}{
			"name":         name,
			"expired_time": expiredTime,
		}).Error; err != nil {
			return nil, err
		}
	}
	return GetInvitationCodeById(id)
}

func DeleteInvitationCodeById(id int) error {
	if id <= 0 {
		return errors.New("invalid invitation code id")
	}
	result := DB.Delete(&InvitationCode{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func DeleteUsedInvitationCodes() (int64, error) {
	result := DB.Where("status = ?", common.InvitationCodeStatusUsed).Delete(&InvitationCode{})
	return result.RowsAffected, result.Error
}

// ResolveInvitationCodeReference converts a raw invitation code into a
// server-side reference without reserving or consuming it. Unknown and
// malformed codes intentionally resolve to zero so OAuth flow creation does
// not disclose whether a supplied code exists.
func ResolveInvitationCodeReference(rawCode string) (int, error) {
	if strings.TrimSpace(rawCode) == "" || utf8.RuneCountInString(rawCode) > common.InvitationCodeMaxLength {
		return 0, nil
	}
	var code InvitationCode
	err := DB.Select("id").Where("code_hash = ?", HashInvitationCode(rawCode)).First(&code).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return code.Id, nil
}

func ConsumeInvitationCodeWithTx(tx *gorm.DB, rawCode string, userID int) (*InvitationCode, error) {
	if strings.TrimSpace(rawCode) == "" {
		return nil, ErrInvitationCodeNotProvided
	}
	if utf8.RuneCountInString(rawCode) > common.InvitationCodeMaxLength {
		return nil, ErrInvitationCodeInvalid
	}
	if tx == nil || userID <= 0 {
		return nil, ErrInvitationCodeInvalid
	}

	code := &InvitationCode{}
	err := lockForUpdate(tx).Where("code_hash = ?", HashInvitationCode(rawCode)).First(code).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrInvitationCodeInvalid
	}
	if err != nil {
		return nil, err
	}
	return consumeInvitationCodeRecordWithTx(tx, code, userID)
}

// ConsumeInvitationCodeReferenceWithTx consumes a previously resolved
// server-side invitation reference. It never accepts a raw or pre-hashed code.
func ConsumeInvitationCodeReferenceWithTx(tx *gorm.DB, codeID int, userID int) (*InvitationCode, error) {
	if tx == nil || codeID <= 0 || userID <= 0 {
		return nil, ErrInvitationCodeInvalid
	}
	code := &InvitationCode{}
	err := lockForUpdate(tx).Where("id = ?", codeID).First(code).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrInvitationCodeInvalid
	}
	if err != nil {
		return nil, err
	}
	return consumeInvitationCodeRecordWithTx(tx, code, userID)
}

func consumeInvitationCodeRecordWithTx(tx *gorm.DB, code *InvitationCode, userID int) (*InvitationCode, error) {
	switch code.Status {
	case common.InvitationCodeStatusUsed:
		return nil, ErrInvitationCodeUsed
	case common.InvitationCodeStatusDisabled:
		return nil, ErrInvitationCodeDisabled
	case common.InvitationCodeStatusEnabled:
	default:
		return nil, ErrInvitationCodeInvalid
	}

	now := common.GetTimestamp()
	if code.ExpiredTime != 0 && code.ExpiredTime <= now {
		return nil, ErrInvitationCodeExpired
	}
	result := tx.Model(&InvitationCode{}).
		Where("id = ? AND status = ? AND (expired_time = 0 OR expired_time > ?)", code.Id, common.InvitationCodeStatusEnabled, now).
		Updates(map[string]interface{}{
			"status":       common.InvitationCodeStatusUsed,
			"used_user_id": userID,
			"used_time":    now,
		})
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, ErrInvitationCodeUsed
	}

	code.Status = common.InvitationCodeStatusUsed
	code.UsedUserId = userID
	code.UsedTime = now
	code.State = "used"
	return code, nil
}

func populateInvitationCodeDisplayFields(tx *gorm.DB, codes []*InvitationCode) error {
	userIDs := make([]int, 0, len(codes))
	now := common.GetTimestamp()
	for _, code := range codes {
		switch {
		case code.Status == common.InvitationCodeStatusUsed:
			code.State = "used"
		case code.Status == common.InvitationCodeStatusDisabled:
			code.State = "disabled"
		case code.ExpiredTime != 0 && code.ExpiredTime <= now:
			code.State = "expired"
		default:
			code.State = "enabled"
		}
		if code.UsedUserId > 0 {
			userIDs = append(userIDs, code.UsedUserId)
		}
	}
	if len(userIDs) == 0 {
		return nil
	}

	type invitationCodeUser struct {
		Id       int
		Username string
	}
	var users []invitationCodeUser
	if err := tx.Model(&User{}).Select("id", "username").Where("id IN ?", userIDs).Find(&users).Error; err != nil {
		return err
	}
	usernames := make(map[int]string, len(users))
	for _, user := range users {
		usernames[user.Id] = user.Username
	}
	for _, code := range codes {
		code.UsedUsername = usernames[code.UsedUserId]
	}
	return nil
}
