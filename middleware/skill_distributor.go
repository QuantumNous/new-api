package middleware

// Skill-relay distributor helpers (Airbotix DR-68).
// Kept in a separate file from upstream middleware/distributor.go per AGENTS.md Rule 8:
// upstream cherry-picks to distributor.go will not conflict with skill-relay code.

import (
	"io"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillrelay "github.com/QuantumNous/new-api/internal/skill/relay"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

func prepareSkillRelayForDistribution(c *gin.Context, modelRequest *ModelRequest) errcodes.ErrorCode {
	if modelRequest == nil || relayconstant.Path2RelayMode(c.Request.URL.Path) != relayconstant.RelayModeChatCompletions {
		return ""
	}

	var request dto.GeneralOpenAIRequest
	if err := common.UnmarshalBodyReusable(c, &request); err != nil {
		return errcodes.ErrInvalidRequest
	}
	if request.Deeprouter == nil || request.Deeprouter.SkillID == "" {
		return ""
	}

	entryPoint, errCode := distributeSkillEntryPoint(c, &request)
	if errCode != "" {
		return errCode
	}
	skillCtx, errCode := skillrelay.ResolveVersion(c, request.Deeprouter.SkillID, request.Deeprouter.SkillVersionID)
	if errCode != "" {
		skillrelay.AbortSkillRelayBlocked(c, skillrelay.AbortSkillRelayBlockedInput{
			ErrorCode:  errCode,
			EntryPoint: entryPoint,
			SkillID:    request.Deeprouter.SkillID,
		}, nil)
		return errCode
	}
	skillCtx.EntryPoint = entryPoint
	// Persist the request-entry-bound snapshot context before LoadAndApply so any
	// post-resolve blocked path can still emit snapshot fields (SkillVersionID,
	// plan, user context) through the shared blocked helper.
	skillrelay.Set(c, skillCtx)
	rewritten, errCode := skillrelay.LoadAndApply(skillCtx, &request)
	if errCode != "" {
		skillrelay.AbortSkillRelayBlocked(c, skillrelay.AbortSkillRelayBlockedInput{
			ErrorCode:  errCode,
			EntryPoint: entryPoint,
			SkillID:    request.Deeprouter.SkillID,
		}, nil)
		return errCode
	}
	// Keep the skill marker only until TextHelper sees it and strips it before
	// provider forwarding. All other client-controlled provider params were dropped.
	rewritten.Deeprouter = request.Deeprouter

	if errCode := replaceReusableRequestBody(c, rewritten); errCode != "" {
		return errCode
	}
	modelRequest.Model = rewritten.Model
	return ""
}

func replaceReusableRequestBody(c *gin.Context, request *dto.GeneralOpenAIRequest) errcodes.ErrorCode {
	jsonData, err := common.Marshal(request)
	if err != nil {
		return errcodes.ErrSkillInternalError
	}
	storage, err := common.CreateBodyStorage(jsonData)
	if err != nil {
		return errcodes.ErrSkillInternalError
	}
	// Seek before closing old storage: if Seek fails, old storage remains valid
	// so any retry or panic-recovery path can still read from it.
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		_ = storage.Close()
		return errcodes.ErrSkillInternalError
	}
	// The compound guard (type assertion ok AND != nil) handles the typed-nil case:
	// a recovery path storing (*concreteStorage)(nil) in KeyBodyStorage would pass the
	// type assertion but be caught by the nil check, preventing a Close() panic and
	// silently skipping the Close on a nil pointer rather than leaking it.
	if old, exists := c.Get(common.KeyBodyStorage); exists {
		if oldStorage, ok := old.(common.BodyStorage); ok && oldStorage != nil {
			_ = oldStorage.Close()
		}
	}
	c.Set(common.KeyBodyStorage, storage)
	c.Request.Body = io.NopCloser(storage)
	c.Request.ContentLength = int64(len(jsonData))
	c.Request.Header.Set("Content-Type", "application/json")
	return ""
}

func distributeSkillEntryPoint(c *gin.Context, request *dto.GeneralOpenAIRequest) (string, errcodes.ErrorCode) {
	requested := ""
	if request != nil && request.Deeprouter != nil {
		requested = request.Deeprouter.EntryPoint
	}
	return skillrelay.ResolveEffectiveEntryPoint(
		common.GetContextKeyString(c, constant.ContextKeySkillRelayEntryPoint),
		requested,
		"",
	)
}
