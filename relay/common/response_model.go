package common

import "github.com/QuantumNous/new-api/setting/model_setting"

func ResponseModelNameForClient(info *RelayInfo) (bool, string) {
	if info == nil || !info.IsModelMapped || info.OriginModelName == "" {
		return false, ""
	}
	if !model_setting.GetGlobalSettings().ResponseModelOriginalEnabled {
		return false, ""
	}
	return true, info.OriginModelName
}
