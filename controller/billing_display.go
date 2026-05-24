package controller

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func buildBillingDisplayData() gin.H {
	setting := operation_setting.GetBillingDisplaySetting()
	return gin.H{
		"public_welfare_text_enabled": setting.PublicWelfareTextEnabled,
		"invitation_panel_enabled":    setting.InvitationPanelEnabled,
	}
}
