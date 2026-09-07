package common

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"

	"github.com/QuantumNous/new-api/common"
)

// NewPassthroughBody builds the upstream request body for channels that forward
// the inbound payload verbatim (全局「请求体透传」或渠道 PassThroughBodyEnabled)。
//
// 透传的契约是「请求体原样转发」，所以这里只做一件事：当渠道的 model_mapping
// 真的改写了模型名时，把顶层 `model` 字段替换成映射后的名字。其余字节
// （字段顺序、未知字段、空白、数值精度）一律不动。
//
// 为什么必须替换：ModelMappedHelper 只改写内存里的 request 副本
// （info.UpstreamModelName + request.SetModelName），透传分支直接取入站 body，
// 那次改写从未落回请求体。于是 new-api 侧看起来映射生效了（日志、计费、
// 渠道选择都用 UpstreamModelName），上游收到的却仍是客户端的对外模型名 ——
// 上游不认识这个模型，直接 404。详见 issue #6002 / #6639。
//
// 返回值的 closer 非空时调用方必须 defer closer.Close()（与 NewOutboundJSONBody
// 一致）；未发生改写时 closer 为 nil，直接复用入站 storage，零额外拷贝。
func NewPassthroughBody(storage common.BodyStorage, info *RelayInfo) (common.ReplayableBody, io.Closer, error) {
	if storage == nil {
		return nil, nil, errors.New("missing request body storage")
	}
	if info == nil || !info.HasChannelMeta() || !info.IsModelMapped {
		return common.NewReplayableBodyReader(storage), nil, nil
	}
	upstreamModel := info.GetUpstreamModelName()
	if upstreamModel == "" {
		return common.NewReplayableBodyReader(storage), nil, nil
	}
	raw, err := storage.Bytes()
	if err != nil || len(raw) == 0 {
		// 读不到内容（已关闭 / 落盘读失败）就退回原样转发，
		// 绝不因为改写失败而丢掉请求体。
		return common.NewReplayableBodyReader(storage), nil, nil
	}
	patched, changed := ReplaceTopLevelModel(raw, upstreamModel)
	if !changed {
		return common.NewReplayableBodyReader(storage), nil, nil
	}
	body, closer, err := NewOutboundJSONBody(patched)
	if err != nil {
		return nil, nil, err
	}
	return body, closer, nil
}

// ReplaceTopLevelModel 把 JSON 对象顶层名为 "model" 的字符串字段替换为 newModel，
// 其余内容保持逐字节不变。
//
// 只处理顶层：嵌套结构里的同名字段（tools[].function.name 之类更不会叫 model）
// 不属于请求模型名，保持原样。发生替换时返回 true。
func ReplaceTopLevelModel(src []byte, newModel string) ([]byte, bool) {
	dec := json.NewDecoder(bytes.NewReader(src))
	tok, err := dec.Token()
	if err != nil {
		return nil, false
	}
	if delim, ok := tok.(json.Delim); !ok || delim != '{' {
		return nil, false
	}
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return nil, false
		}
		key, ok := keyTok.(string)
		if !ok {
			return nil, false
		}
		// InputOffset 位于刚读完的 key token 之后，值还在后面。
		beforeValue := dec.InputOffset()
		valueTok, err := dec.Token()
		if err != nil {
			return nil, false
		}
		afterValue := dec.InputOffset()
		if key == "model" {
			current, ok := valueTok.(string)
			if !ok {
				// model 不是字符串（null / 对象 / 数组）：请求本身就不合规，
				// 交给上游报错，不在这里替它做决定。
				return nil, false
			}
			if current == newModel {
				return nil, false
			}
			start := valueStartOffset(src, int(beforeValue))
			if start < 0 || start >= len(src) || src[start] != '"' {
				return nil, false
			}
			quoted, err := json.Marshal(newModel)
			if err != nil {
				return nil, false
			}
			out := make([]byte, 0, len(src)+len(quoted))
			out = append(out, src[:start]...)
			out = append(out, quoted...)
			out = append(out, src[afterValue:]...)
			return out, true
		}
		if delim, ok := valueTok.(json.Delim); ok && (delim == '{' || delim == '[') {
			if !skipJSONValue(dec) {
				return nil, false
			}
		}
	}
	return nil, false
}

// valueStartOffset 从 key token 结束处向后跳过空白与 ':'，返回值的起始下标。
func valueStartOffset(src []byte, from int) int {
	i := from
	for i < len(src) && isJSONSpace(src[i]) {
		i++
	}
	if i >= len(src) || src[i] != ':' {
		return -1
	}
	i++
	for i < len(src) && isJSONSpace(src[i]) {
		i++
	}
	if i >= len(src) {
		return -1
	}
	return i
}

func isJSONSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}

// skipJSONValue 把一个已经读到起始定界符（'{' 或 '['）的复合值读完，
// 让外层循环继续从下一个顶层 key 开始。
func skipJSONValue(dec *json.Decoder) bool {
	depth := 1
	for depth > 0 {
		tok, err := dec.Token()
		if err != nil {
			return false
		}
		if delim, ok := tok.(json.Delim); ok {
			switch delim {
			case '{', '[':
				depth++
			case '}', ']':
				depth--
			default:
				return false
			}
		}
	}
	return true
}
