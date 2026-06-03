package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type affiliateRegistrationAttributionInput struct {
	InviteeUserId      int
	InviteCode         string
	RegisterMethod     string
	Provider           string
	InitialQuota       int64
	InitialAmountCents int64
	InitialQuotaRule   string
}

func resolveAffiliateInviteContextForRegistration(db *gorm.DB, input affiliateRegistrationAttributionInput) (*service.AffiliateInviteContext, error) {
	return service.ResolveInviteContext(db, service.AffiliateInviteContextInput{
		ModuleEnabled:  common.AffiliateEnabled,
		InviteCode:     input.InviteCode,
		RegisterMethod: input.RegisterMethod,
		Provider:       input.Provider,
	})
}

func recordAffiliateInviteAttributionForRegistration(db *gorm.DB, ctx *service.AffiliateInviteContext, input affiliateRegistrationAttributionInput) (*model.AffiliateInviteEvent, error) {
	if ctx == nil || ctx.Source == service.AffiliateInviteSourceNone {
		return nil, nil
	}

	registerMethod := strings.TrimSpace(input.RegisterMethod)
	if registerMethod == "" {
		registerMethod = ctx.RegisterMethod
	}
	provider := strings.TrimSpace(input.Provider)
	if provider == "" {
		provider = ctx.Provider
	}

	event, err := service.RecordAffiliateInviteEvent(db, service.AffiliateInviteEventInput{
		InviteeUserId:      input.InviteeUserId,
		InviterUserId:      ctx.InviterUserId,
		InviteCode:         ctx.InviteCode,
		InviteSource:       ctx.Source,
		RegisterMethod:     registerMethod,
		Provider:           provider,
		InitialQuota:       input.InitialQuota,
		InitialAmountCents: input.InitialAmountCents,
		InitialQuotaRule:   affiliateInitialQuotaRule(ctx, input.InitialQuotaRule),
	})
	if err != nil {
		return nil, err
	}

	if ctx.Source != service.AffiliateInviteSourceAffiliate {
		return event, nil
	}
	if err := service.BuildAffiliateInviteRelations(db, service.AffiliateRelationCreateInput{
		InviterUserId: ctx.InviterUserId,
		InviteeUserId: input.InviteeUserId,
		InviteEventId: event.Id,
		Source:        ctx.Source,
	}); err != nil {
		return nil, err
	}
	return event, nil
}

func affiliateInitialQuotaRule(ctx *service.AffiliateInviteContext, explicitRule string) string {
	rule := strings.TrimSpace(explicitRule)
	if rule != "" {
		return rule
	}
	if ctx == nil {
		return ""
	}
	switch ctx.Source {
	case service.AffiliateInviteSourceAffiliate:
		if level := affiliateInviterLevelForContext(ctx); level == 1 || level == 2 {
			return "affiliate_invite_level_" + strconv.Itoa(level)
		}
		return "affiliate_invite"
	case service.AffiliateInviteSourceNormal:
		return "normal_invite"
	default:
		return ""
	}
}

func affiliateInviteInitialQuotaForContext(ctx *service.AffiliateInviteContext) int64 {
	quota := affiliateInviteeQuotaForContext(ctx)
	if quota <= 0 || !operation_setting.IsPaymentComplianceConfirmed() {
		return 0
	}
	return int64(quota)
}

func affiliateInviteeQuotaForContext(ctx *service.AffiliateInviteContext) int {
	if ctx == nil || ctx.Source == service.AffiliateInviteSourceNone {
		return 0
	}
	if ctx.Source == service.AffiliateInviteSourceAffiliate {
		switch affiliateInviterLevelForContext(ctx) {
		case 1:
			if common.AffiliateLevelOneQuotaForInvitee >= 0 {
				return common.AffiliateLevelOneQuotaForInvitee
			}
		case 2:
			if common.AffiliateLevelTwoQuotaForInvitee >= 0 {
				return common.AffiliateLevelTwoQuotaForInvitee
			}
		}
		if common.AffiliateQuotaForInvitee >= 0 {
			return common.AffiliateQuotaForInvitee
		}
	}
	return common.QuotaForInvitee
}

func affiliateInviterQuotaForContext(ctx *service.AffiliateInviteContext) int {
	if ctx == nil || ctx.Source == service.AffiliateInviteSourceNone {
		return 0
	}
	if ctx.Source == service.AffiliateInviteSourceAffiliate {
		switch affiliateInviterLevelForContext(ctx) {
		case 1:
			if common.AffiliateLevelOneQuotaForInviter >= 0 {
				return common.AffiliateLevelOneQuotaForInviter
			}
		case 2:
			if common.AffiliateLevelTwoQuotaForInviter >= 0 {
				return common.AffiliateLevelTwoQuotaForInviter
			}
		}
	}
	return common.QuotaForInviter
}

func affiliateInviterLevelForContext(ctx *service.AffiliateInviteContext) int {
	if ctx == nil || ctx.Source != service.AffiliateInviteSourceAffiliate || ctx.InviterUserId <= 0 || model.DB == nil {
		return 0
	}
	var profile model.AffiliateProfile
	err := model.DB.
		Select("level").
		Where("user_id = ? AND status = ?", ctx.InviterUserId, model.AffiliateProfileStatusActive).
		First(&profile).Error
	if err != nil {
		return 0
	}
	if profile.Level == 1 || profile.Level == 2 {
		return profile.Level
	}
	return 0
}

func affiliateInviteCodeFromSessionValue(value any) string {
	code, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(code)
}

func affiliateInviteCodeFromRequest(c *gin.Context) string {
	code := strings.TrimSpace(c.Query("aff"))
	if code != "" {
		return code
	}
	return affiliateInviteCodeFromSessionValue(sessions.Default(c).Get("aff"))
}

func affiliateOAuthProviderKey(providerPrefix string) string {
	key := strings.TrimSuffix(strings.TrimSpace(providerPrefix), "_")
	if key == "" {
		return strings.TrimSpace(providerPrefix)
	}
	return key
}
