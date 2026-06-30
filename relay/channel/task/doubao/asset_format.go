package doubao

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

const assetMaxRespSize = 10 << 20 // 10MB

// callAssetAPI 按出口(outbound)的格式执行一次上游资产 API 调用，仅负责传输与解包，不写 HTTP 响应、不计费。
// 返回值：规范化(canonical)结果原始字节、上游业务错误、HTTP 状态码、传输层错误。
func callAssetAPI(ctx context.Context, ob system_setting.AssetOutbound, action string, body []byte) ([]byte, *assetAPIError, int, error) {
	switch ob.EffectiveFormat() {
	case system_setting.AssetFormatVolcengine:
		return callVolcengineFormat(ctx, ob, action, body)
	case system_setting.AssetFormatNewAPI:
		return callNewAPIFormat(ctx, ob, action, body)
	default:
		cf, ok := system_setting.VolcAssetConfig.CustomFormat(ob.EffectiveFormat())
		if !ok {
			return nil, nil, 0, fmt.Errorf("asset outbound %q references unknown custom format %q", ob.EffectiveId(), ob.EffectiveFormat())
		}
		return callCustomFormat(ctx, ob, cf, action, body)
	}
}

// assetHTTPSend 执行一次上游 HTTP 请求并返回原始响应体与状态码。signFn 可选，用于在发送前对请求签名。
func assetHTTPSend(ctx context.Context, method, requestURL string, headers map[string]string, body []byte, signFn func(*http.Request)) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, method, requestURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create upstream request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Accept", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if signFn != nil {
		signFn(req)
	}

	client, err := service.GetHttpClientWithProxy("")
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create http client: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("upstream request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, assetMaxRespSize))
	if err != nil {
		return nil, 0, errors.New("failed to read upstream response")
	}
	return respBody, resp.StatusCode, nil
}

// ============================
// Built-in formats
// ============================

// callVolcengineFormat 火山 Ark 直连：AK/SK HMAC 签名。火山兼容网关等其它协议请用自定义格式模板。
func callVolcengineFormat(ctx context.Context, ob system_setting.AssetOutbound, action string, body []byte) ([]byte, *assetAPIError, int, error) {
	if ob.AccessKey == "" || ob.SecretKey == "" {
		return nil, nil, 0, errors.New("asset outbound access_key or secret_key is not configured")
	}
	requestURL := fmt.Sprintf("%s/?Action=%s&Version=%s", ob.ResolvedBaseURL(), action, assetAPIVersion)
	ak, sk, region := ob.AccessKey, ob.SecretKey, ob.GetRegion()
	signFn := func(req *http.Request) { signVolcengineRequest(req, body, ak, sk, region) }

	respBody, status, err := assetHTTPSend(ctx, http.MethodPost, requestURL, nil, body, signFn)
	if err != nil {
		return nil, nil, 0, err
	}
	return decodeVolcengineEnvelope(respBody, status)
}

// decodeVolcengineEnvelope 解包火山标准信封 {ResponseMetadata.Error, Result}。
func decodeVolcengineEnvelope(respBody []byte, status int) ([]byte, *assetAPIError, int, error) {
	var envelope struct {
		ResponseMetadata struct {
			Error struct {
				Code    string `json:"Code"`
				Message string `json:"Message"`
			} `json:"Error"`
		} `json:"ResponseMetadata"`
		Result json.RawMessage `json:"Result"`
	}
	if err := common.Unmarshal(respBody, &envelope); err != nil {
		// 上游返回非标准信封时原样透传。
		return respBody, nil, status, nil
	}
	if envelope.ResponseMetadata.Error.Code != "" {
		return nil, &assetAPIError{Code: envelope.ResponseMetadata.Error.Code, Message: envelope.ResponseMetadata.Error.Message}, status, nil
	}
	if len(envelope.Result) > 0 {
		return envelope.Result, nil, http.StatusOK, nil
	}
	return respBody, nil, status, nil
}

// callNewAPIFormat 对接另一台 new-api 的资产接口：路径式 Action + Bearer 鉴权（套娃）。
// 下游 new-api 成功时直接返回规范化结果，失败时返回 {"error": ...}。
func callNewAPIFormat(ctx context.Context, ob system_setting.AssetOutbound, action string, body []byte) ([]byte, *assetAPIError, int, error) {
	if ob.BaseURL == "" || ob.AccessToken == "" {
		return nil, nil, 0, errors.New("asset outbound base_url or access_token is not configured")
	}
	requestURL := strings.TrimRight(ob.BaseURL, "/") + "/" + action
	headers := map[string]string{
		"Authorization": "Bearer " + ob.AccessToken,
		"X-Track-Id":    common.GetUUID(),
	}
	respBody, status, err := assetHTTPSend(ctx, http.MethodPost, requestURL, headers, body, nil)
	if err != nil {
		return nil, nil, 0, err
	}
	if status == http.StatusOK {
		return respBody, nil, status, nil
	}
	code := gjson.GetBytes(respBody, "error.code").String()
	msg := gjson.GetBytes(respBody, "error.message").String()
	if msg == "" {
		msg = gjson.GetBytes(respBody, "error").String()
	}
	if msg == "" {
		msg = strings.TrimSpace(string(respBody))
	}
	return nil, &assetAPIError{Code: code, Message: msg}, status, nil
}

// ============================
// Template-driven custom format
// ============================

func callCustomFormat(ctx context.Context, ob system_setting.AssetOutbound, cf *system_setting.AssetCustomFormat, action string, canonical []byte) ([]byte, *assetAPIError, int, error) {
	tmpl := resolveAssetActionTemplate(cf, action)
	method, requestURL, headers, body, err := buildCustomAssetRequest(ob, cf, tmpl, action, canonical)
	if err != nil {
		return nil, nil, 0, err
	}
	respBody, status, err := assetHTTPSend(ctx, method, requestURL, headers, body, nil)
	if err != nil {
		return nil, nil, 0, err
	}
	return parseCustomAssetResponse(tmpl, respBody, status)
}

// resolveAssetActionTemplate 合并自定义格式的默认模板与该动作的覆盖项（非空字段覆盖默认）。
func resolveAssetActionTemplate(cf *system_setting.AssetCustomFormat, action string) system_setting.AssetActionTemplate {
	t := cf.AssetActionTemplate
	ov, ok := cf.Actions[action]
	if !ok {
		return t
	}
	if ov.Method != "" {
		t.Method = ov.Method
	}
	if ov.URLTemplate != "" {
		t.URLTemplate = ov.URLTemplate
	}
	if len(ov.Headers) > 0 {
		t.Headers = ov.Headers
	}
	if len(ov.RequestStatic) > 0 {
		t.RequestStatic = ov.RequestStatic
	}
	if len(ov.RequestMapping) > 0 {
		t.RequestMapping = ov.RequestMapping
	}
	if ov.RequestPassthrough {
		t.RequestPassthrough = true
	}
	if ov.ResultPath != "" {
		t.ResultPath = ov.ResultPath
	}
	if ov.ErrorCodePath != "" {
		t.ErrorCodePath = ov.ErrorCodePath
	}
	if ov.ErrorMessagePath != "" {
		t.ErrorMessagePath = ov.ErrorMessagePath
	}
	if ov.ItemsPath != "" {
		t.ItemsPath = ov.ItemsPath
	}
	if len(ov.ItemMapping) > 0 {
		t.ItemMapping = ov.ItemMapping
	}
	if len(ov.ResponseMapping) > 0 {
		t.ResponseMapping = ov.ResponseMapping
	}
	return t
}

func buildCustomAssetRequest(ob system_setting.AssetOutbound, cf *system_setting.AssetCustomFormat, tmpl system_setting.AssetActionTemplate, action string, canonical []byte) (method, requestURL string, headers map[string]string, body []byte, err error) {
	tctx := assetTemplateContext(ob, action)

	method = strings.ToUpper(strings.TrimSpace(tmpl.Method))
	if method == "" {
		method = http.MethodPost
	}

	urlTemplate := tmpl.URLTemplate
	if urlTemplate == "" {
		urlTemplate = "{base_url}?Action={action}"
	}
	requestURL = applyAssetTemplate(urlTemplate, tctx, canonical)

	if tmpl.RequestPassthrough {
		body = canonical
	} else {
		body = []byte("{}")
		for _, m := range tmpl.RequestMapping {
			res := gjson.GetBytes(canonical, m.From)
			if !res.Exists() {
				continue
			}
			body, err = sjson.SetRawBytes(body, m.To, []byte(res.Raw))
			if err != nil {
				return "", "", nil, nil, fmt.Errorf("request mapping %q->%q failed: %w", m.From, m.To, err)
			}
		}
	}
	for path, val := range tmpl.RequestStatic {
		body, err = sjson.SetBytes(body, path, applyAssetTemplate(val, tctx, canonical))
		if err != nil {
			return "", "", nil, nil, fmt.Errorf("request static %q failed: %w", path, err)
		}
	}

	headers = make(map[string]string, len(tmpl.Headers)+1)
	for k, val := range tmpl.Headers {
		headers[k] = applyAssetTemplate(val, tctx, canonical)
	}
	applyAssetAuth(cf.Auth, &requestURL, headers, tctx, canonical)
	return method, requestURL, headers, body, nil
}

func parseCustomAssetResponse(tmpl system_setting.AssetActionTemplate, respBody []byte, status int) ([]byte, *assetAPIError, int, error) {
	if tmpl.ErrorCodePath != "" {
		code := gjson.GetBytes(respBody, tmpl.ErrorCodePath)
		if codeStr := code.String(); code.Exists() && codeStr != "" && codeStr != "0" {
			msg := ""
			if tmpl.ErrorMessagePath != "" {
				msg = gjson.GetBytes(respBody, tmpl.ErrorMessagePath).String()
			}
			return nil, &assetAPIError{Code: codeStr, Message: msg}, status, nil
		}
	}

	resultRaw := respBody
	if tmpl.ResultPath != "" {
		if r := gjson.GetBytes(respBody, tmpl.ResultPath); r.Exists() {
			resultRaw = []byte(r.Raw)
		}
	}

	// 无字段映射时直接返回结果（适用于上游已是规范化形态的场景）。
	if len(tmpl.ResponseMapping) == 0 && len(tmpl.ItemMapping) == 0 {
		return resultRaw, nil, http.StatusOK, nil
	}

	canonical := []byte("{}")
	var err error
	for _, m := range tmpl.ResponseMapping {
		res := gjson.GetBytes(resultRaw, m.From)
		if !res.Exists() {
			continue
		}
		canonical, err = sjson.SetRawBytes(canonical, m.To, []byte(res.Raw))
		if err != nil {
			return nil, nil, 0, fmt.Errorf("response mapping %q->%q failed: %w", m.From, m.To, err)
		}
	}

	if len(tmpl.ItemMapping) > 0 {
		itemsSrc := gjson.ParseBytes(resultRaw)
		if tmpl.ItemsPath != "" {
			itemsSrc = gjson.GetBytes(resultRaw, tmpl.ItemsPath)
		}
		idx := 0
		itemsSrc.ForEach(func(_, el gjson.Result) bool {
			item := []byte("{}")
			for _, m := range tmpl.ItemMapping {
				res := el.Get(m.From)
				if !res.Exists() {
					continue
				}
				item, _ = sjson.SetRawBytes(item, m.To, []byte(res.Raw))
			}
			canonical, _ = sjson.SetRawBytes(canonical, fmt.Sprintf("Items.%d", idx), item)
			idx++
			return true
		})
	}
	return canonical, nil, http.StatusOK, nil
}

// ============================
// Templating
// ============================

var assetFieldTemplateRe = regexp.MustCompile(`\{field:([^}]+)\}`)

// assetTemplateContext 构造模板替换表（凭证、区域、动作等）。
func assetTemplateContext(ob system_setting.AssetOutbound, action string) map[string]string {
	return map[string]string{
		"{base_url}":     strings.TrimRight(ob.ResolvedBaseURL(), "/"),
		"{action}":       action,
		"{access_key}":   ob.AccessKey,
		"{secret_key}":   ob.SecretKey,
		"{access_token}": ob.AccessToken,
		"{project_name}": ob.ProjectName,
		"{region}":       ob.GetRegion(),
		"{group_type}":   ob.GetGroupType(),
		"{uuid}":         common.GetUUID(),
	}
}

// applyAssetTemplate 先替换上下文占位符，再用 {field:<gjsonPath>} 从规范化请求体取值替换。
func applyAssetTemplate(s string, tctx map[string]string, canonical []byte) string {
	for k, v := range tctx {
		s = strings.ReplaceAll(s, k, v)
	}
	if !strings.Contains(s, "{field:") {
		return s
	}
	return assetFieldTemplateRe.ReplaceAllStringFunc(s, func(match string) string {
		path := assetFieldTemplateRe.FindStringSubmatch(match)[1]
		return gjson.GetBytes(canonical, path).String()
	})
}

func applyAssetAuth(auth system_setting.AssetAuthSpec, requestURL *string, headers map[string]string, tctx map[string]string, canonical []byte) {
	value := applyAssetTemplate(auth.Value, tctx, canonical)
	switch auth.Type {
	case "header":
		if auth.Name != "" {
			headers[auth.Name] = value
		}
	case "bearer":
		headers["Authorization"] = "Bearer " + value
	case "query":
		if auth.Name == "" {
			return
		}
		sep := "?"
		if strings.Contains(*requestURL, "?") {
			sep = "&"
		}
		*requestURL = *requestURL + sep + url.QueryEscape(auth.Name) + "=" + url.QueryEscape(value)
	}
}
