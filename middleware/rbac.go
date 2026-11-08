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
//   - The decision reads the cached user setting, consistent with the rest of the
//     dashboard authorization pipeline.
func RequireVisibleSection(section string) func(c *gin.Context) {
	return func(c *gin.Context) {
		if c.GetInt("role") == common.RoleRootUser {
			c.Next()
			return
		}
		user, err := model.GetUserCache(c.GetInt("id"))
		if err != nil {
			abortWithWebMessage(c, http.StatusInternalServerError, "AUTH_INTERNAL_ERROR", common.NewMessage("Database error, please contact the administrator"))
			return
		}
		sections := user.GetSetting().VisibleSections
		if len(sections) == 0 || slices.Contains(sections, section) {
			c.Next()
			return
		}
		abortWithWebMessage(c, http.StatusForbidden, "", common.NewMessage("Unauthorized, this section is not available for your account"))
	}
}
