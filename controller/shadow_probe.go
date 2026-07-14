package controller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/modelroute"
	"github.com/QuantumNous/new-api/relay"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

var shadowWireOnce sync.Once

// EnsureBilledShadowExecutor installs a shadow executor that goes through the normal
// channel adaptor path so the upstream provider bills like a real request.
// Supports OpenAI Chat / Responses, Claude, and Gemini native formats captured from production traffic.
func EnsureBilledShadowExecutor() {
	shadowWireOnce.Do(func() {
		modelroute.EnsureDefaultShadowWiring()
		if modelroute.GlobalShadowDispatcher != nil {
			modelroute.GlobalShadowDispatcher.Executor = BilledRelayShadowExecutor
			modelroute.GlobalShadowDispatcher.Builder = modelroute.TextShadowBuilder{}
		}
		modelroute.WireShadowExecutor = EnsureBilledShadowExecutor
	})
	if modelroute.GlobalShadowDispatcher != nil && modelroute.GlobalShadowDispatcher.Executor == nil {
		modelroute.GlobalShadowDispatcher.Executor = BilledRelayShadowExecutor
	}
}

func BilledRelayShadowExecutor(ctx context.Context, req *modelroute.ShadowRequest) modelroute.ShadowResult {
	out := modelroute.ShadowResult{BuildResult: modelroute.ShadowTransportFailure, TransportOK: false}
	if req == nil || req.ChannelID <= 0 {
		return out
	}
	if ctx == nil {
		ctx = context.Background()
	}

	ch, err := loadChannelForBilledShadow(int(req.ChannelID))
	if err != nil || ch == nil || ch.Status != common.ChannelStatusEnabled {
		return out
	}

	capture := modelroute.LookupShadowCapture(req.SourceRequestIDHint(), req.RequestedModel)
	userID := 0
	group := "default"
	tokenName := "影子探测"
	tokenID := 0
	requestID := ""
	relayFormat := types.RelayFormatOpenAI
	requestPath := "/v1/chat/completions"
	if capture != nil {
		userID = capture.UserID
		if capture.Group != "" {
			group = capture.Group
		}
		if capture.TokenName != "" {
			tokenName = capture.TokenName
		}
		tokenID = capture.TokenID
		requestID = capture.RequestID
		if capture.RelayFormat != "" {
			relayFormat = types.RelayFormat(capture.RelayFormat)
		}
		if capture.RequestPath != "" {
			requestPath = capture.RequestPath
		}
	}
	if userID <= 0 {
		var root model.User
		if e := model.DB.Select("id").Where("role = ?", common.RoleRootUser).First(&root).Error; e == nil {
			userID = root.Id
		}
	}
	if userID <= 0 {
		return out
	}

	modelName := req.EffectiveModel
	if modelName == "" {
		modelName = req.RequestedModel
	}
	if modelName == "" && capture != nil {
		modelName = capture.OriginModel
	}
	if modelName == "" {
		return out
	}

	// Build native request for the captured format (full production-derived text, no tools, no ping).
	dtoReq, ok := buildShadowDTORequest(req, capture, modelName, relayFormat)
	if !ok || dtoReq == nil {
		return out
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	// Gemini path must include model in URL for some adaptors
	if relayFormat == types.RelayFormatGemini {
		requestPath = "/v1beta/models/" + modelName + ":generateContent"
	}
	c.Request = httptest.NewRequestWithContext(ctx, http.MethodPost, requestPath, nil)
	c.Request.Header.Set("Content-Type", "application/json")
	if requestID != "" {
		c.Set(common.RequestIdKey, requestID+"-shadow")
	}

	if cache, e := model.GetUserCache(userID); e == nil && cache != nil {
		cache.WriteContext(c)
	}
	c.Set("id", userID)
	c.Set("channel", ch.Type)
	c.Set("base_url", ch.GetBaseURL())
	if group == "" || group == "default" {
		if g, e := model.GetUserGroup(userID, false); e == nil && g != "" {
			group = g
		}
	}
	c.Set("group", group)

	if apiErr := middleware.SetupContextForSelectedChannel(c, ch, modelName); apiErr != nil {
		return out
	}

	info, err := relaycommon.GenRelayInfo(c, relayFormat, dtoReq, nil)
	if err != nil {
		return out
	}
	info.IsChannelTest = true
	info.InitChannelMeta(c)

	if err := helper.ModelMappedHelper(c, info, dtoReq); err != nil {
		return out
	}
	dtoReq.SetModelName(info.UpstreamModelName)

	apiType, _ := common.ChannelType2APIType(ch.Type)
	adaptor := relay.GetAdaptor(apiType)
	if adaptor == nil {
		return out
	}
	adaptor.Init(info)

	converted, err := convertShadowRequest(c, info, adaptor, dtoReq, relayFormat)
	if err != nil || converted == nil {
		return out
	}
	jsonData, err := common.Marshal(converted)
	if err != nil {
		return out
	}
	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return out
		}
	}

	start := time.Now()
	c.Request.Body = io.NopCloser(bytes.NewReader(jsonData))
	respAny, err := adaptor.DoRequest(c, info, bytes.NewReader(jsonData))
	if err != nil {
		logger.LogDebug(c, "shadow DoRequest failed channel=%d model=%s format=%s err=%v", ch.Id, modelName, relayFormat, err)
		return out
	}
	httpResp, _ := respAny.(*http.Response)
	if httpResp == nil {
		return out
	}
	defer httpResp.Body.Close()

	usageAny, respErr := adaptor.DoResponse(c, httpResp, info)
	lat := time.Since(start)
	out.TotalLatency = lat
	out.TTFT = lat
	out.StatusCode = httpResp.StatusCode

	if respErr != nil || httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 {
		out.TransportOK = false
		out.BuildResult = modelroute.ShadowTransportFailure
		return out
	}

	out.TransportOK = true
	out.BuildResult = modelroute.ShadowBuildOK

	usage := coerceShadowUsage(usageAny)
	if usage != nil {
		priceData, priceErr := helper.ModelPriceHelper(c, info, usage.PromptTokens, dtoReq.GetTokenCountMeta())
		quota := 0
		if priceErr == nil {
			quota = settleShadowQuota(info, priceData, usage)
		}
		model.RecordConsumeLog(c, userID, model.RecordConsumeLogParams{
			ChannelId:        ch.Id,
			PromptTokens:     usage.PromptTokens,
			CompletionTokens: usage.CompletionTokens,
			ModelName:        info.OriginModelName,
			TokenName:        tokenName,
			Quota:            quota,
			Content:          "影子探测",
			TokenId:          tokenID,
			UseTimeSeconds:   int(lat.Seconds()),
			IsStream:         false,
			Group:            group,
			Other: map[string]interface{}{
				"shadow_probe": true,
				"relay_format": string(relayFormat),
				"admin_info": map[string]interface{}{
					"shadow_probe": true,
					"source":       "modelroute",
					"relay_format": string(relayFormat),
				},
			},
		})
		if quota > 0 {
			model.UpdateChannelUsedQuota(ch.Id, quota)
		}
	}
	return out
}

func convertShadowRequest(c *gin.Context, info *relaycommon.RelayInfo, adaptor relaychannel.Adaptor, req dto.Request, format types.RelayFormat) (any, error) {
	switch format {
	case types.RelayFormatOpenAIResponses:
		rr, ok := req.(*dto.OpenAIResponsesRequest)
		if !ok {
			return nil, fmt.Errorf("expected OpenAIResponsesRequest")
		}
		return adaptor.ConvertOpenAIResponsesRequest(c, info, *rr)
	case types.RelayFormatClaude:
		cr, ok := req.(*dto.ClaudeRequest)
		if !ok {
			return nil, fmt.Errorf("expected ClaudeRequest")
		}
		return adaptor.ConvertClaudeRequest(c, info, cr)
	case types.RelayFormatGemini:
		gr, ok := req.(*dto.GeminiChatRequest)
		if !ok {
			return nil, fmt.Errorf("expected GeminiChatRequest")
		}
		return adaptor.ConvertGeminiRequest(c, info, gr)
	default:
		or, ok := req.(*dto.GeneralOpenAIRequest)
		if !ok {
			return nil, fmt.Errorf("expected GeneralOpenAIRequest")
		}
		return adaptor.ConvertOpenAIRequest(c, info, or)
	}
}

func buildShadowDTORequest(req *modelroute.ShadowRequest, capture *modelroute.ProductionShadowCapture, modelName string, format types.RelayFormat) (dto.Request, bool) {
	msgs := req.Messages
	if len(msgs) == 0 && capture != nil {
		msgs = capture.View.Messages
	}
	if len(msgs) == 0 {
		return nil, false
	}
	maxTok := req.MaxTokens
	if maxTok <= 0 && capture != nil && capture.MaxTokens > 0 {
		maxTok = capture.MaxTokens
	}
	if maxTok <= 0 {
		maxTok = model.DefaultShadowProbeMaxTokens
	}
	if capture != nil && capture.MaxTokens > maxTok {
		maxTok = capture.MaxTokens
	}
	streamFalse := false

	switch format {
	case types.RelayFormatOpenAIResponses:
		var instructions []string
		var inputs []string
		for _, m := range msgs {
			text := strings.TrimSpace(m.Text)
			if text == "" {
				continue
			}
			if m.Role == "system" {
				instructions = append(instructions, text)
				continue
			}
			inputs = append(inputs, text)
		}
		if len(inputs) == 0 {
			return nil, false
		}
		input, err := common.Marshal(strings.Join(inputs, "\n"))
		if err != nil {
			return nil, false
		}
		rr := &dto.OpenAIResponsesRequest{
			Model:           modelName,
			Input:           input,
			MaxOutputTokens: lo.ToPtr(uint(maxTok)),
			Stream:          &streamFalse,
		}
		if len(instructions) > 0 {
			rr.Instructions, err = common.Marshal(strings.Join(instructions, "\n"))
			if err != nil {
				return nil, false
			}
		}
		return rr, true

	case types.RelayFormatClaude:
		var system string
		var claudeMsgs []dto.ClaudeMessage
		for _, m := range msgs {
			if m.Role == "system" {
				if system == "" {
					system = m.Text
				} else {
					system += "\n" + m.Text
				}
				continue
			}
			role := m.Role
			if role == "assistant" {
				role = "assistant"
			} else {
				role = "user"
			}
			if strings.TrimSpace(m.Text) == "" {
				continue
			}
			claudeMsgs = append(claudeMsgs, dto.ClaudeMessage{Role: role, Content: m.Text})
		}
		if len(claudeMsgs) == 0 {
			return nil, false
		}
		// Claude requires alternating ending with user ideally; if last is assistant, append nothing extra
		cr := &dto.ClaudeRequest{
			Model:     modelName,
			Messages:  claudeMsgs,
			MaxTokens: lo.ToPtr(uint(maxTok)),
			Stream:    &streamFalse,
			Tools:     nil,
		}
		if system != "" {
			cr.SetStringSystem(system)
		}
		return cr, true

	case types.RelayFormatGemini:
		var contents []dto.GeminiChatContent
		var systemParts []dto.GeminiPart
		for _, m := range msgs {
			if m.Role == "system" {
				if strings.TrimSpace(m.Text) != "" {
					systemParts = append(systemParts, dto.GeminiPart{Text: m.Text})
				}
				continue
			}
			role := m.Role
			if role == "assistant" {
				role = "model"
			} else {
				role = "user"
			}
			if strings.TrimSpace(m.Text) == "" {
				continue
			}
			contents = append(contents, dto.GeminiChatContent{
				Role:  role,
				Parts: []dto.GeminiPart{{Text: m.Text}},
			})
		}
		if len(contents) == 0 {
			return nil, false
		}
		gr := &dto.GeminiChatRequest{
			Contents: contents,
			GenerationConfig: dto.GeminiChatGenerationConfig{
				MaxOutputTokens: lo.ToPtr(uint(maxTok)),
			},
			Tools: nil,
		}
		if len(systemParts) > 0 {
			gr.SystemInstructions = &dto.GeminiChatContent{Parts: systemParts}
		}
		return gr, true

	default:
		outMsgs := make([]dto.Message, 0, len(msgs))
		for _, m := range msgs {
			role := m.Role
			if role == "" {
				role = "user"
			}
			if strings.TrimSpace(m.Text) == "" {
				continue
			}
			outMsgs = append(outMsgs, dto.Message{Role: role, Content: m.Text})
		}
		if len(outMsgs) == 0 {
			return nil, false
		}
		g := &dto.GeneralOpenAIRequest{
			Model:     modelName,
			Messages:  outMsgs,
			Stream:    &streamFalse,
			MaxTokens: lo.ToPtr(uint(maxTok)),
			Tools:     nil,
		}
		return g, true
	}
}

func loadChannelForBilledShadow(id int) (*model.Channel, error) {
	if common.MemoryCacheEnabled {
		if ch, err := model.CacheGetChannel(id); err == nil && ch != nil {
			return ch, nil
		}
	}
	return model.GetChannelById(id, true)
}

func coerceShadowUsage(usageAny any) *dto.Usage {
	switch u := usageAny.(type) {
	case *dto.Usage:
		return u
	case dto.Usage:
		return &u
	default:
		return nil
	}
}

func settleShadowQuota(info *relaycommon.RelayInfo, priceData types.PriceData, usage *dto.Usage) int {
	if usage == nil {
		return 0
	}
	if !priceData.UsePrice {
		quota := usage.PromptTokens + int(float64(usage.CompletionTokens)*priceData.CompletionRatio)
		quota = int(float64(quota) * priceData.ModelRatio)
		if priceData.ModelRatio != 0 && quota <= 0 {
			quota = 1
		}
		return quota
	}
	return int(priceData.ModelPrice * common.QuotaPerUnit)
}

// BuildProductionShadowCaptureFromRelay extracts a capture from a live relay request for later probes.
// Supports OpenAI Chat / Responses, Claude Messages, and Gemini generateContent. No synthetic ping.
func BuildProductionShadowCaptureFromRelay(c *gin.Context, relayInfo *relaycommon.RelayInfo, request dto.Request) *modelroute.ProductionShadowCapture {
	if relayInfo == nil || request == nil {
		return nil
	}
	view := modelroute.ProductionRequestView{
		RequestedModel: relayInfo.OriginModelName,
	}
	maxTokens := 0
	relayFormat := string(relayInfo.RelayFormat)
	requestPath := "/v1/chat/completions"

	switch r := request.(type) {
	case *dto.GeneralOpenAIRequest:
		if r == nil {
			return nil
		}
		fillOpenAIShadowView(&view, r)
		if r.MaxTokens != nil {
			maxTokens = int(*r.MaxTokens)
		} else if r.MaxCompletionTokens != nil {
			maxTokens = int(*r.MaxCompletionTokens)
		}
		if relayFormat == "" {
			relayFormat = string(types.RelayFormatOpenAI)
		}
		requestPath = "/v1/chat/completions"
	case *dto.OpenAIResponsesRequest:
		if r == nil {
			return nil
		}
		fillResponsesShadowView(&view, r)
		if r.MaxOutputTokens != nil {
			maxTokens = int(*r.MaxOutputTokens)
		}
		relayFormat = string(types.RelayFormatOpenAIResponses)
		requestPath = "/v1/responses"
	case *dto.ClaudeRequest:
		if r == nil {
			return nil
		}
		fillClaudeShadowView(&view, r)
		if r.MaxTokens != nil {
			maxTokens = int(*r.MaxTokens)
		} else if r.MaxTokensToSample != nil {
			maxTokens = int(*r.MaxTokensToSample)
		}
		relayFormat = string(types.RelayFormatClaude)
		requestPath = "/v1/messages"
	case *dto.GeminiChatRequest:
		if r == nil {
			return nil
		}
		fillGeminiShadowView(&view, r)
		if r.GenerationConfig.MaxOutputTokens != nil {
			maxTokens = int(*r.GenerationConfig.MaxOutputTokens)
		}
		relayFormat = string(types.RelayFormatGemini)
		requestPath = "/v1beta/models/" + relayInfo.OriginModelName + ":generateContent"
	default:
		return nil
	}

	if len(view.Messages) == 0 {
		return nil
	}
	// require at least one non-empty user/text turn
	hasUserText := false
	for _, m := range view.Messages {
		role := m.Role
		if role == "model" {
			// gemini model role still counts as content but need user for probe independence
			continue
		}
		if (role == "user" || role == "") && strings.TrimSpace(m.Text) != "" {
			hasUserText = true
			break
		}
	}
	if !hasUserText {
		return nil
	}
	for i := len(view.Messages) - 1; i >= 0; i-- {
		if (view.Messages[i].Role == "user" || view.Messages[i].Role == "") && strings.TrimSpace(view.Messages[i].Text) != "" {
			view.TextIndependentComplete = true
			break
		}
	}

	userID := 0
	tokenID := 0
	tokenName := ""
	group := relayInfo.TokenGroup
	if c != nil {
		userID = c.GetInt("id")
		if userID == 0 {
			userID = common.GetContextKeyInt(c, constant.ContextKeyUserId)
		}
		tokenID = common.GetContextKeyInt(c, constant.ContextKeyTokenId)
		tokenName = c.GetString("token_name")
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
		}
	}
	if group == "" {
		group = relayInfo.UsingGroup
	}
	reqID := ""
	if c != nil {
		reqID = c.GetString(common.RequestIdKey)
	}
	return &modelroute.ProductionShadowCapture{
		View:        view,
		UserID:      userID,
		TokenID:     tokenID,
		TokenName:   tokenName,
		Group:       group,
		RequestID:   reqID,
		RequestPath: requestPath,
		RelayFormat: relayFormat,
		OriginModel: relayInfo.OriginModelName,
		MaxTokens:   maxTokens,
	}
}

func fillResponsesShadowView(view *modelroute.ProductionRequestView, r *dto.OpenAIResponsesRequest) {
	if len(r.Instructions) > 0 {
		var instructions string
		if err := common.Unmarshal(r.Instructions, &instructions); err == nil {
			if instructions = strings.TrimSpace(instructions); instructions != "" {
				view.Messages = append(view.Messages, modelroute.ShadowMessage{Role: "system", Text: instructions})
			}
		}
	}

	var texts []string
	for _, input := range r.ParseInput() {
		switch input.Type {
		case "input_image", "input_file":
			view.HasNonTextContent = true
		case "input_text", "":
			if text := strings.TrimSpace(input.Text); text != "" {
				texts = append(texts, text)
			}
		}
	}
	if len(texts) > 0 {
		view.Messages = append(view.Messages, modelroute.ShadowMessage{Role: "user", Text: strings.Join(texts, "\n")})
	}
	if len(r.Tools) > 0 {
		view.HasTools = true
	}
}

func fillOpenAIShadowView(view *modelroute.ProductionRequestView, r *dto.GeneralOpenAIRequest) {
	for _, m := range r.Messages {
		text := ""
		if m.IsStringContent() {
			text = m.StringContent()
		} else {
			view.HasNonTextContent = true
			for _, part := range m.ParseContent() {
				if part.Type == dto.ContentTypeText && part.Text != "" {
					if text != "" {
						text += "\n"
					}
					text += part.Text
				}
			}
		}
		if text == "" && m.Role != "user" {
			continue
		}
		view.Messages = append(view.Messages, modelroute.ShadowMessage{Role: m.Role, Text: text})
	}
	if len(r.Tools) > 0 {
		view.HasTools = true
	}
}

func fillClaudeShadowView(view *modelroute.ProductionRequestView, r *dto.ClaudeRequest) {
	// system → system message
	if r.System != nil {
		if r.IsStringSystem() {
			if sys := strings.TrimSpace(r.GetStringSystem()); sys != "" {
				view.Messages = append(view.Messages, modelroute.ShadowMessage{Role: "system", Text: sys})
			}
		} else {
			var sysParts []string
			for _, media := range r.ParseSystem() {
				if media.Type == "text" || media.Type == "" {
					if t := media.GetText(); t != "" {
						sysParts = append(sysParts, t)
					}
				} else if media.Type == "image" {
					view.HasNonTextContent = true
				}
			}
			if s := strings.Join(sysParts, "\n"); s != "" {
				view.Messages = append(view.Messages, modelroute.ShadowMessage{Role: "system", Text: s})
			}
		}
	}
	if r.Prompt != "" && len(r.Messages) == 0 {
		view.Messages = append(view.Messages, modelroute.ShadowMessage{Role: "user", Text: r.Prompt})
	}
	for _, message := range r.Messages {
		role := message.Role
		if role == "" {
			role = "user"
		}
		text := ""
		if message.IsStringContent() {
			text = message.GetStringContent()
		} else {
			content, _ := message.ParseContent()
			for _, media := range content {
				switch media.Type {
				case "text", "":
					if t := media.GetText(); t != "" {
						if text != "" {
							text += "\n"
						}
						text += t
					}
				case "image":
					view.HasNonTextContent = true
				case "tool_use", "tool_result":
					view.HasTools = true
					// skip tool payloads in shadow replay
				default:
					if t := media.GetText(); t != "" {
						if text != "" {
							text += "\n"
						}
						text += t
					}
				}
			}
		}
		if strings.TrimSpace(text) == "" {
			if role == "user" {
				// keep empty user? skip — unprobeable without text
			}
			continue
		}
		view.Messages = append(view.Messages, modelroute.ShadowMessage{Role: role, Text: text})
	}
	if r.Tools != nil {
		view.HasTools = true
	}
}

func fillGeminiShadowView(view *modelroute.ProductionRequestView, r *dto.GeminiChatRequest) {
	if r.SystemInstructions != nil {
		var parts []string
		for _, p := range r.SystemInstructions.Parts {
			if p.Text != "" {
				parts = append(parts, p.Text)
			}
			if p.InlineData != nil || p.FileData != nil {
				view.HasNonTextContent = true
			}
		}
		if s := strings.Join(parts, "\n"); s != "" {
			view.Messages = append(view.Messages, modelroute.ShadowMessage{Role: "system", Text: s})
		}
	}
	for _, content := range r.Contents {
		role := content.Role
		// gemini: "user" / "model"
		if role == "model" {
			role = "assistant"
		}
		if role == "" {
			role = "user"
		}
		var texts []string
		for _, part := range content.Parts {
			if part.Text != "" {
				texts = append(texts, part.Text)
			}
			if part.InlineData != nil || part.FileData != nil {
				view.HasNonTextContent = true
			}
			if part.FunctionCall != nil || part.FunctionResponse != nil {
				view.HasTools = true
			}
		}
		text := strings.Join(texts, "\n")
		if strings.TrimSpace(text) == "" {
			continue
		}
		view.Messages = append(view.Messages, modelroute.ShadowMessage{Role: role, Text: text})
	}
	if len(r.GetTools()) > 0 {
		view.HasTools = true
	}
}
