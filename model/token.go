package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrUserTokenLimitReached = errors.New("user token limit reached")
var ErrTokenBatchInvalid = errors.New("token batch contains missing or unauthorized token")
var ErrTokenBatchCacheInvalidation = errors.New("token cache invalidation failed")

type Token struct {
	Id                 int            `json:"id"`
	UserId             int            `json:"user_id" gorm:"index"`
	Key                string         `json:"key" gorm:"type:varchar(128);uniqueIndex"`
	Status             int            `json:"status" gorm:"default:1"`
	Name               string         `json:"name" gorm:"index" `
	CreatedTime        int64          `json:"created_time" gorm:"bigint"`
	AccessedTime       int64          `json:"accessed_time" gorm:"bigint"`
	ExpiredTime        int64          `json:"expired_time" gorm:"bigint;default:-1"` // -1 means never expired
	RemainQuota        int            `json:"remain_quota" gorm:"default:0"`
	UnlimitedQuota     bool           `json:"unlimited_quota"`
	ModelLimitsEnabled bool           `json:"model_limits_enabled"`
	ModelLimits        string         `json:"model_limits" gorm:"type:text"`
	AllowIps           *string        `json:"allow_ips" gorm:"default:''"`
	UsedQuota          int            `json:"used_quota" gorm:"default:0"` // used quota
	Group              string         `json:"group" gorm:"default:''"`
	CrossGroupRetry    bool           `json:"cross_group_retry"` // 跨分组重试，仅auto分组有效
	Source             string         `json:"source" gorm:"index;default:''"`
	DeviceIdHash       string         `json:"device_id_hash" gorm:"index;default:''"`
	ClientName         string         `json:"client_name" gorm:"default:''"`
	ClientVersion      string         `json:"client_version" gorm:"default:''"`
	LastUsedClientAt   int64          `json:"last_used_client_at" gorm:"bigint;default:0"`
	DeletedAt          gorm.DeletedAt `gorm:"index"`
}

func (token *Token) Clean() {
	token.Key = ""
}

func MaskTokenKey(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 4 {
		return strings.Repeat("*", len(key))
	}
	if len(key) <= 8 {
		return key[:2] + "****" + key[len(key)-2:]
	}
	return key[:4] + "**********" + key[len(key)-4:]
}

func (token *Token) GetFullKey() string {
	return token.Key
}

func (token *Token) GetMaskedKey() string {
	return MaskTokenKey(token.Key)
}

func (token *Token) GetIpLimits() []string {
	// delete empty spaces
	//split with \n
	ipLimits := make([]string, 0)
	if token.AllowIps == nil {
		return ipLimits
	}
	cleanIps := strings.ReplaceAll(*token.AllowIps, " ", "")
	if cleanIps == "" {
		return ipLimits
	}
	ips := strings.Split(cleanIps, "\n")
	for _, ip := range ips {
		ip = strings.TrimSpace(ip)
		ip = strings.ReplaceAll(ip, ",", "")
		if ip != "" {
			ipLimits = append(ipLimits, ip)
		}
	}
	return ipLimits
}

func GetAllUserTokens(userId int, startIdx int, num int) ([]*Token, error) {
	var tokens []*Token
	var err error
	err = DB.Where("user_id = ?", userId).Order("id desc").Limit(num).Offset(startIdx).Find(&tokens).Error
	return tokens, err
}

// sanitizeLikePattern 校验并清洗用户输入的 LIKE 搜索模式。
// 规则：
//  1. 转义 ! 和 _（使用 ! 作为 ESCAPE 字符，兼容 MySQL/PostgreSQL/SQLite）
//  2. 连续的 % 合并为单个 %
//  3. 最多允许 2 个 %
//  4. 含 % 时（模糊搜索），去掉 % 后关键词长度必须 >= 2
//  5. 不含 % 时按精确匹配
func sanitizeLikePattern(input string) (string, error) {
	// 1. 先转义 ESCAPE 字符 ! 自身，再转义 _
	//    使用 ! 而非 \ 作为 ESCAPE 字符，避免 MySQL 中反斜杠的字符串转义问题
	input = strings.ReplaceAll(input, "!", "!!")
	input = strings.ReplaceAll(input, `_`, `!_`)

	// 2. 连续的 % 直接拒绝
	if strings.Contains(input, "%%") {
		return "", errors.New("搜索模式中不允许包含连续的 % 通配符")
	}

	// 3. 统计 % 数量，不得超过 2
	count := strings.Count(input, "%")
	if count > 2 {
		return "", errors.New("搜索模式中最多允许包含 2 个 % 通配符")
	}

	// 4. 含 % 时，去掉 % 后关键词长度必须 >= 2
	if count > 0 {
		stripped := strings.ReplaceAll(input, "%", "")
		if len(stripped) < 2 {
			return "", errors.New("使用模糊搜索时，关键词长度至少为 2 个字符")
		}
		return input, nil
	}

	// 5. 无 % 时，精确全匹配
	return input, nil
}

const searchHardLimit = 100

func SearchUserTokens(userId int, keyword string, token string, status int, offset int, limit int) (tokens []*Token, total int64, err error) {
	// model 层强制截断
	if limit <= 0 || limit > searchHardLimit {
		limit = searchHardLimit
	}
	if offset < 0 {
		offset = 0
	}

	if token != "" {
		token = strings.TrimPrefix(token, "sk-")
	}

	// 超量用户（令牌数超过上限）只允许精确搜索，禁止模糊搜索
	maxTokens := operation_setting.GetMaxUserTokens()
	hasFuzzy := strings.Contains(keyword, "%") || strings.Contains(token, "%")
	if hasFuzzy {
		count, err := CountUserTokens(userId)
		if err != nil {
			common.SysLog("failed to count user tokens: " + err.Error())
			return nil, 0, errors.New("获取令牌数量失败")
		}
		if int(count) > maxTokens {
			return nil, 0, errors.New("令牌数量超过上限，仅允许精确搜索，请勿使用 % 通配符")
		}
	}

	baseQuery := DB.Model(&Token{}).Where("user_id = ?", userId)

	// 非空才加 LIKE 条件，空则跳过（不过滤该字段）
	if keyword != "" {
		keywordPattern, err := sanitizeLikePattern(keyword)
		if err != nil {
			return nil, 0, err
		}
		baseQuery = baseQuery.Where("name LIKE ? ESCAPE '!'", keywordPattern)
	}
	if token != "" {
		tokenPattern, err := sanitizeLikePattern(token)
		if err != nil {
			return nil, 0, err
		}
		baseQuery = baseQuery.Where(commonKeyCol+" LIKE ? ESCAPE '!'", tokenPattern)
	}
	if status != 0 {
		condition, args := effectiveTokenStatusCondition(status, common.GetTimestamp())
		baseQuery = baseQuery.Where(condition, args...)
	}

	// 先查匹配总数（用于分页，受 maxTokens 上限保护，避免全表 COUNT）
	err = baseQuery.Limit(maxTokens).Count(&total).Error
	if err != nil {
		common.SysError("failed to count search tokens: " + err.Error())
		return nil, 0, errors.New("搜索令牌失败")
	}

	// 再分页查数据
	err = baseQuery.Order("id desc").Offset(offset).Limit(limit).Find(&tokens).Error
	if err != nil {
		common.SysError("failed to search tokens: " + err.Error())
		return nil, 0, errors.New("搜索令牌失败")
	}
	return tokens, total, nil
}

func ValidateUserToken(key string) (token *Token, err error) {
	if key == "" {
		return nil, ErrTokenNotProvided
	}
	token, err = GetTokenByKey(key, false)
	if err == nil {
		if token.Status == common.TokenStatusExhausted && !token.UnlimitedQuota {
			return token, ErrTokenExhausted
		}
		if token.Status == common.TokenStatusExpired {
			return token, ErrTokenExpired
		}
		if token.Status != common.TokenStatusEnabled && !(token.Status == common.TokenStatusExhausted && token.UnlimitedQuota) {
			return token, ErrTokenUnavailable
		}
		if token.ExpiredTime != -1 && token.ExpiredTime < common.GetTimestamp() {
			if !common.RedisEnabled {
				token.Status = common.TokenStatusExpired
				err := token.SelectUpdate()
				if err != nil {
					common.SysLog("failed to update token status" + err.Error())
				}
			}
			return token, ErrTokenExpired
		}
		if !token.UnlimitedQuota && token.RemainQuota <= 0 {
			if !common.RedisEnabled {
				token.Status = common.TokenStatusExhausted
				err := token.SelectUpdate()
				if err != nil {
					common.SysLog("failed to update token status" + err.Error())
				}
			}
			return token, ErrTokenExhausted
		}
		return token, nil
	}
	common.SysLog("ValidateUserToken: failed to get token: " + err.Error())
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrTokenInvalid
	}
	return nil, fmt.Errorf("%w: %v", ErrDatabase, err)
}

func GetTokenByIds(id int, userId int) (*Token, error) {
	if id == 0 || userId == 0 {
		return nil, errors.New("id 或 userId 为空！")
	}
	token := Token{Id: id, UserId: userId}
	var err error = nil
	err = DB.First(&token, "id = ? and user_id = ?", id, userId).Error
	return &token, err
}

func GetTokenById(id int) (*Token, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	token := Token{Id: id}
	fillFence := ""
	if common.RedisEnabled {
		var fenceErr error
		fillFence, fenceErr = captureTokenCacheFillFence()
		if fenceErr != nil {
			common.SysLog("failed to capture token cache fill fence: " + fenceErr.Error())
		}
	}
	var err error = nil
	err = DB.First(&token, "id = ?", id).Error
	if shouldUpdateRedis(true, err) && fillFence != "" {
		gopool.Go(func() {
			if err := cacheSetToken(token, fillFence); err != nil {
				common.SysLog("failed to update user status cache: " + err.Error())
			}
		})
	}
	return &token, err
}

func GetTokenByKey(key string, fromDB bool) (token *Token, err error) {
	fillFence := ""
	defer func() {
		// Update Redis cache asynchronously on successful DB read
		if shouldUpdateRedis(fromDB, err) && token != nil && fillFence != "" {
			gopool.Go(func() {
				if err := cacheSetToken(*token, fillFence); err != nil {
					common.SysLog("failed to update user status cache: " + err.Error())
				}
			})
		}
	}()
	if !fromDB && common.RedisEnabled {
		// Try Redis first
		token, err := cacheGetTokenByKey(key)
		if err == nil {
			return token, nil
		}
		// Don't return error - fall through to DB
	}
	if common.RedisEnabled {
		fillFence, err = captureTokenCacheFillFence()
		if err != nil {
			common.SysLog("failed to capture token cache fill fence: " + err.Error())
			fillFence = ""
		}
	}
	fromDB = true
	err = DB.Where(commonKeyCol+" = ?", key).First(&token).Error
	return token, err
}

func (token *Token) Insert() error {
	var err error
	err = DB.Create(token).Error
	return err
}

func CreateUserToken(userId int, token *Token, maxTokens int) error {
	if userId == 0 {
		return errors.New("userId 为空！")
	}
	if token == nil {
		return errors.New("token 为空！")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		return createUserTokenInTx(tx, userId, token, maxTokens)
	})
}

func CreateUserTokenWithInviteReward(userId int, token *Token, maxTokens int, triggerType string) error {
	if userId == 0 {
		return errors.New("userId 为空！")
	}
	if token == nil {
		return errors.New("token 为空！")
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := createUserTokenInTx(tx, userId, token, maxTokens); err != nil {
			return err
		}
		return validateTokenCreateInviteRewardTrigger(triggerType)
	})
	return err
}

const TokenSourceCLI = "cli"

func createUserTokenInTx(tx *gorm.DB, userId int, token *Token, maxTokens int) error {
	var user User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("id").
		Where("id = ?", userId).
		First(&user).Error; err != nil {
		return err
	}

	var total int64
	if err := tx.Model(&Token{}).Where("user_id = ?", userId).Count(&total).Error; err != nil {
		return err
	}
	if int(total) >= maxTokens {
		return ErrUserTokenLimitReached
	}

	token.UserId = userId
	return tx.Create(token).Error
}

func EnsureInitialUserToken(userId int, token Token, maxTokens int) (*Token, bool, error) {
	if userId == 0 {
		return nil, false, errors.New("userId 为空！")
	}

	var created bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		created, err = ensureInitialUserTokenInTx(tx, userId, &token, maxTokens)
		return err
	})
	if err != nil {
		return nil, false, err
	}
	if !created {
		return nil, false, nil
	}
	return &token, true, nil
}

func EnsureInitialUserTokenWithInviteReward(userId int, token Token, maxTokens int, triggerType string) (*Token, bool, error) {
	if userId == 0 {
		return nil, false, errors.New("userId 为空！")
	}

	var created bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		created, err = ensureInitialUserTokenInTx(tx, userId, &token, maxTokens)
		if err != nil || !created {
			return err
		}
		return validateTokenCreateInviteRewardTrigger(triggerType)
	})
	if err != nil {
		return nil, false, err
	}
	if !created {
		return nil, false, nil
	}
	return &token, true, nil
}

func ensureInitialUserTokenInTx(tx *gorm.DB, userId int, token *Token, maxTokens int) (bool, error) {
	var user User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("id").
		Where("id = ?", userId).
		First(&user).Error; err != nil {
		return false, err
	}

	var total int64
	if err := tx.Model(&Token{}).Where("user_id = ?", userId).Count(&total).Error; err != nil {
		return false, err
	}
	if total > 0 {
		return false, nil
	}
	if int(total) >= maxTokens {
		return false, ErrUserTokenLimitReached
	}

	token.UserId = userId
	if err := tx.Create(token).Error; err != nil {
		return false, err
	}
	return true, nil
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (token *Token) Update() (err error) {
	fillFence := ""
	if common.RedisEnabled {
		fillFence, err = captureTokenCacheFillFence()
		if err != nil {
			common.SysLog("failed to capture token cache fill fence: " + err.Error())
			fillFence = ""
		}
	}
	err = DB.Model(token).Select("name", "status", "expired_time", "remain_quota", "unlimited_quota",
		"model_limits_enabled", "model_limits", "allow_ips", "group", "cross_group_retry").Updates(token).Error
	if shouldUpdateRedis(true, err) && fillFence != "" {
		if _, cacheErr := cachePatchTokenAfterUpdate(*token, fillFence); cacheErr != nil {
			common.SysLog("failed to update token cache: " + cacheErr.Error())
		}
	}
	return err
}

// UpdateNonModelFields atomically updates form fields unrelated to model access.
// When forcePLGGroup is true, it also enforces the PLG group invariant without
// replaying the allowlist from a potentially stale client snapshot.
func (token *Token) UpdateNonModelFields(forcePLGGroup bool) (err error) {
	defer func() {
		if shouldUpdateRedis(true, err) {
			gopool.Go(func() {
				if err := cacheDeleteToken(token.Key); err != nil {
					common.SysLog("failed to invalidate token cache: " + err.Error())
				}
			})
		}
	}()
	columns := []string{"name", "expired_time", "remain_quota", "unlimited_quota", "allow_ips"}
	if forcePLGGroup {
		columns = append(columns, "group", "cross_group_retry")
	}
	err = DB.Model(token).Select(columns).Updates(token).Error
	return err
}

func (token *Token) SelectUpdate() (err error) {
	fillFence := ""
	if common.RedisEnabled {
		fillFence, err = captureTokenCacheFillFence()
		if err != nil {
			common.SysLog("failed to capture token cache fill fence: " + err.Error())
			fillFence = ""
		}
	}
	// This can update zero values
	err = DB.Model(token).Select("accessed_time", "status").Updates(token).Error
	if shouldUpdateRedis(true, err) && fillFence != "" {
		if _, cacheErr := cachePatchTokenAfterSelectUpdate(*token, fillFence); cacheErr != nil {
			common.SysLog("failed to update token cache: " + cacheErr.Error())
		}
	}
	return err
}

func (token *Token) Delete() (err error) {
	defer func() {
		if shouldUpdateRedis(true, err) {
			gopool.Go(func() {
				err := cacheDeleteToken(token.Key)
				if err != nil {
					common.SysLog("failed to delete token cache: " + err.Error())
				}
			})
		}
	}()
	err = DB.Delete(token).Error
	return err
}

func (token *Token) IsModelLimitsEnabled() bool {
	return token.ModelLimitsEnabled
}

func (token *Token) GetModelLimits() []string {
	if token.ModelLimits == "" {
		return []string{}
	}
	return strings.Split(token.ModelLimits, ",")
}

func (token *Token) GetModelLimitsMap() map[string]bool {
	limits := token.GetModelLimits()
	limitsMap := make(map[string]bool)
	for _, limit := range limits {
		limitsMap[limit] = true
	}
	return limitsMap
}

func DisableModelLimits(tokenId int) error {
	token, err := GetTokenById(tokenId)
	if err != nil {
		return err
	}
	token.ModelLimitsEnabled = false
	token.ModelLimits = ""
	return token.Update()
}

func DeleteTokenById(id int, userId int) (err error) {
	// Why we need userId here? In case user want to delete other's token.
	if id == 0 || userId == 0 {
		return errors.New("id 或 userId 为空！")
	}
	token := Token{Id: id, UserId: userId}
	err = DB.Where(token).First(&token).Error
	if err != nil {
		return err
	}
	return token.Delete()
}

func IncreaseTokenQuota(tokenId int, key string, quota int) (err error) {
	if quota < 0 {
		return errors.New("quota 不能为负数！")
	}
	if common.RedisEnabled {
		gopool.Go(func() {
			err := cacheIncrTokenQuota(key, int64(quota))
			if err != nil {
				common.SysLog("failed to increase token quota: " + err.Error())
			}
		})
	}
	if common.BatchUpdateEnabled {
		addNewRecord(BatchUpdateTypeTokenQuota, tokenId, quota)
		return nil
	}
	return increaseTokenQuota(tokenId, quota)
}

func increaseTokenQuota(id int, quota int) (err error) {
	err = DB.Model(&Token{}).Where("id = ?", id).Updates(
		map[string]interface{}{
			"remain_quota":  gorm.Expr("remain_quota + ?", quota),
			"used_quota":    gorm.Expr("used_quota - ?", quota),
			"accessed_time": common.GetTimestamp(),
		},
	).Error
	return err
}

func DecreaseTokenQuota(id int, key string, quota int) (err error) {
	if quota < 0 {
		return errors.New("quota 不能为负数！")
	}
	if common.RedisEnabled {
		gopool.Go(func() {
			err := cacheDecrTokenQuota(key, int64(quota))
			if err != nil {
				common.SysLog("failed to decrease token quota: " + err.Error())
			}
		})
	}
	if common.BatchUpdateEnabled {
		addNewRecord(BatchUpdateTypeTokenQuota, id, -quota)
		return nil
	}
	return decreaseTokenQuota(id, quota)
}

func decreaseTokenQuota(id int, quota int) (err error) {
	err = DB.Model(&Token{}).Where("id = ?", id).Updates(
		map[string]interface{}{
			"remain_quota":  gorm.Expr("remain_quota - ?", quota),
			"used_quota":    gorm.Expr("used_quota + ?", quota),
			"accessed_time": common.GetTimestamp(),
		},
	).Error
	return err
}

// CountUserTokens returns total number of tokens for the given user, used for pagination
func CountUserTokens(userId int) (int64, error) {
	var total int64
	err := DB.Model(&Token{}).Where("user_id = ?", userId).Count(&total).Error
	return total, err
}

type BatchUpdateTokensParams struct {
	Ids         []int
	UserId      int
	Group       *string
	RemainQuota *int
}

func BatchUpdateTokens(params BatchUpdateTokensParams) (int, error) {
	if len(params.Ids) == 0 || len(params.Ids) > 100 || params.UserId <= 0 {
		return 0, ErrTokenBatchInvalid
	}
	if params.Group == nil && params.RemainQuota == nil {
		return 0, ErrTokenBatchInvalid
	}
	if params.Group != nil && *params.Group == "" {
		return 0, ErrTokenBatchInvalid
	}
	seen := make(map[int]struct{}, len(params.Ids))
	for _, id := range params.Ids {
		if id <= 0 {
			return 0, ErrTokenBatchInvalid
		}
		if _, exists := seen[id]; exists {
			return 0, ErrTokenBatchInvalid
		}
		seen[id] = struct{}{}
	}
	if params.RemainQuota != nil {
		maxQuotaValue := int(1000000000 * common.QuotaPerUnit)
		if *params.RemainQuota < 0 || *params.RemainQuota > maxQuotaValue {
			return 0, ErrTokenBatchInvalid
		}
	}

	var tokenKeys []string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var tokens []Token
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("id", "key").
			Where("user_id = ? AND id IN ?", params.UserId, params.Ids).
			Find(&tokens).Error; err != nil {
			return err
		}
		if len(tokens) != len(params.Ids) {
			return ErrTokenBatchInvalid
		}

		tokenKeys = make([]string, 0, len(tokens))
		for _, token := range tokens {
			tokenKeys = append(tokenKeys, token.Key)
		}
		updates := make(map[string]interface{}, 2)
		if params.Group != nil {
			updates["group"] = *params.Group
			if *params.Group == plgUserGroup {
				updates["cross_group_retry"] = false
			}
		}
		if len(updates) > 0 {
			result := tx.Model(&Token{}).
				Where("user_id = ? AND id IN ?", params.UserId, params.Ids).
				Updates(updates)
			if result.Error != nil {
				return result.Error
			}
		}
		if params.RemainQuota != nil {
			result := tx.Model(&Token{}).
				Where("user_id = ? AND id IN ? AND unlimited_quota = ?", params.UserId, params.Ids, false).
				Update("remain_quota", *params.RemainQuota)
			if result.Error != nil {
				return result.Error
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}

	if common.RedisEnabled {
		var err error
		if params.RemainQuota != nil {
			err = cacheDeleteTokens(tokenKeys)
		} else {
			err = cachePatchTokenGroups(tokenKeys, *params.Group)
		}
		if err != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate %d token caches after batch token update", len(tokenKeys)))
			return len(params.Ids), ErrTokenBatchCacheInvalidation
		}
	}
	return len(params.Ids), nil
}

func BatchUpdateTokenGroup(ids []int, userId int, group string) (int, error) {
	return BatchUpdateTokens(BatchUpdateTokensParams{
		Ids:    ids,
		UserId: userId,
		Group:  &group,
	})
}

// UserTokenStats contains account-wide API token counts grouped by status.
type UserTokenStats struct {
	Total     int64 `json:"total"`
	Enabled   int64 `json:"enabled"`
	Disabled  int64 `json:"disabled"`
	Expired   int64 `json:"expired"`
	Exhausted int64 `json:"exhausted"`
}

// GetEffectiveTokenStatus returns the status enforced by ValidateUserToken without
// persisting lifecycle transitions. Explicitly disabled tokens stay disabled;
// expiration takes precedence over quota exhaustion for otherwise usable tokens.
func GetEffectiveTokenStatus(token *Token, now int64) int {
	if token == nil {
		return common.TokenStatusDisabled
	}
	if token.Status == common.TokenStatusExhausted && !token.UnlimitedQuota {
		return common.TokenStatusExhausted
	}
	if token.Status == common.TokenStatusExpired {
		return common.TokenStatusExpired
	}
	if token.Status != common.TokenStatusEnabled &&
		!(token.Status == common.TokenStatusExhausted && token.UnlimitedQuota) {
		return common.TokenStatusDisabled
	}
	if token.ExpiredTime != -1 && token.ExpiredTime < now {
		return common.TokenStatusExpired
	}
	if !token.UnlimitedQuota && token.RemainQuota <= 0 {
		return common.TokenStatusExhausted
	}
	return common.TokenStatusEnabled
}

func effectiveTokenStatusCondition(status int, now int64) (string, []any) {
	switch status {
	case common.TokenStatusEnabled:
		return `((status = ? OR (status = ? AND unlimited_quota = ?))
			AND (expired_time = -1 OR expired_time >= ?)
			AND (unlimited_quota = ? OR remain_quota > 0))`, []any{
				common.TokenStatusEnabled,
				common.TokenStatusExhausted,
				true,
				now,
				true,
			}
	case common.TokenStatusDisabled:
		return `(status NOT IN (?, ?, ?))`, []any{
			common.TokenStatusEnabled,
			common.TokenStatusExpired,
			common.TokenStatusExhausted,
		}
	case common.TokenStatusExpired:
		return `(status = ?
			OR ((status = ? OR (status = ? AND unlimited_quota = ?))
				AND expired_time != -1 AND expired_time < ?))`, []any{
				common.TokenStatusExpired,
				common.TokenStatusEnabled,
				common.TokenStatusExhausted,
				true,
				now,
			}
	case common.TokenStatusExhausted:
		return `((status = ? AND unlimited_quota = ?)
			OR (status = ?
				AND (expired_time = -1 OR expired_time >= ?)
				AND unlimited_quota = ? AND remain_quota <= 0))`, []any{
				common.TokenStatusExhausted,
				false,
				common.TokenStatusEnabled,
				now,
				false,
			}
	default:
		return "1 = 0", nil
	}
}

// GetUserTokenStats returns account-wide effective status counts for one user.
func GetUserTokenStats(userId int) (UserTokenStats, error) {
	now := common.GetTimestamp()
	enabledCondition, enabledArgs := effectiveTokenStatusCondition(common.TokenStatusEnabled, now)
	expiredCondition, expiredArgs := effectiveTokenStatusCondition(common.TokenStatusExpired, now)
	exhaustedCondition, exhaustedArgs := effectiveTokenStatusCondition(common.TokenStatusExhausted, now)
	queryArgs := make([]any, 0, len(enabledArgs)+len(expiredArgs)+len(exhaustedArgs))
	queryArgs = append(queryArgs, enabledArgs...)
	queryArgs = append(queryArgs, expiredArgs...)
	queryArgs = append(queryArgs, exhaustedArgs...)

	var stats UserTokenStats
	err := DB.Model(&Token{}).
		Select(fmt.Sprintf(`
			COUNT(*) AS total,
			COALESCE(SUM(CASE WHEN %s THEN 1 ELSE 0 END), 0) AS enabled,
			COALESCE(SUM(CASE WHEN %s THEN 1 ELSE 0 END), 0) AS expired,
			COALESCE(SUM(CASE WHEN %s THEN 1 ELSE 0 END), 0) AS exhausted`,
			enabledCondition,
			expiredCondition,
			exhaustedCondition,
		), queryArgs...).
		Where("user_id = ?", userId).
		Scan(&stats).Error
	if err != nil {
		return UserTokenStats{}, err
	}

	stats.Disabled = stats.Total - stats.Enabled - stats.Expired - stats.Exhausted
	return stats, nil
}

// BatchDeleteTokens 删除指定用户的一组令牌，返回成功删除数量
func BatchDeleteTokens(ids []int, userId int) (int, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 不能为空！")
	}

	tx := DB.Begin()

	var tokens []Token
	if err := tx.Where("user_id = ? AND id IN (?)", userId, ids).Find(&tokens).Error; err != nil {
		tx.Rollback()
		return 0, err
	}

	if err := tx.Where("user_id = ? AND id IN (?)", userId, ids).Delete(&Token{}).Error; err != nil {
		tx.Rollback()
		return 0, err
	}

	if err := tx.Commit().Error; err != nil {
		return 0, err
	}

	if common.RedisEnabled {
		gopool.Go(func() {
			keys := make([]string, 0, len(tokens))
			for _, token := range tokens {
				keys = append(keys, token.Key)
			}
			if err := cacheDeleteTokens(keys); err != nil {
				common.SysLog("failed to invalidate deleted token caches: " + err.Error())
			}
		})
	}

	return len(tokens), nil
}

func GetTokenKeysByIds(ids []int, userId int) ([]Token, error) {
	var tokens []Token
	err := DB.Select("id", commonKeyCol).
		Where("user_id = ? AND id IN (?)", userId, ids).
		Find(&tokens).Error
	return tokens, err
}

// InvalidateUserTokensCache 清理指定用户所有令牌在 Redis 中的缓存，
// 配合 InvalidateUserCache 使用，可在用户被禁用/删除时立即阻断其令牌的请求。
// 下一次请求将从数据库重新加载令牌及用户状态，从而立即识别出被禁用的用户。
func InvalidateUserTokensCache(userId int) error {
	if !common.RedisEnabled {
		return nil
	}
	if userId <= 0 {
		return errors.New("userId 无效")
	}
	var tokens []Token
	if err := DB.Unscoped().
		Select("id", commonKeyCol).
		Where("user_id = ?", userId).
		Find(&tokens).Error; err != nil {
		return err
	}
	keys := make([]string, 0, len(tokens))
	for _, t := range tokens {
		if t.Key == "" {
			continue
		}
		keys = append(keys, t.Key)
	}
	return cacheDeleteTokens(keys)
}
