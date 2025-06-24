package constant

import "one-api/common"

// 使用函数来避免初始化顺序带来的赋值问题
func RedisKeyCacheSeconds() int {
	return common.SyncFrequency
}

// Cache keys
const (
	UserGroupKeyFmt    = "user_group:%d"
	UserQuotaKeyFmt    = "user_quota:%d"
	UserEnabledKeyFmt  = "user_enabled:%d"
	UserUsernameKeyFmt = "user_name:%d"
)

const (
	TokenFiledRemainQuota = "RemainQuota"
	TokenFieldGroup       = "Group"
)
