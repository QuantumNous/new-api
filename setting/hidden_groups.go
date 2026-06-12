package setting

import (
	"strings"
	"sync"
)

// hiddenGroups contains group names hidden from the /api/user/self/groups
// response (token creation & playground group selectors). Hiding a group does
// not disable it: existing tokens and explicit API usage keep working.
var hiddenGroups = []string{}
var hiddenGroupsMutex sync.RWMutex

func HiddenGroupsToString() string {
	hiddenGroupsMutex.RLock()
	defer hiddenGroupsMutex.RUnlock()

	return strings.Join(hiddenGroups, ",")
}

func HiddenGroupsFromString(s string) {
	hiddenGroupsMutex.Lock()
	defer hiddenGroupsMutex.Unlock()

	hiddenGroups = []string{}
	for _, item := range strings.FieldsFunc(s, func(r rune) bool {
		return r == ',' || r == '\n'
	}) {
		item = strings.TrimSpace(item)
		if item != "" {
			hiddenGroups = append(hiddenGroups, item)
		}
	}
}

func IsGroupHidden(groupName string) bool {
	hiddenGroupsMutex.RLock()
	defer hiddenGroupsMutex.RUnlock()

	for _, g := range hiddenGroups {
		if g == groupName {
			return true
		}
	}
	return false
}
