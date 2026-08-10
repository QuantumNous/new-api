package model

import "encoding/json"

// InitPublicSiteDefaults 在首次启动（表为空）时写入营销站默认的定价方案与模型目录，
// 提供中英双语。仅在表为空时插入，避免重复写入。
func InitPublicSiteDefaults() {
	if DB == nil {
		return
	}
	var pricingCount int64
	if err := DB.Model(&PublicPricing{}).Count(&pricingCount).Error; err != nil {
		return
	}
	if pricingCount == 0 {
		pricings := defaultPublicPricings()
		_ = DB.Create(&pricings).Error
	}

	var catCount int64
	if err := DB.Model(&PublicModelCategory{}).Count(&catCount).Error; err != nil {
		return
	}
	if catCount == 0 {
		cats := defaultPublicModelCategories()
		_ = DB.Create(&cats).Error
	}
}

func defaultPublicPricings() []PublicPricing {
	paygFeatures, _ := json.Marshal([]string{
		"按实际 token 用量计费，无月费",
		"全模型统一接入，无需逐家签约",
		"即时开通，按量结算",
	})
	proFeatures, _ := json.Marshal([]string{
		"每月固定额度，单价更优",
		"优先队列与更高并发",
		"团队子账号与用量看板",
	})
	entFeatures, _ := json.Marshal([]string{
		"专属 SLA 与区域路由",
		"定制模型与私有部署",
		"专属客户成功经理",
	})
	return []PublicPricing{
		{PlanKey: "payg", Locale: "en", Title: "Pay as you go", Description: "Token-based pricing, no monthly fee.", BillingMode: "payg", PriceText: "Per-token", Features: string(paygFeatures), Sort: 1, Enabled: true},
		{PlanKey: "payg", Locale: "zh", Title: "按量计费", Description: "按实际 token 用量计费，无月费。", BillingMode: "payg", PriceText: "按 token", Features: string(paygFeatures), Sort: 1, Enabled: true},
		{PlanKey: "pro", Locale: "en", Title: "Pro", Description: "Monthly quota with better unit price.", BillingMode: "subscription", PriceText: "$49 / month", Features: string(proFeatures), Sort: 2, Enabled: true},
		{PlanKey: "pro", Locale: "zh", Title: "专业版", Description: "每月固定额度，单价更优。", BillingMode: "subscription", PriceText: "￥299 / 月", Features: string(proFeatures), Sort: 2, Enabled: true},
		{PlanKey: "enterprise", Locale: "en", Title: "Enterprise", Description: "Dedicated SLA, regional routing, custom models.", BillingMode: "custom", PriceText: "Contact sales", Features: string(entFeatures), Sort: 3, Enabled: true},
		{PlanKey: "enterprise", Locale: "zh", Title: "企业版", Description: "专属 SLA、区域路由与定制模型。", BillingMode: "custom", PriceText: "联系销售", Features: string(entFeatures), Sort: 3, Enabled: true},
	}
}

func defaultPublicModelCategories() []PublicModelCategory {
	chinese, _ := json.Marshal([]map[string]string{
		{"name": "DeepSeek", "capability_tags": "reasoning, chat", "note": "国产强推理模型"},
		{"name": "Qwen", "capability_tags": "chat, vision", "note": "通义千问全系列"},
		{"name": "GLM", "capability_tags": "chat, agent", "note": "智谱 GLM 系列"},
		{"name": "Doubao", "capability_tags": "chat, vision", "note": "字节豆包"},
		{"name": "Kimi", "capability_tags": "long-context", "note": "月之暗面长上下文"},
		{"name": "Hunyuan", "capability_tags": "chat", "note": "腾讯混元"},
	})
	global, _ := json.Marshal([]map[string]string{
		{"name": "OpenAI", "capability_tags": "chat, vision, audio", "note": "GPT 全系列"},
		{"name": "Anthropic", "capability_tags": "chat, agent", "note": "Claude 全系列"},
		{"name": "Google", "capability_tags": "chat, vision", "note": "Gemini 全系列"},
		{"name": "Meta", "capability_tags": "chat", "note": "Llama 开源系列"},
		{"name": "Mistral", "capability_tags": "chat", "note": "欧洲开源模型"},
	})
	image, _ := json.Marshal([]map[string]string{
		{"name": "DALL·E", "capability_tags": "image", "note": "OpenAI 文生图"},
		{"name": "Midjourney", "capability_tags": "image", "note": "艺术风格图像"},
		{"name": "Stable Diffusion", "capability_tags": "image", "note": "开源文生图"},
		{"name": "Flux", "capability_tags": "image", "note": "高质感图像"},
	})
	video, _ := json.Marshal([]map[string]string{
		{"name": "Runway", "capability_tags": "video", "note": "文生视频"},
		{"name": "Kling", "capability_tags": "video", "note": "可灵文生视频"},
		{"name": "Sora", "capability_tags": "video", "note": "OpenAI 视频生成"},
	})
	audio, _ := json.Marshal([]map[string]string{
		{"name": "Whisper", "capability_tags": "audio", "note": "语音识别"},
		{"name": "TTS", "capability_tags": "audio", "note": "语音合成"},
		{"name": "Suno", "capability_tags": "audio", "note": "音乐生成"},
	})
	embedding, _ := json.Marshal([]map[string]string{
		{"name": "text-embedding", "capability_tags": "embedding", "note": "文本向量"},
		{"name": "bge", "capability_tags": "embedding", "note": "开源嵌入模型"},
	})
	return []PublicModelCategory{
		{Category: "chinese", Locale: "en", Title: "Chinese LLMs", Description: "Top open & commercial large models from China.", Models: string(chinese), Sort: 1, Enabled: true},
		{Category: "chinese", Locale: "zh", Title: "中国大模型", Description: "国内头部开源与商业大模型统一接入。", Models: string(chinese), Sort: 1, Enabled: true},
		{Category: "global", Locale: "en", Title: "Global LLMs", Description: "Leading models from OpenAI, Anthropic, Google and more.", Models: string(global), Sort: 2, Enabled: true},
		{Category: "global", Locale: "zh", Title: "海外大模型", Description: "OpenAI、Anthropic、Google 等全球领先模型。", Models: string(global), Sort: 2, Enabled: true},
		{Category: "image", Locale: "en", Title: "Image Generation", Description: "Text-to-image models for product & creative use.", Models: string(image), Sort: 3, Enabled: true},
		{Category: "image", Locale: "zh", Title: "图像生成", Description: "面向产品与创作的文生图模型。", Models: string(image), Sort: 3, Enabled: true},
		{Category: "video", Locale: "en", Title: "Video Generation", Description: "Text-to-video for marketing and storytelling.", Models: string(video), Sort: 4, Enabled: true},
		{Category: "video", Locale: "zh", Title: "视频生成", Description: "面向营销与叙事的文生视频。", Models: string(video), Sort: 4, Enabled: true},
		{Category: "audio", Locale: "en", Title: "Audio", Description: "Speech recognition, TTS and music generation.", Models: string(audio), Sort: 5, Enabled: true},
		{Category: "audio", Locale: "zh", Title: "语音与音乐", Description: "语音识别、语音合成与音乐生成。", Models: string(audio), Sort: 5, Enabled: true},
		{Category: "embedding", Locale: "en", Title: "Embeddings", Description: "Vector embeddings for RAG & search.", Models: string(embedding), Sort: 6, Enabled: true},
		{Category: "embedding", Locale: "zh", Title: "向量嵌入", Description: "面向 RAG 与检索的向量嵌入。", Models: string(embedding), Sort: 6, Enabled: true},
	}
}
