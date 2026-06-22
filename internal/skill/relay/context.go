package skillrelay

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/gin-gonic/gin"
)

// SkillRelayContext holds the server-resolved identity, skill reference, and
// immutable execution snapshot established exactly once at relay request entry.
//
// SkillVersion is the authoritative request-entry snapshot for the lifetime of
// the request. Once Resolve succeeds, downstream code must consume this bound
// snapshot and must not re-query the mutable active skill_version pointer.
//
// Downstream handlers read from this context:
//   - DR-67 (entitlement): calls availability.Resolve with Skill + identity fields
//   - DR-68 (routing): LoadAndApply populates SkillVersionID, consumes SkillVersion,
//     and rewrites the request from the server-bound snapshot
//   - DR-88 (prompt injection, superseded by DR-68 request rewrite): must not
//     re-resolve mutable Skill state later in the request
//
// The snapshot contract covers at least:
//   - SkillVersionID
//   - InstructionTemplate
//   - ModelWhitelistSnapshot
//   - RequiredPlanSnapshot
//   - MonetizationSnapshot
//   - MaxInputTokensSnapshot
//
// Even if another request activates a new skill_version mid-flight, an already
// returned SkillRelayContext must continue using the original bound snapshot.
type SkillRelayContext struct {
	RequestID      string
	SkillID        string
	SkillVersionID string
	UserID         int
	IsKidsSession  bool
	Plan           enums.RequiredPlan
	SubActive      bool
	Skill          *skillmodel.Skill
	SkillVersion   *skillmodel.SkillVersion
	EntryPoint     string // enums.EntryPoint value; set by TextHelper from deeprouter.entry_point
}

// Set stores ctx in the gin context under ContextKeySkillRelayCtx.
func Set(c *gin.Context, ctx *SkillRelayContext) {
	common.SetContextKey(c, constant.ContextKeySkillRelayCtx, ctx)
}

// Get retrieves the SkillRelayContext stored by Set.
// Returns (nil, false) when no skill request is active.
func Get(c *gin.Context) (*SkillRelayContext, bool) {
	return common.GetContextKeyType[*SkillRelayContext](c, constant.ContextKeySkillRelayCtx)
}
