package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// PlaygroundGroupQuery is the reserved query parameter used by playground
// clients to pick a usable group. It must never reach upstream providers, so
// it is stripped from the raw query before the relay pipeline builds the
// upstream URL.
const PlaygroundGroupQuery = "pg_group"

// PlaygroundGroup resolves the optional pg_group query parameter on /pg
// routes. The selected group is validated against the user's usable groups
// and written into the using-group context before Distribute runs, then the
// parameter is removed from the request so it cannot leak into upstream URLs
// (GenRelayInfo forwards the full request URL, and image pass-through bodies
// rule out a body-level group field).
func PlaygroundGroup() func(c *gin.Context) {
	return func(c *gin.Context) {
		if !strings.HasPrefix(c.Request.URL.Path, common.PlaygroundRequestPathPrefix+"/") {
			c.Next()
			return
		}

		group := c.Query(PlaygroundGroupQuery)
		if group == "" {
			c.Next()
			return
		}

		usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
		if !service.GroupInUserUsableGroups(usingGroup, group) && group != usingGroup {
			abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorGroupAccessDenied))
			return
		}

		common.SetContextKey(c, constant.ContextKeyUsingGroup, group)
		common.SetContextKey(c, constant.ContextKeyTokenGroup, group)

		query := c.Request.URL.Query()
		query.Del(PlaygroundGroupQuery)
		c.Request.URL.RawQuery = query.Encode()

		c.Next()
	}
}
