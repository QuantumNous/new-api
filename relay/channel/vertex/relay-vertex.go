package vertex

import "one-api/common"

func GetModelRegion(other string, localModelName string) string {
	// if other is json string
	if common.IsJsonObject(other) {
		m, err := common.StrToMap(other)
		if err != nil {
			return other // return original if parsing fails
		}
		if m[localModelName] != nil {
			return m[localModelName].(string)
		} else {
			return m["default"].(string)
		}
	}
	return other
}
