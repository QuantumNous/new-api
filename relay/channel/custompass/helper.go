package custompass

import (
	"one-api/common"
	"one-api/model"
	"one-api/service"
	"one-api/setting/ratio_setting"
	"fmt"
)

// GetEffectiveUserRatio calculates the effective user ratio for billing
// This considers both personal user ratio (future feature) and group special ratio
func GetEffectiveUserRatio(billingService service.CustomPassBillingService, user *model.User) float64 {
	// Check for group special ratio first (current implementation)
	if specialRatio, hasSpecial := ratio_setting.GetGroupGroupRatio(user.Group, user.Group); hasSpecial {
		common.SysLog(fmt.Sprintf("[CustomPass-Helper] Using group special ratio for user %d (group: %s): %.6f", 
			user.Id, user.Group, specialRatio))
		return specialRatio
	}
	
	// Fall back to personal user ratio (returns 1.0 currently as it's not implemented)
	userRatio := billingService.CalculateUserRatio(user.Id)
	if userRatio != 1.0 {
		common.SysLog(fmt.Sprintf("[CustomPass-Helper] Using personal user ratio for user %d: %.6f", 
			user.Id, userRatio))
	}
	return userRatio
}

// GetEffectiveUserRatioByID calculates the effective user ratio by user ID
func GetEffectiveUserRatioByID(billingService service.CustomPassBillingService, userID int) float64 {
	// Get user information
	user, err := model.GetUserById(userID, false)
	if err != nil {
		common.SysLog(fmt.Sprintf("[CustomPass-Helper] Failed to get user %d, using default ratio 1.0: %v", userID, err))
		return 1.0
	}
	
	return GetEffectiveUserRatio(billingService, user)
}