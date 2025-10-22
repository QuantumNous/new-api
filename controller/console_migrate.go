// 用于迁移检测的旧键，该文件下个版本会删除

package controller

import (
	"encoding/json"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// MigrateConsoleSetting 迁移旧的控制台相关配置到 console_setting.*
func MigrateConsoleSetting(c *gin.Context) {
	// 读取全部 option
	opts, err := model.AllOption()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	// 建立 map
	valMap := map[string]string{}
	for _, o := range opts {
		valMap[o.Key] = o.Value
	}

	// 处理 APIInfo
	if v := valMap["ApiInfo"]; v != "" {
		var arr []map[string]interface{}
		if err := json.Unmarshal([]byte(v), &arr); err == nil {
			if len(arr) > 50 {
				arr = arr[:50]
			}
			bytes, _ := json.Marshal(arr)
			model.UpdateOption("console_setting.api_info", string(bytes))
		}
		model.UpdateOption("ApiInfo", "")
	}
	// Announcements 直接搬
	if v := valMap["Announcements"]; v != "" {
		model.UpdateOption("console_setting.announcements", v)
		model.UpdateOption("Announcements", "")
	}
	// FAQ 转换
	if v := valMap["FAQ"]; v != "" {
		var arr []map[string]interface{}
		if err := json.Unmarshal([]byte(v), &arr); err == nil {
			out := []map[string]interface{}{}
			for _, item := range arr {
				q, _ := item["question"].(string)
				if q == "" {
					q, _ = item["title"].(string)
				}
				a, _ := item["answer"].(string)
				if a == "" {
					a, _ = item["content"].(string)
				}
				if q != "" && a != "" {
					out = append(out, map[string]interface{}{"question": q, "answer": a})
				}
			}
			if len(out) > 50 {
				out = out[:50]
			}
			bytes, _ := json.Marshal(out)
			model.UpdateOption("console_setting.faq", string(bytes))
		}
		model.UpdateOption("FAQ", "")
	}
	// Uptime Kuma 迁移到新的 groups 结构（console_setting.uptime_kuma_groups）
	url := valMap["UptimeKumaUrl"]
	slug := valMap["UptimeKumaSlug"]
	if url != "" && slug != "" {
		// 仅当同时存在 URL 与 Slug 时才进行迁移
		groups := []map[string]interface{}{
			{
				"id":           1,
				"categoryName": "old",
				"url":          url,
				"slug":         slug,
				"description":  "",
			},
		}
		bytes, _ := json.Marshal(groups)
		model.UpdateOption("console_setting.uptime_kuma_groups", string(bytes))
	}
	// 清空旧键内容
	if url != "" {
		model.UpdateOption("UptimeKumaUrl", "")
	}
	if slug != "" {
		model.UpdateOption("UptimeKumaSlug", "")
	}

	// 删除旧键记录
	oldKeys := []string{"ApiInfo", "Announcements", "FAQ", "UptimeKumaUrl", "UptimeKumaSlug"}
	model.DB.Where("key IN ?", oldKeys).Delete(&model.Option{})

	// 重新加载 OptionMap
	model.InitOptionMap()
	common.SysLog("console setting migrated")
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "migrated"})
}
