package controller

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Only split an explicit counted list in the template's requirements field.
// Product measurements and ordinary prompts must never become image counts.
var drawingRequirementsHeader = regexp.MustCompile(`(?im)(?:^|\n)[\t ]*(?:本次图片需求|本次圖片需求|Image requirements|Requirements for this image)[\t ]*[:：]`)
var drawingRequirementCount = regexp.MustCompile(`(?i)(?:^|[;；\n])[\t\r\n ]*([0-9]+)[\t ]*(?:张|張|images?)[\t ]*[:：]?[\t ]*`)

func splitDrawingRequirements(prompt string, count int) ([]DrawingPlanItem, string) {
	header := drawingRequirementsHeader.FindStringIndex(prompt)
	if header == nil {
		return nil, ""
	}
	requirements := strings.TrimSpace(prompt[header[1]:])
	entries := drawingRequirementCount.FindAllStringSubmatchIndex(requirements, -1)
	if len(entries) == 0 {
		return nil, ""
	}
	if entries[0][0] != 0 {
		return nil, "图片需求清单请从“1张：具体要求”开始，每项用分号或换行分隔"
	}
	shared := strings.TrimSpace(prompt[:header[0]])
	items := make([]DrawingPlanItem, 0, count)
	for i, entry := range entries {
		quantity, err := strconv.Atoi(requirements[entry[2]:entry[3]])
		if err != nil || quantity < 1 || quantity > count-len(items) {
			return nil, "图片需求清单的总张数必须与生成数量一致，请检查后重新提交"
		}
		end := len(requirements)
		if i+1 < len(entries) {
			end = entries[i+1][0]
		}
		description := strings.Trim(requirements[entry[1]:end], " \t\r\n;；")
		if description == "" {
			return nil, "图片需求清单中的每一项都需要填写具体要求"
		}
		for variant := 1; variant <= quantity; variant++ {
			instruction := "只生成当前任务的一张独立成品图。不要把整套商品图片拼成海报、缩略图集合或联系表。当前任务明确要求的多角度对比、尺寸标注或细节展示可以保留在同一张成品图中。遵守产品资料中指定的图片语言，不要把任务编号或这些执行说明画在图片上。"
			if quantity > 1 {
				instruction += fmt.Sprintf("\n这是同类需求的第%d/%d张：将该需求中已有的卖点、细节或场景按顺序分配，每张突出不同重点，并采用不同视角和构图；不足时仅改变视角和构图，不虚构产品功能或参数。本张只呈现第%d张对应的重点。", variant, quantity, variant)
			}
			items = append(items, DrawingPlanItem{
				Title:  fmt.Sprintf("%02d", len(items)+1),
				Prompt: shared + "\n\n当前单张图片需求：" + description + "\n\n" + instruction,
			})
		}
	}
	if len(items) != count {
		return nil, "图片需求清单的总张数必须与生成数量一致，请检查后重新提交"
	}
	if count == 1 {
		return nil, ""
	}
	return items, ""
}
