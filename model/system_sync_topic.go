package model

import (
	"crypto/rand"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Topics of the data each node keeps a copy of in memory. A write to that
// data bumps its topic; every node reloads a topic whose revision changed.
const (
	SyncTopicOptions           = "options"
	SyncTopicChannels          = "channels"
	SyncTopicAuthz             = "authz"
	SyncTopicPlugins           = "plugins"
	SyncTopicOAuthProviders    = "oauth_providers"
	SyncTopicModels            = "models"
	SyncTopicSubscriptionPlans = "subscription_plans"
)

// SystemSyncTopic holds the latest revision of one topic. Revisions are random
// tokens, only ever compared for equality; a topic with no row has revision "".
type SystemSyncTopic struct {
	Topic     string `json:"topic" gorm:"type:varchar(64);primaryKey"`
	Revision  string `json:"revision" gorm:"type:varchar(64);not null"`
	UpdatedBy string `json:"updated_by" gorm:"type:varchar(128)"`
	UpdatedAt int64  `json:"updated_at"`
}

// BumpSyncTopic gives topic a new revision. Call it after the write to the
// topic's data has committed. A failed bump is only logged: the periodic full
// reloads still carry the change to the other nodes. Data that no periodic
// reload covers bumps with bumpSyncTopic inside its write transaction.
func BumpSyncTopic(topic string) {
	if err := bumpSyncTopic(DB, topic); err != nil {
		common.SysError(common.LogText("failed to bump sync topic %s: %v", topic, err))
	}
}

// bumpSyncTopic gives topic a new revision on tx; inside the transaction of a
// write, the write and its bump commit or fail together.
func bumpSyncTopic(tx *gorm.DB, topic string) error {
	row := SystemSyncTopic{Topic: topic, Revision: rand.Text(), UpdatedBy: common.NodeName, UpdatedAt: common.GetTimestamp()}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "topic"}},
		DoUpdates: clause.AssignmentColumns([]string{"revision", "updated_by", "updated_at"}),
	}).Create(&row).Error
}

func ListSyncTopics() ([]SystemSyncTopic, error) {
	var topics []SystemSyncTopic
	err := DB.Find(&topics).Error
	return topics, err
}
