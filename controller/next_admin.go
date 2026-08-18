package controller

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/modellab"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type nextAdminUserDTO struct {
	ID             int    `json:"id"`
	Username       string `json:"username"`
	DisplayName    string `json:"display_name"`
	Email          string `json:"email"`
	Role           int    `json:"role"`
	Status         int    `json:"status"`
	Quota          int    `json:"quota"`
	UsedQuota      int    `json:"used_quota"`
	RequestCount   int    `json:"request_count"`
	InvitedCount   int    `json:"invited_count"`
	AffiliateQuota int    `json:"affiliate_quota"`
	InviterID      int    `json:"inviter_id"`
	CreatedTime    int64  `json:"created_time"`
	LastLoginTime  int64  `json:"last_login_time"`
}

type nextAdminUserWriteRequest struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        int    `json:"role"`
	Status      int    `json:"status"`
}

func validateNextAdminUserWrite(request *nextAdminUserWriteRequest, creating bool) error {
	request.Username = strings.TrimSpace(request.Username)
	request.DisplayName = strings.TrimSpace(request.DisplayName)
	request.Email = model.NormalizeEmail(request.Email)
	if request.Username == "" || (creating && request.Password == "") {
		return fmt.Errorf("username and password are required")
	}
	if request.Role != common.RoleCommonUser && request.Role != common.RoleAdminUser {
		return fmt.Errorf("invalid user role")
	}
	if request.Status != 0 && request.Status != common.UserStatusEnabled && request.Status != common.UserStatusDisabled {
		return fmt.Errorf("invalid user status")
	}
	if creating && request.Status == 0 {
		return fmt.Errorf("invalid user status")
	}
	password := request.Password
	if password == "" {
		password = "unchanged"
	}
	return common.Validate.Struct(&model.User{
		Username: request.Username, DisplayName: request.DisplayName, Email: request.Email,
		Password: password, Role: request.Role, Status: request.Status,
	})
}

func buildNextAdminUserDTO(user *model.User) nextAdminUserDTO {
	return nextAdminUserDTO{
		ID: user.Id, Username: user.Username, DisplayName: user.DisplayName,
		Email: user.Email, Role: user.Role, Status: user.Status, Quota: user.Quota,
		UsedQuota: user.UsedQuota, RequestCount: user.RequestCount,
		InvitedCount: user.AffCount, AffiliateQuota: user.AffQuota,
		InviterID: user.InviterId, CreatedTime: user.CreatedAt, LastLoginTime: user.LastLoginAt,
	}
}

func NextCreateAdminUser(c *gin.Context) {
	var request nextAdminUserWriteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		nextBusinessError(c, "invalid user input", "VALIDATION_ERROR")
		return
	}
	if err := validateNextAdminUserWrite(&request, true); err != nil {
		nextBusinessError(c, err.Error(), "VALIDATION_ERROR")
		return
	}
	if request.Role >= c.GetInt("role") {
		nextBusinessError(c, "insufficient permission", "FORBIDDEN")
		return
	}
	if request.DisplayName == "" {
		request.DisplayName = request.Username
	}
	user := &model.User{
		Username: request.Username, DisplayName: request.DisplayName, Email: request.Email,
		Password: request.Password, Role: request.Role, Status: request.Status,
	}
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		return user.InsertWithTx(tx, 0)
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	user.FinishInsert(0)
	recordManageAuditFor(c, user.Id, "user.create", map[string]interface{}{
		"username": user.Username, "role": user.Role, "status": user.Status,
	})
	common.ApiSuccess(c, buildNextAdminUserDTO(user))
}

func NextUpdateAdminUser(c *gin.Context) {
	var request nextAdminUserWriteRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.ID <= 0 {
		nextBusinessError(c, "invalid user input", "VALIDATION_ERROR")
		return
	}
	if err := validateNextAdminUserWrite(&request, false); err != nil {
		nextBusinessError(c, err.Error(), "VALIDATION_ERROR")
		return
	}
	original, err := model.GetUserById(request.ID, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	operatorRole := c.GetInt("role")
	if original.Role >= operatorRole || request.Role >= operatorRole {
		nextBusinessError(c, "insufficient permission", "FORBIDDEN")
		return
	}
	if request.Status == 0 {
		request.Status = original.Status
	}
	user := &model.User{
		Id: request.ID, Username: request.Username, DisplayName: request.DisplayName,
		Email: request.Email, Password: request.Password, Role: request.Role, Status: request.Status,
	}
	previousAuthVersion := original.AuthVersion
	authzTouched := false
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := user.UpdateManagedWithTx(tx, request.Password != "", operatorRole); err != nil {
			return err
		}
		touched, err := updateAdminPermissionsForUserInTx(c, tx, user.Id, user.Role, nil)
		authzTouched = touched
		return err
	}); err != nil {
		writeManagedUserError(c, err)
		return
	}
	if authzTouched {
		if err := authz.ReloadPolicy(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := model.PublishUserAuthCache(user.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	if user.AuthVersion > previousAuthVersion {
		if _, err := model.RevokeAllUserSessions(user.Id, "admin_user_update"); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	recordManageAuditFor(c, user.Id, "user.update", map[string]interface{}{
		"username": user.Username, "role": user.Role, "status": user.Status,
	})
	common.ApiSuccess(c, buildNextAdminUserDTO(user))
}

func NextDeleteAdminUsersBatch(c *gin.Context) {
	var request struct {
		IDs []int `json:"ids"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || len(request.IDs) == 0 || len(request.IDs) > 100 {
		nextBusinessError(c, "invalid user batch", "VALIDATION_ERROR")
		return
	}
	ids := make([]int, 0, len(request.IDs))
	seen := make(map[int]struct{}, len(request.IDs))
	for _, id := range request.IDs {
		if id <= 0 {
			nextBusinessError(c, "invalid user batch", "VALIDATION_ERROR")
			return
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	deleted, err := model.HardDeleteManagedUsers(ids, c.GetInt("id"), c.GetInt("role"))
	if err != nil {
		writeManagedUserError(c, err)
		return
	}
	recordManageAudit(c, "user.delete_batch", map[string]interface{}{"count": deleted})
	common.ApiSuccess(c, deleted)
}

func NextListAdminUsers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := strings.TrimSpace(c.Query("keyword"))
	baseQuery := func() *gorm.DB {
		query := model.DB.Model(&model.User{})
		if keyword == "" {
			return query
		}
		like := "%" + keyword + "%"
		if id, err := strconv.Atoi(keyword); err == nil {
			return query.Where(
				"(username LIKE ? OR display_name LIKE ? OR email LIKE ? OR id = ?)",
				like, like, like, id,
			)
		}
		return query.Where("(username LIKE ? OR display_name LIKE ? OR email LIKE ?)", like, like, like)
	}

	type countRow struct {
		Value int
		Count int
	}
	roleRows := make([]countRow, 0)
	if err := baseQuery().Select("role AS value, COUNT(*) AS count").Group("role").Scan(&roleRows).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	statusRows := make([]countRow, 0)
	if err := baseQuery().Select("status AS value, COUNT(*) AS count").Group("status").Scan(&statusRows).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	roleCounts := make(map[string]int, len(roleRows))
	for _, row := range roleRows {
		roleCounts[strconv.Itoa(row.Value)] = row.Count
	}
	statusCounts := map[string]int{"enabled": 0, "disabled": 0}
	for _, row := range statusRows {
		if row.Value == common.UserStatusEnabled {
			statusCounts["enabled"] += row.Count
		} else {
			statusCounts["disabled"] += row.Count
		}
	}

	query := baseQuery()
	if value, err := strconv.Atoi(c.Query("role")); err == nil {
		query = query.Where("role = ?", value)
	}
	switch strings.ToLower(strings.TrimSpace(c.Query("status"))) {
	case "enabled", strconv.Itoa(common.UserStatusEnabled):
		query = query.Where("status = ?", common.UserStatusEnabled)
	case "disabled", strconv.Itoa(common.UserStatusDisabled):
		query = query.Where("status = ?", common.UserStatusDisabled)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	sortColumns := map[string]string{
		"id": "id", "username": "username", "quota": "quota", "used_quota": "used_quota",
		"created_time": "created_at", "last_login_time": "last_login_at",
	}
	sortColumn := sortColumns[c.Query("sort_by")]
	if sortColumn == "" {
		sortColumn = "id"
	}
	users := make([]*model.User, 0)
	if err := query.Order(clause.OrderByColumn{
		Column: clause.Column{Name: sortColumn},
		Desc:   strings.ToLower(c.Query("sort_order")) != "asc",
	}).Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&users).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]nextAdminUserDTO, 0, len(users))
	for _, user := range users {
		items = append(items, buildNextAdminUserDTO(user))
	}
	common.ApiSuccess(c, gin.H{
		"items": items, "total": total, "page": pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(), "role_counts": roleCounts, "status_counts": statusCounts,
	})
}

func NextAdminUserStatus(c *gin.Context) {
	var request struct {
		Status int `json:"status"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || (request.Status != common.UserStatusEnabled && request.Status != common.UserStatusDisabled) {
		nextBusinessError(c, "invalid user status", "VALIDATION_ERROR")
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		nextBusinessError(c, "invalid user id", "VALIDATION_ERROR")
		return
	}
	result, err := model.UpdateManagedUserStatuses([]int{id}, request.Status, c.GetInt("id"), c.GetInt("role"))
	if err != nil {
		writeManagedUserError(c, err)
		return
	}
	recordManageAudit(c, "user.status_update", map[string]interface{}{"id": id, "status": request.Status})
	common.ApiSuccess(c, buildNextAdminUserDTO(&result.Users[0]))
}

func NextAdminUserQuota(c *gin.Context) {
	var request struct {
		ID    int `json:"id"`
		Delta int `json:"delta"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || request.ID <= 0 || request.Delta == 0 {
		nextBusinessError(c, "invalid quota adjustment", "VALIDATION_ERROR")
		return
	}
	user, err := model.AdjustManagedUserQuota(request.ID, request.Delta, c.GetInt("role"))
	if err != nil {
		writeManagedUserError(c, err)
		return
	}
	recordManageAudit(c, "user.quota_adjust", map[string]interface{}{"id": request.ID, "delta": request.Delta})
	common.ApiSuccess(c, buildNextAdminUserDTO(user))
}

func NextAdminUserStatusBatch(c *gin.Context) {
	var request struct {
		IDs    []int `json:"ids"`
		Status int   `json:"status"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || len(request.IDs) == 0 || len(request.IDs) > 100 || (request.Status != common.UserStatusEnabled && request.Status != common.UserStatusDisabled) {
		nextBusinessError(c, "invalid user status batch", "VALIDATION_ERROR")
		return
	}
	ids := make([]int, 0, len(request.IDs))
	seen := make(map[int]struct{}, len(request.IDs))
	for _, id := range request.IDs {
		if id <= 0 {
			nextBusinessError(c, "invalid user status batch", "VALIDATION_ERROR")
			return
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	result, err := model.UpdateManagedUserStatuses(ids, request.Status, c.GetInt("id"), c.GetInt("role"))
	if err != nil {
		writeManagedUserError(c, err)
		return
	}
	recordManageAudit(c, "user.status_update_batch", map[string]interface{}{"count": result.Changed, "status": request.Status})
	common.ApiSuccess(c, result.Changed)
}

func writeManagedUserError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrManagedUserNotFound):
		nextBusinessError(c, "user not found", "NOT_FOUND")
	case errors.Is(err, model.ErrManagedUserForbidden):
		nextBusinessError(c, "insufficient permission", "FORBIDDEN")
	case errors.Is(err, model.ErrManagedUserQuotaOutOfRange):
		nextBusinessError(c, "quota adjustment is out of range", "VALIDATION_ERROR")
	default:
		common.ApiError(c, err)
	}
}

type nextAdminChannelDTO struct {
	ID            int                   `json:"id"`
	Name          string                `json:"name"`
	Type          int                   `json:"type"`
	Supplier      string                `json:"supplier"`
	Status        int                   `json:"status"`
	Priority      int64                 `json:"priority"`
	Weight        uint                  `json:"weight"`
	UsedQuota     int64                 `json:"used_quota"`
	ChannelRatio  float64               `json:"channel_ratio"`
	Balance       float64               `json:"balance"`
	UpstreamRatio float64               `json:"upstream_ratio"`
	CapacityTotal int                   `json:"capacity_total"`
	CapacityUsed  int                   `json:"capacity_used"`
	ResponseTime  int                   `json:"response_time"`
	TestTime      int64                 `json:"test_time"`
	BaseURL       string                `json:"base_url"`
	Models        string                `json:"models"`
	ModelMapping  string                `json:"model_mapping"`
	LabGroupSlug  string                `json:"lab_group_slug"`
	LabGroupName  string                `json:"lab_group_name"`
	LabMatches    []modellab.LabMatch   `json:"lab_matches"`
	LabModels     []modellab.ModelMatch `json:"lab_models"`
	LabUnresolved int                   `json:"lab_unresolved_count"`
	LabCatalog    string                `json:"lab_catalog_version"`
}

func labGroupName(resolution modellab.Resolution) string {
	switch resolution.GroupSlug {
	case modellab.GroupMixed:
		return "Mixed / Multi-Lab"
	case modellab.GroupUnknown:
		return "Unknown / Provider-specific"
	default:
		if len(resolution.Labs) > 0 && resolution.Labs[0].Slug == resolution.GroupSlug {
			return resolution.Labs[0].Name
		}
		return resolution.GroupSlug
	}
}

func buildNextAdminChannelDTO(channel *model.Channel) nextAdminChannelDTO {
	var priority int64
	var weight uint
	if channel.Priority != nil {
		priority = *channel.Priority
	}
	if channel.Weight != nil {
		weight = *channel.Weight
	}
	channelRatio := channel.ChannelRatio
	if channelRatio == 0 {
		channelRatio = model.DefaultChannelRatio
	}
	upstreamRatio := channel.UpstreamRatio
	if upstreamRatio == 0 {
		upstreamRatio = model.DefaultChannelRatio
	}
	capacityTotal := channel.CapacityTotal
	if capacityTotal == 0 {
		capacityTotal = model.DefaultChannelCapacityTotal
	}
	modelMapping := ""
	if channel.ModelMapping != nil {
		modelMapping = *channel.ModelMapping
	}
	labResolution := modellab.Resolve(channel.Models, modelMapping)
	return nextAdminChannelDTO{
		ID: channel.Id, Name: channel.Name, Type: channel.Type, Supplier: constant.GetChannelTypeName(channel.Type),
		Status: channel.Status, Priority: priority, Weight: weight,
		UsedQuota: channel.UsedQuota, ChannelRatio: channelRatio, Balance: channel.Balance,
		UpstreamRatio: upstreamRatio, CapacityTotal: capacityTotal, CapacityUsed: channel.CapacityUsed,
		ResponseTime: channel.ResponseTime, TestTime: channel.TestTime,
		BaseURL: channel.GetBaseURL(), Models: channel.Models, ModelMapping: modelMapping,
		LabGroupSlug: labResolution.GroupSlug, LabGroupName: labGroupName(labResolution),
		LabMatches: labResolution.Labs, LabModels: labResolution.Models,
		LabUnresolved: labResolution.UnresolvedCount, LabCatalog: labResolution.CatalogVersion,
	}
}

func NextListAdminChannels(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	baseQuery := func() *gorm.DB {
		query := model.DB.Model(&model.Channel{})
		if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
			like := "%" + keyword + "%"
			query = query.Where("name LIKE ? OR models LIKE ?", like, like)
		}
		switch strings.ToLower(strings.TrimSpace(c.Query("status"))) {
		case "enabled", strconv.Itoa(common.ChannelStatusEnabled):
			query = query.Where("status = ?", common.ChannelStatusEnabled)
		case "disabled", strconv.Itoa(common.ChannelStatusManuallyDisabled):
			query = query.Where("status <> ?", common.ChannelStatusEnabled)
		}
		return query
	}
	countRows := make([]struct {
		Type  int
		Count int
	}, 0)
	if err := baseQuery().Select("type, COUNT(*) AS count").Group("type").Scan(&countRows).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	typeCounts := make(map[string]int, len(countRows))
	for _, row := range countRows {
		typeCounts[strconv.Itoa(row.Type)] = row.Count
	}

	query := baseQuery()
	if value, err := strconv.Atoi(c.Query("type")); err == nil {
		query = query.Where("type = ?", value)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	channels := make([]*model.Channel, 0)
	sortOptions := model.NewChannelSortOptions(c.Query("sort_by"), c.Query("sort_order"), true)
	if err := sortOptions.Apply(query).Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Omit("key").Find(&channels).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]nextAdminChannelDTO, 0, len(channels))
	for _, channel := range channels {
		items = append(items, buildNextAdminChannelDTO(channel))
	}
	common.ApiSuccess(c, gin.H{
		"items": items, "total": total, "page": pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(), "type_counts": typeCounts,
	})
}

type nextAdminRedemptionDTO struct {
	ID            int     `json:"id"`
	Name          string  `json:"name"`
	Code          string  `json:"code"`
	Type          string  `json:"type"`
	Status        string  `json:"status"`
	Quota         int     `json:"quota,omitempty"`
	Amount        float64 `json:"amount,omitempty"`
	RedeemerID    int     `json:"redeemer_id"`
	RedeemerEmail string  `json:"redeemer_email"`
	CreatedTime   int64   `json:"created_time"`
	UsedTime      int64   `json:"used_time"`
	ExpiredTime   int64   `json:"expired_time"`
}

func buildNextAdminRedemptionDTO(item *model.Redemption, redeemerEmail string) nextAdminRedemptionDTO {
	status := "unused"
	if item.Status == common.RedemptionCodeStatusUsed {
		status = "used"
	}
	if item.Status == common.RedemptionCodeStatusDisabled {
		status = "disabled"
	}
	if item.Status == common.RedemptionCodeStatusEnabled && item.ExpiredTime != 0 && item.ExpiredTime < common.GetTimestamp() {
		status = "expired"
	}
	expiredTime := item.ExpiredTime
	if expiredTime == 0 {
		expiredTime = -1
	}
	return nextAdminRedemptionDTO{
		ID: item.Id, Name: item.Name, Code: item.Key, Type: "quota", Status: status,
		Quota: item.Quota, Amount: float64(item.Quota) / common.QuotaPerUnit,
		RedeemerID: item.UsedUserId, RedeemerEmail: redeemerEmail, CreatedTime: item.CreatedTime,
		UsedTime: item.RedeemedTime, ExpiredTime: expiredTime,
	}
}

func nextRedemptionStatusQuery(query *gorm.DB, status string) *gorm.DB {
	now := common.GetTimestamp()
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "unused":
		return query.Where("status = ? AND (expired_time = 0 OR expired_time >= ?)", common.RedemptionCodeStatusEnabled, now)
	case "used":
		return query.Where("status = ?", common.RedemptionCodeStatusUsed)
	case "disabled":
		return query.Where("status = ?", common.RedemptionCodeStatusDisabled)
	case "expired":
		return query.Where("status = ? AND expired_time != 0 AND expired_time < ?", common.RedemptionCodeStatusEnabled, now)
	default:
		return query
	}
}

func NextListAdminRedemptions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	baseQuery := func() *gorm.DB {
		query := model.DB.Model(&model.Redemption{})
		if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
			like := "%" + keyword + "%"
			keywordQuery := model.DB.Where("name LIKE ?", like).Or(clause.Like{
				Column: clause.Column{Name: "key"},
				Value:  like,
			})
			if id, err := strconv.Atoi(keyword); err == nil {
				keywordQuery = keywordQuery.Or("id = ?", id)
			}
			query = query.Where(keywordQuery)
		}
		return query
	}
	allStatuses := make([]struct {
		Status      int
		ExpiredTime int64
	}, 0)
	if err := baseQuery().Select("status, expired_time").Find(&allStatuses).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	statusCounts := map[string]int{"unused": 0, "used": 0, "expired": 0, "disabled": 0}
	now := common.GetTimestamp()
	for _, item := range allStatuses {
		switch {
		case item.Status == common.RedemptionCodeStatusUsed:
			statusCounts["used"]++
		case item.Status == common.RedemptionCodeStatusDisabled:
			statusCounts["disabled"]++
		case item.ExpiredTime != 0 && item.ExpiredTime < now:
			statusCounts["expired"]++
		default:
			statusCounts["unused"]++
		}
	}
	if requestedType := strings.TrimSpace(c.Query("type")); requestedType != "" && requestedType != "quota" {
		common.ApiSuccess(c, gin.H{
			"items": []nextAdminRedemptionDTO{}, "total": 0, "page": pageInfo.GetPage(), "page_size": pageInfo.GetPageSize(),
			"type_counts": map[string]int{"quota": len(allStatuses)}, "status_counts": statusCounts,
		})
		return
	}
	query := nextRedemptionStatusQuery(baseQuery(), c.Query("status"))
	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	rawItems := make([]*model.Redemption, 0)
	sortColumns := map[string]string{"id": "id", "created_time": "created_time", "used_time": "redeemed_time"}
	sortColumn := sortColumns[c.Query("sort_by")]
	if sortColumn == "" {
		sortColumn = "id"
	}
	if err := query.Order(clause.OrderByColumn{
		Column: clause.Column{Name: sortColumn}, Desc: strings.ToLower(c.Query("sort_order")) != "asc",
	}).Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&rawItems).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	redeemerIDs := make([]int, 0, len(rawItems))
	for _, item := range rawItems {
		if item.UsedUserId > 0 {
			redeemerIDs = append(redeemerIDs, item.UsedUserId)
		}
	}
	emails := make(map[int]string, len(redeemerIDs))
	if len(redeemerIDs) > 0 {
		users := make([]model.User, 0)
		if err := model.DB.Select("id", "email").Where("id IN ?", redeemerIDs).Find(&users).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		for _, user := range users {
			emails[user.Id] = user.Email
		}
	}
	items := make([]nextAdminRedemptionDTO, 0, len(rawItems))
	for _, item := range rawItems {
		items = append(items, buildNextAdminRedemptionDTO(item, emails[item.UsedUserId]))
	}
	common.ApiSuccess(c, gin.H{
		"items": items, "total": total, "page": pageInfo.GetPage(), "page_size": pageInfo.GetPageSize(),
		"type_counts": map[string]int{"quota": len(allStatuses)}, "status_counts": statusCounts,
	})
}

func NextCreateAdminRedemptions(c *gin.Context) {
	var request struct {
		Type        string  `json:"type"`
		Count       int     `json:"count"`
		Amount      float64 `json:"amount"`
		ExpiredTime int64   `json:"expired_time"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || request.Type != "quota" || request.Count < 1 || request.Count > 100 || request.Amount <= 0 {
		nextBusinessError(c, "only quota redemption codes are supported", "VALIDATION_ERROR")
		return
	}
	quota, err := common.QuotaFromFloatStrict(request.Amount * common.QuotaPerUnit)
	if err != nil || quota <= 0 {
		nextBusinessError(c, "redemption amount is out of range", "VALIDATION_ERROR")
		return
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		nextBusinessError(c, "payment compliance is required", "PAYMENT_COMPLIANCE_REQUIRED")
		return
	}
	if request.ExpiredTime != -1 && request.ExpiredTime <= common.GetTimestamp() {
		nextBusinessError(c, "invalid expiration time", "VALIDATION_ERROR")
		return
	}
	keys := make([]string, 0, request.Count)
	items := make([]nextAdminRedemptionDTO, 0, request.Count)
	expires := request.ExpiredTime
	if expires == -1 {
		expires = 0
	}
	if err := model.DB.Transaction(func(tx *gorm.DB) error {
		for index := 0; index < request.Count; index++ {
			item := &model.Redemption{
				UserId: c.GetInt("id"), Name: fmt.Sprintf("$%.2f", request.Amount), Key: common.GetUUID(),
				Quota: quota, CreatedTime: common.GetTimestamp(), ExpiredTime: expires,
			}
			if err := tx.Create(item).Error; err != nil {
				return err
			}
			keys = append(keys, item.Key)
			items = append(items, buildNextAdminRedemptionDTO(item, ""))
		}
		return nil
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "redemption.create", map[string]interface{}{"count": request.Count, "amount": request.Amount})
	common.ApiSuccess(c, gin.H{"codes": keys, "items": items})
}

func NextAdminRedemptionStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		nextBusinessError(c, "invalid redemption id", "VALIDATION_ERROR")
		return
	}
	item, err := model.GetRedemptionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if item.Status == common.RedemptionCodeStatusDisabled {
		item.Status = common.RedemptionCodeStatusEnabled
	} else {
		item.Status = common.RedemptionCodeStatusDisabled
	}
	if err := item.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "redemption.status_update", map[string]interface{}{"id": id, "status": item.Status})
	common.ApiSuccess(c, buildNextAdminRedemptionDTO(item, ""))
}

func NextDeleteAdminRedemptionsBatch(c *gin.Context) {
	var request struct {
		IDs []int `json:"ids"`
	}
	if err := c.ShouldBindJSON(&request); err != nil || len(request.IDs) == 0 || len(request.IDs) > 500 {
		nextBusinessError(c, "invalid redemption batch", "VALIDATION_ERROR")
		return
	}
	ids := make([]int, 0, len(request.IDs))
	seen := make(map[int]struct{}, len(request.IDs))
	for _, id := range request.IDs {
		if id <= 0 {
			nextBusinessError(c, "invalid redemption batch", "VALIDATION_ERROR")
			return
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	deleted, err := model.BatchDeleteRedemptions(ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "redemption.delete_batch", map[string]interface{}{"count": deleted})
	common.ApiSuccess(c, deleted)
}
