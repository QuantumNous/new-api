package jimeng

var omniHumanModels = []string{
	"jimeng_realman_avatar_picture_omni_v15",
}

func isOmniHumanModel(name string) bool {
	for _, modelName := range omniHumanModels {
		if name == modelName {
			return true
		}
	}
	return false
}
