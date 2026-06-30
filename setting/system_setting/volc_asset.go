package system_setting

import "fmt"

var VolcAssetConfig = VolcAssetSettings{}

type VolcAssetSettings struct {
	AccessKey   string `json:"access_key"`
	SecretKey   string `json:"secret_key"`
	Region      string `json:"region"`
	ProjectName string `json:"project_name"`
	GroupId     string `json:"group_id"`
	GroupType   string `json:"group_type"`
}

func (v *VolcAssetSettings) GetRegion() string {
	if v.Region == "" {
		return "cn-beijing"
	}
	return v.Region
}

func (v *VolcAssetSettings) GetGroupType() string {
	if v.GroupType == "" {
		return "AIGC"
	}
	return v.GroupType
}

func (v *VolcAssetSettings) GetBaseURL() string {
	return fmt.Sprintf("https://ark.%s.volcengineapi.com", v.GetRegion())
}
