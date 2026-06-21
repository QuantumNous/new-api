package skillrelay

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/gin-gonic/gin"
)

// SkillRelayContext holds the server-resolved identity and skill reference
// established at relay entry (tasks/05 §5.1 steps 1-6).
//
// Downstream handlers read from this context:
//   - DR-67 (entitlement): calls availability.Resolve with Skill + identity fields
//   - DR-88 (prompt injection): reads Skill.ActiveVersionID to load instruction template
//     and EntryPoint to record the correct analytics entry_point (tasks/03 §9)
type SkillRelayContext struct {
	RequestID     string
	SkillID       string
	UserID        int
	IsKidsSession bool
	Plan          enums.RequiredPlan
	SubActive     bool
	Skill         *skillmodel.Skill
	EntryPoint    string // enums.EntryPoint value; set by TextHelper from deeprouter.entry_point
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
