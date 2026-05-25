package volcengine

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// v3HTTPRequestBody is the JSON body shared by both HTTP transports
// (chunked + SSE). It mirrors the StartSession payload shape, since the v3
// HTTP endpoints accept all parameters in a single request.
type v3HTTPRequestBody struct {
	User      *v3UserMeta      `json:"user,omitempty"`
	Namespace string           `json:"namespace,omitempty"`
	ReqParams v3StartReqParams `json:"req_params"`
}

func buildV3HTTPRequestBody(vReq VolcengineTTSRequest, encoding string) v3HTTPRequestBody {
	speedPtr := mapV1SpeedToV3(vReq.Audio.SpeedRatio)
	audio := v3AudioParams{
		Format:     encoding,
		SampleRate: intPtr(vReq.Audio.Rate),
		SpeechRate: speedPtr,
	}
	if vReq.Audio.Bitrate > 0 {
		audio.BitRate = intPtr(vReq.Audio.Bitrate)
	}
	if vReq.Audio.LoudnessRatio != 0 {
		audio.LoudnessRate = intPtr(int(vReq.Audio.LoudnessRatio))
	}
	if vReq.Audio.EnableEmotion && vReq.Audio.Emotion != "" {
		audio.Emotion = vReq.Audio.Emotion
		if vReq.Audio.EmotionScale != 0 {
			s := vReq.Audio.EmotionScale
			audio.EmotionScale = &s
		}
	}
	return v3HTTPRequestBody{
		User: &v3UserMeta{UID: vReq.User.UID},
		ReqParams: v3StartReqParams{
			Text:        vReq.Request.Text,
			Speaker:     vReq.Audio.VoiceType,
			Model:       vReq.Request.Model,
			AudioParams: audio,
		},
	}
}

// ----------------------------------------------------------------------------
// HTTP Chunked: response is a stream of independent v3 binary frames
// ----------------------------------------------------------------------------

func handleTTSV3HTTPChunked(c *gin.Context, requestURL string, vReq VolcengineTTSRequest, info *relaycommon.RelayInfo, encoding string, cfg dto.VolcTTSConfig) (any, *types.NewAPIError) {
	bodyJSON, marshalErr := common.Marshal(buildV3HTTPRequestBody(vReq, encoding))
	if marshalErr != nil {
		return nil, v3WrapError(marshalErr, "marshal v3 http body failed")
	}

	connectID := uuid.NewString()
	header, hdrErr := buildV3Headers(cfg, info.ApiKey, connectID)
	if hdrErr != nil {
		return nil, types.NewErrorWithStatusCode(hdrErr, types.ErrorCodeChannelInvalidKey, http.StatusUnauthorized)
	}
	header.Set("Content-Type", "application/json")

	req, reqErr := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, requestURL, bytes.NewReader(bodyJSON))
	if reqErr != nil {
		return nil, v3WrapError(reqErr, "build v3 http request failed")
	}
	req.Header = header

	resp, doErr := http.DefaultClient.Do(req)
	if doErr != nil {
		return nil, v3WrapError(doErr, "do v3 http request failed")
	}
	defer resp.Body.Close()

	if logID := resp.Header.Get("X-Tt-Logid"); logID != "" {
		c.Header("X-Volc-Logid", logID)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("volcengine v3 http chunked unexpected status: %d body=%s", resp.StatusCode, string(body)),
			types.ErrorCodeBadResponseStatusCode,
			resp.StatusCode,
		)
	}

	c.Header("Content-Type", getContentTypeByEncoding(encoding))
	c.Header("Transfer-Encoding", "chunked")

	usage := &dto.Usage{}
	wroteAny := false
	reader := bufio.NewReader(resp.Body)

	for {
		msg, err := ReadOneFrame(reader)
		if err != nil {
			if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
				break
			}
			return nil, v3WrapError(err, "parse v3 http frame failed")
		}

		switch msg.MsgType {
		case MsgTypeError:
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("volcengine v3 http error frame: code=%d body=%s", msg.ErrorCode, string(msg.Payload)),
				types.ErrorCodeBadResponse,
				http.StatusBadGateway,
			)
		case MsgTypeAudioOnlyServer:
			if len(msg.Payload) > 0 {
				if _, wErr := c.Writer.Write(msg.Payload); wErr != nil {
					return nil, v3WrapError(wErr, "write http audio chunk failed")
				}
				c.Writer.Flush()
				wroteAny = true
			}
		case MsgTypeFullServerResponse:
			switch msg.EventType {
			case EventType_SessionFinished:
				if env := parseV3SessionResult(msg.Payload); env != nil && env.Usage != nil {
					usage.PromptTokens = env.Usage.TextWords
					usage.TotalTokens = env.Usage.TextWords
				}
				goto done
			case EventType_SessionFailed, EventType_ConnectionFailed:
				env := parseV3SessionResult(msg.Payload)
				return nil, types.NewErrorWithStatusCode(
					fmt.Errorf("volcengine v3 http session/connection failed: status=%s msg=%s",
						envStatus(env), envMessage(env)),
					types.ErrorCodeBadResponse,
					http.StatusBadGateway,
				)
			}
		}
	}
done:

	if !wroteAny {
		return nil, types.NewErrorWithStatusCode(
			errors.New("volcengine v3 http chunked finished without delivering audio"),
			types.ErrorCodeBadResponse,
			http.StatusBadGateway,
		)
	}
	if usage.PromptTokens == 0 {
		est := info.GetEstimatePromptTokens()
		usage.PromptTokens = est
		usage.TotalTokens = est
	}
	return usage, nil
}

// ----------------------------------------------------------------------------
// HTTP SSE: passthrough — forward raw event-stream bytes to the client.
// Side-channel parses SessionFinished events to capture usage for billing.
// ----------------------------------------------------------------------------

func handleTTSV3HTTPSSE(c *gin.Context, requestURL string, vReq VolcengineTTSRequest, info *relaycommon.RelayInfo, cfg dto.VolcTTSConfig) (any, *types.NewAPIError) {
	bodyJSON, marshalErr := common.Marshal(buildV3HTTPRequestBody(vReq, "mp3"))
	if marshalErr != nil {
		return nil, v3WrapError(marshalErr, "marshal v3 sse body failed")
	}

	connectID := uuid.NewString()
	header, hdrErr := buildV3Headers(cfg, info.ApiKey, connectID)
	if hdrErr != nil {
		return nil, types.NewErrorWithStatusCode(hdrErr, types.ErrorCodeChannelInvalidKey, http.StatusUnauthorized)
	}
	header.Set("Content-Type", "application/json")
	header.Set("Accept", "text/event-stream")

	req, reqErr := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, requestURL, bytes.NewReader(bodyJSON))
	if reqErr != nil {
		return nil, v3WrapError(reqErr, "build v3 sse request failed")
	}
	req.Header = header

	resp, doErr := http.DefaultClient.Do(req)
	if doErr != nil {
		return nil, v3WrapError(doErr, "do v3 sse request failed")
	}
	defer resp.Body.Close()

	if logID := resp.Header.Get("X-Tt-Logid"); logID != "" {
		c.Header("X-Volc-Logid", logID)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("volcengine v3 sse unexpected status: %d body=%s", resp.StatusCode, string(body)),
			types.ErrorCodeBadResponseStatusCode,
			resp.StatusCode,
		)
	}

	// Passthrough headers — preserve upstream content-type if it's text/event-stream.
	c.Header("Content-Type", "text/event-stream; charset=utf-8")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	usage := &dto.Usage{}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)

	var (
		curEvent strings.Builder
		curData  strings.Builder
		eventBuf strings.Builder // raw bytes to forward
	)

	flushEvent := func() {
		if eventBuf.Len() == 0 {
			curEvent.Reset()
			curData.Reset()
			return
		}
		// Side-channel parse SessionFinished payload for usage.
		eventName := strings.TrimSpace(curEvent.String())
		if eventName == "SessionFinished" || strings.Contains(curData.String(), "\"event\":152") {
			env := parseV3SessionResult([]byte(strings.TrimSpace(curData.String())))
			if env != nil && env.Usage != nil {
				usage.PromptTokens = env.Usage.TextWords
				usage.TotalTokens = env.Usage.TextWords
			}
		}
		// Forward verbatim.
		_, _ = c.Writer.WriteString(eventBuf.String())
		_, _ = c.Writer.WriteString("\n")
		c.Writer.Flush()

		eventBuf.Reset()
		curEvent.Reset()
		curData.Reset()
	}

	for scanner.Scan() {
		line := scanner.Text()
		// Forward each line plus its trailing newline (SSE preserves \n line endings).
		eventBuf.WriteString(line)
		eventBuf.WriteString("\n")

		if line == "" {
			flushEvent()
			continue
		}
		if strings.HasPrefix(line, "event:") {
			curEvent.WriteString(strings.TrimPrefix(line, "event:"))
		} else if strings.HasPrefix(line, "data:") {
			curData.WriteString(strings.TrimPrefix(line, "data:"))
		}
	}
	if scanErr := scanner.Err(); scanErr != nil && !errors.Is(scanErr, io.EOF) {
		return nil, v3WrapError(scanErr, "scan v3 sse stream failed")
	}
	// Flush any tail event without a terminating blank line.
	flushEvent()

	if usage.PromptTokens == 0 {
		est := info.GetEstimatePromptTokens()
		usage.PromptTokens = est
		usage.TotalTokens = est
	}
	return usage, nil
}

// ----------------------------------------------------------------------------
// Frame splitter shared by HTTP Chunked transport
// ----------------------------------------------------------------------------

// ReadOneFrame consumes one full Volcengine v3 binary frame from r and parses
// it into a Message. It re-uses Message.Unmarshal for actual decoding by first
// buffering enough bytes for one frame.
//
// This walks the wire format:
//   header(4-byte) → optional event(4) → optional sessionID/connectID(uvarint32+N)
//     → optional sequence(4) or errorCode(4) → payload(uvarint32+N)
//
// The duplication with protocols.go is intentional: that file deals with a
// pre-fetched byte slice, while we operate on a streaming reader here.
func ReadOneFrame(r io.Reader) (*Message, error) {
	header := make([]byte, 4)
	if _, err := io.ReadFull(r, header); err != nil {
		return nil, err
	}
	headerSize := int(header[0]&0x0F) * 4
	if headerSize < 4 {
		return nil, fmt.Errorf("invalid v3 frame header size: %d", headerSize)
	}

	frame := bytes.NewBuffer(nil)
	frame.Write(header)

	// Drain header padding past the 4 bytes we already consumed.
	if pad := headerSize - 4; pad > 0 {
		buf := make([]byte, pad)
		if _, err := io.ReadFull(r, buf); err != nil {
			return nil, err
		}
		frame.Write(buf)
	}

	msgType := MsgType(header[1] >> 4)
	flag := MsgTypeFlagBits(header[1] & 0x0F)

	// WithEvent: event(4) + optional sessionID(4+N) + optional connectID(4+N)
	if flag == MsgTypeFlagWithEvent {
		evtBuf := make([]byte, 4)
		if _, err := io.ReadFull(r, evtBuf); err != nil {
			return nil, err
		}
		frame.Write(evtBuf)
		evt := EventType(int32(uint32(evtBuf[0])<<24 | uint32(evtBuf[1])<<16 | uint32(evtBuf[2])<<8 | uint32(evtBuf[3])))
		if !isConnectionClassEvent(evt) {
			if err := copyLengthPrefixed(r, frame); err != nil {
				return nil, err
			}
		}
		if isConnectionResponseEvent(evt) {
			if err := copyLengthPrefixed(r, frame); err != nil {
				return nil, err
			}
		}
	}

	switch msgType {
	case MsgTypeFullClientRequest, MsgTypeFullServerResponse, MsgTypeFrontEndResultServer,
		MsgTypeAudioOnlyClient, MsgTypeAudioOnlyServer:
		if flag == MsgTypeFlagPositiveSeq || flag == MsgTypeFlagNegativeSeq {
			if err := copyN(r, frame, 4); err != nil {
				return nil, err
			}
		}
	case MsgTypeError:
		if err := copyN(r, frame, 4); err != nil {
			return nil, err
		}
	}

	// Payload: uint32 size + size bytes.
	if err := copyLengthPrefixed(r, frame); err != nil {
		return nil, err
	}

	return NewMessageFromBytes(frame.Bytes())
}

func copyN(r io.Reader, dst *bytes.Buffer, n int) error {
	buf := make([]byte, n)
	if _, err := io.ReadFull(r, buf); err != nil {
		return err
	}
	dst.Write(buf)
	return nil
}

func copyLengthPrefixed(r io.Reader, dst *bytes.Buffer) error {
	sizeBuf := make([]byte, 4)
	if _, err := io.ReadFull(r, sizeBuf); err != nil {
		return err
	}
	dst.Write(sizeBuf)
	size := uint32(sizeBuf[0])<<24 | uint32(sizeBuf[1])<<16 | uint32(sizeBuf[2])<<8 | uint32(sizeBuf[3])
	if size == 0 {
		return nil
	}
	body := make([]byte, size)
	if _, err := io.ReadFull(r, body); err != nil {
		return err
	}
	dst.Write(body)
	return nil
}

func isConnectionClassEvent(e EventType) bool {
	switch e {
	case EventType_StartConnection, EventType_FinishConnection,
		EventType_ConnectionStarted, EventType_ConnectionFailed,
		EventType_ConnectionFinished:
		return true
	}
	return false
}

func isConnectionResponseEvent(e EventType) bool {
	switch e {
	case EventType_ConnectionStarted, EventType_ConnectionFailed,
		EventType_ConnectionFinished:
		return true
	}
	return false
}

// Suppress unused-import warning when base64 isn't yet referenced by SSE handler
// (kept reserved for future SSE→audio decode mode).
var _ = base64.StdEncoding
