package operation_setting

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// ImageAwareRouteRule 描述一条「虚拟入口模型」的路由规则。
// 用户在客户端发送入口模型名（如 auto-coder），网关根据当前请求最后一条
// user 消息是否含图片，改写为 VisionModel 或 CodingModel。
type ImageAwareRouteRule struct {
	VisionModel string `json:"vision_model"`
	CodingModel string `json:"coding_model"`
}

// ImageAwareModelRouting 保存所有入口模型名 -> 规则 的映射。
// 空 map 表示功能关闭（无入口模型会被匹配）。
var ImageAwareModelRouting = map[string]ImageAwareRouteRule{}

var imageAwareModelRoutingLock sync.RWMutex

// ImageAwareModelRouting2JSONString 将当前内存中的路由规则序列化为 JSON 字符串。
func ImageAwareModelRouting2JSONString() string {
	imageAwareModelRoutingLock.RLock()
	defer imageAwareModelRoutingLock.RUnlock()
	data, err := common.Marshal(ImageAwareModelRouting)
	if err != nil {
		return "{}"
	}
	return string(data)
}

// UpdateImageAwareModelRoutingByJSONString 从 JSON 字符串反序列化并替换内存中的路由规则。
func UpdateImageAwareModelRoutingByJSONString(value string) error {
	newMap := make(map[string]ImageAwareRouteRule)
	if value != "" {
		if err := common.Unmarshal([]byte(value), &newMap); err != nil {
			return err
		}
	}
	imageAwareModelRoutingLock.Lock()
	ImageAwareModelRouting = newMap
	imageAwareModelRoutingLock.Unlock()
	return nil
}

// GetImageAwareRouteRule 查询某个模型名是否为配置好的入口模型，并返回对应规则。
func GetImageAwareRouteRule(model string) (ImageAwareRouteRule, bool) {
	imageAwareModelRoutingLock.RLock()
	defer imageAwareModelRoutingLock.RUnlock()
	rule, ok := ImageAwareModelRouting[model]
	return rule, ok
}
