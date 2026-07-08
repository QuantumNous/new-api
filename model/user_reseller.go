package model

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

func UpdateUserResellerProfile(userId int, isReseller bool, resellerUserId int) error {
	if userId <= 0 {
		return errors.New("用户 ID 为空")
	}
	if isReseller && resellerUserId > 0 {
		return errors.New("分销商账号不能再设置上级分销商")
	}
	var user User
	if err := DB.Select("id, is_reseller, reseller_user_id").Where("id = ?", userId).First(&user).Error; err != nil {
		return err
	}
	if !isReseller && resellerUserId > 0 {
		if resellerUserId == userId {
			return errors.New("用户不能把自己设置为上级分销商")
		}
		var reseller User
		if err := DB.Select("id, is_reseller, reseller_user_id").Where("id = ?", resellerUserId).First(&reseller).Error; err != nil {
			return err
		}
		if !reseller.IsReseller {
			return errors.New("上级账号不是分销商")
		}
		if reseller.ResellerUserId > 0 {
			return errors.New("上级分销商不能再有上级分销商")
		}
	}
	if err := DB.Model(&User{}).Where("id = ?", userId).Updates(map[string]interface{}{
		"is_reseller":      isReseller,
		"reseller_user_id": resellerUserId,
	}).Error; err != nil {
		return err
	}
	return invalidateUserCache(userId)
}

func GetResellerDownlines(resellerId int) ([]User, error) {
	if resellerId <= 0 {
		return nil, errors.New("分销商账号为空")
	}
	var users []User
	err := DB.Omit("password").Where("reseller_user_id = ?", resellerId).Order("id desc").Find(&users).Error
	return users, err
}

func FindResellerUserByKeyword(keyword string, limit int) ([]User, error) {
	keyword = strings.TrimSpace(keyword)
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	tx := DB.Omit("password").Where("is_reseller = ?", true).Order("id desc").Limit(limit)
	if keyword != "" {
		if id, ok := parsePositiveInt(keyword); ok {
			tx = tx.Where("id = ? OR username LIKE ? OR email LIKE ? OR display_name LIKE ?", id, "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
		} else {
			tx = tx.Where("username LIKE ? OR email LIKE ? OR display_name LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
		}
	}
	var users []User
	err := tx.Find(&users).Error
	return users, err
}

func parsePositiveInt(s string) (int, bool) {
	var out int
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0, false
		}
		out = out*10 + int(ch-'0')
	}
	return out, out > 0
}

func EnsureResellerDownline(resellerId int, downlineId int) error {
	if resellerId <= 0 || downlineId <= 0 {
		return errors.New("分销商或下线账号为空")
	}
	var reseller User
	if err := DB.Select("id, is_reseller, reseller_user_id").Where("id = ?", resellerId).First(&reseller).Error; err != nil {
		return err
	}
	if !reseller.IsReseller {
		return errors.New("账号不是分销商")
	}
	if reseller.ResellerUserId > 0 {
		return errors.New("分销商账号不能有上级分销商")
	}
	var downline User
	err := DB.Select("id, reseller_user_id").Where("id = ?", downlineId).First(&downline).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return errors.New("下线用户不存在")
	}
	if err != nil {
		return err
	}
	if downline.ResellerUserId != resellerId {
		return errors.New("该用户不是当前分销商的下线")
	}
	return nil
}
