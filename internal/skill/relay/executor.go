package skillrelay

// executor implements DR-68: server-side routing/model-selection + provider call setup.
// After Resolve() stores a SkillRelayContext, LoadAndApply() consumes the immutable
// SkillVersion snapshot, selects a server-authoritative model, and rewrites the relay
// request to enforce FR-G19 (stateless single-turn).
//
// Security invariants:
//   - Model comes from model_whitelist_snapshot, never from the client payload.
//   - Provider call contains only instruction_template + last user message (no history).
//   - Provider credentials stay server-side; instruction_template is not a secret (R2/D-09).
//   - Downstream execution must consume the request-entry-bound snapshot and must not
//     re-resolve mutable skill version pointer state.

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/internal/skill/tiers"
	"gorm.io/gorm"
)

// LoadAndApply is the DR-68 relay execution step (package-level, uses package db).
// It consumes the immutable SkillVersion snapshot already bound on ctx.
//
// Returns the rewritten request on success.
// Returns (nil, errCode) on any failure - caller must abort the request.
// SkillRelayContext.SkillVersionID is populated on success.
func LoadAndApply(ctx *SkillRelayContext, request *dto.GeneralOpenAIRequest) (*dto.GeneralOpenAIRequest, errcodes.ErrorCode) {
	return loadAndApply(db, ctx, request)
}

// loadAndApply is the DB-injectable core used directly in tests.
func loadAndApply(database *gorm.DB, ctx *SkillRelayContext, request *dto.GeneralOpenAIRequest) (*dto.GeneralOpenAIRequest, errcodes.ErrorCode) {
	if database == nil {
		return nil, errcodes.ErrSkillInternalError
	}

	snapshot, errCode := loadSnapshot(database, ctx)
	if errCode != "" {
		return nil, errCode
	}

	model, errCode := selectModel(snapshot.ModelWhitelist)
	if errCode != "" {
		return nil, errCode
	}

	rewritten, errCode := rewriteForSingleTurn(request, snapshot.InstructionTemplate, model)
	if errCode != "" {
		return nil, errCode
	}

	ctx.SkillVersionID = snapshot.SkillVersionID
	return rewritten, ""
}

// versionSnapshot holds the execution-critical fields from skill_versions.
// Treated as immutable for the lifetime of the request (server-authoritative).
type versionSnapshot struct {
	SkillVersionID      string
	InstructionTemplate string
	ModelWhitelist      []string
}

// loadSnapshot consumes only the SkillVersion snapshot bound by Resolve at request
// entry. If the bound snapshot is absent, fail closed instead of inspecting mutable
// Skill state.
func loadSnapshot(_ *gorm.DB, ctx *SkillRelayContext) (*versionSnapshot, errcodes.ErrorCode) {
	if ctx == nil {
		return nil, errcodes.ErrSkillInternalError
	}
	if ctx.SkillVersion == nil {
		return nil, errcodes.ErrSkillInternalError
	}
	return snapshotFromSkillVersion(ctx.SkillVersion)
}

func snapshotFromSkillVersion(version *skillmodel.SkillVersion) (*versionSnapshot, errcodes.ErrorCode) {
	if version == nil {
		return nil, errcodes.ErrSkillInternalError
	}
	whitelist, err := parseModelWhitelist(version.ModelWhitelistSnapshot)
	if err != nil {
		return nil, errcodes.ErrSkillInternalError
	}
	return &versionSnapshot{
		SkillVersionID:      version.ID,
		InstructionTemplate: version.InstructionTemplate,
		ModelWhitelist:      whitelist,
	}, ""
}

// parseModelWhitelist decodes the SkillJSONB (JSON array of model alias strings).
func parseModelWhitelist(raw skillmodel.SkillJSONB) ([]string, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var models []string
	if err := common.Unmarshal(raw, &models); err != nil {
		return nil, err
	}
	return models, nil
}

// selectModel picks the server-authoritative model from the whitelist.
// V1: takes the first non-empty entry (list is priority-ordered by admin at publish time).
//
// DR-96: a whitelist entry may be a platform tier alias (e.g. "smart-tier") rather
// than a concrete model id. Tier aliases are resolved server-side to the current
// best model via the platform alias registry; non-alias entries are treated as
// literal model names and passed through unchanged (backward compatible).
// TODO(DR-68-model-selection): add plan-based filtering and context-budget check.
func selectModel(whitelist []string) (string, errcodes.ErrorCode) {
	for _, m := range whitelist {
		if m == "" {
			continue
		}
		if resolved, ok := tiers.Resolve(m); ok {
			return resolved, ""
		}
		return m, ""
	}
	return "", errcodes.ErrSkillInternalError
}

// rewriteForSingleTurn enforces FR-G19 (stateless single-turn execution):
//   - Extracts the last user message from the original request.
//   - Builds a fresh message array: [system: instruction_template, user: last_user_message].
//   - Sets request.Model to the server-selected model (discards client-supplied model).
//
// All prior-turn messages are dropped - the provider sees exactly one user turn.
func rewriteForSingleTurn(request *dto.GeneralOpenAIRequest, instructionTemplate, model string) (*dto.GeneralOpenAIRequest, errcodes.ErrorCode) {
	// V1 skills are text-only. StringContent() returns "" for pure-image ContentPart
	// arrays (no text type), which is treated the same as a missing user message.
	// Callers that need multimodal support must wait for a future version of this API.
	userContent := ""
	for i := len(request.Messages) - 1; i >= 0; i-- {
		if request.Messages[i].Role == "user" {
			userContent = request.Messages[i].StringContent()
			break
		}
	}
	if userContent == "" {
		return nil, errcodes.ErrInvalidRequest
	}

	// TODO(DR-67): add a server-side MaxTokens ceiling here to bound output cost.
	// MaxTokens/MaxCompletionTokens are intentionally NOT forwarded: client-supplied
	// token ceilings would allow cost manipulation via crafted skill requests.
	built := &dto.GeneralOpenAIRequest{
		Model:  model,
		Stream: request.Stream,
	}
	// Deep-copy StreamOptions so future in-place mutations of built.StreamOptions
	// do not affect the caller's original request.StreamOptions via shared pointer.
	if request.StreamOptions != nil {
		so := *request.StreamOptions
		built.StreamOptions = &so
	}

	systemMsg := dto.Message{Role: "system"}
	systemMsg.SetStringContent(instructionTemplate)
	userMsg := dto.Message{Role: "user"}
	userMsg.SetStringContent(userContent)
	built.Messages = []dto.Message{systemMsg, userMsg}

	return built, ""
}
