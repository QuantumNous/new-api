package model

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"gorm.io/gorm"
)

type CdkToolRedeemResult struct {
	RedemptionId         int     `json:"redemption_id"`
	TokenId              int     `json:"token_id"`
	TokenName            string  `json:"token_name"`
	ApiKey               string  `json:"api_key"`
	ApiKeyMasked         string  `json:"api_key_masked"`
	RedeemedQuota        int     `json:"redeemed_quota"`
	RedeemedAmount       float64 `json:"redeemed_amount"`
	TokenRemainingQuota  int     `json:"token_remaining_quota"`
	TokenRemainingAmount float64 `json:"token_remaining_amount"`
	QuotaPerUnit         float64 `json:"quota_per_unit"`
	TokenGroup           string  `json:"token_group"`
	Recovered            bool    `json:"recovered"`
	RecoveryToken        string  `json:"recovery_token,omitempty"`
}

func RedeemCdkToolCode(key string, recoveryToken ...string) (*CdkToolRedeemResult, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return nil, errors.New("请输入 CDK")
	}
	providedRecoveryToken := ""
	if len(recoveryToken) > 0 {
		providedRecoveryToken = strings.TrimSpace(recoveryToken[0])
	}

	cdkSetting := operation_setting.GetCdkToolSetting()
	if !cdkSetting.Enabled {
		return nil, errors.New("CDK 工具兑换未启用")
	}
	if cdkSetting.ServiceUserId <= 0 {
		return nil, errors.New("CDK 工具专用账户未配置")
	}

	var result *CdkToolRedeemResult
	var created bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		serviceUser := &User{}
		if err := tx.First(serviceUser, "id = ?", cdkSetting.ServiceUserId).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("CDK 工具专用账户不存在")
			}
			return err
		}
		if serviceUser.Status != common.UserStatusEnabled {
			return errors.New("CDK 工具专用账户已被禁用")
		}

		tokenGroup := strings.TrimSpace(cdkSetting.TokenGroup)
		if tokenGroup != "" && !cdkToolTokenGroupAllowed(serviceUser.Group, tokenGroup) {
			return fmt.Errorf("CDK 工具专用账户无权使用 %s 分组", tokenGroup)
		}

		redemption := &Redemption{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(commonKeyCol+" = ?", key).First(redemption).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("无效的 CDK")
			}
			return err
		}

		if redemption.Status == common.RedemptionCodeStatusUsed &&
			redemption.UsedUserId == cdkSetting.ServiceUserId &&
			redemption.RedeemedTokenId > 0 {
			if !verifyCdkToolRecoveryToken(providedRecoveryToken, redemption.CdkToolRecoveryTokenHash) {
				return errors.New("该 CDK 已被兑换，请在首次兑换的设备上恢复，或联系管理员")
			}
			token := &Token{}
			if err := tx.Where("id = ? AND user_id = ?", redemption.RedeemedTokenId, cdkSetting.ServiceUserId).First(token).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.New("CDK 已兑换，但对应 API 密钥不存在，请联系管理员")
				}
				return err
			}
			result = buildCdkToolRedeemResult(redemption, token, serviceUser.Group, true)
			result.RecoveryToken = providedRecoveryToken
			return nil
		}

		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该 CDK 已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该 CDK 已过期")
		}
		if redemption.Quota <= 0 {
			return errors.New("CDK 额度无效")
		}

		apiKey, err := common.GenerateKey()
		if err != nil {
			return err
		}
		newRecoveryToken, err := common.GenerateKey()
		if err != nil {
			return err
		}
		tokenName := fmt.Sprintf("%s-%d", operation_setting.GetCdkToolSetting().TokenNamePrefix, redemption.Id)
		token := &Token{
			UserId:             cdkSetting.ServiceUserId,
			Key:                apiKey,
			Status:             common.TokenStatusEnabled,
			Name:               tokenName,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        -1,
			RemainQuota:        redemption.Quota,
			UnlimitedQuota:     false,
			ModelLimitsEnabled: false,
			ModelLimits:        "",
			Group:              tokenGroup,
			CrossGroupRetry:    false,
		}
		if err := tx.Model(&User{}).Where("id = ?", cdkSetting.ServiceUserId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error; err != nil {
			return err
		}
		if err := tx.Create(token).Error; err != nil {
			return err
		}

		redemption.RedeemedTime = common.GetTimestamp()
		redemption.Status = common.RedemptionCodeStatusUsed
		redemption.UsedUserId = cdkSetting.ServiceUserId
		redemption.RedeemedTokenId = token.Id
		redemption.CdkToolRecoveryTokenHash = hashCdkToolRecoveryToken(newRecoveryToken)
		if err := tx.Model(redemption).Select("redeemed_time", "status", "used_user_id", "redeemed_token_id", "cdk_tool_recovery_token_hash").Updates(redemption).Error; err != nil {
			return err
		}

		result = buildCdkToolRedeemResult(redemption, token, serviceUser.Group, false)
		result.RecoveryToken = newRecoveryToken
		created = true
		return nil
	})
	if err != nil {
		return nil, err
	}
	if created && result != nil {
		RecordLog(
			operation_setting.GetCdkToolSetting().ServiceUserId,
			LogTypeTopup,
			fmt.Sprintf("CDK 工具兑换成功，兑换码ID %d，API密钥ID %d，额度：%s", result.RedemptionId, result.TokenId, logger.FormatQuota(result.RedeemedQuota)),
		)
	}
	return result, nil
}

func hashCdkToolRecoveryToken(recoveryToken string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(recoveryToken)))
	return hex.EncodeToString(sum[:])
}

func verifyCdkToolRecoveryToken(recoveryToken string, expectedHash string) bool {
	recoveryToken = strings.TrimSpace(recoveryToken)
	expectedHash = strings.TrimSpace(expectedHash)
	if recoveryToken == "" || expectedHash == "" {
		return false
	}
	actualHash := hashCdkToolRecoveryToken(recoveryToken)
	return subtle.ConstantTimeCompare([]byte(actualHash), []byte(expectedHash)) == 1
}

func buildCdkToolRedeemResult(redemption *Redemption, token *Token, userGroup string, recovered bool) *CdkToolRedeemResult {
	apiKey := normalizeCdkToolApiKey(token.Key)
	effectiveGroup := strings.TrimSpace(token.Group)
	if effectiveGroup == "" {
		effectiveGroup = strings.TrimSpace(userGroup)
	}
	return &CdkToolRedeemResult{
		RedemptionId:         redemption.Id,
		TokenId:              token.Id,
		TokenName:            token.Name,
		ApiKey:               apiKey,
		ApiKeyMasked:         MaskTokenKey(apiKey),
		RedeemedQuota:        redemption.Quota,
		RedeemedAmount:       quotaToAmount(redemption.Quota),
		TokenRemainingQuota:  token.RemainQuota,
		TokenRemainingAmount: quotaToAmount(token.RemainQuota),
		QuotaPerUnit:         common.QuotaPerUnit,
		TokenGroup:           effectiveGroup,
		Recovered:            recovered,
	}
}

func normalizeCdkToolApiKey(key string) string {
	key = strings.TrimSpace(key)
	if key == "" || strings.HasPrefix(key, "sk-") {
		return key
	}
	return "sk-" + key
}

func quotaToAmount(quota int) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	return float64(quota) / common.QuotaPerUnit
}

func cdkToolTokenGroupAllowed(userGroup string, tokenGroup string) bool {
	groupsCopy := setting.GetUserUsableGroupsCopy()
	if userGroup != "" {
		if specialSettings, ok := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get(userGroup); ok {
			for specialGroup, desc := range specialSettings {
				if strings.HasPrefix(specialGroup, "-:") {
					delete(groupsCopy, strings.TrimPrefix(specialGroup, "-:"))
				} else if strings.HasPrefix(specialGroup, "+:") {
					groupsCopy[strings.TrimPrefix(specialGroup, "+:")] = desc
				} else {
					groupsCopy[specialGroup] = desc
				}
			}
		}
		if _, ok := groupsCopy[userGroup]; !ok {
			groupsCopy[userGroup] = "用户分组"
		}
	}
	if _, ok := groupsCopy[tokenGroup]; !ok {
		return false
	}
	return tokenGroup == "auto" || ratio_setting.ContainsGroupRatio(tokenGroup)
}
