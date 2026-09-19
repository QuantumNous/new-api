package controller

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const mugDrawingPrompt = "销售平台：Ozon\n图片语言：俄语\n产品名称：手工绘制的500毫升陶瓷马克杯\n尺寸及参数：高度11.5厘米，宽度14.8厘米\n本次图片需求：1张：白底主图，产品占画面60-80%，四周留10%安全边距；1张：信息图（尺寸、参数、材质）；2张：卖点图，展示核心卖点及细节；2张：真实场景图，展示生活使用场景；1张：对比图，多角度实拍对比（侧面、背面）；"

func TestDrawingSubmissionSplitsProductImageRequirements(t *testing.T) {
	count := 7
	input := drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: mugDrawingPrompt, Count: &count}
	require.Empty(t, validateDrawingSubmission(&input))
	require.Len(t, input.Items, 7)
	roles := []string{"白底主图", "信息图", "卖点图", "卖点图", "真实场景图", "真实场景图", "对比图"}
	for i, item := range input.Items {
		assert.Contains(t, item.Prompt, "500毫升陶瓷马克杯")
		assert.Contains(t, item.Prompt, "图片语言：俄语")
		assert.Contains(t, item.Prompt, roles[i])
		assert.NotContains(t, item.Prompt, "本次图片需求：")
		for _, other := range []string{"白底主图", "信息图", "卖点图", "真实场景图", "对比图"} {
			if other != roles[i] {
				assert.NotContains(t, item.Prompt, other)
			}
		}
	}
	assert.Contains(t, input.Items[0].Prompt, "10%安全边距")
	assert.Contains(t, input.Items[6].Prompt, "侧面、背面")
	assert.NotEqual(t, input.Items[2].Prompt, input.Items[3].Prompt)
	assert.NotEqual(t, input.Items[4].Prompt, input.Items[5].Prompt)
}

func TestDrawingSubmissionRejectsRequirementCountMismatchBeforeCreatingBatch(t *testing.T) {
	r, _ := setupDrawingTests(t)
	count := 6
	response := submitDrawingTestBatch(t, r, drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: mugDrawingPrompt, Count: &count}, nil)
	require.Equal(t, 400, response.Code, response.Body.String())
	var total int64
	require.NoError(t, model.DB.Model(&model.DrawingBatch{}).Count(&total).Error)
	assert.Zero(t, total)
}

func TestDrawingSplitPromptsReachBothImageRequestFormats(t *testing.T) {
	_, pngData := setupDrawingTests(t)
	count := 7
	input := drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: mugDrawingPrompt, Count: &count}
	require.Empty(t, validateDrawingSubmission(&input))
	batch := model.DrawingBatch{ID: uuid.NewString(), Model: input.Model, Group: input.Group, Ratio: input.Ratio}
	require.NoError(t, service.WriteDrawingFile(batch.ID, ".input", pngData))
	for _, reference := range []bool{false, true} {
		batch.HasReference = reference
		for _, plan := range input.Items {
			path, contentType, body, err := drawingRequestBody(&batch, &model.DrawingItem{Prompt: plan.Prompt})
			require.NoError(t, err)
			request := httptest.NewRequest("POST", path, body)
			request.Header.Set("Content-Type", contentType)
			var prompt string
			if reference {
				require.NoError(t, request.ParseMultipartForm(1<<20))
				prompt = request.FormValue("prompt")
				assert.Equal(t, "1", request.FormValue("n"))
				require.NoError(t, request.MultipartForm.RemoveAll())
			} else {
				var payload struct {
					Prompt string
					N      int
				}
				data, err := io.ReadAll(body)
				require.NoError(t, err)
				require.NoError(t, common.Unmarshal(data, &payload))
				prompt = payload.Prompt
				assert.Equal(t, 1, payload.N)
			}
			assert.Equal(t, plan.Prompt, prompt)
			assert.False(t, strings.Contains(prompt, "白底主图") && strings.Contains(prompt, "真实场景图"))
		}
	}
}

func TestDrawingRequirementListValidationAndPromptPreservation(t *testing.T) {
	for _, tc := range []struct {
		name    string
		prompt  string
		count   int
		invalid bool
		split   bool
	}{
		{name: "plain batch remains exact", prompt: "制作一张由7张照片组成的拼图", count: 3},
		{name: "measurements are not requirements", prompt: "产品：1张桌子；2张椅子\n本次图片需求：完整展示家具", count: 2},
		{name: "single explicit collage remains exact", prompt: "本次图片需求：1张：多图拼版海报", count: 1},
		{name: "line separated list", prompt: "产品：马克杯\r\n本次图片需求：\r\n1 张 白底主图\r\n1张 场景图", count: 2, split: true},
		{name: "english list", prompt: "Product: mug\nImage requirements: 1 image: main; 1 image: lifestyle", count: 2, split: true},
		{name: "same role expands", prompt: "本次图片需求：2张：展示杯子的不同细节", count: 2, split: true},
		{name: "too few requirements", prompt: "本次图片需求：1张：主图；1张：场景图", count: 3, invalid: true},
		{name: "default quantity does not increase charge", prompt: mugDrawingPrompt, count: 1, invalid: true},
		{name: "zero quantity", prompt: "本次图片需求：0张：主图；2张：场景图", count: 2, invalid: true},
		{name: "overflow quantity", prompt: "本次图片需求：184467440737095516160张：主图", count: 2, invalid: true},
		{name: "empty requirement", prompt: "本次图片需求：1张：；1张：场景图", count: 2, invalid: true},
		{name: "ambiguous preamble is not discarded", prompt: "本次图片需求：统一用俄语；1张：主图；1张：场景图", count: 2, invalid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input := drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: tc.prompt, Count: &tc.count}
			message := validateDrawingSubmission(&input)
			if tc.invalid {
				require.NotEmpty(t, message)
				assert.Empty(t, input.Items)
				return
			}
			require.Empty(t, message)
			require.Len(t, input.Items, tc.count)
			if tc.split {
				assert.NotEqual(t, input.Items[0].Prompt, input.Items[1].Prompt)
			} else {
				for _, item := range input.Items {
					assert.Equal(t, tc.prompt, item.Prompt)
				}
			}
		})
	}
}

func TestDrawingExplicitPlanTakesPrecedenceOverSharedRequirements(t *testing.T) {
	count := 2
	items := []DrawingPlanItem{{Title: "Main", Prompt: "Exact main prompt"}, {Title: "Scene", Prompt: "Exact scene prompt"}}
	input := drawingSubmission{SubmissionID: uuid.NewString(), Model: "gpt-image-2", Group: "default", Ratio: "3:4", Prompt: mugDrawingPrompt, Count: &count, Items: items}
	require.Empty(t, validateDrawingSubmission(&input))
	assert.Equal(t, items, input.Items)
}
