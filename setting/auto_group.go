package setting

import "encoding/json"

var AutoGroups = []string{
	"default",
}

var DefaultUseAutoGroup = false

func ContainsAutoGroup(group string) bool {
	for _, autoGroup := range AutoGroups {
		if autoGroup == group {
			return true
		}
	}
	return false
}

func UpdateAutoGroupsByJsonString(jsonString string) error {
	AutoGroups = make([]string, 0)
	return json.Unmarshal([]byte(jsonString), &AutoGroups)
}

func AutoGroups2JsonString() string {
	jsonBytes, err := json.Marshal(AutoGroups)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}
