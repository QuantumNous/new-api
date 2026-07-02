package constant

// 图片 / 视频模型能力枚举（中文即值），需与前端
// web/classic/src/constants/imagePlayground.constants.js 的 IMAGE_CAPABILITIES
// 与 videoPlayground.constants.js 的 VIDEO_CAPABILITIES 保持一致。
// 这些能力由运营设置里逐模型声明，作为「能力标签」在模型广场展示。
var ImageCapabilities = []string{
	"文生图",
	"图生图",
	"图像编辑",
	"局部重绘",
	"扩图",
	"高清放大",
}

var VideoCapabilities = []string{
	"文生视频",
	"图生视频",
	"首尾帧",
	"参考生视频",
	"音频驱动",
	"视频转视频",
}

// IsCapabilityTag 判断某个标签词是否属于能力词表（图片或视频）。
// 用于模型广场对标签归类去重：命中者归入「模型能力」分类。
func IsCapabilityTag(tag string) bool {
	for _, c := range ImageCapabilities {
		if c == tag {
			return true
		}
	}
	for _, c := range VideoCapabilities {
		if c == tag {
			return true
		}
	}
	return false
}
