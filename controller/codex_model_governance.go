package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

type codexModelGovernanceRecordResponse struct {
	ID                 int    `json:"id"`
	ModelName          string `json:"model_name"`
	Status             string `json:"status"`
	Source             string `json:"source"`
	MatchedRule        string `json:"matched_rule"`
	LastError          string `json:"last_error"`
	AffectedChannelIDs []int  `json:"affected_channel_ids"`
	AbilitiesDisabled  bool   `json:"abilities_disabled"`
	DetectedAt         int64  `json:"detected_at"`
	LastCheckedAt      int64  `json:"last_checked_at"`
	ReviewedAt         int64  `json:"reviewed_at"`
	ReviewedBy         int    `json:"reviewed_by"`
	ReviewNote         string `json:"review_note"`
}

type codexModelGovernanceReviewRequest struct {
	Action string `json:"action"`
	Note   string `json:"note"`
}

type codexModelGovernanceRuleTestRequest struct {
	Message  string   `json:"message"`
	Patterns []string `json:"patterns"`
}

func ListCodexModelGovernanceRecords(c *gin.Context) {
	records, err := model.ListCodexModelGovernanceRecords(c.Query("status"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses := make([]codexModelGovernanceRecordResponse, 0, len(records))
	for _, record := range records {
		responses = append(responses, buildCodexModelGovernanceRecordResponse(record))
	}
	common.ApiSuccess(c, responses)
}

func ReviewCodexModelGovernanceRecord(c *gin.Context) {
	recordID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req codexModelGovernanceReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.ReviewCodexModelGovernance(recordID, req.Action, c.GetInt("id"), req.Note); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func TestCodexModelGovernanceRule(c *gin.Context) {
	var req codexModelGovernanceRuleTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	patterns := req.Patterns
	if len(patterns) == 0 {
		patterns = operation_setting.GetCodexModelGovernanceSetting().UnsupportedMessagePatterns
	}
	match := service.ClassifyCodexUnsupportedMessage(req.Message, patterns)
	common.ApiSuccess(c, gin.H{
		"matched":      match.Matched,
		"model_name":   match.ModelName,
		"matched_rule": match.Pattern,
	})
}

func buildCodexModelGovernanceRecordResponse(record model.CodexModelGovernanceRecord) codexModelGovernanceRecordResponse {
	channelIDs := model.DecodeCodexModelGovernanceChannelIDs(record.AffectedChannelIDs)
	if channelIDs == nil {
		// keep JSON as [] instead of null so frontend .length/.map never crash
		channelIDs = []int{}
	}
	return codexModelGovernanceRecordResponse{
		ID:                 record.ID,
		ModelName:          record.ModelName,
		Status:             record.Status,
		Source:             record.Source,
		MatchedRule:        record.MatchedRule,
		LastError:          record.LastError,
		AffectedChannelIDs: channelIDs,
		AbilitiesDisabled:  record.AbilitiesDisabled,
		DetectedAt:         record.DetectedAt,
		LastCheckedAt:      record.LastCheckedAt,
		ReviewedAt:         record.ReviewedAt,
		ReviewedBy:         record.ReviewedBy,
		ReviewNote:         record.ReviewNote,
	}
}
