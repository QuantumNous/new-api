package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	EntitlementStatusEnabled  = 1
	EntitlementStatusDisabled = 2
)

var entitlementLocation = time.FixedZone("Asia/Shanghai", 8*60*60)

// EntitlementPackage defines a reusable, administrator-managed activity rule.
// Quota values use the platform's native quota unit. A zero limit means unlimited.
type EntitlementPackage struct {
	Id                  int            `json:"id"`
	Name                string         `json:"name" gorm:"type:varchar(100);uniqueIndex"`
	Description         string         `json:"description" gorm:"type:text"`
	Status              int            `json:"status" gorm:"default:2;index"`
	Group               string         `json:"group" gorm:"type:varchar(64)"`
	Models              string         `json:"models" gorm:"type:text"`
	Priority            int            `json:"priority" gorm:"default:0;index"`
	AllowPublicFallback bool           `json:"allow_public_fallback" gorm:"default:false"`
	StartTime           int64          `json:"start_time" gorm:"bigint;default:0"`
	EndTime             int64          `json:"end_time" gorm:"bigint;default:0"`
	DailyQuota          int            `json:"daily_quota" gorm:"default:0"`
	DailyRequestLimit   int64          `json:"daily_request_limit" gorm:"default:0"`
	TotalQuota          int            `json:"total_quota" gorm:"default:0"`
	TotalRequestLimit   int64          `json:"total_request_limit" gorm:"default:0"`
	CreatedTime         int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime         int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt           gorm.DeletedAt `gorm:"index"`
}

type UserEntitlement struct {
	Id          int            `json:"id"`
	PackageId   int            `json:"package_id" gorm:"uniqueIndex:idx_user_entitlement;index"`
	UserId      int            `json:"user_id" gorm:"uniqueIndex:idx_user_entitlement;index"`
	Status      int            `json:"status" gorm:"default:2;index"`
	StartTime   int64          `json:"start_time" gorm:"bigint;default:0"`
	EndTime     int64          `json:"end_time" gorm:"bigint;default:0"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

// Override limits use -1 to inherit the package value, 0 for unlimited and
// positive values for a token-specific limit.
type TokenEntitlement struct {
	Id                        int            `json:"id"`
	PackageId                 int            `json:"package_id" gorm:"uniqueIndex:idx_token_entitlement;index"`
	TokenId                   int            `json:"token_id" gorm:"uniqueIndex:idx_token_entitlement;index"`
	UserId                    int            `json:"user_id" gorm:"index"`
	Status                    int            `json:"status" gorm:"default:2;index"`
	StartTime                 int64          `json:"start_time" gorm:"bigint;default:0"`
	EndTime                   int64          `json:"end_time" gorm:"bigint;default:0"`
	DailyQuotaOverride        int            `json:"daily_quota_override" gorm:"default:-1"`
	DailyRequestLimitOverride int64          `json:"daily_request_limit_override" gorm:"default:-1"`
	TotalQuotaOverride        int            `json:"total_quota_override" gorm:"default:-1"`
	TotalRequestLimitOverride int64          `json:"total_request_limit_override" gorm:"default:-1"`
	UsedQuota                 int            `json:"used_quota" gorm:"default:0"`
	UsedRequests              int64          `json:"used_requests" gorm:"default:0"`
	CreatedTime               int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime               int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt                 gorm.DeletedAt `gorm:"index"`
}

type EntitlementDailyUsage struct {
	Id                 int    `json:"id"`
	TokenEntitlementId int    `json:"token_entitlement_id" gorm:"uniqueIndex:idx_entitlement_day;index"`
	UsageDate          string `json:"usage_date" gorm:"type:varchar(10);uniqueIndex:idx_entitlement_day"`
	UsedQuota          int    `json:"used_quota" gorm:"default:0"`
	RequestCount       int64  `json:"request_count" gorm:"default:0"`
	UpdatedTime        int64  `json:"updated_time" gorm:"bigint"`
}

type EntitlementGrant struct {
	Package           EntitlementPackage `json:"package"`
	UserGrant         UserEntitlement    `json:"user_grant"`
	TokenGrant        TokenEntitlement   `json:"token_grant"`
	DailyQuota        int                `json:"daily_quota"`
	DailyRequestLimit int64              `json:"daily_request_limit"`
	TotalQuota        int                `json:"total_quota"`
	TotalRequestLimit int64              `json:"total_request_limit"`
	UsageDate         string             `json:"usage_date"`
}

type EntitlementAccessError struct {
	Code    string
	Message string
}

func (e *EntitlementAccessError) Error() string {
	return e.Message
}

func entitlementModels(models string) []string {
	items := strings.Split(models, ",")
	result := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item != "" {
			result = append(result, item)
		}
	}
	return result
}

func entitlementContainsModel(models, modelName string) bool {
	for _, item := range entitlementModels(models) {
		if item == modelName {
			return true
		}
		if strings.HasSuffix(modelName, "-thinking") && item == strings.TrimSuffix(modelName, "-thinking") {
			return true
		}
	}
	return false
}

func entitlementTimeActive(status int, start, end, now int64) (bool, string) {
	if status != EntitlementStatusEnabled {
		return false, "权益已关闭"
	}
	if start > 0 && now < start {
		return false, "活动尚未开始"
	}
	if end > 0 && now >= end {
		return false, "活动已结束"
	}
	return true, ""
}

func resolveIntOverride(value, inherited int) int {
	if value < 0 {
		return inherited
	}
	return value
}

func resolveInt64Override(value, inherited int64) int64 {
	if value < 0 {
		return inherited
	}
	return value
}

func entitlementDate(now time.Time) string {
	return now.In(entitlementLocation).Format("2006-01-02")
}

func GetAllEntitlementPackages() ([]EntitlementPackage, error) {
	var packages []EntitlementPackage
	err := DB.Order("priority desc, id desc").Find(&packages).Error
	return packages, err
}

func GetEntitlementPackage(id int) (*EntitlementPackage, error) {
	var item EntitlementPackage
	if id <= 0 {
		return nil, errors.New("权益包 ID 无效")
	}
	if err := DB.First(&item, id).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func SaveEntitlementPackage(item *EntitlementPackage) error {
	if item == nil {
		return errors.New("权益包不能为空")
	}
	item.Name = strings.TrimSpace(item.Name)
	item.Group = strings.TrimSpace(item.Group)
	item.Models = strings.Join(entitlementModels(item.Models), ",")
	if item.Name == "" {
		return errors.New("权益包名称不能为空")
	}
	if item.Group == "" {
		return errors.New("权益包必须绑定分组")
	}
	if item.Models == "" {
		return errors.New("权益包至少需要一个模型")
	}
	if item.StartTime < 0 || item.EndTime < 0 || (item.EndTime > 0 && item.StartTime > 0 && item.EndTime <= item.StartTime) {
		return errors.New("活动时间范围无效")
	}
	if item.DailyQuota < 0 || item.DailyRequestLimit < 0 || item.TotalQuota < 0 || item.TotalRequestLimit < 0 {
		return errors.New("限额不能为负数")
	}
	now := common.GetTimestamp()
	item.UpdatedTime = now
	if item.Id == 0 {
		item.CreatedTime = now
		if item.Status == 0 {
			item.Status = EntitlementStatusDisabled
		}
		return DB.Create(item).Error
	}
	existing, err := GetEntitlementPackage(item.Id)
	if err != nil {
		return err
	}
	item.CreatedTime = existing.CreatedTime
	result := DB.Model(&EntitlementPackage{}).Where("id = ?", item.Id).Select(
		"name", "description", "status", "group", "models", "priority", "allow_public_fallback",
		"start_time", "end_time", "daily_quota", "daily_request_limit",
		"total_quota", "total_request_limit", "updated_time",
	).Updates(item)
	if result.Error != nil {
		return result.Error
	}
	return nil
}

func UpsertUserEntitlement(item *UserEntitlement) error {
	if item == nil || item.PackageId <= 0 || item.UserId <= 0 {
		return errors.New("用户授权参数无效")
	}
	if _, err := GetEntitlementPackage(item.PackageId); err != nil {
		return err
	}
	if _, err := GetUserById(item.UserId, false); err != nil {
		return err
	}
	if item.StartTime < 0 || item.EndTime < 0 || (item.EndTime > 0 && item.StartTime > 0 && item.EndTime <= item.StartTime) {
		return errors.New("用户授权时间范围无效")
	}
	now := common.GetTimestamp()
	var existing UserEntitlement
	err := DB.Where("package_id = ? AND user_id = ?", item.PackageId, item.UserId).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		item.CreatedTime = now
		item.UpdatedTime = now
		if item.Status == 0 {
			item.Status = EntitlementStatusDisabled
		}
		return DB.Create(item).Error
	}
	if err != nil {
		return err
	}
	existing.Status = item.Status
	existing.StartTime = item.StartTime
	existing.EndTime = item.EndTime
	existing.UpdatedTime = now
	return DB.Model(&existing).Select("status", "start_time", "end_time", "updated_time").Updates(&existing).Error
}

func GetPackageUserEntitlements(packageId int) ([]UserEntitlement, error) {
	var items []UserEntitlement
	err := DB.Where("package_id = ?", packageId).Order("id desc").Find(&items).Error
	return items, err
}

func GetUserEntitlementPackages(userId int, activeOnly bool) ([]EntitlementPackage, error) {
	var packages []EntitlementPackage
	if activeOnly && !common.EntitlementFeatureEnabled {
		return packages, nil
	}
	query := DB.Table("entitlement_packages").
		Select("entitlement_packages.*").
		Joins("JOIN user_entitlements ON user_entitlements.package_id = entitlement_packages.id AND user_entitlements.deleted_at IS NULL").
		Where("user_entitlements.user_id = ? AND entitlement_packages.deleted_at IS NULL", userId)
	if activeOnly {
		now := common.GetTimestamp()
		query = query.Where(
			"user_entitlements.status = ? AND entitlement_packages.status = ? "+
				"AND (user_entitlements.start_time = 0 OR user_entitlements.start_time <= ?) "+
				"AND (user_entitlements.end_time = 0 OR user_entitlements.end_time > ?) "+
				"AND (entitlement_packages.start_time = 0 OR entitlement_packages.start_time <= ?) "+
				"AND (entitlement_packages.end_time = 0 OR entitlement_packages.end_time > ?)",
			EntitlementStatusEnabled, EntitlementStatusEnabled, now, now, now, now,
		)
	}
	err := query.Order("entitlement_packages.priority desc, entitlement_packages.id desc").Scan(&packages).Error
	return packages, err
}

func GetActiveTokenEntitlementPackages(tokenId, userId int) ([]EntitlementPackage, error) {
	var packages []EntitlementPackage
	if !common.EntitlementFeatureEnabled {
		return packages, nil
	}
	now := common.GetTimestamp()
	err := DB.Table("entitlement_packages").
		Select("entitlement_packages.*").
		Joins("JOIN user_entitlements ON user_entitlements.package_id = entitlement_packages.id AND user_entitlements.deleted_at IS NULL").
		Joins("JOIN token_entitlements ON token_entitlements.package_id = entitlement_packages.id AND token_entitlements.deleted_at IS NULL").
		Where(
			"token_entitlements.token_id = ? AND token_entitlements.user_id = ? AND user_entitlements.user_id = ? "+
				"AND entitlement_packages.status = ? AND user_entitlements.status = ? AND token_entitlements.status = ? "+
				"AND (entitlement_packages.start_time = 0 OR entitlement_packages.start_time <= ?) "+
				"AND (entitlement_packages.end_time = 0 OR entitlement_packages.end_time > ?) "+
				"AND (user_entitlements.start_time = 0 OR user_entitlements.start_time <= ?) "+
				"AND (user_entitlements.end_time = 0 OR user_entitlements.end_time > ?) "+
				"AND (token_entitlements.start_time = 0 OR token_entitlements.start_time <= ?) "+
				"AND (token_entitlements.end_time = 0 OR token_entitlements.end_time > ?)",
			tokenId, userId, userId,
			EntitlementStatusEnabled, EntitlementStatusEnabled, EntitlementStatusEnabled,
			now, now, now, now, now, now,
		).
		Order("entitlement_packages.priority desc, entitlement_packages.id desc").
		Scan(&packages).Error
	return packages, err
}

func UpsertTokenEntitlement(item *TokenEntitlement) error {
	if item == nil || item.PackageId <= 0 || item.TokenId <= 0 {
		return errors.New("令牌授权参数无效")
	}
	token, err := GetTokenById(item.TokenId)
	if err != nil {
		return err
	}
	if item.UserId == 0 {
		item.UserId = token.UserId
	}
	if item.UserId != token.UserId {
		return errors.New("令牌不属于目标用户")
	}
	var userGrant UserEntitlement
	if err := DB.Where("package_id = ? AND user_id = ?", item.PackageId, item.UserId).First(&userGrant).Error; err != nil {
		return errors.New("用户尚未获得该权益包授权")
	}
	if item.StartTime < 0 || item.EndTime < 0 || (item.EndTime > 0 && item.StartTime > 0 && item.EndTime <= item.StartTime) {
		return errors.New("令牌授权时间范围无效")
	}
	if item.DailyQuotaOverride < -1 || item.DailyRequestLimitOverride < -1 ||
		item.TotalQuotaOverride < -1 || item.TotalRequestLimitOverride < -1 {
		return errors.New("限额覆盖值不能小于 -1")
	}
	now := common.GetTimestamp()
	var existing TokenEntitlement
	err = DB.Where("package_id = ? AND token_id = ?", item.PackageId, item.TokenId).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		item.CreatedTime = now
		item.UpdatedTime = now
		if item.Status == 0 {
			item.Status = EntitlementStatusDisabled
		}
		return DB.Create(item).Error
	}
	if err != nil {
		return err
	}
	existing.Status = item.Status
	existing.StartTime = item.StartTime
	existing.EndTime = item.EndTime
	existing.DailyQuotaOverride = item.DailyQuotaOverride
	existing.DailyRequestLimitOverride = item.DailyRequestLimitOverride
	existing.TotalQuotaOverride = item.TotalQuotaOverride
	existing.TotalRequestLimitOverride = item.TotalRequestLimitOverride
	existing.UpdatedTime = now
	return DB.Model(&existing).Select(
		"status", "start_time", "end_time", "daily_quota_override",
		"daily_request_limit_override", "total_quota_override",
		"total_request_limit_override", "updated_time",
	).Updates(&existing).Error
}

func GetTokenEntitlements(tokenId int) ([]TokenEntitlement, error) {
	var items []TokenEntitlement
	err := DB.Where("token_id = ?", tokenId).Order("id desc").Find(&items).Error
	return items, err
}

func GetPackageTokenEntitlements(packageId int) ([]TokenEntitlement, error) {
	var items []TokenEntitlement
	err := DB.Where("package_id = ?", packageId).Order("id desc").Find(&items).Error
	return items, err
}

func SetTokenEntitlementPackages(tokenId, userId int, packageIds []int, autoGrant bool) error {
	token, err := GetTokenByIds(tokenId, userId)
	if err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		return setTokenEntitlementPackagesTx(tx, token.Id, userId, packageIds, autoGrant)
	})
}

func setTokenEntitlementPackagesTx(tx *gorm.DB, tokenId, userId int, packageIds []int, autoGrant bool) error {
	selected := make(map[int]bool, len(packageIds))
	for _, packageId := range packageIds {
		if packageId <= 0 {
			return errors.New("权益包 ID 无效")
		}
		selected[packageId] = true
	}
	now := common.GetTimestamp()
	var existing []TokenEntitlement
	if err := tx.Where("token_id = ?", tokenId).Find(&existing).Error; err != nil {
		return err
	}
	for _, item := range existing {
		targetStatus := EntitlementStatusDisabled
		if selected[item.PackageId] {
			targetStatus = EntitlementStatusEnabled
			delete(selected, item.PackageId)
		}
		if item.Status != targetStatus {
			if err := tx.Model(&item).Updates(map[string]interface{}{
				"status":       targetStatus,
				"updated_time": now,
			}).Error; err != nil {
				return err
			}
		}
	}
	for packageId := range selected {
		var pkg EntitlementPackage
		if err := tx.First(&pkg, packageId).Error; err != nil {
			return err
		}
		var userGrant UserEntitlement
		err := tx.Where("package_id = ? AND user_id = ?", packageId, userId).First(&userGrant).Error
		if errors.Is(err, gorm.ErrRecordNotFound) && autoGrant {
			userGrant = UserEntitlement{
				PackageId:   packageId,
				UserId:      userId,
				Status:      EntitlementStatusEnabled,
				CreatedTime: now,
				UpdatedTime: now,
			}
			if err := tx.Create(&userGrant).Error; err != nil {
				return err
			}
		} else if err != nil {
			return errors.New("用户尚未获得该权益包授权")
		} else if userGrant.Status != EntitlementStatusEnabled {
			if !autoGrant {
				return errors.New("用户权益包授权未启用")
			}
			if err := tx.Model(&userGrant).Updates(map[string]interface{}{
				"status":       EntitlementStatusEnabled,
				"updated_time": now,
			}).Error; err != nil {
				return err
			}
		}
		item := TokenEntitlement{
			PackageId:                 packageId,
			TokenId:                   tokenId,
			UserId:                    userId,
			Status:                    EntitlementStatusEnabled,
			DailyQuotaOverride:        -1,
			DailyRequestLimitOverride: -1,
			TotalQuotaOverride:        -1,
			TotalRequestLimitOverride: -1,
			CreatedTime:               now,
			UpdatedTime:               now,
		}
		if err := tx.Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func CreateTokenWithEntitlements(token *Token, packageIds []int, autoGrant bool) error {
	if token == nil {
		return errors.New("令牌不能为空")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(token).Error; err != nil {
			return err
		}
		now := common.GetTimestamp()
		for _, packageId := range packageIds {
			if packageId <= 0 {
				return errors.New("权益包 ID 无效")
			}
			var pkg EntitlementPackage
			if err := tx.First(&pkg, packageId).Error; err != nil {
				return err
			}
			var userGrant UserEntitlement
			err := tx.Where("package_id = ? AND user_id = ?", packageId, token.UserId).First(&userGrant).Error
			if errors.Is(err, gorm.ErrRecordNotFound) && autoGrant {
				userGrant = UserEntitlement{
					PackageId:   packageId,
					UserId:      token.UserId,
					Status:      EntitlementStatusEnabled,
					CreatedTime: now,
					UpdatedTime: now,
				}
				if err := tx.Create(&userGrant).Error; err != nil {
					return err
				}
			} else if err != nil {
				return errors.New("用户尚未获得该权益包授权")
			} else if userGrant.Status != EntitlementStatusEnabled {
				if !autoGrant {
					return errors.New("用户权益包授权未启用")
				}
				if err := tx.Model(&userGrant).Updates(map[string]interface{}{
					"status":       EntitlementStatusEnabled,
					"updated_time": now,
				}).Error; err != nil {
					return err
				}
			}
			item := TokenEntitlement{
				PackageId:                 packageId,
				TokenId:                   token.Id,
				UserId:                    token.UserId,
				Status:                    EntitlementStatusEnabled,
				DailyQuotaOverride:        -1,
				DailyRequestLimitOverride: -1,
				TotalQuotaOverride:        -1,
				TotalRequestLimitOverride: -1,
				CreatedTime:               now,
				UpdatedTime:               now,
			}
			if err := tx.Create(&item).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func ResolveTokenEntitlement(tokenId, userId int, modelName string, now time.Time) (*EntitlementGrant, bool, error) {
	if !common.EntitlementFeatureEnabled {
		return nil, false, nil
	}
	var packages []EntitlementPackage
	if err := DB.Order("priority desc, id desc").Find(&packages).Error; err != nil {
		return nil, false, err
	}
	protected := false
	matchingIds := make([]int, 0)
	packageById := make(map[int]EntitlementPackage)
	nowUnix := now.Unix()
	for _, item := range packages {
		if !entitlementContainsModel(item.Models, modelName) {
			continue
		}
		if active, _ := entitlementTimeActive(item.Status, item.StartTime, item.EndTime, nowUnix); !active {
			continue
		}
		if !item.AllowPublicFallback {
			protected = true
		}
		matchingIds = append(matchingIds, item.Id)
		packageById[item.Id] = item
	}
	if len(matchingIds) == 0 {
		return nil, false, nil
	}

	var tokenGrants []TokenEntitlement
	if err := DB.Where("token_id = ? AND user_id = ? AND package_id IN ?", tokenId, userId, matchingIds).
		Find(&tokenGrants).Error; err != nil {
		return nil, protected, err
	}
	if len(tokenGrants) == 0 {
		if protected {
			return nil, true, &EntitlementAccessError{Code: "entitlement_required", Message: "该令牌未获此活动/权益包授权"}
		}
		return nil, false, nil
	}

	var firstInactiveReason string
	tokenGrantByPackage := make(map[int]TokenEntitlement, len(tokenGrants))
	for _, item := range tokenGrants {
		tokenGrantByPackage[item.PackageId] = item
	}
	for _, packageId := range matchingIds {
		tokenGrant, exists := tokenGrantByPackage[packageId]
		if !exists {
			continue
		}
		pkg := packageById[packageId]
		if ok, reason := entitlementTimeActive(pkg.Status, pkg.StartTime, pkg.EndTime, nowUnix); !ok {
			if firstInactiveReason == "" {
				firstInactiveReason = reason
			}
			continue
		}
		var userGrant UserEntitlement
		if err := DB.Where("package_id = ? AND user_id = ?", pkg.Id, userId).First(&userGrant).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				if firstInactiveReason == "" {
					firstInactiveReason = "用户权益授权已撤销"
				}
				continue
			}
			return nil, protected, err
		}
		if ok, reason := entitlementTimeActive(userGrant.Status, userGrant.StartTime, userGrant.EndTime, nowUnix); !ok {
			if firstInactiveReason == "" {
				firstInactiveReason = reason
			}
			continue
		}
		if ok, reason := entitlementTimeActive(tokenGrant.Status, tokenGrant.StartTime, tokenGrant.EndTime, nowUnix); !ok {
			if firstInactiveReason == "" {
				firstInactiveReason = reason
			}
			continue
		}
		return &EntitlementGrant{
			Package:           pkg,
			UserGrant:         userGrant,
			TokenGrant:        tokenGrant,
			DailyQuota:        resolveIntOverride(tokenGrant.DailyQuotaOverride, pkg.DailyQuota),
			DailyRequestLimit: resolveInt64Override(tokenGrant.DailyRequestLimitOverride, pkg.DailyRequestLimit),
			TotalQuota:        resolveIntOverride(tokenGrant.TotalQuotaOverride, pkg.TotalQuota),
			TotalRequestLimit: resolveInt64Override(tokenGrant.TotalRequestLimitOverride, pkg.TotalRequestLimit),
			UsageDate:         entitlementDate(now),
		}, protected, nil
	}
	if protected {
		if firstInactiveReason == "" {
			firstInactiveReason = "权益授权不可用"
		}
		return nil, true, &EntitlementAccessError{Code: "entitlement_inactive", Message: firstInactiveReason}
	}
	return nil, false, nil
}

func getLockedEntitlementUsage(tx *gorm.DB, grantId int, usageDate string) (*TokenEntitlement, *EntitlementDailyUsage, error) {
	var tokenGrant TokenEntitlement
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&tokenGrant, grantId).Error; err != nil {
		return nil, nil, err
	}
	var daily EntitlementDailyUsage
	err := tx.Where("token_entitlement_id = ? AND usage_date = ?", grantId, usageDate).First(&daily).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		daily = EntitlementDailyUsage{
			TokenEntitlementId: grantId,
			UsageDate:          usageDate,
			UpdatedTime:        common.GetTimestamp(),
		}
		if err := tx.Create(&daily).Error; err != nil {
			return nil, nil, err
		}
	} else if err != nil {
		return nil, nil, err
	}
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&daily, daily.Id).Error; err != nil {
		return nil, nil, err
	}
	return &tokenGrant, &daily, nil
}

func ReserveEntitlementRequest(grant *EntitlementGrant) error {
	if grant == nil {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		tokenGrant, daily, err := getLockedEntitlementUsage(tx, grant.TokenGrant.Id, grant.UsageDate)
		if err != nil {
			return err
		}
		if grant.TotalRequestLimit > 0 && tokenGrant.UsedRequests+1 > grant.TotalRequestLimit {
			return &EntitlementAccessError{Code: "entitlement_total_requests_exhausted", Message: "活动总请求次数已用尽"}
		}
		if grant.DailyRequestLimit > 0 && daily.RequestCount+1 > grant.DailyRequestLimit {
			return &EntitlementAccessError{Code: "entitlement_daily_requests_exhausted", Message: "今日活动请求次数已用尽"}
		}
		now := common.GetTimestamp()
		if err := tx.Model(tokenGrant).Updates(map[string]interface{}{
			"used_requests": gorm.Expr("used_requests + 1"),
			"updated_time":  now,
		}).Error; err != nil {
			return err
		}
		return tx.Model(daily).Updates(map[string]interface{}{
			"request_count": gorm.Expr("request_count + 1"),
			"updated_time":  now,
		}).Error
	})
}

func AdjustEntitlementRequest(grantId int, usageDate string, delta int64) error {
	if grantId <= 0 || usageDate == "" || delta == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		tokenGrant, daily, err := getLockedEntitlementUsage(tx, grantId, usageDate)
		if err != nil {
			return err
		}
		tokenDelta := delta
		dailyDelta := delta
		if tokenGrant.UsedRequests+tokenDelta < 0 {
			tokenDelta = -tokenGrant.UsedRequests
		}
		if daily.RequestCount+dailyDelta < 0 {
			dailyDelta = -daily.RequestCount
		}
		now := common.GetTimestamp()
		if err := tx.Model(tokenGrant).Updates(map[string]interface{}{
			"used_requests": gorm.Expr("used_requests + ?", tokenDelta),
			"updated_time":  now,
		}).Error; err != nil {
			return err
		}
		return tx.Model(daily).Updates(map[string]interface{}{
			"request_count": gorm.Expr("request_count + ?", dailyDelta),
			"updated_time":  now,
		}).Error
	})
}

func AdjustEntitlementQuota(grantId int, usageDate string, delta, dailyLimit, totalLimit int) error {
	if grantId <= 0 || usageDate == "" || delta == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		tokenGrant, daily, err := getLockedEntitlementUsage(tx, grantId, usageDate)
		if err != nil {
			return err
		}
		if delta > 0 {
			if totalLimit > 0 && tokenGrant.UsedQuota+delta > totalLimit {
				return &EntitlementAccessError{Code: "entitlement_total_quota_exhausted", Message: "活动总额度已用尽"}
			}
			if dailyLimit > 0 && daily.UsedQuota+delta > dailyLimit {
				return &EntitlementAccessError{Code: "entitlement_daily_quota_exhausted", Message: "今日活动额度已用尽"}
			}
		}
		tokenDelta := delta
		dailyDelta := delta
		if tokenGrant.UsedQuota+tokenDelta < 0 {
			tokenDelta = -tokenGrant.UsedQuota
		}
		if daily.UsedQuota+dailyDelta < 0 {
			dailyDelta = -daily.UsedQuota
		}
		now := common.GetTimestamp()
		if err := tx.Model(tokenGrant).Updates(map[string]interface{}{
			"used_quota":   gorm.Expr("used_quota + ?", tokenDelta),
			"updated_time": now,
		}).Error; err != nil {
			return err
		}
		return tx.Model(daily).Updates(map[string]interface{}{
			"used_quota":   gorm.Expr("used_quota + ?", dailyDelta),
			"updated_time": now,
		}).Error
	})
}

func GetEntitlementDailyUsage(grantId int, usageDate string) (*EntitlementDailyUsage, error) {
	var usage EntitlementDailyUsage
	err := DB.Where("token_entitlement_id = ? AND usage_date = ?", grantId, usageDate).First(&usage).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &EntitlementDailyUsage{TokenEntitlementId: grantId, UsageDate: usageDate}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("查询权益用量失败: %w", err)
	}
	return &usage, nil
}
