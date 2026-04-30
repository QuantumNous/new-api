/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package controller

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// PerformUpdate triggers a Watchtower-based container image update.
// Requires WATCHTOWER_API_TOKEN and WATCHTOWER_API_URL to be set in the environment.
// POST /api/system/update
func PerformUpdate(c *gin.Context) {
	userId := c.GetInt("id")
	token := os.Getenv("WATCHTOWER_API_TOKEN")
	apiURL := os.Getenv("WATCHTOWER_API_URL")

	if token == "" || apiURL == "" {
		common.SysLog(fmt.Sprintf("system update failed: Watchtower not configured (user %d)", userId))
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "升级服务未配置，请在 docker-compose.yml 中设置 WATCHTOWER_API_TOKEN 和 WATCHTOWER_API_URL",
		})
		return
	}

	common.SysLog(fmt.Sprintf("user %d triggered system update via Watchtower", userId))

	url := fmt.Sprintf("%s/v1/update", apiURL)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, url, nil)
	if err != nil {
		common.SysLog(fmt.Sprintf("system update: failed to create request: %s (user %d)", err.Error(), userId))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "创建升级请求失败: " + err.Error(),
		})
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		common.SysLog(fmt.Sprintf("system update: Watchtower connection failed: %s (user %d)", err.Error(), userId))
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "无法连接升级服务，请确认 Watchtower 容器正在运行",
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			body = []byte("(unable to read response)")
		}
		common.SysLog(fmt.Sprintf("system update: Watchtower returned %d: %s (user %d)", resp.StatusCode, string(body), userId))
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": fmt.Sprintf("升级服务返回错误 %d: %s", resp.StatusCode, string(body)),
		})
		return
	}

	common.SysLog(fmt.Sprintf("system update: command sent successfully (user %d)", userId))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "升级指令已发送，容器正在重建，请稍候...",
	})
}
