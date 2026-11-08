package middleware

import (
	"net/http"
	"slices"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// RequireVisibleSection enforces the administrator-managed per-user console
// section allow-list on the server. Hiding a sidebar entry is a UI concern; this
// middleware makes the matching API return 403 when the section is not granted,
// so the restriction cannot be bypassed by calling the endpoint directly.
//
// Semantics:
//   - An empty or absent `visible_sections` list means the user is unrestricted,
//     keeping the default behavior for existing accounts.
//   - The root account always keeps full access.
//   - Several sections may be passed for endpoints that several console pages
//     share (for example the group list used by the channel, user, subscription
//     and usage log pages). The request is allowed when at least one of them is
//     granted, so the shared endpoint stays usable for every page that renders
//     it while remaining closed to accounts that hold none of them.
//   - The decision reads the cached user setting, consistent with the rest of the
//     dashboard authorization pipeline.
func RequireVisibleSection(sections ...string) func(c *gin.Context) {
	return func(c *gin.Context) {
		if c.GetInt("role") == common.RoleRootUser {
			c.Next()
			return
		}
		if len(sections) == 0 {
			// A guard without a section cannot decide anything; fail closed
			// instead of leaving the endpoint unguarded.
			abortWithWebMessage(c, http.StatusForbidden, "", common.NewMessage("Unauthorized, this section is not available for your account"))
			return
		}
		user, err := model.GetUserCache(c.GetInt("id"))
		if err != nil {
			abortWithWebMessage(c, http.StatusInternalServerError, "AUTH_INTERNAL_ERROR", common.NewMessage("Database error, please contact the administrator"))
			return
		}
		granted := user.GetSetting().VisibleSections
		if len(granted) == 0 {
			c.Next()
			return
		}
		for _, section := range sections {
			if slices.Contains(granted, section) {
				c.Next()
				return
			}
		}
		abortWithWebMessage(c, http.StatusForbidden, "", common.NewMessage("Unauthorized, this section is not available for your account"))
	}
}
