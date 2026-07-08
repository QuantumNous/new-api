package model

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"

	"gorm.io/gorm"
)

const (
	OrganizationStatusEnabled  = 1
	OrganizationStatusDisabled = 2

	OrganizationRoleOwner   = "owner"
	OrganizationRoleAdmin   = "admin"
	OrganizationRoleMember  = "member"
	OrganizationRoleBilling = "billing"
)

type Organization struct {
	Id        int    `json:"id"`
	Name      string `json:"name" gorm:"type:varchar(128);not null"`
	OwnerId   int    `json:"owner_id" gorm:"index"`
	Status    int    `json:"status" gorm:"type:int;default:1;index"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

type OrganizationMember struct {
	Id             int     `json:"id"`
	OrganizationId int     `json:"organization_id" gorm:"index"`
	UserId         int     `json:"user_id" gorm:"index"`
	Role           string  `json:"role" gorm:"type:varchar(32);default:'member';index"`
	JoinedAt       int64   `json:"joined_at" gorm:"bigint;index"`
	LeftAt         int64   `json:"left_at" gorm:"bigint;default:0;index"`
	CurrentKey     *string `json:"-" gorm:"type:varchar(64);uniqueIndex"`
	Username       string  `json:"username,omitempty" gorm:"-:all"`
	DisplayName    string  `json:"display_name,omitempty" gorm:"-:all"`
	Email          string  `json:"email,omitempty" gorm:"-:all"`
}

type OrganizationWithMember struct {
	Organization Organization       `json:"organization"`
	Member       OrganizationMember `json:"member"`
}

type OrganizationBillingFilters struct {
	StartTimestamp int64
	EndTimestamp   int64
	Types          []int
	UserId         int
	ModelName      string
	ChannelId      int
}

type OrganizationBillingSummary struct {
	TotalQuota        int `json:"total_quota"`
	RequestCount      int `json:"request_count"`
	PromptTokens      int `json:"prompt_tokens"`
	CompletionTokens  int `json:"completion_tokens"`
	MemberCount       int `json:"member_count"`
	ActiveMemberCount int `json:"active_member_count"`
}

type OrganizationBillingDimension struct {
	UserId           int              `json:"user_id,omitempty"`
	Username         string           `json:"username,omitempty"`
	DisplayName      string           `json:"display_name,omitempty"`
	ModelName        string           `json:"model_name,omitempty"`
	ChannelId        int              `json:"channel_id,omitempty"`
	ChannelName      string           `json:"channel_name,omitempty"`
	TotalQuota       int              `json:"total_quota"`
	RequestCount     int              `json:"request_count"`
	PromptTokens     int              `json:"prompt_tokens"`
	CompletionTokens int              `json:"completion_tokens"`
	Pricing          *PricingSnapshot `json:"pricing,omitempty" gorm:"-"`
}

type PricingSnapshot struct {
	QuotaType   int     `json:"quota_type"`
	ModelRatio  float64 `json:"model_ratio"`
	ModelPrice  float64 `json:"model_price"`
	BillingMode string  `json:"billing_mode,omitempty"`
	BillingExpr string  `json:"billing_expr,omitempty"`
	OwnerBy     string  `json:"owner_by,omitempty"`
}

type OrganizationBillingTrendPoint struct {
	Period           string `json:"period"`
	TotalQuota       int    `json:"total_quota"`
	RequestCount     int    `json:"request_count"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
}

func normalizeOrganizationRole(role string) (string, error) {
	role = strings.ToLower(strings.TrimSpace(role))
	if role == "" {
		role = OrganizationRoleMember
	}
	switch role {
	case OrganizationRoleOwner, OrganizationRoleAdmin, OrganizationRoleMember, OrganizationRoleBilling:
		return role, nil
	default:
		return "", fmt.Errorf("invalid organization role: %s", role)
	}
}

func activeOrganizationCurrentKey(userId int) *string {
	key := strconv.Itoa(userId)
	return &key
}

func CreateOrganization(name string) (*Organization, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("organization name is required")
	}

	now := common.GetTimestamp()
	org := Organization{
		Name:      name,
		Status:    OrganizationStatusEnabled,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := DB.Create(&org).Error; err != nil {
		return nil, err
	}
	return &org, nil
}

func ensureUserHasNoActiveOrganization(tx *gorm.DB, userId int) error {
	var count int64
	if err := tx.Model(&OrganizationMember{}).Where("user_id = ? AND left_at = 0", userId).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("user already belongs to an organization")
	}
	return nil
}

func GetOrganizationById(id int) (*Organization, error) {
	if id <= 0 {
		return nil, errors.New("invalid organization id")
	}
	var org Organization
	if err := DB.First(&org, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &org, nil
}

func GetCurrentOrganizationForUser(userId int) (*OrganizationWithMember, error) {
	var member OrganizationMember
	if err := DB.Where("user_id = ? AND left_at = 0", userId).First(&member).Error; err != nil {
		return nil, err
	}
	var org Organization
	if err := DB.First(&org, "id = ?", member.OrganizationId).Error; err != nil {
		return nil, err
	}
	return &OrganizationWithMember{Organization: org, Member: member}, nil
}

func ListOrganizations(keyword string, status *int, startIdx int, num int) ([]Organization, int64, error) {
	keyword = strings.TrimSpace(keyword)
	tx := DB.Model(&Organization{})
	if keyword != "" {
		like := "%" + keyword + "%"
		keywordClauses := []string{
			"organizations.name LIKE ?",
			"users.username LIKE ?",
			"users.email LIKE ?",
			"users.display_name LIKE ?",
		}
		keywordArgs := []interface{}{like, like, like, like}
		if keywordId, err := strconv.Atoi(keyword); err == nil {
			keywordClauses = append(keywordClauses, "organizations.id = ?", "organizations.owner_id = ?")
			keywordArgs = append(keywordArgs, keywordId, keywordId)
		}
		tx = tx.Joins("LEFT JOIN users ON users.id = organizations.owner_id").
			Where("("+strings.Join(keywordClauses, " OR ")+")", keywordArgs...)
	}
	if status != nil {
		switch *status {
		case OrganizationStatusEnabled, OrganizationStatusDisabled:
			tx = tx.Where("organizations.status = ?", *status)
		default:
			return nil, 0, errors.New("invalid organization status")
		}
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var orgs []Organization
	err := tx.Order("organizations.id desc").Limit(num).Offset(startIdx).Find(&orgs).Error
	return orgs, total, err
}

func UpdateOrganization(id int, name string, status *int) (*Organization, error) {
	name = strings.TrimSpace(name)
	updates := map[string]interface{}{}
	if name != "" {
		updates["name"] = name
	}
	if status != nil {
		switch *status {
		case OrganizationStatusEnabled, OrganizationStatusDisabled:
			updates["status"] = *status
		default:
			return nil, errors.New("invalid organization status")
		}
	}
	if len(updates) == 0 {
		return GetOrganizationById(id)
	}
	if err := DB.Model(&Organization{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return GetOrganizationById(id)
}

func ListOrganizationMembers(organizationId int, includeHistory bool) ([]OrganizationMember, error) {
	tx := DB.Where("organization_id = ?", organizationId)
	if !includeHistory {
		tx = tx.Where("left_at = 0")
	}
	var members []OrganizationMember
	if err := tx.Order("left_at asc, role desc, joined_at asc, id asc").Find(&members).Error; err != nil {
		return nil, err
	}
	fillOrganizationMemberUsers(members)
	return members, nil
}

func fillOrganizationMemberUsers(members []OrganizationMember) {
	if len(members) == 0 {
		return
	}
	userIds := make([]int, 0, len(members))
	for _, member := range members {
		userIds = append(userIds, member.UserId)
	}
	var users []User
	if err := DB.Select("id", "username", "display_name", "email").Where("id IN ?", userIds).Find(&users).Error; err != nil {
		return
	}
	userMap := make(map[int]User, len(users))
	for _, user := range users {
		userMap[user.Id] = user
	}
	for i := range members {
		user, ok := userMap[members[i].UserId]
		if !ok {
			continue
		}
		members[i].Username = user.Username
		members[i].DisplayName = user.DisplayName
		members[i].Email = user.Email
	}
}

func AddOrganizationMember(organizationId int, userId int, role string, allowOwner bool) (*OrganizationMember, error) {
	if organizationId <= 0 || userId <= 0 {
		return nil, errors.New("invalid organization or user id")
	}
	normalizedRole, err := normalizeOrganizationRole(role)
	if err != nil {
		return nil, err
	}
	if normalizedRole == OrganizationRoleOwner && !allowOwner {
		return nil, errors.New("owner role is assigned by system administrator")
	}
	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	if user.Status != common.UserStatusEnabled {
		return nil, errors.New("user is disabled")
	}
	now := common.GetTimestamp()
	member := OrganizationMember{
		OrganizationId: organizationId,
		UserId:         userId,
		Role:           normalizedRole,
		JoinedAt:       now,
		CurrentKey:     activeOrganizationCurrentKey(userId),
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var org Organization
		if err := tx.First(&org, "id = ?", organizationId).Error; err != nil {
			return err
		}
		if normalizedRole == OrganizationRoleOwner && org.OwnerId > 0 {
			return errors.New("organization owner already exists")
		}
		if err := ensureUserHasNoActiveOrganization(tx, userId); err != nil {
			return err
		}
		if err := tx.Create(&member).Error; err != nil {
			return err
		}
		if normalizedRole == OrganizationRoleOwner {
			return tx.Model(&Organization{}).Where("id = ?", organizationId).Update("owner_id", userId).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	fillOrganizationMemberUsersInPlace(&member)
	return &member, nil
}

func UpdateOrganizationMemberRole(organizationId int, userId int, role string, allowOwner bool) (*OrganizationMember, error) {
	normalizedRole, err := normalizeOrganizationRole(role)
	if err != nil {
		return nil, err
	}
	if normalizedRole == OrganizationRoleOwner && !allowOwner {
		return nil, errors.New("owner role is assigned by system administrator")
	}
	var member OrganizationMember
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("organization_id = ? AND user_id = ? AND left_at = 0", organizationId, userId).First(&member).Error; err != nil {
			return err
		}
		if member.Role == OrganizationRoleOwner {
			return errors.New("owner role cannot be changed")
		}
		if normalizedRole == OrganizationRoleOwner {
			var org Organization
			if err := tx.First(&org, "id = ?", organizationId).Error; err != nil {
				return err
			}
			if org.OwnerId > 0 {
				return errors.New("organization owner already exists")
			}
		}
		if err := tx.Model(&OrganizationMember{}).Where("id = ?", member.Id).Update("role", normalizedRole).Error; err != nil {
			return err
		}
		if normalizedRole == OrganizationRoleOwner {
			if err := tx.Model(&Organization{}).Where("id = ?", organizationId).Update("owner_id", userId).Error; err != nil {
				return err
			}
		}
		member.Role = normalizedRole
		return nil
	})
	if err != nil {
		return nil, err
	}
	fillOrganizationMemberUsersInPlace(&member)
	return &member, nil
}

func RemoveOrganizationMember(organizationId int, userId int) error {
	now := common.GetTimestamp()
	return DB.Transaction(func(tx *gorm.DB) error {
		var member OrganizationMember
		if err := tx.Where("organization_id = ? AND user_id = ? AND left_at = 0", organizationId, userId).First(&member).Error; err != nil {
			return err
		}
		if member.Role == OrganizationRoleOwner {
			return errors.New("owner cannot be removed from organization")
		}
		return tx.Model(&OrganizationMember{}).Where("id = ?", member.Id).Updates(map[string]interface{}{
			"left_at":     now,
			"current_key": nil,
		}).Error
	})
}

func UserCanManageOrganization(userId int, organizationId int) (bool, error) {
	return userHasOrganizationRoles(userId, organizationId, OrganizationRoleOwner, OrganizationRoleAdmin)
}

func UserCanViewOrganizationBilling(userId int, organizationId int) (bool, error) {
	return userHasOrganizationRoles(userId, organizationId, OrganizationRoleOwner, OrganizationRoleAdmin, OrganizationRoleBilling)
}

func userHasOrganizationRoles(userId int, organizationId int, roles ...string) (bool, error) {
	var member OrganizationMember
	err := DB.Where("organization_id = ? AND user_id = ? AND left_at = 0", organizationId, userId).First(&member).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	for _, role := range roles {
		if member.Role == role {
			return true, nil
		}
	}
	return false, nil
}

func activeAndHistoricalOrganizationMembers(organizationId int, userId int) ([]OrganizationMember, error) {
	tx := DB.Where("organization_id = ?", organizationId)
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	var members []OrganizationMember
	if err := tx.Order("joined_at asc, id asc").Find(&members).Error; err != nil {
		return nil, err
	}
	return members, nil
}

func logMembershipBounds(member OrganizationMember, filters OrganizationBillingFilters) (int64, int64, bool, bool) {
	start := member.JoinedAt
	if filters.StartTimestamp > start {
		start = filters.StartTimestamp
	}
	if member.LeftAt > 0 && filters.StartTimestamp >= member.LeftAt {
		return 0, 0, false, false
	}
	if filters.EndTimestamp > 0 && filters.EndTimestamp < start {
		return 0, 0, false, false
	}

	end := filters.EndTimestamp
	exclusiveEnd := false
	if member.LeftAt > 0 && (end == 0 || member.LeftAt <= end) {
		end = member.LeftAt
		exclusiveEnd = true
	}
	return start, end, exclusiveEnd, true
}

func applyOrganizationLogFilters(tx *gorm.DB, member OrganizationMember, filters OrganizationBillingFilters) (*gorm.DB, bool, error) {
	start, end, exclusiveEnd, ok := logMembershipBounds(member, filters)
	if !ok {
		return tx, false, nil
	}
	tx = tx.Where("user_id = ?", member.UserId).Where("created_at >= ?", start)
	if end > 0 {
		if exclusiveEnd {
			tx = tx.Where("created_at < ?", end)
		} else {
			tx = tx.Where("created_at <= ?", end)
		}
	}
	typesFilter := filters.Types
	if len(typesFilter) == 0 {
		typesFilter = []int{LogTypeConsume}
	}
	if len(typesFilter) == 1 {
		tx = tx.Where("type = ?", typesFilter[0])
	} else {
		tx = tx.Where("type IN ?", typesFilter)
	}
	if filters.ModelName != "" {
		var err error
		tx, err = applyExplicitLogTextFilter(tx, "model_name", filters.ModelName)
		if err != nil {
			return tx, false, err
		}
	}
	if filters.ChannelId > 0 {
		tx = tx.Where("channel_id = ?", filters.ChannelId)
	}
	return tx, true, nil
}

type organizationLogAggregate struct {
	TotalQuota       int
	RequestCount     int
	PromptTokens     int
	CompletionTokens int
}

func aggregateOrganizationLogs(members []OrganizationMember, filters OrganizationBillingFilters, each func(OrganizationMember, organizationLogAggregate)) error {
	for _, member := range members {
		tx, ok, err := applyOrganizationLogFilters(LOG_DB.Model(&Log{}), member, filters)
		if err != nil {
			return err
		}
		if !ok {
			continue
		}
		var row organizationLogAggregate
		if err := tx.Select("COALESCE(sum(quota), 0) AS total_quota, count(*) AS request_count, COALESCE(sum(prompt_tokens), 0) AS prompt_tokens, COALESCE(sum(completion_tokens), 0) AS completion_tokens").Scan(&row).Error; err != nil {
			return err
		}
		each(member, row)
	}
	return nil
}

func GetOrganizationBillingSummary(organizationId int, filters OrganizationBillingFilters) (*OrganizationBillingSummary, error) {
	members, err := activeAndHistoricalOrganizationMembers(organizationId, filters.UserId)
	if err != nil {
		return nil, err
	}
	summary := &OrganizationBillingSummary{}
	activeUsers := types.NewSet[int]()
	allUsers := types.NewSet[int]()
	for _, member := range members {
		allUsers.Add(member.UserId)
		if member.LeftAt == 0 {
			activeUsers.Add(member.UserId)
		}
	}
	summary.MemberCount = allUsers.Len()
	summary.ActiveMemberCount = activeUsers.Len()
	err = aggregateOrganizationLogs(members, filters, func(_ OrganizationMember, row organizationLogAggregate) {
		summary.TotalQuota += row.TotalQuota
		summary.RequestCount += row.RequestCount
		summary.PromptTokens += row.PromptTokens
		summary.CompletionTokens += row.CompletionTokens
	})
	return summary, err
}

func GetOrganizationBillingMembers(organizationId int, filters OrganizationBillingFilters) ([]OrganizationBillingDimension, error) {
	members, err := activeAndHistoricalOrganizationMembers(organizationId, filters.UserId)
	if err != nil {
		return nil, err
	}
	memberMap := make(map[int]*OrganizationBillingDimension)
	if err := aggregateOrganizationLogs(members, filters, func(member OrganizationMember, row organizationLogAggregate) {
		item, ok := memberMap[member.UserId]
		if !ok {
			item = &OrganizationBillingDimension{UserId: member.UserId}
			memberMap[member.UserId] = item
		}
		item.TotalQuota += row.TotalQuota
		item.RequestCount += row.RequestCount
		item.PromptTokens += row.PromptTokens
		item.CompletionTokens += row.CompletionTokens
	}); err != nil {
		return nil, err
	}
	items := make([]OrganizationBillingDimension, 0, len(memberMap))
	for _, item := range memberMap {
		items = append(items, *item)
	}
	fillBillingDimensionUsers(items)
	sortBillingDimensions(items)
	return items, nil
}

func fillBillingDimensionUsers(items []OrganizationBillingDimension) {
	if len(items) == 0 {
		return
	}
	userIds := make([]int, 0, len(items))
	for _, item := range items {
		if item.UserId > 0 {
			userIds = append(userIds, item.UserId)
		}
	}
	if len(userIds) == 0 {
		return
	}
	var users []User
	if err := DB.Select("id", "username", "display_name").Where("id IN ?", userIds).Find(&users).Error; err != nil {
		common.SysError(fmt.Sprintf("failed to hydrate organization billing users: %s", err.Error()))
		return
	}
	userMap := make(map[int]User, len(users))
	for _, user := range users {
		userMap[user.Id] = user
	}
	for i := range items {
		user, ok := userMap[items[i].UserId]
		if !ok {
			continue
		}
		items[i].Username = user.Username
		items[i].DisplayName = user.DisplayName
	}
}

func GetOrganizationBillingModels(organizationId int, filters OrganizationBillingFilters) ([]OrganizationBillingDimension, error) {
	members, err := activeAndHistoricalOrganizationMembers(organizationId, filters.UserId)
	if err != nil {
		return nil, err
	}
	itemMap := make(map[string]*OrganizationBillingDimension)
	for _, member := range members {
		tx, ok, err := applyOrganizationLogFilters(LOG_DB.Model(&Log{}), member, filters)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		var rows []OrganizationBillingDimension
		if err := tx.Select("model_name, COALESCE(sum(quota), 0) AS total_quota, count(*) AS request_count, COALESCE(sum(prompt_tokens), 0) AS prompt_tokens, COALESCE(sum(completion_tokens), 0) AS completion_tokens").Group("model_name").Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			item, ok := itemMap[row.ModelName]
			if !ok {
				item = &OrganizationBillingDimension{ModelName: row.ModelName}
				itemMap[row.ModelName] = item
			}
			item.TotalQuota += row.TotalQuota
			item.RequestCount += row.RequestCount
			item.PromptTokens += row.PromptTokens
			item.CompletionTokens += row.CompletionTokens
		}
	}
	pricingMap := currentPricingSnapshotMap()
	items := make([]OrganizationBillingDimension, 0, len(itemMap))
	for _, item := range itemMap {
		if pricing, ok := pricingMap[item.ModelName]; ok {
			item.Pricing = &pricing
		}
		items = append(items, *item)
	}
	sortBillingDimensions(items)
	return items, nil
}

func currentPricingSnapshotMap() map[string]PricingSnapshot {
	pricing := GetPricing()
	result := make(map[string]PricingSnapshot, len(pricing))
	for _, item := range pricing {
		result[item.ModelName] = PricingSnapshot{
			QuotaType:   item.QuotaType,
			ModelRatio:  item.ModelRatio,
			ModelPrice:  item.ModelPrice,
			BillingMode: item.BillingMode,
			BillingExpr: item.BillingExpr,
			OwnerBy:     item.OwnerBy,
		}
	}
	return result
}

func GetOrganizationBillingChannels(organizationId int, filters OrganizationBillingFilters) ([]OrganizationBillingDimension, error) {
	members, err := activeAndHistoricalOrganizationMembers(organizationId, filters.UserId)
	if err != nil {
		return nil, err
	}
	itemMap := make(map[int]*OrganizationBillingDimension)
	for _, member := range members {
		tx, ok, err := applyOrganizationLogFilters(LOG_DB.Model(&Log{}), member, filters)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		var rows []OrganizationBillingDimension
		if err := tx.Select("channel_id, COALESCE(sum(quota), 0) AS total_quota, count(*) AS request_count, COALESCE(sum(prompt_tokens), 0) AS prompt_tokens, COALESCE(sum(completion_tokens), 0) AS completion_tokens").Group("channel_id").Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			item, ok := itemMap[row.ChannelId]
			if !ok {
				item = &OrganizationBillingDimension{ChannelId: row.ChannelId}
				itemMap[row.ChannelId] = item
			}
			item.TotalQuota += row.TotalQuota
			item.RequestCount += row.RequestCount
			item.PromptTokens += row.PromptTokens
			item.CompletionTokens += row.CompletionTokens
		}
	}
	items := make([]OrganizationBillingDimension, 0, len(itemMap))
	for _, item := range itemMap {
		items = append(items, *item)
	}
	fillBillingDimensionChannels(items)
	sortBillingDimensions(items)
	return items, nil
}

func fillBillingDimensionChannels(items []OrganizationBillingDimension) {
	channelIds := types.NewSet[int]()
	for _, item := range items {
		if item.ChannelId > 0 {
			channelIds.Add(item.ChannelId)
		}
	}
	if channelIds.Len() == 0 {
		return
	}
	var channels []struct {
		Id   int    `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	if err := DB.Table("channels").Select("id, name").Where("id IN ?", channelIds.Items()).Find(&channels).Error; err != nil {
		common.SysError(fmt.Sprintf("failed to hydrate organization billing channels: %s", err.Error()))
		return
	}
	channelMap := make(map[int]string, len(channels))
	for _, channel := range channels {
		channelMap[channel.Id] = channel.Name
	}
	for i := range items {
		items[i].ChannelName = channelMap[items[i].ChannelId]
	}
}

func GetOrganizationBillingTrend(organizationId int, filters OrganizationBillingFilters) ([]OrganizationBillingTrendPoint, error) {
	members, err := activeAndHistoricalOrganizationMembers(organizationId, filters.UserId)
	if err != nil {
		return nil, err
	}
	periodExpr := organizationTrendPeriodExpr()
	selectExpr := fmt.Sprintf("%s AS period_bucket, COALESCE(sum(quota), 0) AS total_quota, count(*) AS request_count, COALESCE(sum(prompt_tokens), 0) AS prompt_tokens, COALESCE(sum(completion_tokens), 0) AS completion_tokens", periodExpr)
	pointMap := map[string]*OrganizationBillingTrendPoint{}
	for _, member := range members {
		tx, ok, err := applyOrganizationLogFilters(LOG_DB.Model(&Log{}), member, filters)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		var rows []organizationTrendAggregate
		if err := tx.Select(selectExpr).Group(periodExpr).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			period := time.Unix(row.PeriodBucket*86400, 0).UTC().Format("2006-01-02")
			point, ok := pointMap[period]
			if !ok {
				point = &OrganizationBillingTrendPoint{Period: period}
				pointMap[period] = point
			}
			point.TotalQuota += row.TotalQuota
			point.RequestCount += row.RequestCount
			point.PromptTokens += row.PromptTokens
			point.CompletionTokens += row.CompletionTokens
		}
	}
	points := make([]OrganizationBillingTrendPoint, 0, len(pointMap))
	for _, point := range pointMap {
		points = append(points, *point)
	}
	sort.Slice(points, func(i, j int) bool {
		return points[i].Period < points[j].Period
	})
	return points, nil
}

type organizationTrendAggregate struct {
	PeriodBucket     int64 `gorm:"column:period_bucket"`
	TotalQuota       int
	RequestCount     int
	PromptTokens     int
	CompletionTokens int
}

func organizationTrendPeriodExpr() string {
	switch common.LogDatabaseType() {
	case common.DatabaseTypeClickHouse:
		return "intDiv(created_at, 86400)"
	case common.DatabaseTypeMySQL:
		return "FLOOR(created_at / 86400)"
	default:
		return "created_at / 86400"
	}
}

func GetOrganizationBillingLogs(organizationId int, filters OrganizationBillingFilters, startIdx int, num int) ([]*Log, int64, error) {
	members, err := activeAndHistoricalOrganizationMembers(organizationId, filters.UserId)
	if err != nil {
		return nil, 0, err
	}
	var total int64
	cursors := make([]organizationLogCursor, 0, len(members))
	for _, member := range members {
		tx, ok, err := applyOrganizationLogFilters(LOG_DB.Model(&Log{}), member, filters)
		if err != nil {
			return nil, 0, err
		}
		if !ok {
			continue
		}
		var count int64
		if err := tx.Count(&count).Error; err != nil {
			return nil, 0, err
		}
		total += count
		if count > 0 {
			cursors = append(cursors, organizationLogCursor{member: member})
		}
	}
	if num <= 0 || startIdx >= int(total) {
		return []*Log{}, total, nil
	}
	for i := range cursors {
		if err := cursors[i].loadMore(filters, 1); err != nil {
			return nil, 0, err
		}
	}
	batchSize := num
	if batchSize < 20 {
		batchSize = 20
	}
	page := make([]*Log, 0, num)
	for seen := 0; seen < startIdx+num; seen++ {
		bestCursorIndex := -1
		var bestLog *Log
		for i := range cursors {
			current := cursors[i].current()
			if current == nil {
				continue
			}
			if bestLog == nil || organizationLogComesBefore(current, bestLog) {
				bestLog = current
				bestCursorIndex = i
			}
		}
		if bestCursorIndex < 0 || bestLog == nil {
			break
		}
		if seen >= startIdx {
			page = append(page, bestLog)
		}
		if err := cursors[bestCursorIndex].advance(filters, batchSize); err != nil {
			return nil, 0, err
		}
	}
	hydrateLogChannelNames(page)
	return page, total, nil
}

type organizationLogCursor struct {
	member OrganizationMember
	rows   []*Log
	index  int
	offset int
	done   bool
}

func (c *organizationLogCursor) current() *Log {
	if c.index >= len(c.rows) {
		return nil
	}
	return c.rows[c.index]
}

func (c *organizationLogCursor) advance(filters OrganizationBillingFilters, batchSize int) error {
	c.index++
	if c.index < len(c.rows) {
		return nil
	}
	return c.loadMore(filters, batchSize)
}

func (c *organizationLogCursor) loadMore(filters OrganizationBillingFilters, limit int) error {
	if c.done {
		c.rows = nil
		c.index = 0
		return nil
	}
	rows, err := fetchOrganizationMemberLogs(c.member, filters, c.offset, limit)
	if err != nil {
		return err
	}
	c.rows = rows
	c.index = 0
	c.offset += len(rows)
	if len(rows) < limit {
		c.done = true
	}
	return nil
}

func fetchOrganizationMemberLogs(member OrganizationMember, filters OrganizationBillingFilters, offset int, limit int) ([]*Log, error) {
	tx, ok, err := applyOrganizationLogFilters(LOG_DB.Model(&Log{}), member, filters)
	if err != nil {
		return nil, err
	}
	if !ok || limit <= 0 {
		return []*Log{}, nil
	}
	var logs []*Log
	if err := tx.Order(organizationLogOrder()).Offset(offset).Limit(limit).Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

func organizationLogOrder() string {
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		return clickHouseLogOrder("")
	}
	return "created_at desc, id desc"
}

func organizationLogComesBefore(left *Log, right *Log) bool {
	if left.CreatedAt != right.CreatedAt {
		return left.CreatedAt > right.CreatedAt
	}
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		return left.RequestId > right.RequestId
	}
	return left.Id > right.Id
}

func hydrateLogChannelNames(logs []*Log) {
	channelIds := types.NewSet[int]()
	for _, log := range logs {
		if log.ChannelId > 0 {
			channelIds.Add(log.ChannelId)
		}
	}
	if channelIds.Len() == 0 {
		return
	}
	var channels []struct {
		Id   int    `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	if err := DB.Table("channels").Select("id, name").Where("id IN ?", channelIds.Items()).Find(&channels).Error; err != nil {
		common.SysError(fmt.Sprintf("failed to hydrate organization billing log channels: %s", err.Error()))
		return
	}
	channelMap := make(map[int]string, len(channels))
	for _, channel := range channels {
		channelMap[channel.Id] = channel.Name
	}
	for i := range logs {
		logs[i].ChannelName = channelMap[logs[i].ChannelId]
	}
}

func sortBillingDimensions(items []OrganizationBillingDimension) {
	sort.Slice(items, func(i, j int) bool {
		if items[i].TotalQuota == items[j].TotalQuota {
			if items[i].RequestCount == items[j].RequestCount {
				if items[i].UserId != items[j].UserId {
					return items[i].UserId < items[j].UserId
				}
				if items[i].ModelName != items[j].ModelName {
					return items[i].ModelName < items[j].ModelName
				}
				return items[i].ChannelId < items[j].ChannelId
			}
			return items[i].RequestCount > items[j].RequestCount
		}
		return items[i].TotalQuota > items[j].TotalQuota
	})
}

func fillOrganizationMemberUsersInPlace(member *OrganizationMember) {
	if member == nil {
		return
	}
	members := []OrganizationMember{*member}
	fillOrganizationMemberUsers(members)
	*member = members[0]
}
