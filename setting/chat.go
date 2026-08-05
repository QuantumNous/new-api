package setting

import (
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
)

// chats 前端展示的第三方客户端跳转配置。
//
// 与敏感词、自动分组同理：热更新原先先清空再重填，读者可能读到中间态。改为整体发布。
var chats atomic.Pointer[[]map[string]string]

var defaultChats = []map[string]string{
	//{
	//	"ChatGPT Next Web 官方示例": "https://app.nextchat.dev/#/?settings={\"key\":\"{key}\",\"url\":\"{address}\"}",
	//},
	{
		"Cherry Studio": "cherrystudio://providers/api-keys?v=1&data={cherryConfig}",
	},
	{
		"AionUI": "aionui://provider/add?v=1&data={aionuiConfig}",
	},
	{
		"流畅阅读": "fluentread",
	},
	{
		"CC Switch": "ccswitch",
	},
	{
		"DeepChat": "deepchat://provider/install?v=1&data={deepchatConfig}",
	},
	{
		"Lobe Chat 官方示例": "https://chat-preview.lobehub.com/?settings={\"keyVaults\":{\"openai\":{\"apiKey\":\"{key}\",\"baseURL\":\"{address}/v1\"}}}",
	},
	{
		"AI as Workspace": "https://aiaw.app/set-provider?provider={\"type\":\"openai\",\"settings\":{\"apiKey\":\"{key}\",\"baseURL\":\"{address}/v1\",\"compatibility\":\"strict\"}}",
	},
	{
		"AMA 问天": "ama://set-api-key?server={address}&key={key}",
	},
	{
		"OpenCat": "opencat://team/join?domain={address}&token={key}",
	},
}

func init() {
	chats.Store(&defaultChats)
}

// GetChats 返回当前客户端跳转配置。返回的切片不得被调用方修改。
func GetChats() []map[string]string {
	return *chats.Load()
}

func UpdateChatsByJsonString(jsonString string) error {
	parsed := make([]map[string]string, 0)
	if err := common.Unmarshal([]byte(jsonString), &parsed); err != nil {
		return err
	}
	chats.Store(&parsed)
	return nil
}

func Chats2JsonString() string {
	jsonBytes, err := common.Marshal(GetChats())
	if err != nil {
		common.SysLog("error marshalling chats: " + err.Error())
		return "[]"
	}
	return string(jsonBytes)
}
