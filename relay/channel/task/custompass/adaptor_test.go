package custompass

import (
	"encoding/json"
	"testing"

	"github.com/gin-gonic/gin"
	"one-api/dto"
)

func TestExtractUsageFromResponse(t *testing.T) {
	// 初始化gin context
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	
	adaptor := &TaskAdaptor{}

	// 测试用例1：根级别usage字段
	t.Run("Root level usage", func(t *testing.T) {
		responseData := map[string]interface{}{
			"code": 0,
			"msg":  "success",
			"usage": map[string]interface{}{
				"prompt_tokens":     100,
				"completion_tokens": 50,
				"total_tokens":      150,
			},
		}
		
		responseBody, _ := json.Marshal(responseData)
		adaptor.extractUsageFromResponse(responseBody, c)
		
		// 检查是否正确提取了usage信息
		if usageInterface, exists := c.Get("custompass_usage"); exists {
			usage := usageInterface.(*dto.Usage)
			if usage.PromptTokens != 100 || usage.CompletionTokens != 50 || usage.TotalTokens != 150 {
				t.Errorf("Expected usage: prompt=100, completion=50, total=150, got: prompt=%d, completion=%d, total=%d",
					usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens)
			}
		} else {
			t.Error("Expected usage to be extracted and stored in context")
		}
	})

	// 测试用例2：data.usage字段
	t.Run("Data level usage", func(t *testing.T) {
		c, _ := gin.CreateTestContext(nil) // 重新创建context
		
		responseData := map[string]interface{}{
			"code": 0,
			"msg":  "success",
			"data": map[string]interface{}{
				"task_id": "test-task-123",
				"usage": map[string]interface{}{
					"prompt_tokens":     200,
					"completion_tokens": 100,
					"total_tokens":      300,
				},
			},
		}
		
		responseBody, _ := json.Marshal(responseData)
		adaptor.extractUsageFromResponse(responseBody, c)
		
		// 检查是否正确提取了usage信息
		if usageInterface, exists := c.Get("custompass_usage"); exists {
			usage := usageInterface.(*dto.Usage)
			if usage.PromptTokens != 200 || usage.CompletionTokens != 100 || usage.TotalTokens != 300 {
				t.Errorf("Expected usage: prompt=200, completion=100, total=300, got: prompt=%d, completion=%d, total=%d",
					usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens)
			}
		} else {
			t.Error("Expected usage to be extracted and stored in context")
		}
	})

	// 测试用例3：无usage信息
	t.Run("No usage information", func(t *testing.T) {
		c, _ := gin.CreateTestContext(nil) // 重新创建context
		
		responseData := map[string]interface{}{
			"code": 0,
			"msg":  "success",
			"data": map[string]interface{}{
				"task_id": "test-task-123",
			},
		}
		
		responseBody, _ := json.Marshal(responseData)
		adaptor.extractUsageFromResponse(responseBody, c)
		
		// 检查是否没有设置usage信息
		if _, exists := c.Get("custompass_usage"); exists {
			t.Error("Expected no usage to be stored in context when no usage information is present")
		}
	})

	// 测试用例4：无效JSON
	t.Run("Invalid JSON", func(t *testing.T) {
		c, _ := gin.CreateTestContext(nil) // 重新创建context
		
		responseBody := []byte("invalid json")
		adaptor.extractUsageFromResponse(responseBody, c)
		
		// 检查是否没有设置usage信息
		if _, exists := c.Get("custompass_usage"); exists {
			t.Error("Expected no usage to be stored in context when JSON is invalid")
		}
	})
}

func TestParseUsageFromInterface(t *testing.T) {
	adaptor := &TaskAdaptor{}

	// 测试用例1：完整的usage信息
	t.Run("Complete usage info", func(t *testing.T) {
		usageData := map[string]interface{}{
			"prompt_tokens":     float64(100),
			"completion_tokens": float64(50),
			"total_tokens":      float64(150),
		}
		
		usage := adaptor.parseUsageFromInterface(usageData)
		if usage == nil {
			t.Fatal("Expected usage to be parsed successfully")
		}
		
		if usage.PromptTokens != 100 || usage.CompletionTokens != 50 || usage.TotalTokens != 150 {
			t.Errorf("Expected usage: prompt=100, completion=50, total=150, got: prompt=%d, completion=%d, total=%d",
				usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens)
		}
	})

	// 测试用例2：缺少total_tokens，应该自动计算
	t.Run("Missing total_tokens", func(t *testing.T) {
		usageData := map[string]interface{}{
			"prompt_tokens":     float64(100),
			"completion_tokens": float64(50),
		}
		
		usage := adaptor.parseUsageFromInterface(usageData)
		if usage == nil {
			t.Fatal("Expected usage to be parsed successfully")
		}
		
		if usage.TotalTokens != 150 {
			t.Errorf("Expected total_tokens to be calculated as 150, got: %d", usage.TotalTokens)
		}
	})

	// 测试用例3：无效数据类型
	t.Run("Invalid data type", func(t *testing.T) {
		usageData := "invalid data type"
		
		usage := adaptor.parseUsageFromInterface(usageData)
		if usage != nil {
			t.Error("Expected usage to be nil for invalid data type")
		}
	})

	// 测试用例4：空的usage信息
	t.Run("Empty usage info", func(t *testing.T) {
		usageData := map[string]interface{}{}
		
		usage := adaptor.parseUsageFromInterface(usageData)
		if usage != nil {
			t.Error("Expected usage to be nil for empty usage info")
		}
	})
}

func TestSubmitResponseDataTypes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// 测试用例1：data字段是map类型，包含task_id
	t.Run("Data as map with task_id", func(t *testing.T) {
		responseData := map[string]interface{}{
			"code": 0,
			"msg":  "success",
			"data": map[string]interface{}{
				"task_id": "test-task-123",
				"status":  "submitted",
			},
		}

		responseBody, _ := json.Marshal(responseData)

		// 直接测试JSON解析
		var submitResp SubmitResponse
		err := json.Unmarshal(responseBody, &submitResp)
		if err != nil {
			t.Fatalf("Failed to unmarshal response: %v", err)
		}

		// 验证data字段类型
		if submitResp.Data == nil {
			t.Fatal("Expected data field to be present")
		}

		// 验证可以从map类型的data中提取task_id
		if dataMap, ok := submitResp.Data.(map[string]interface{}); ok {
			if taskId, exists := dataMap["task_id"]; exists {
				if taskIdStr, ok := taskId.(string); ok {
					if taskIdStr != "test-task-123" {
						t.Errorf("Expected task_id to be 'test-task-123', got: %s", taskIdStr)
					}
				} else {
					t.Error("Expected task_id to be string type")
				}
			} else {
				t.Error("Expected task_id to exist in data map")
			}
		} else {
			t.Error("Expected data to be map[string]interface{} type")
		}
	})

	// 测试用例2：data字段是字符串类型
	t.Run("Data as string", func(t *testing.T) {
		responseData := map[string]interface{}{
			"code": 0,
			"msg":  "success",
			"data": "task-id-string-123",
		}

		responseBody, _ := json.Marshal(responseData)

		// 直接测试JSON解析
		var submitResp SubmitResponse
		err := json.Unmarshal(responseBody, &submitResp)
		if err != nil {
			t.Fatalf("Failed to unmarshal response: %v", err)
		}

		// 验证data字段类型
		if submitResp.Data == nil {
			t.Fatal("Expected data field to be present")
		}

		// 验证data是字符串类型
		if dataStr, ok := submitResp.Data.(string); ok {
			if dataStr != "task-id-string-123" {
				t.Errorf("Expected data to be 'task-id-string-123', got: %s", dataStr)
			}
		} else {
			t.Errorf("Expected data to be string type, got: %T", submitResp.Data)
		}
	})

	// 测试用例3：data字段是数字类型
	t.Run("Data as number", func(t *testing.T) {
		responseData := map[string]interface{}{
			"code": 0,
			"msg":  "success",
			"data": 12345,
		}

		responseBody, _ := json.Marshal(responseData)

		// 直接测试JSON解析
		var submitResp SubmitResponse
		err := json.Unmarshal(responseBody, &submitResp)
		if err != nil {
			t.Fatalf("Failed to unmarshal response: %v", err)
		}

		// 验证data字段类型
		if submitResp.Data == nil {
			t.Fatal("Expected data field to be present")
		}

		// 验证data是数字类型（JSON解析后会是float64）
		if dataNum, ok := submitResp.Data.(float64); ok {
			if dataNum != 12345 {
				t.Errorf("Expected data to be 12345, got: %f", dataNum)
			}
		} else {
			t.Errorf("Expected data to be float64 type, got: %T", submitResp.Data)
		}
	})
}
