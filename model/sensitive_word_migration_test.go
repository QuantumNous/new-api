package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
	"gorm.io/gorm"
)

func optionsRevision(t *testing.T, db *gorm.DB) string {
	t.Helper()
	var topic SystemSyncTopic
	if err := db.Where(&SystemSyncTopic{Topic: SyncTopicOptions}).First(&topic).Error; err != nil {
		return ""
	}
	return topic.Revision
}

// The old words become one global request-filter instance after the saved
// ones, enabled when both old switches were on; the old options go, and a
// second start changes nothing.
func TestMigrateSensitiveWords(t *testing.T) {
	keep := `{"id":"rp_keep","name":"Keep","plugin":"request-redact","enabled":true,"global":true,"groups":[],"models":[],"config":{"replacement":"[X]"}}`
	tests := map[string]struct {
		options   map[string]string
		language  string
		instances []string
		enabled   bool
		name      string
	}{
		"both switches on": {
			options:   map[string]string{"CheckSensitiveEnabled": "true", "CheckSensitiveOnPromptEnabled": "true", "StopOnSensitiveEnabled": "false", "SensitiveWords": " Bad \n\nworse\r\n", "StreamCacheQueueLength": "3", request_plugin_setting.InstancesOption: "[" + keep + "]"},
			instances: []string{keep},
			enabled:   true,
			name:      "敏感词",
		},
		"one switch on, no saved instances, English": {
			options:  map[string]string{"CheckSensitiveEnabled": "true", "SensitiveWords": "Bad\nworse"},
			language: "en",
			name:     "Sensitive words",
		},
		"Chinese by region": {
			options:  map[string]string{"CheckSensitiveOnPromptEnabled": "true", "SensitiveWords": "Bad\nworse"},
			language: "zh-TW",
			name:     "敏感词",
		},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			db := useFrontendOptionMigrationDB(t)
			require.NoError(t, db.AutoMigrate(&SystemSyncTopic{}))
			previousLanguage := common.DefaultLanguage
			common.DefaultLanguage = tc.language
			t.Cleanup(func() { common.DefaultLanguage = previousLanguage })
			for key, value := range tc.options {
				require.NoError(t, db.Create(&Option{Key: key, Value: value}).Error)
			}

			require.NoError(t, MigrateSensitiveWords())
			for _, key := range retiredSensitiveOptionKeys {
				requireOptionMissing(t, db, key)
			}
			saved := requireOptionValue(t, db, request_plugin_setting.InstancesOption)
			instances := gjson.Parse(saved).Array()
			require.Len(t, instances, len(tc.instances)+1)
			for index, instance := range tc.instances {
				assert.JSONEq(t, instance, instances[index].Raw)
			}
			migrated := instances[len(tc.instances)]
			assert.Regexp(t, `^rp_[a-z2-7]{8}$`, migrated.Get("id").Str)
			withoutID, err := sjson.Delete(migrated.Raw, "id")
			require.NoError(t, err)
			assert.JSONEq(t, `{"name":"`+tc.name+`","plugin":"request-filter","enabled":`+map[bool]string{true: "true", false: "false"}[tc.enabled]+`,
				"global":true,"groups":[],"models":[],
				"config":{"rules":[],"keywords":"Bad\nworse","keywordsCaseSensitive":false,"message":"","replies":false}}`, withoutID)
			revision := optionsRevision(t, db)
			assert.NotEmpty(t, revision, "the other nodes reload the options")

			require.NoError(t, MigrateSensitiveWords())
			assert.Equal(t, saved, requireOptionValue(t, db, request_plugin_setting.InstancesOption))
			assert.Equal(t, revision, optionsRevision(t, db))
		})
	}
}

func TestMigrateSensitiveWordsWithoutWords(t *testing.T) {
	db := useFrontendOptionMigrationDB(t)
	require.NoError(t, db.AutoMigrate(&SystemSyncTopic{}))

	// Nothing to move: no write, no reload.
	require.NoError(t, MigrateSensitiveWords())
	assert.Empty(t, optionsRevision(t, db))

	// Switches without words leave no instance behind.
	require.NoError(t, db.Create(&[]Option{{Key: "CheckSensitiveEnabled", Value: "true"}, {Key: "SensitiveWords", Value: " \n "}}).Error)
	require.NoError(t, MigrateSensitiveWords())
	requireOptionMissing(t, db, "CheckSensitiveEnabled")
	requireOptionMissing(t, db, "SensitiveWords")
	requireOptionMissing(t, db, request_plugin_setting.InstancesOption)

	// An instance list it cannot read keeps everything as it was.
	require.NoError(t, db.Create(&[]Option{{Key: "SensitiveWords", Value: "bad"}, {Key: request_plugin_setting.InstancesOption, Value: "{"}}).Error)
	require.Error(t, MigrateSensitiveWords())
	assert.Equal(t, "bad", requireOptionValue(t, db, "SensitiveWords"))
	assert.Equal(t, "{", requireOptionValue(t, db, request_plugin_setting.InstancesOption))
}
