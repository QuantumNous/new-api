package model

import (
	"github.com/QuantumNous/new-api/common"

	"github.com/samber/lo"
	"gorm.io/gorm"
)

// ChannelScope is the set of channels a query may read. Every caller names its
// scope: AllChannelsScope for administrators and system tasks, and
// CreatorChannelsScope for a channel supplier. The zero value matches no
// channel, so a missing scope never widens to every channel.
type ChannelScope struct {
	all           bool
	creatorUserID int
}

// AllChannelsScope covers every channel, for administrators and system tasks.
func AllChannelsScope() ChannelScope {
	return ChannelScope{all: true}
}

// CreatorChannelsScope covers the channels the user created as a channel
// supplier. A user who created channels as an administrator and later became a
// supplier cannot reach those channels, which take part in relaying. A user ID
// of zero or less matches no channel.
func CreatorChannelsScope(userID int) ChannelScope {
	return ChannelScope{creatorUserID: userID}
}

// IsAll reports whether the scope covers every channel.
func (s ChannelScope) IsAll() bool {
	return s.all
}

// Apply limits a query whose only table is channels to the scope. Use it only
// on a query without a chained Or: GORM joins a later Where to the last Or
// branch, as in "a OR b AND scope", so the scope would bind that branch alone.
func (s ChannelScope) Apply(query *gorm.DB) *gorm.DB {
	if s.all {
		return query
	}
	if s.creatorUserID <= 0 {
		return query.Where("1 = 0")
	}
	return query.Where("creator_user_id = ? AND creator_role = ?", s.creatorUserID, common.RoleChannelSupplierUser)
}

// applyByChannelID limits a query on a table that refers to channels by
// channel_id, such as abilities, to the channels in the scope. The query of
// AllChannelsScope is left as it is. Like Apply, it is only for a query
// without a chained Or.
func (s ChannelScope) applyByChannelID(query *gorm.DB) *gorm.DB {
	if s.all {
		return query
	}
	return query.Where("channel_id IN (?)", s.ChannelIDQuery())
}

// ChannelIDQuery selects the IDs of the channels in the scope, for filtering
// tables that reference channels by channel_id.
func (s ChannelScope) ChannelIDQuery() *gorm.DB {
	return s.Apply(DB.Model(&Channel{}).Select("id"))
}

// ChannelIDsWithinScope reports whether every ID names an existing channel in
// the scope. A repeated ID counts once, and an empty list names no channel.
func ChannelIDsWithinScope(scope ChannelScope, ids []int) (bool, error) {
	if len(ids) == 0 {
		return false, nil
	}
	uniqueIDs := lo.Uniq(ids)
	var count int64
	if err := scope.Apply(DB.Model(&Channel{}).Where("id IN ?", uniqueIDs)).Count(&count).Error; err != nil {
		return false, err
	}
	return count == int64(len(uniqueIDs)), nil
}

// GetEnabledModelsInScope lists the distinct models enabled on the channels in
// the scope.
func GetEnabledModelsInScope(scope ChannelScope) []string {
	var models []string
	DB.Table("abilities").
		Where("enabled = ? AND channel_id IN (?)", true, scope.ChannelIDQuery()).
		Distinct("model").
		Pluck("model", &models)
	return models
}

// FillChannelCreatorNames sets the creator username of each channel with one
// query. A channel without a creator, or whose creator was deleted, gets an
// empty name.
func FillChannelCreatorNames(channels []*Channel) error {
	creatorIDs := make([]int, 0, len(channels))
	for _, channel := range channels {
		if channel.CreatorUserId > 0 {
			creatorIDs = append(creatorIDs, channel.CreatorUserId)
		}
	}
	usernames := make(map[int]string)
	if len(creatorIDs) > 0 {
		var creators []User
		if err := DB.Select("id", "username").Where("id IN ?", lo.Uniq(creatorIDs)).Find(&creators).Error; err != nil {
			return err
		}
		for _, creator := range creators {
			usernames[creator.Id] = creator.Username
		}
	}
	for _, channel := range channels {
		channel.CreatorUsername = usernames[channel.CreatorUserId]
	}
	return nil
}
