package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var (
	ErrInviteCodeNotFound = errors.New("invite code not found")
	ErrInviteCodeInvalid  = errors.New("invite code invalid")
	ErrInviteCodeExpired  = errors.New("invite code expired")
	ErrInviteCodeUsed     = errors.New("invite code used")
)

type InviteCode struct {
	Id           int    `json:"id"`
	Code         string `json:"code" gorm:"type:varchar(32);uniqueIndex"`
	Name         string `json:"name" gorm:"type:varchar(64);index"`
	CreatorId    int    `json:"creator_id" gorm:"type:int;index"`
	InviterId    int    `json:"inviter_id" gorm:"type:int;index"`
	Status       int    `json:"status" gorm:"type:int;default:1;index"`
	MaxUses      int    `json:"max_uses" gorm:"type:int;default:1"`
	UsedCount    int    `json:"used_count" gorm:"type:int;default:0"`
	UsedUserId   int    `json:"used_user_id" gorm:"type:int;index"`
	UsedUsername string `json:"used_username,omitempty" gorm:"-:all"`
	CreatedTime  int64  `json:"created_time" gorm:"type:bigint;index"`
	UsedTime     int64  `json:"used_time" gorm:"type:bigint"`
	ExpiredTime  int64  `json:"expired_time" gorm:"type:bigint;index"`
}

type InviteCodeCreateParams struct {
	Name        string
	Count       int
	CreatorId   int
	InviterId   int
	MaxUses     int
	ExpiredTime int64
}

func normalizeInviteCode(code string) string {
	return strings.TrimSpace(code)
}

func generateUniqueInviteCode() (string, error) {
	for i := 0; i < 20; i++ {
		code, err := common.GenerateRandomCharsKey(10)
		if err != nil {
			return "", err
		}
		var count int64
		if err := DB.Model(&InviteCode{}).Where("code = ?", code).Count(&count).Error; err != nil {
			return "", err
		}
		if count > 0 {
			continue
		}
		if inviterId, _ := GetUserIdByAffCode(code); inviterId != 0 {
			continue
		}
		return code, nil
	}
	return "", errors.New("生成邀请码失败")
}

func CreateInviteCodes(params InviteCodeCreateParams) ([]string, error) {
	if params.Count <= 0 {
		return nil, errors.New("邀请码数量必须大于0")
	}
	if params.Count > 100 {
		return nil, errors.New("一次最多创建100个邀请码")
	}
	if params.CreatorId == 0 {
		return nil, errors.New("创建者为空")
	}
	if params.InviterId == 0 {
		params.InviterId = params.CreatorId
	}
	if params.MaxUses <= 0 {
		params.MaxUses = 1
	}
	if strings.TrimSpace(params.Name) == "" {
		params.Name = "invite"
	}

	codes := make([]string, 0, params.Count)
	seen := make(map[string]struct{}, params.Count)
	err := DB.Transaction(func(tx *gorm.DB) error {
		for i := 0; i < params.Count; i++ {
			var code string
			for {
				generated, err := generateUniqueInviteCode()
				if err != nil {
					return err
				}
				if _, ok := seen[generated]; ok {
					continue
				}
				code = generated
				seen[code] = struct{}{}
				break
			}
			inviteCode := InviteCode{
				Code:        code,
				Name:        strings.TrimSpace(params.Name),
				CreatorId:   params.CreatorId,
				InviterId:   params.InviterId,
				Status:      common.InviteCodeStatusEnabled,
				MaxUses:     params.MaxUses,
				CreatedTime: common.GetTimestamp(),
				ExpiredTime: params.ExpiredTime,
			}
			if err := tx.Create(&inviteCode).Error; err != nil {
				return err
			}
			codes = append(codes, code)
		}
		return nil
	})
	return codes, err
}

func CountInviteCodesCreatedToday(userId int) (int64, error) {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	var count int64
	err := DB.Model(&InviteCode{}).Where("creator_id = ? AND created_time >= ?", userId, start).Count(&count).Error
	return count, err
}

func applyInviteCodeUsageFilter(query *gorm.DB, usageStatus string) *gorm.DB {
	switch strings.ToLower(strings.TrimSpace(usageStatus)) {
	case "used":
		return query.Where("used_count > ?", 0)
	case "unused":
		return query.Where("used_count = ?", 0)
	default:
		return query
	}
}

func GetInviteCodes(startIdx int, num int, creatorId int, usageStatus string) (codes []*InviteCode, total int64, err error) {
	query := DB.Model(&InviteCode{})
	if creatorId != 0 {
		query = query.Where("creator_id = ?", creatorId)
	}
	query = applyInviteCodeUsageFilter(query, usageStatus)
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&codes).Error
	if err != nil {
		return nil, 0, err
	}
	err = fillInviteCodeUsedUsers(codes)
	return codes, total, err
}

func SearchInviteCodes(keyword string, startIdx int, num int, creatorId int, usageStatus string) (codes []*InviteCode, total int64, err error) {
	keyword = strings.TrimSpace(keyword)
	query := DB.Model(&InviteCode{})
	if creatorId != 0 {
		query = query.Where("creator_id = ?", creatorId)
	}
	query = applyInviteCodeUsageFilter(query, usageStatus)
	if keyword != "" {
		like := keyword + "%"
		query = query.Where("code LIKE ? OR name LIKE ?", like, like)
	}
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&codes).Error
	if err != nil {
		return nil, 0, err
	}
	err = fillInviteCodeUsedUsers(codes)
	return codes, total, err
}

func fillInviteCodeUsedUsers(codes []*InviteCode) error {
	userIds := make([]int, 0)
	seen := make(map[int]struct{})
	for _, code := range codes {
		if code == nil || code.UsedUserId == 0 {
			continue
		}
		if _, ok := seen[code.UsedUserId]; ok {
			continue
		}
		seen[code.UsedUserId] = struct{}{}
		userIds = append(userIds, code.UsedUserId)
	}
	if len(userIds) == 0 {
		return nil
	}

	var users []User
	if err := DB.Model(&User{}).Select("id", "username").Where("id IN ?", userIds).Find(&users).Error; err != nil {
		return err
	}
	usernames := make(map[int]string, len(users))
	for _, user := range users {
		usernames[user.Id] = user.Username
	}
	for _, code := range codes {
		if code == nil || code.UsedUserId == 0 {
			continue
		}
		code.UsedUsername = usernames[code.UsedUserId]
	}
	return nil
}

func GetInviteCodeById(id int) (*InviteCode, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	inviteCode := InviteCode{Id: id}
	err := DB.First(&inviteCode, "id = ?", id).Error
	return &inviteCode, err
}

func UpdateInviteCode(inviteCode *InviteCode) error {
	return DB.Model(inviteCode).Select("name", "status", "max_uses", "expired_time").Updates(inviteCode).Error
}

func DeleteInviteCodeById(id int, actorId int, actorRole int) error {
	inviteCode, err := GetInviteCodeById(id)
	if err != nil {
		return err
	}
	if actorRole < common.RoleAdminUser && inviteCode.CreatorId != actorId {
		return errors.New("无权删除该邀请码")
	}
	return DB.Delete(inviteCode).Error
}

func validateInviteCode(inviteCode *InviteCode) error {
	if inviteCode.Id == 0 {
		return ErrInviteCodeNotFound
	}
	if inviteCode.Status != common.InviteCodeStatusEnabled {
		if inviteCode.Status == common.InviteCodeStatusUsed {
			return ErrInviteCodeUsed
		}
		return ErrInviteCodeInvalid
	}
	if inviteCode.ExpiredTime != 0 && inviteCode.ExpiredTime < common.GetTimestamp() {
		return ErrInviteCodeExpired
	}
	if inviteCode.MaxUses > 0 && inviteCode.UsedCount >= inviteCode.MaxUses {
		return ErrInviteCodeUsed
	}
	return nil
}

func GetInviterIdByRegistrationInviteCode(code string) (int, bool, error) {
	return GetInviterIdByRegistrationInviteCodeWithTx(DB, code)
}

func GetInviterIdByRegistrationInviteCodeWithTx(tx *gorm.DB, code string) (int, bool, error) {
	code = normalizeInviteCode(code)
	if code == "" {
		return 0, false, ErrInviteCodeNotFound
	}

	var inviteCode InviteCode
	err := tx.Set("gorm:query_option", "FOR UPDATE").Where("code = ?", code).First(&inviteCode).Error
	if err == nil {
		if err := validateInviteCode(&inviteCode); err != nil {
			return 0, true, err
		}
		return inviteCode.InviterId, true, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, false, err
	}

	inviterId, err := GetUserIdByAffCode(code)
	if err != nil || inviterId == 0 {
		return 0, false, ErrInviteCodeNotFound
	}
	return inviterId, false, nil
}

func ConsumeRegistrationInviteCode(code string, userId int) error {
	return ConsumeRegistrationInviteCodeWithTx(DB, code, userId)
}

func ConsumeRegistrationInviteCodeWithTx(tx *gorm.DB, code string, userId int) error {
	code = normalizeInviteCode(code)
	if code == "" || userId == 0 {
		return nil
	}
	var inviteCode InviteCode
	err := tx.Set("gorm:query_option", "FOR UPDATE").Where("code = ?", code).First(&inviteCode).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := validateInviteCode(&inviteCode); err != nil {
		return err
	}
	inviteCode.UsedCount++
	inviteCode.UsedUserId = userId
	inviteCode.UsedTime = common.GetTimestamp()
	if inviteCode.MaxUses > 0 && inviteCode.UsedCount >= inviteCode.MaxUses {
		inviteCode.Status = common.InviteCodeStatusUsed
	}
	if err := tx.Save(&inviteCode).Error; err != nil {
		return fmt.Errorf("更新邀请码状态失败: %w", err)
	}
	return nil
}
