package handler

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/gin-gonic/gin"
)

type marketplaceEventRequest struct {
	EventType  enums.SkillUsageEventType `json:"event_type"`
	SkillID    string                    `json:"skill_id"`
	EntryPoint enums.EntryPoint          `json:"entry_point"`
	Metadata   map[string]any            `json:"metadata,omitempty"`
}

func RecordMarketplaceEvent(c *gin.Context) {
	var req marketplaceEventRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Invalid event payload.", nil)
		return
	}
	if req.EventType != enums.SkillUsageEventTypeImpression &&
		req.EventType != enums.SkillUsageEventTypeDetailView {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Unsupported marketplace event type.", nil)
		return
	}
	req.SkillID = strings.TrimSpace(req.SkillID)
	if req.SkillID == "" {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "skill_id is required.", nil)
		return
	}
	if req.EntryPoint == "" {
		req.EntryPoint = enums.EntryPointMarketplaceCard
	}
	if req.EntryPoint != enums.EntryPointMarketplaceCard {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Unsupported marketplace entry point.", nil)
		return
	}

	metadata := req.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadataBytes, err := common.Marshal(metadata)
	if err != nil {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Invalid event metadata.", nil)
		return
	}

	event := skillmodel.SkillUsageEvent{
		EventType:  req.EventType,
		SkillID:    &req.SkillID,
		EntryPoint: req.EntryPoint,
		RequestID:  stringPtr(skillapi.RequestID(c)),
		Metadata:   skillmodel.SkillJSONB(metadataBytes),
	}
	if userID := int64(c.GetInt("id")); userID > 0 {
		event.UserID = &userID
		event.TenantID = &userID
	}

	db, ok := skillDB(c)
	if !ok {
		return
	}
	if err := skillmodel.EmitSkillUsageEvent(db, event); err != nil {
		writeDBError(c, err)
		return
	}
	skillapi.Success(c, gin.H{"recorded": true})
}

func stringPtr(v string) *string {
	return &v
}
