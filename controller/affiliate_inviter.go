package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type affiliateInviterUpdateRequest struct {
	NewInviterUserId int    `json:"new_inviter_user_id"`
	Reason           string `json:"reason"`
}

func AdminSearchAffiliateInviterCandidates(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	users, total, err := service.SearchAffiliateInviterCandidates(model.DB, service.AffiliateInviterCandidateSearchInput{
		Keyword:  c.Query("keyword"),
		StartIdx: pageInfo.GetStartIdx(),
		PageSize: pageInfo.GetPageSize(),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(users)
	common.ApiSuccess(c, pageInfo)
}

func AdminPreviewAffiliateInviterChange(c *gin.Context) {
	targetUserId, ok := parseAffiliateInviterTargetUserId(c)
	if !ok {
		return
	}
	newInviterUserId, _ := strconv.Atoi(c.Query("new_inviter_user_id"))

	preview, err := service.PreviewAffiliateInviterChange(model.DB, service.AffiliateInviterChangeInput{
		TargetUserId:     targetUserId,
		NewInviterUserId: newInviterUserId,
		ActorUserId:      c.GetInt("id"),
		PreviewOnly:      true,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, preview)
}

func AdminUpdateAffiliateInviter(c *gin.Context) {
	targetUserId, ok := parseAffiliateInviterTargetUserId(c)
	if !ok {
		return
	}

	var req affiliateInviterUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	preview, err := service.UpdateAffiliateInviter(model.DB, service.AffiliateInviterChangeInput{
		TargetUserId:     targetUserId,
		NewInviterUserId: req.NewInviterUserId,
		ActorUserId:      c.GetInt("id"),
		Reason:           req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, preview)
}

func parseAffiliateInviterTargetUserId(c *gin.Context) (int, bool) {
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil || userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return 0, false
	}
	return userId, true
}
