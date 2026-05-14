package ratio_setting

import "sync"

var userGroupRatioMu sync.RWMutex
var userGroupRatioMap = make(map[int]map[string]float64)

type UserGroupRatioEntry struct {
	UserId     int
	UsingGroup string
	Ratio      float64
}

func InitUserGroupRatioCache(entries []UserGroupRatioEntry) {
	userGroupRatioMu.Lock()
	defer userGroupRatioMu.Unlock()
	userGroupRatioMap = make(map[int]map[string]float64, len(entries))
	for _, e := range entries {
		if _, ok := userGroupRatioMap[e.UserId]; !ok {
			userGroupRatioMap[e.UserId] = make(map[string]float64)
		}
		userGroupRatioMap[e.UserId][e.UsingGroup] = e.Ratio
	}
}

func GetUserGroupRatioOverride(userId int, usingGroup string) (float64, bool) {
	userGroupRatioMu.RLock()
	defer userGroupRatioMu.RUnlock()
	if groups, ok := userGroupRatioMap[userId]; ok {
		if ratio, ok := groups[usingGroup]; ok {
			return ratio, true
		}
	}
	return 0, false
}

func SetUserGroupRatioCache(userId int, usingGroup string, ratio float64) {
	userGroupRatioMu.Lock()
	defer userGroupRatioMu.Unlock()
	if _, ok := userGroupRatioMap[userId]; !ok {
		userGroupRatioMap[userId] = make(map[string]float64)
	}
	userGroupRatioMap[userId][usingGroup] = ratio
}

func DeleteUserGroupRatioCache(userId int, usingGroup string) {
	userGroupRatioMu.Lock()
	defer userGroupRatioMu.Unlock()
	if groups, ok := userGroupRatioMap[userId]; ok {
		delete(groups, usingGroup)
		if len(groups) == 0 {
			delete(userGroupRatioMap, userId)
		}
	}
}

func DeleteUserGroupRatioCacheByUser(userId int) {
	userGroupRatioMu.Lock()
	defer userGroupRatioMu.Unlock()
	delete(userGroupRatioMap, userId)
}
