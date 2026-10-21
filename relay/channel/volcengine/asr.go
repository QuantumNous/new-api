package volcengine

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// ASR WebSocket endpoints
const (
	asrDefaultEndpoint       = "wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_async"
	asrNoStreamEndpoint      = "wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_nostream"
	asrDefaultResourceID     = "volc.seedasr.sauc.duration"
	asrProtocolModelName     = "bigmodel"
	defaultASRAudioChunkSize = 3200 // 100ms of PCM 16kHz 16-bit mono
	contextKeyASRData        = "volcengine_asr_data"
)

// VolcengineASRRequest is the initialization payload sent as FullClientRequest.
type VolcengineASRRequest struct {
	User    VolcengineASRUser    `json:"user"`
	Audio   VolcengineASRAudio   `json:"audio"`
	Request VolcengineASRReqInfo `json:"request"`
}

type VolcengineASRUser struct {
	UID string `json:"uid"`
}

type VolcengineASRAudio struct {
	Format   string `json:"format"`
	Rate     int    `json:"rate"`
	Bits     int    `json:"bits"`
	Channel  int    `json:"channel"`
	Language string `json:"language"`
}

type VolcengineASRReqInfo struct {
	ModelName  string                 `json:"model_name"`
	EnableITN  bool                   `json:"enable_itn"`
	EnablePunc bool                   `json:"enable_punc"`
	ResultType string                 `json:"result_type"`
	ExtraParam map[string]interface{} `json:"extra_param,omitempty"`
}

type asrContextData struct {
	audioData      []byte
	responseFormat string
	fileMode       bool
}

// asrServerResponse is the SeedASR response payload. The transcription text is
// nested under "result", not at the top level.
type asrServerResponse struct {
	Result struct {
		Text       string `json:"text"`
		Utterances []struct {
			Text      string `json:"text"`
			Definite  bool   `json:"definite"`
			StartTime int    `json:"start_time"`
			EndTime   int    `json:"end_time"`
		} `json:"utterances"`
	} `json:"result"`
}

// decodeASRPayload returns the message payload, gunzipping it when the frame
// header declares gzip compression.
func decodeASRPayload(msg *Message) ([]byte, error) {
	if msg.Compression != CompressionGzip || len(msg.Payload) == 0 {
		return msg.Payload, nil
	}
	reader, err := gzip.NewReader(bytes.NewReader(msg.Payload))
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

// parseASRMultipartForm reads the multipart/form-data body to extract the
// audio file and form fields. The body is restored afterward so downstream
// code can still read it if needed.
// Falls back to parsing JSON for channel-test and HTTP-based ASR scenarios.
func parseASRMultipartForm(c *gin.Context) (*asrContextData, error) {
	requestBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, err
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(requestBody))

	contentType := c.Request.Header.Get("Content-Type")

	// JSON fallback for channel-test and non-multipart requests
	if strings.HasPrefix(contentType, "application/json") {
		return &asrContextData{
			audioData:      nil,
			responseFormat: "json",
		}, nil
	}

	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return nil, fmt.Errorf("failed to parse content type: %w", err)
	}

	boundary, ok := params["boundary"]
	if !ok {
		return nil, errors.New("multipart boundary not found")
	}

	reader := multipart.NewReader(bytes.NewReader(requestBody), boundary)
	form, err := reader.ReadForm(32 << 20) // 32 MB max memory
	if err != nil {
		return nil, fmt.Errorf("failed to read multipart form: %w", err)
	}
	defer form.RemoveAll()

	responseFormat := ""
	// OpenAI audio transcriptions are file uploads by default. Keep the
	// explicit file mode for backwards compatibility, and reserve stream mode
	// for callers that explicitly opt in via metadata.
	fileMode := true
	streamMode := false
	if vals, ok := form.Value["response_format"]; ok && len(vals) > 0 {
		responseFormat = vals[0]
	}
	if vals, ok := form.Value["metadata"]; ok && len(vals) > 0 {
		var metadata struct {
			Mode string `json:"mode"`
		}
		if common.Unmarshal([]byte(vals[0]), &metadata) == nil {
			streamMode = metadata.Mode == "stream"
			fileMode = !streamMode
		}
	}
	if responseFormat == "" {
		responseFormat = "json"
	}

	// Try "file" first (OpenAI standard), then "audio" as fallback
	var audioFile multipart.File
	for _, fieldName := range []string{"file", "audio"} {
		files := form.File[fieldName]
		if len(files) > 0 {
			f, err := files[0].Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open audio file %q: %w", fieldName, err)
			}
			audioFile = f
			break
		}
	}
	if audioFile == nil {
		// Also check if there's a raw audio field in form values
		if vals, ok := form.Value["audio_data"]; ok && len(vals) > 0 {
			return &asrContextData{
				audioData:      []byte(vals[0]),
				responseFormat: responseFormat,
				fileMode:       fileMode,
			}, nil
		}
		return nil, errors.New("no audio file found in multipart form (expected 'file' or 'audio' field)")
	}
	defer audioFile.Close()

	audioData, err := io.ReadAll(audioFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read audio file: %w", err)
	}

	return &asrContextData{
		audioData:      audioData,
		responseFormat: responseFormat,
		fileMode:       fileMode,
	}, nil
}

// stripWAVHeader detects WAV files and strips the header, returning raw PCM.
// Returns the data unchanged if it doesn't look like a WAV file.
func stripWAVHeader(data []byte) []byte {
	// WAV files start with "RIFF" followed by file size, then "WAVE", then "fmt " chunk
	if len(data) < 44 || string(data[0:4]) != "RIFF" || string(data[8:12]) != "WAVE" {
		return data
	}
	// Find the "data" chunk
	offset := 12
	for offset < len(data)-8 {
		chunkID := string(data[offset : offset+4])
		chunkSize := int(data[offset+4]) | int(data[offset+5])<<8 | int(data[offset+6])<<16 | int(data[offset+7])<<24
		if chunkID == "data" {
			start := offset + 8
			end := start + chunkSize
			if end > len(data) {
				end = len(data)
			}
			return data[start:end]
		}
		offset += 8 + chunkSize
	}
	// No "data" chunk found, return as-is
	return data
}

// buildASRInitPayload builds the FullClientRequest config. request.model_name
// is the ASR protocol model ("bigmodel"), which is distinct from the channel
// model name — that is carried as the X-Api-Resource-Id header instead.
func buildASRInitPayload(modelName string) VolcengineASRRequest {
	return VolcengineASRRequest{
		User: VolcengineASRUser{
			UID: "openai_relay_user",
		},
		Audio: VolcengineASRAudio{
			Format:   "pcm",
			Rate:     16000,
			Bits:     16,
			Channel:  1,
			Language: "zh-CN",
		},
		Request: VolcengineASRReqInfo{
			ModelName:  modelName,
			EnableITN:  true,
			EnablePunc: true,
			ResultType: "single",
		},
	}
}

func gzipCompress(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write(data); err != nil {
		return nil, err
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// buildWebSocketRequestHeader builds the SeedASR WebSocket auth headers.
//
// SeedASR does not share the TTS "Authorization: Bearer;<token>" scheme. It
// authenticates with X-Api-Key plus the resource id of the ASR model; sending
// the TTS scheme is rejected with 401 "Invalid X-Api-Key". Ark console keys
// ("ark-...") are passed verbatim as X-Api-Key, while legacy
// "appid|access_token" keys use the older App-Key/Access-Key pair.
func buildWebSocketRequestHeader(apiKey, resourceID string) (http.Header, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, errors.New("missing volcengine api key")
	}

	header := http.Header{}
	header.Set("X-Api-Resource-Id", resourceID)
	header.Set("X-Api-Connect-Id", uuid.New().String())

	if appID, token, err := parseVolcengineAuth(apiKey); err == nil {
		header.Set("X-Api-App-Key", appID)
		header.Set("X-Api-Access-Key", token)
		return header, nil
	}

	header.Set("X-Api-Key", apiKey)
	return header, nil
}

// asrResourceID resolves the X-Api-Resource-Id for the request. Channels
// configure the SeedASR resource id ("volc.seedasr.sauc.duration") as the model
// name, so it is used directly when present.
func asrResourceID(modelName string) string {
	if strings.HasPrefix(modelName, "volc.") {
		return modelName
	}
	return asrDefaultResourceID
}

// sendASRFullClientRequest marshals the init payload, gzip-compresses it,
// and sends it as a FullClientRequest binary message.
func sendASRFullClientRequest(conn *websocket.Conn, initPayload VolcengineASRRequest) error {
	jsonPayload, err := json.Marshal(initPayload)
	if err != nil {
		return fmt.Errorf("failed to marshal ASR init payload: %w", err)
	}
	compressedPayload, err := gzipCompress(jsonPayload)
	if err != nil {
		return fmt.Errorf("failed to gzip compress ASR init payload: %w", err)
	}
	msg, err := NewMessage(MsgTypeFullClientRequest, MsgTypeFlagPositiveSeq)
	if err != nil {
		return err
	}
	// The payload is gzipped, so the header must declare it — otherwise the
	// server fails to unmarshal it ("invalid character '\x1f'").
	msg.Compression = CompressionGzip
	msg.Sequence = 1
	msg.Payload = compressedPayload
	frame, err := msg.Marshal()
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.BinaryMessage, frame)
}

// sendAudioOnlyFrame sends a chunk of audio data as an AudioOnlyClient message.
func sendAudioOnlyFrame(conn *websocket.Conn, data []byte, sequence int32) error {
	msg, err := NewMessage(MsgTypeAudioOnlyClient, MsgTypeFlagPositiveSeq)
	if err != nil {
		return err
	}
	compressed, err := gzipCompress(data)
	if err != nil {
		return fmt.Errorf("failed to gzip compress audio frame: %w", err)
	}
	msg.Compression = CompressionGzip
	msg.Payload = compressed
	msg.Sequence = sequence
	frame, err := msg.Marshal()
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.BinaryMessage, frame)
}

// sendAudioEndFrame signals end of audio input. The sequence number must be
// negated (not just flagged), which is how the server recognises the last
// packet and returns the final transcription.
func sendAudioEndFrame(conn *websocket.Conn, sequence int32) error {
	msg, err := NewMessage(MsgTypeAudioOnlyClient, MsgTypeFlagNegativeSeq)
	if err != nil {
		return err
	}
	compressed, err := gzipCompress(nil)
	if err != nil {
		return fmt.Errorf("failed to gzip compress audio end frame: %w", err)
	}
	msg.Compression = CompressionGzip
	msg.Payload = compressed
	msg.Sequence = -sequence
	frame, err := msg.Marshal()
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.BinaryMessage, frame)
}

// handleASRWebSocketResponse handles the full ASR WebSocket lifecycle:
// connect, send init + audio chunks, collect results, and write the
// OpenAI-format transcription response.
func handleASRWebSocketResponse(
	c *gin.Context,
	requestURL string,
	asrData *asrContextData,
	info *relaycommon.RelayInfo,
) (usage any, err *types.NewAPIError) {
	header, headerErr := buildWebSocketRequestHeader(info.ApiKey, asrResourceID(info.OriginModelName))
	if headerErr != nil {
		return nil, types.NewErrorWithStatusCode(
			headerErr,
			types.ErrorCodeChannelInvalidKey,
			http.StatusUnauthorized,
		)
	}

	conn, resp, dialErr := websocket.DefaultDialer.DialContext(context.Background(), requestURL, header)
	if dialErr != nil {
		if resp != nil {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("failed to connect to ASR websocket: %w, status: %d", dialErr, resp.StatusCode),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusBadGateway,
			)
		}
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to connect to ASR websocket: %w", dialErr),
			types.ErrorCodeBadResponseStatusCode,
			http.StatusBadGateway,
		)
	}
	defer conn.Close()

	// 1. Send FullClientRequest with gzip-compressed init payload
	initPayload := buildASRInitPayload(asrProtocolModelName)
	if sendErr := sendASRFullClientRequest(conn, initPayload); sendErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to send ASR init request: %w", sendErr),
			types.ErrorCodeBadRequestBody,
			http.StatusInternalServerError,
		)
	}

	// 2. Wait for connection started (FullServerResponse with EventType_ASRInfo)
	msg, recvErr := ReceiveMessage(conn)
	if recvErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to receive ASR connection response: %w", recvErr),
			types.ErrorCodeBadResponse,
			http.StatusInternalServerError,
		)
	}

	if msg.MsgType == MsgTypeError {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("ASR server error: code=%d, %s", msg.ErrorCode, string(msg.Payload)),
			types.ErrorCodeBadResponse,
			http.StatusBadRequest,
		)
	}

	// 3. Send audio chunks. The init frame already consumed sequence 1, so
	// audio frames continue from 2 — the server validates that the sequence
	// increments contiguously across the whole stream.
	audioData := stripWAVHeader(asrData.audioData)
	chunkSize := defaultASRAudioChunkSize
	var seq int32 = 1

	for offset := 0; offset < len(audioData); offset += chunkSize {
		end := offset + chunkSize
		if end > len(audioData) {
			end = len(audioData)
		}
		seq++
		if frameErr := sendAudioOnlyFrame(conn, audioData[offset:end], seq); frameErr != nil {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("failed to send audio frame: %w", frameErr),
				types.ErrorCodeBadRequestBody,
				http.StatusInternalServerError,
			)
		}
	}

	// 4. Send end-of-audio frame
	seq++
	if endErr := sendAudioEndFrame(conn, seq); endErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to send audio end frame: %w", endErr),
			types.ErrorCodeBadRequestBody,
			http.StatusInternalServerError,
		)
	}

	// 5. Collect ASR results. Responses carry no event bits, so the loop keys
	// off message type and reads the latest non-empty result.text, which the
	// server resends in full as it refines the transcription. The stream ends
	// with a normal close ("finish last sequence") or a negative sequence.
	transcription := ""

	for {
		msg, recvErr = ReceiveMessage(conn)
		if recvErr != nil {
			if websocket.IsCloseError(recvErr, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				break
			}
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("failed to receive ASR message: %w", recvErr),
				types.ErrorCodeBadResponse,
				http.StatusInternalServerError,
			)
		}

		if msg.MsgType == MsgTypeError {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("ASR error: code=%d, %s", msg.ErrorCode, string(msg.Payload)),
				types.ErrorCodeBadResponse,
				http.StatusBadRequest,
			)
		}

		if msg.MsgType != MsgTypeFullServerResponse && msg.MsgType != MsgTypeFrontEndResultServer {
			continue
		}

		payload, decodeErr := decodeASRPayload(msg)
		if decodeErr != nil {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("failed to decode ASR response payload: %w", decodeErr),
				types.ErrorCodeBadResponseBody,
				http.StatusInternalServerError,
			)
		}

		var serverResp asrServerResponse
		if len(payload) > 0 && json.Unmarshal(payload, &serverResp) == nil {
			if text := serverResp.Result.Text; text != "" {
				transcription = text
			}
		}

		// A negative sequence marks the final packet for this stream.
		if msg.Sequence < 0 {
			break
		}
	}

	// 6. Format as OpenAI AudioResponse
	responseData, marshalErr := common.Marshal(dto.AudioResponse{
		Text: transcription,
	})
	if marshalErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to marshal transcription response: %w", marshalErr),
			types.ErrorCodeBadResponseBody,
			http.StatusInternalServerError,
		)
	}

	c.Header("Content-Type", "application/json")
	c.Data(http.StatusOK, "application/json", responseData)

	usage = &dto.Usage{
		PromptTokens:     info.GetEstimatePromptTokens(),
		CompletionTokens: 0,
		TotalTokens:      info.GetEstimatePromptTokens(),
	}

	return usage, nil
}
