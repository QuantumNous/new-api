package operation_setting

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// ImageAwareRouteRule 描述一条「虚拟入口模型」的路由规则：含图改写为 VisionModel，否则 CodingModel。
type ImageAwareRouteRule struct {
	VisionModel string `json:"vision_model"`
	CodingModel string `json:"coding_model"`
}

// imageAwareModelRouting 不导出：所有读写必须经由下方加锁方法，避免绕过 imageAwareModelRoutingLock。
var imageAwareModelRouting = map[string]ImageAwareRouteRule{}

var imageAwareModelRoutingLock sync.RWMutex

func ImageAwareModelRouting2JSONString() string {
	imageAwareModelRoutingLock.RLock()
	defer imageAwareModelRoutingLock.RUnlock()
	data, err := common.Marshal(imageAwareModelRouting)
	if err != nil {
		return "{}"
	}
	return string(data)
}

func UpdateImageAwareModelRoutingByJSONString(value string) error {
	newMap := make(map[string]ImageAwareRouteRule)
	if value != "" {
		if err := common.Unmarshal([]byte(value), &newMap); err != nil {
			return err
		}
	}
	imageAwareModelRoutingLock.Lock()
	imageAwareModelRouting = newMap
	imageAwareModelRoutingLock.Unlock()
	return nil
}

func GetImageAwareRouteRule(model string) (ImageAwareRouteRule, bool) {
	imageAwareModelRoutingLock.RLock()
	defer imageAwareModelRoutingLock.RUnlock()
	rule, ok := imageAwareModelRouting[model]
	return rule, ok
}
