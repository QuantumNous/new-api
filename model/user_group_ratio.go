package model

import (
	"fmt"
)

type UserGroupRatio struct {
	Id         int     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId     int     `json:"user_id" gorm:"not null;uniqueIndex:idx_user_group_ratio"`
	Username   string  `json:"username" gorm:"-"`
	UsingGroup string  `json:"using_group" gorm:"type:varchar(64);not null;uniqueIndex:idx_user_group_ratio;index:idx_using_group"`
	Ratio      float64 `json:"ratio" gorm:"not null"`
	CreatedAt  int64   `json:"created_at" gorm:"bigint;autoCreateTime"`
	UpdatedAt  int64   `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

func GetAllUserGroupRatiosForCache() ([]UserGroupRatio, error) {
	var ratios []UserGroupRatio
	err := DB.Find(&ratios).Error
	return ratios, err
}

func GetAllUserGroupRatios(startIdx, pageSize, userId int, usingGroup string) ([]UserGroupRatio, int64, error) {
	var ratios []UserGroupRatio
	var total int64

	tx := DB.Model(&UserGroupRatio{})
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	if usingGroup != "" {
		tx = tx.Where("using_group = ?", usingGroup)
	}

	err := tx.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = tx.Order("id desc").Offset(startIdx).Limit(pageSize).Find(&ratios).Error
	if err != nil {
		return nil, 0, err
	}

	if len(ratios) > 0 {
		userIds := make([]int, 0, len(ratios))
		for _, r := range ratios {
			userIds = append(userIds, r.UserId)
		}
		userMap := getUsernameMap(userIds)
		for i := range ratios {
			ratios[i].Username = userMap[ratios[i].UserId]
		}
	}

	return ratios, total, nil
}

// GetUserGroupRatiosGroupedByUser 按用户分组分页：先分页取 distinct user_id，再查这些用户的所有 ratios
func GetUserGroupRatiosGroupedByUser(startIdx, pageSize int, keyword string) ([]UserGroupRatio, int64, error) {
	// Step 1: get paginated distinct user_ids
	var userIds []int
	var totalUsers int64

	var matchedUserIds []int
	if keyword != "" {
		DB.Model(&User{}).Select("id").Where("username LIKE ?", keyword+"%").Find(&matchedUserIds)
		if len(matchedUserIds) == 0 {
			return nil, 0, nil
		}
	}

	userQuery := DB.Model(&UserGroupRatio{}).Select("DISTINCT user_id")
	if keyword != "" {
		userQuery = userQuery.Where("user_id IN ?", matchedUserIds)
	}

	// Count distinct users
	countQuery := DB.Model(&UserGroupRatio{})
	if keyword != "" {
		countQuery = countQuery.Where("user_id IN ?", matchedUserIds)
	}
	countQuery.Select("COUNT(DISTINCT user_id)").Scan(&totalUsers)

	// Get paginated user_ids
	DB.Model(&UserGroupRatio{}).Select("user_id").
		Where("user_id IN (?)", userQuery).
		Group("user_id").
		Order("user_id desc").
		Offset(startIdx).Limit(pageSize).
		Find(&userIds)

	if len(userIds) == 0 {
		return nil, totalUsers, nil
	}

	// Step 2: get all ratios for these users
	var ratios []UserGroupRatio
	DB.Where("user_id IN ?", userIds).Order("user_id desc, id asc").Find(&ratios)

	// Fill usernames
	userMap := getUsernameMap(userIds)
	for i := range ratios {
		ratios[i].Username = userMap[ratios[i].UserId]
	}

	return ratios, totalUsers, nil
}

func getUsernameMap(userIds []int) map[int]string {
	type userInfo struct {
		Id       int
		Username string
	}
	var users []userInfo
	DB.Model(&User{}).Select("id, username").Where("id IN ?", userIds).Find(&users)
	m := make(map[int]string, len(users))
	for _, u := range users {
		m[u.Id] = u.Username
	}
	return m
}

func CreateOrUpdateUserGroupRatio(ratio *UserGroupRatio) error {
	var existing UserGroupRatio
	err := DB.Where("user_id = ? AND using_group = ?", ratio.UserId, ratio.UsingGroup).First(&existing).Error
	if err == nil {
		// update
		ratio.Id = existing.Id
		return DB.Model(&existing).Update("ratio", ratio.Ratio).Error
	}
	return DB.Create(ratio).Error
}

func UpdateUserGroupRatio(id int, ratio float64) error {
	result := DB.Model(&UserGroupRatio{}).Where("id = ?", id).Update("ratio", ratio)
	if result.RowsAffected == 0 {
		return fmt.Errorf("record not found")
	}
	return result.Error
}

func DeleteUserGroupRatio(id int) error {
	result := DB.Where("id = ?", id).Delete(&UserGroupRatio{})
	if result.RowsAffected == 0 {
		return fmt.Errorf("record not found")
	}
	return result.Error
}

func BatchDeleteUserGroupRatios(ids []int) error {
	return DB.Where("id IN ?", ids).Delete(&UserGroupRatio{}).Error
}

func CountUserGroupRatiosByGroup() (map[string]int64, error) {
	type groupCount struct {
		UsingGroup string
		Count      int64
	}
	var results []groupCount
	err := DB.Model(&UserGroupRatio{}).
		Select("using_group, count(distinct user_id) as count").
		Group("using_group").
		Find(&results).Error
	if err != nil {
		return nil, err
	}
	m := make(map[string]int64, len(results))
	for _, r := range results {
		m[r.UsingGroup] = r.Count
	}
	return m, nil
}

func GetUserGroupRatioByUserId(userId int) ([]UserGroupRatio, error) {
	var ratios []UserGroupRatio
	err := DB.Where("user_id = ?", userId).Find(&ratios).Error
	return ratios, err
}

func SearchUserGroupRatios(keyword string, startIdx, pageSize int) ([]UserGroupRatio, int64, error) {
	var ratios []UserGroupRatio
	var total int64

	// search by username
	var userIds []int
	if keyword != "" {
		DB.Model(&User{}).Select("id").Where("username LIKE ?", keyword+"%").Find(&userIds)
	}

	tx := DB.Model(&UserGroupRatio{})
	if keyword != "" {
		if len(userIds) > 0 {
			tx = tx.Where("user_id IN ?", userIds)
		} else {
			return ratios, 0, nil
		}
	}

	err := tx.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = tx.Order("id desc").Offset(startIdx).Limit(pageSize).Find(&ratios).Error
	if err != nil {
		return nil, 0, err
	}

	if len(ratios) > 0 {
		ids := make([]int, 0, len(ratios))
		for _, r := range ratios {
			ids = append(ids, r.UserId)
		}
		userMap := getUsernameMap(ids)
		for i := range ratios {
			ratios[i].Username = userMap[ratios[i].UserId]
		}
	}

	return ratios, total, nil
}
