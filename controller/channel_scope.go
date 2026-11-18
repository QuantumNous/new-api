package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// channelScopeFromContext returns the channels the authenticated user may
// reach, from the user ID and role the auth middleware set: every channel for
// an administrator, the user's own channels for a channel supplier, and none
// for anyone else.
func channelScopeFromContext(c *gin.Context) model.ChannelScope {
	role := c.GetInt("role")
	if role >= common.RoleAdminUser {
		return model.AllChannelsScope()
	}
	if role == common.RoleChannelSupplierUser {
		return model.CreatorChannelsScope(c.GetInt("id"))
	}
	return model.CreatorChannelsScope(0)
}

// rejectChannelOutsideScope answers "Channel does not exist" and returns true
// when the channel is not in the user's scope, whether it belongs to someone
// else or does not exist at all, so a channel supplier cannot tell the two
// apart. An administrator is never rejected and costs no query. Call it as
// soon as the channel ID is parsed, before any lock, read, check or outbound
// request on that channel.
func rejectChannelOutsideScope(c *gin.Context, channelID int) bool {
	scope := channelScopeFromContext(c)
	if scope.IsAll() {
		return false
	}
	within, err := model.ChannelIDsWithinScope(scope, []int{channelID})
	if err != nil {
		common.ApiError(c, err)
		return true
	}
	if !within {
		common.ApiErrorT(c, "Channel does not exist")
		return true
	}
	return false
}

// rejectChannelsOutsideScope answers "One or more channels do not exist" and
// returns true when any channel of a batch request is not in the user's
// scope, so the whole batch is refused and a missing ID looks the same as
// someone else's. An administrator is never rejected and costs no query.
func rejectChannelsOutsideScope(c *gin.Context, channelIDs []int) bool {
	scope := channelScopeFromContext(c)
	if scope.IsAll() {
		return false
	}
	within, err := model.ChannelIDsWithinScope(scope, channelIDs)
	if err != nil {
		common.ApiError(c, err)
		return true
	}
	if !within {
		common.ApiErrorT(c, "One or more channels do not exist")
		return true
	}
	return false
}

// buildChannelListQuery selects the channels in scope that match the list
// filters; a negative typeFilter matches every type.
func buildChannelListQuery(scope model.ChannelScope, group string, statusFilter int, typeFilter int) *gorm.DB {
	query := scope.Apply(model.DB.Model(&model.Channel{}))
	query = model.ApplyChannelGroupFilter(query, group)
	query = applyChannelStatusFilter(query, statusFilter)
	if typeFilter >= 0 {
		query = query.Where("type = ?", typeFilter)
	}
	return query
}
