package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type affiliateWithdrawalRequest struct {
	AmountMicros  int64  `json:"amount_micros" binding:"required"`
	PayoutMethod  string `json:"payout_method" binding:"required"`
	PayoutAccount string `json:"payout_account" binding:"required"`
	RequestKey    string `json:"request_key"`
}

type affiliateWithdrawalActionRequest struct {
	Note             string `json:"note"`
	PaymentReference string `json:"payment_reference"`
}

type affiliateWithdrawalResponse struct {
	ID               int    `json:"id"`
	UserID           int    `json:"user_id"`
	Username         string `json:"username,omitempty"`
	Currency         string `json:"currency"`
	AmountMicros     int64  `json:"amount_micros"`
	Status           string `json:"status"`
	PayoutMethod     string `json:"payout_method"`
	PayoutAccount    string `json:"payout_account"`
	RequestedAt      int64  `json:"requested_at"`
	ReviewedAt       int64  `json:"reviewed_at"`
	ReviewedBy       int    `json:"reviewed_by"`
	ReviewNote       string `json:"review_note"`
	PaidAt           int64  `json:"paid_at"`
	PaymentReference string `json:"payment_reference"`
}

func GetAffiliateSummary(c *gin.Context) {
	summary, err := model.GetAffiliateSummary(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func GetAffiliateReferrals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetUserReferralRelations(c.GetInt("id"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetAffiliateCommissions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetUserAffiliateCommissions(c.GetInt("id"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func affiliateWithdrawalResponses(items []model.WithdrawalRequest, admin bool) ([]affiliateWithdrawalResponse, error) {
	usernames := map[int]string{}
	if admin && len(items) > 0 {
		userIDs := make([]int, 0, len(items))
		for _, item := range items {
			userIDs = append(userIDs, item.UserID)
		}
		var users []model.User
		if err := model.DB.Select("id", "username").Where("id IN ?", userIDs).Find(&users).Error; err != nil {
			return nil, err
		}
		for _, user := range users {
			usernames[user.Id] = user.Username
		}
	}
	responses := make([]affiliateWithdrawalResponse, 0, len(items))
	for _, item := range items {
		account, err := service.DecryptAffiliatePayoutDetails(item.PayoutDetailsEncrypted)
		if err != nil {
			return nil, err
		}
		if !admin {
			account = service.MaskAffiliatePayoutDetails(account)
		}
		responses = append(responses, affiliateWithdrawalResponse{
			ID:               item.ID,
			UserID:           item.UserID,
			Username:         usernames[item.UserID],
			Currency:         item.Currency,
			AmountMicros:     item.AmountMicros,
			Status:           item.Status,
			PayoutMethod:     item.PayoutMethod,
			PayoutAccount:    account,
			RequestedAt:      item.RequestedAt,
			ReviewedAt:       item.ReviewedAt,
			ReviewedBy:       item.ReviewedBy,
			ReviewNote:       item.ReviewNote,
			PaidAt:           item.PaidAt,
			PaymentReference: item.PaymentReference,
		})
	}
	return responses, nil
}

func GetAffiliateWithdrawals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetAffiliateWithdrawals(c.GetInt("id"), c.Query("status"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses, err := affiliateWithdrawalResponses(items, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(responses)
	common.ApiSuccess(c, pageInfo)
}

func CreateAffiliateWithdrawal(c *gin.Context) {
	var request affiliateWithdrawalRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	requestKey := strings.TrimSpace(request.RequestKey)
	if requestKey == "" {
		requestKey = common.GetUUID()
	}
	encrypted, err := service.EncryptAffiliatePayoutDetails(request.PayoutAccount)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	withdrawal, err := model.CreateAffiliateWithdrawal(c.GetInt("id"), request.AmountMicros, request.PayoutMethod, encrypted, requestKey)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses, err := affiliateWithdrawalResponses([]model.WithdrawalRequest{*withdrawal}, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, responses[0])
}

func CancelAffiliateWithdrawal(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	withdrawal, err := model.CancelAffiliateWithdrawal(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, withdrawal)
}

func GetAffiliateStatements(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetUserAffiliateStatements(c.GetInt("id"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetAffiliateStatement(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	detail, err := model.GetUserAffiliateStatementDetail(c.GetInt("id"), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, detail)
}

func AdminGetAffiliateWithdrawals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetAffiliateWithdrawals(0, c.Query("status"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses, err := affiliateWithdrawalResponses(items, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(responses)
	common.ApiSuccess(c, pageInfo)
}

func AdminApproveAffiliateWithdrawal(c *gin.Context) {
	adminTransitionAffiliateWithdrawal(c, model.WithdrawalStatusApproved)
}

func AdminRejectAffiliateWithdrawal(c *gin.Context) {
	adminTransitionAffiliateWithdrawal(c, model.WithdrawalStatusRejected)
}

func AdminMarkAffiliateWithdrawalPaid(c *gin.Context) {
	adminTransitionAffiliateWithdrawal(c, model.WithdrawalStatusPaid)
}

func adminTransitionAffiliateWithdrawal(c *gin.Context, targetStatus string) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var request affiliateWithdrawalActionRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&request); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	var withdrawal *model.WithdrawalRequest
	switch targetStatus {
	case model.WithdrawalStatusApproved:
		withdrawal, err = model.ApproveAffiliateWithdrawal(id, c.GetInt("id"), request.Note)
	case model.WithdrawalStatusRejected:
		withdrawal, err = model.RejectAffiliateWithdrawal(id, c.GetInt("id"), request.Note)
	case model.WithdrawalStatusPaid:
		withdrawal, err = model.MarkAffiliateWithdrawalPaid(id, c.GetInt("id"), request.PaymentReference)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "affiliate.withdrawal."+targetStatus, map[string]interface{}{
		"withdrawal_id": id,
		"user_id":       withdrawal.UserID,
		"amount_micros": withdrawal.AmountMicros,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": withdrawal})
}
