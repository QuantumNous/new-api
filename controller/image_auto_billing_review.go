package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetImageAutoBillingReviewJournals(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	journals, err := model.ListImageAutoBillingReviewJournals(limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    journals,
	})
}

type resolveImageAutoBillingReviewRequest struct {
	RequestId   string `json:"request_id"`
	ActualQuota *int64 `json:"actual_quota"`
}

// ResolveImageAutoBillingReview is the operational exit for journals parked in
// settlement_manual_review: an admin verifies the upstream bill and supplies
// the trusted actual quota (0 releases the full reservation back). The money
// math must go through the existing Settle→Reconcile state machine — editing
// the journal row directly would desync user/token quota from the ledger.
func ResolveImageAutoBillingReview(c *gin.Context) {
	var req resolveImageAutoBillingReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	requestId := strings.TrimSpace(req.RequestId)
	if requestId == "" || len(requestId) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request_id"})
		return
	}
	if req.ActualQuota == nil || *req.ActualQuota < 0 || *req.ActualQuota > int64(common.MaxQuota) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("actual_quota must be within [0, %d]", common.MaxQuota),
		})
		return
	}
	journal, err := model.GetImageAutoBillingJournalByRequestId(requestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if journal == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "image-auto billing journal not found"})
		return
	}
	// Only review-parked journals may be resolved here: a reserved journal is
	// still owned by an in-flight request and settling it from the admin side
	// would race the gateway's own settlement.
	if journal.Status != model.ImageAutoBillingStatusSettlementReview {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"message": "journal is not in settlement_manual_review (current: " + journal.Status + ")",
		})
		return
	}
	if err := model.SettleImageAutoBilling(requestId, int(*req.ActualQuota)); err != nil {
		if errors.Is(err, model.ErrImageAutoBillingConflict) ||
			errors.Is(err, model.ErrImageAutoBillingTerminalConflict) {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
			return
		}
		common.ApiError(c, err)
		return
	}
	resolved, err := model.GetImageAutoBillingJournalByRequestId(requestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.SysLog(fmt.Sprintf(
		"image-auto settlement review resolved: request_id=%s actual_quota=%d operator=%s",
		requestId, *req.ActualQuota, c.GetString("username")))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    resolved,
	})
}
