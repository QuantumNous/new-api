package service

import (
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	gptImage2CanonicalModel         = "gpt-image-2"
	gptImage2OfficialAliasModel     = "gpt-image-2-official"
	contextKeyGptImage2Profile      = "gpt_image2_profile"
	contextKeyGptImage2OfficialFB   = "gpt_image2_official_fallback"
	contextKeyGptImage2RaceHedge    = "gpt_image2_for_race_hedge"
	contextKeyGptImage2RoutingRetry = "gpt_image2_routing_retry"
	contextKeyGptImage2ResponseFmt  = "gpt_image2_client_response_format"
)

var ErrGptImage2ChannelTierMismatch = errors.New("selected channel cannot serve this gpt-image-2 request profile")

// GptImage2Profile classifies client requests for channel tier selection.
type GptImage2Profile string

const (
	GptImage2ProfileStandard GptImage2Profile = "standard"
	GptImage2ProfilePacky    GptImage2Profile = "packy"
	GptImage2ProfileOfficial GptImage2Profile = "official"
)

// GptImage2ChannelTier marks upstream capability on a channel.
type GptImage2ChannelTier string

const (
	GptImage2TierStandard GptImage2ChannelTier = "standard"
	GptImage2TierPacky    GptImage2ChannelTier = "packy"
	GptImage2TierOfficial GptImage2ChannelTier = "official"
)

// IsGptImage2Family reports whether model routing should apply gpt-image-2 tier rules.
func IsGptImage2Family(modelName string) bool {
	name := strings.TrimSpace(modelName)
	return name == gptImage2CanonicalModel || name == gptImage2OfficialAliasModel ||
		strings.HasPrefix(name, gptImage2CanonicalModel+"-")
}

// NormalizeGptImage2ModelName maps legacy official alias to the public model id.
func NormalizeGptImage2ModelName(modelName string) string {
	if strings.EqualFold(strings.TrimSpace(modelName), gptImage2OfficialAliasModel) {
		return gptImage2CanonicalModel
	}
	return modelName
}

// PrepareGptImage2ModelRequest classifies the request, stores routing context, and
// returns the canonical model name for channel selection.
func PrepareGptImage2ModelRequest(c *gin.Context, modelName string) string {
	if !IsGptImage2Family(modelName) {
		return modelName
	}
	// None of the enabled gpt-image-2 upstreams (packy #72, APIMart #59/#73/#81)
	// accept response_format; PackyAPI returns 400 Unknown parameter. Strip it here
	// — before routing and forwarding — so the request stays eligible for the cheap
	// channels instead of being forced onto the only upstream whose capability filter
	// didn't reject it. The client's requested format is remembered so the response
	// handler can convert the upstream payload back to what the client asked for.
	stripGptImage2UnsupportedParams(c)
	profile := ClassifyGptImage2Profile(c, modelName)
	officialFallback := classifyGptImage2OfficialFallback(c)
	if c != nil {
		c.Set(contextKeyGptImage2Profile, string(profile))
		c.Set(contextKeyGptImage2OfficialFB, officialFallback)
	}
	return NormalizeGptImage2ModelName(modelName)
}

// gptImage2UnsupportedParams lists request fields that no enabled gpt-image-2
// upstream honors; carrying them only causes upstream 400s and skews routing.
var gptImage2UnsupportedParams = []string{"response_format"}

// stripGptImage2UnsupportedParams removes unsupported fields from a JSON
// gpt-image-2 request body and rewrites the shared body storage so both channel
// routing and upstream forwarding observe the cleaned payload. Multipart bodies
// are left untouched (no enabled channel serves them with these fields set).
//
// The client's requested response_format is recorded on the context first, so
// GptImage2ConvertResponseFormat can transform the upstream payload back into the
// format the client asked for (url ↔ b64_json).
func stripGptImage2UnsupportedParams(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}
	if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		captureGptImage2ResponseFormat(c, gptImage2ResponseFormatFromForm(c))
		return
	}
	raw, err := readGptImage2RequestJSON(c)
	if err != nil || len(raw) == 0 {
		return
	}
	var fields map[string]json.RawMessage
	if common.Unmarshal(raw, &fields) != nil {
		return
	}
	if v, ok := fields["response_format"]; ok {
		captureGptImage2ResponseFormat(c, jsonString(v))
	}
	removed := false
	for _, key := range gptImage2UnsupportedParams {
		if _, ok := fields[key]; ok {
			delete(fields, key)
			removed = true
		}
	}
	if !removed {
		return
	}
	cleaned, err := common.Marshal(fields)
	if err != nil {
		return
	}
	storage, err := common.CreateBodyStorage(cleaned)
	if err != nil {
		return
	}
	c.Set(common.KeyBodyStorage, storage)
	c.Set(common.KeyRequestBody, cleaned)
	c.Request.Body = io.NopCloser(storage)
	c.Request.ContentLength = int64(len(cleaned))
}

// captureGptImage2ResponseFormat records a normalized client response_format
// ("url" or "b64_json") on the context; unknown/empty values are ignored so the
// response handler keeps the upstream's native format.
func captureGptImage2ResponseFormat(c *gin.Context, format string) {
	if c == nil {
		return
	}
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "url":
		c.Set(contextKeyGptImage2ResponseFmt, "url")
	case "b64_json":
		c.Set(contextKeyGptImage2ResponseFmt, "b64_json")
	}
}

func gptImage2ResponseFormatFromForm(c *gin.Context) string {
	if c == nil {
		return ""
	}
	form, err := common.ParseMultipartFormReusable(c)
	if err != nil || form == nil {
		return ""
	}
	return firstGptImage2FormValue(form.Value, "response_format")
}

// GptImage2ClientResponseFormat returns the response_format the client requested
// ("url", "b64_json", or "" when none/unsupported was set).
func GptImage2ClientResponseFormat(c *gin.Context) string {
	if c == nil {
		return ""
	}
	if v, ok := c.Get(contextKeyGptImage2ResponseFmt); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// GptImage2ProfileFromContext reads the profile set during distributor prep.
func GptImage2ProfileFromContext(c *gin.Context) GptImage2Profile {
	if c == nil {
		return GptImage2ProfileStandard
	}
	v, ok := c.Get(contextKeyGptImage2Profile)
	if !ok {
		return GptImage2ProfileStandard
	}
	s, _ := v.(string)
	switch GptImage2Profile(s) {
	case GptImage2ProfileOfficial:
		return GptImage2ProfileOfficial
	case GptImage2ProfilePacky:
		return GptImage2ProfilePacky
	default:
		return GptImage2ProfileStandard
	}
}

func gptImage2OfficialFallbackFromContext(c *gin.Context) bool {
	if c == nil {
		return false
	}
	v, ok := c.Get(contextKeyGptImage2OfficialFB)
	if !ok {
		return false
	}
	b, _ := v.(bool)
	return b
}

// GptImage2OfficialFallbackContextValue serializes official_fallback for async task storage.
func GptImage2OfficialFallbackContextValue(c *gin.Context) string {
	if gptImage2OfficialFallbackFromContext(c) {
		return "true"
	}
	return ""
}

func gptImage2RoutingRetryFromContext(c *gin.Context) int {
	if c == nil {
		return 0
	}
	if v, ok := c.Get(contextKeyGptImage2RoutingRetry); ok {
		if n, ok := v.(int); ok && n >= 0 {
			return n
		}
	}
	return RoutingRetryFromHeader(c)
}

func gptImage2ForRaceHedgeFromContext(c *gin.Context) bool {
	if c == nil {
		return false
	}
	v, ok := c.Get(contextKeyGptImage2RaceHedge)
	if !ok {
		return false
	}
	b, _ := v.(bool)
	return b
}

func gptImage2ClientAsyncPath(c *gin.Context) bool {
	if c == nil || c.Request == nil || c.Request.URL == nil {
		return false
	}
	return strings.HasSuffix(c.Request.URL.Path, "/images/generations/async")
}

func gptImage2EditsPath(c *gin.Context) bool {
	if c == nil || c.Request == nil || c.Request.URL == nil {
		return false
	}
	return strings.HasSuffix(c.Request.URL.Path, "/images/edits")
}

// SetGptImage2RoutingRetry stores relay retry index for channel-pick filters.
func SetGptImage2RoutingRetry(c *gin.Context, retry int) {
	if c != nil && retry >= 0 {
		c.Set(contextKeyGptImage2RoutingRetry, retry)
	}
}

// SetGptImage2RaceHedgePick marks the next channel pick as a race-hedge candidate.
func SetGptImage2RaceHedgePick(c *gin.Context, enabled bool) {
	if c != nil {
		c.Set(contextKeyGptImage2RaceHedge, enabled)
	}
}

// ClassifyGptImage2Profile decides standard vs official-required routing.
func ClassifyGptImage2Profile(c *gin.Context, modelName string) GptImage2Profile {
	if strings.EqualFold(strings.TrimSpace(modelName), gptImage2OfficialAliasModel) {
		return GptImage2ProfileOfficial
	}
	if c != nil && strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		if form, err := common.ParseMultipartFormReusable(c); err == nil && form != nil {
			if strings.HasSuffix(c.Request.URL.Path, "/images/edits") {
				return classifyGptImage2ProfileFromMultipartForm(form, true)
			}
			if multipartFormHasImageFiles(form) {
				return GptImage2ProfileOfficial
			}
			if profile, ok := classifyGptImage2ProfileFromFormValues(form.Value); ok {
				return profile
			}
		}
	}
	if raw, err := readGptImage2RequestJSON(c); err == nil && len(raw) > 0 {
		if profile, ok := classifyGptImage2ProfileFromJSON(raw); ok {
			return profile
		}
	}
	return GptImage2ProfileStandard
}

func classifyGptImage2ProfileFromMultipartForm(form *multipart.Form, isEdit bool) GptImage2Profile {
	if form == nil {
		return GptImage2ProfileStandard
	}
	if n := strings.TrimSpace(firstGptImage2FormValue(form.Value, "n")); n != "" {
		if f, err := strconv.ParseFloat(n, 64); err == nil && int(f) > 1 {
			return GptImage2ProfileOfficial
		}
	}
	if jsonFieldStringEqualsString(firstGptImage2FormValue(form.Value, "background"), "transparent") ||
		jsonFieldStringEqualsString(firstGptImage2FormValue(form.Value, "output_format"), "webp") ||
		formValuePresent(form.Value, "stream") ||
		formValuePresent(form.Value, "partial_images") ||
		formValuePresent(form.Value, "mask_url") {
		return GptImage2ProfileOfficial
	}
	if isEdit {
		return GptImage2ProfilePacky
	}
	if profile, ok := classifyGptImage2ProfileFromFormValues(form.Value); ok {
		return profile
	}
	return GptImage2ProfileStandard
}

func classifyGptImage2ProfileFromFormValues(values map[string][]string) (GptImage2Profile, bool) {
	if len(values) == 0 {
		return GptImage2ProfileStandard, false
	}
	if jsonFieldStringEqualsString(firstGptImage2FormValue(values, "background"), "transparent") ||
		jsonFieldStringEqualsString(firstGptImage2FormValue(values, "output_format"), "webp") ||
		formValuePresent(values, "stream") ||
		formValuePresent(values, "partial_images") ||
		formValuePresent(values, "mask_url") {
		return GptImage2ProfileOfficial, true
	}
	for _, key := range []string{"quality", "background", "moderation", "output_format", "output_compression", "input_fidelity"} {
		if formValuePresent(values, key) {
			return GptImage2ProfilePacky, true
		}
	}
	return GptImage2ProfileStandard, false
}

func multipartFormHasImageFiles(form *multipart.Form) bool {
	if form == nil || form.File == nil {
		return false
	}
	for _, key := range []string{"images", "image", "image[]"} {
		if files, ok := form.File[key]; ok && len(files) > 0 {
			return true
		}
	}
	for key, files := range form.File {
		if strings.HasPrefix(key, "image[") && len(files) > 0 {
			return true
		}
	}
	return false
}

func firstGptImage2FormValue(values map[string][]string, key string) string {
	if values == nil {
		return ""
	}
	if vals, ok := values[key]; ok && len(vals) > 0 {
		return strings.TrimSpace(vals[0])
	}
	return ""
}

func formValuePresent(values map[string][]string, key string) bool {
	return firstGptImage2FormValue(values, key) != ""
}

func readGptImage2RequestJSON(c *gin.Context) ([]byte, error) {
	if c == nil {
		return nil, nil
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	if storage == nil {
		return nil, nil
	}
	return storage.Bytes()
}

func classifyGptImage2OfficialFallback(c *gin.Context) bool {
	raw, err := readGptImage2RequestJSON(c)
	if err != nil || len(raw) == 0 {
		return false
	}
	var fields map[string]json.RawMessage
	if err := common.Unmarshal(raw, &fields); err != nil {
		return false
	}
	v, ok := fields["official_fallback"]
	if !ok || len(v) == 0 || string(v) == "null" {
		return false
	}
	var b bool
	if err := common.Unmarshal(v, &b); err == nil {
		return b
	}
	return strings.EqualFold(strings.Trim(string(v), `"`), "true")
}

func classifyGptImage2ProfileFromJSON(raw []byte) (GptImage2Profile, bool) {
	var fields map[string]json.RawMessage
	if err := common.Unmarshal(raw, &fields); err != nil {
		return GptImage2ProfileStandard, false
	}
	if rawN, ok := fields["n"]; ok && jsonFieldIntGreaterThan(rawN, 1) {
		return GptImage2ProfileOfficial, true
	}
	for _, key := range []string{"stream", "partial_images", "mask_url", "mask", "image_urls", "images", "image"} {
		if v, ok := fields[key]; ok && jsonFieldPresent(v) {
			return GptImage2ProfileOfficial, true
		}
	}
	if v, ok := fields["background"]; ok && jsonFieldPresent(v) {
		if jsonFieldStringEquals(v, "transparent") {
			return GptImage2ProfileOfficial, true
		}
		return GptImage2ProfilePacky, true
	}
	if v, ok := fields["output_format"]; ok && jsonFieldPresent(v) {
		if jsonFieldStringEquals(v, "webp") {
			return GptImage2ProfileOfficial, true
		}
		return GptImage2ProfilePacky, true
	}
	for _, key := range []string{
		"quality", "moderation", "output_compression", "input_fidelity",
	} {
		if v, ok := fields[key]; ok && jsonFieldPresent(v) {
			return GptImage2ProfilePacky, true
		}
	}
	return GptImage2ProfileStandard, true
}

func jsonFieldPresent(v json.RawMessage) bool {
	s := strings.TrimSpace(string(v))
	return s != "" && s != "null" && s != `""` && s != "0"
}

func jsonFieldStringEquals(v json.RawMessage, want string) bool {
	s := strings.TrimSpace(string(v))
	if s == "" || s == "null" {
		return false
	}
	var decoded string
	if err := common.Unmarshal(v, &decoded); err == nil {
		s = decoded
	} else {
		s = strings.Trim(s, `"`)
	}
	return strings.EqualFold(strings.TrimSpace(s), want)
}

func jsonFieldStringEqualsString(v string, want string) bool {
	return strings.EqualFold(strings.TrimSpace(strings.Trim(v, `"`)), want)
}

func jsonFieldIntGreaterThan(v json.RawMessage, min int) bool {
	s := strings.TrimSpace(string(v))
	if s == "" || s == "null" {
		return false
	}
	var n int
	if err := common.Unmarshal(v, &n); err == nil {
		return n > min
	}
	if f, err := strconv.ParseFloat(strings.Trim(s, `"`), 64); err == nil {
		return int(f) > min
	}
	return false
}

// ChannelGptImage2Tier resolves whether a channel is standard or official-capable.
func ChannelGptImage2Tier(ch *model.Channel) GptImage2ChannelTier {
	if ch == nil {
		return GptImage2TierStandard
	}
	settings := ch.GetOtherSettings()
	switch strings.ToLower(strings.TrimSpace(settings.GptImage2Tier)) {
	case string(GptImage2TierOfficial):
		return GptImage2TierOfficial
	case string(GptImage2TierPacky):
		return GptImage2TierPacky
	case string(GptImage2TierStandard):
		return GptImage2TierStandard
	}
	if channelMapsGptImage2ToOfficial(ch) {
		return GptImage2TierOfficial
	}
	if channelLooksLikePacky(ch) {
		return GptImage2TierPacky
	}
	return GptImage2TierStandard
}

func channelLooksLikePacky(ch *model.Channel) bool {
	if ch == nil {
		return false
	}
	parts := []string{ch.Name, ch.GetBaseURL(), ch.OtherInfo}
	if ch.Tag != nil {
		parts = append(parts, *ch.Tag)
	}
	if ch.Remark != nil {
		parts = append(parts, *ch.Remark)
	}
	for _, part := range parts {
		if strings.Contains(strings.ToLower(part), "packy") {
			return true
		}
	}
	return false
}

func channelMapsGptImage2ToOfficial(ch *model.Channel) bool {
	if ch.ModelMapping == nil {
		return false
	}
	mapping := strings.TrimSpace(*ch.ModelMapping)
	if mapping == "" || mapping == "{}" {
		return false
	}
	var modelMap map[string]string
	if err := json.Unmarshal([]byte(mapping), &modelMap); err != nil {
		return false
	}
	current := gptImage2CanonicalModel
	visited := map[string]bool{current: true}
	for {
		mapped, ok := modelMap[current]
		if !ok || strings.TrimSpace(mapped) == "" {
			break
		}
		if strings.Contains(strings.ToLower(mapped), "official") {
			return true
		}
		if visited[mapped] {
			break
		}
		visited[mapped] = true
		current = mapped
	}
	for src, dst := range modelMap {
		if strings.EqualFold(strings.TrimSpace(src), gptImage2OfficialAliasModel) &&
			strings.Contains(strings.ToLower(dst), "official") {
			return true
		}
	}
	return false
}

func gptImage2ChannelMatchesPick(
	tier GptImage2ChannelTier,
	profile GptImage2Profile,
	officialFallback bool,
	routingRetry int,
	forRaceHedge bool,
) bool {
	switch profile {
	case GptImage2ProfileOfficial:
		return tier == GptImage2TierOfficial
	case GptImage2ProfilePacky:
		return tier == GptImage2TierPacky || tier == GptImage2TierOfficial
	case GptImage2ProfileStandard:
		// Standard requests compete on user price across all enabled gpt-image-2 channels
		// (e.g. roma-image #33 and Apimart-image #59), not only standard-tier upstreams.
		return tier == GptImage2TierStandard || tier == GptImage2TierPacky || tier == GptImage2TierOfficial
	default:
		return true
	}
}

// GptImage2ChannelPickFilter builds a channel filter for gpt-image-2 tier routing.
func GptImage2ChannelPickFilter(c *gin.Context, modelName string) model.ChannelPickFilter {
	if !IsGptImage2Family(modelName) {
		return nil
	}
	request := gptImage2CapabilityRequestFromContext(c, modelName)
	return func(ch *model.Channel) bool {
		return gptImage2ChannelSupportsRequest(ch, request)
	}
}

// GptImage2ChannelPickFilterForTask builds the same document-driven capability
// filter for a detached async race hedge. The saved request body is authoritative;
// channel labels such as standard/packy/official are deliberately not used.
func GptImage2ChannelPickFilterForTask(modelName string, requestBody []byte) model.ChannelPickFilter {
	request := gptImage2CapabilityRequestFromJSON(modelName, requestBody)
	request.AsyncPath = true
	return func(ch *model.Channel) bool {
		return gptImage2ChannelSupportsRequest(ch, request)
	}
}

// gptImage2CapabilityRequest is the subset of an Images API request that changes
// upstream compatibility. It mirrors the published APIMart and PackyAPI docs.
type gptImage2CapabilityRequest struct {
	ExplicitOfficial  bool
	AsyncPath         bool
	EditsPath         bool
	Multipart         bool
	HasUploadedImage  bool
	HasUploadedMask   bool
	N                 int
	ImageURLCount     int
	HasMaskURL        bool
	HasStream         bool
	HasPartialImages  bool
	Quality           string
	Background        string
	OutputFormat      string
	OutputCompression bool
	ResponseFormat    string
	Moderation        string
	InputFidelity     string
	User              string
	Style             string
}

func gptImage2CapabilityRequestFromContext(c *gin.Context, modelName string) gptImage2CapabilityRequest {
	req := gptImage2CapabilityRequest{ExplicitOfficial: strings.EqualFold(strings.TrimSpace(modelName), gptImage2OfficialAliasModel), N: 1}
	if c == nil || c.Request == nil {
		return req
	}
	req.AsyncPath = gptImage2ClientAsyncPath(c)
	req.EditsPath = gptImage2EditsPath(c)
	req.Multipart = strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data")
	if req.Multipart {
		if form, err := common.ParseMultipartFormReusable(c); err == nil && form != nil {
			req.HasUploadedImage = multipartFormHasImageFiles(form)
			for _, key := range []string{"mask", "mask[]"} {
				if len(form.File[key]) > 0 {
					req.HasUploadedMask = true
				}
			}
			applyGptImage2FormCapabilities(&req, form.Value)
		}
		return req
	}
	raw, _ := readGptImage2RequestJSON(c)
	parsed := gptImage2CapabilityRequestFromJSON(modelName, raw)
	parsed.AsyncPath = req.AsyncPath
	parsed.EditsPath = req.EditsPath
	return parsed
}

func gptImage2CapabilityRequestFromJSON(modelName string, raw []byte) gptImage2CapabilityRequest {
	req := gptImage2CapabilityRequest{ExplicitOfficial: strings.EqualFold(strings.TrimSpace(modelName), gptImage2OfficialAliasModel), N: 1}
	var fields map[string]json.RawMessage
	if len(raw) == 0 || common.Unmarshal(raw, &fields) != nil {
		return req
	}
	if v, ok := fields["model"]; ok && jsonFieldStringEquals(v, gptImage2OfficialAliasModel) {
		req.ExplicitOfficial = true
	}
	if v, ok := fields["n"]; ok {
		var n int
		if common.Unmarshal(v, &n) == nil && n > 0 {
			req.N = n
		}
	}
	req.ImageURLCount = jsonArrayLength(fields["image_urls"])
	if req.ImageURLCount == 0 {
		for _, key := range []string{"images", "image"} {
			if jsonFieldPresent(fields[key]) {
				req.ImageURLCount = 1
				break
			}
		}
	}
	req.HasMaskURL = jsonFieldPresent(fields["mask_url"]) || jsonFieldPresent(fields["mask"])
	req.HasStream = jsonFieldPresent(fields["stream"])
	req.HasPartialImages = jsonFieldPresent(fields["partial_images"])
	req.Quality = jsonString(fields["quality"])
	req.Background = jsonString(fields["background"])
	req.OutputFormat = jsonString(fields["output_format"])
	req.OutputCompression = jsonFieldPresent(fields["output_compression"])
	req.ResponseFormat = jsonString(fields["response_format"])
	req.Moderation = jsonString(fields["moderation"])
	req.InputFidelity = jsonString(fields["input_fidelity"])
	req.User = jsonString(fields["user"])
	req.Style = jsonString(fields["style"])
	return req
}

func applyGptImage2FormCapabilities(req *gptImage2CapabilityRequest, values map[string][]string) {
	if req == nil {
		return
	}
	if n, err := strconv.Atoi(firstGptImage2FormValue(values, "n")); err == nil && n > 0 {
		req.N = n
	}
	req.Quality = firstGptImage2FormValue(values, "quality")
	req.Background = firstGptImage2FormValue(values, "background")
	req.OutputFormat = firstGptImage2FormValue(values, "output_format")
	req.OutputCompression = formValuePresent(values, "output_compression")
	req.ResponseFormat = firstGptImage2FormValue(values, "response_format")
	req.Moderation = firstGptImage2FormValue(values, "moderation")
	req.InputFidelity = firstGptImage2FormValue(values, "input_fidelity")
	req.User = firstGptImage2FormValue(values, "user")
	req.Style = firstGptImage2FormValue(values, "style")
	req.HasStream = formValuePresent(values, "stream")
	req.HasPartialImages = formValuePresent(values, "partial_images")
	req.HasMaskURL = formValuePresent(values, "mask_url")
}

func jsonString(v json.RawMessage) string {
	if !jsonFieldPresent(v) {
		return ""
	}
	var s string
	if common.Unmarshal(v, &s) == nil {
		return strings.ToLower(strings.TrimSpace(s))
	}
	return strings.ToLower(strings.Trim(strings.TrimSpace(string(v)), `"`))
}

func jsonArrayLength(v json.RawMessage) int {
	if !jsonFieldPresent(v) {
		return 0
	}
	var items []json.RawMessage
	if common.Unmarshal(v, &items) == nil {
		return len(items)
	}
	return 1
}

// gptImage2ChannelSupportsRequest applies the actual published contract of the
// four enabled image routes. Auto-cheapest keeps walking its price-ordered list
// whenever this function rejects a channel.
func gptImage2ChannelSupportsRequest(ch *model.Channel, req gptImage2CapabilityRequest) bool {
	if ch == nil {
		return false
	}
	switch ch.Id {
	case 59: // APIMart gpt-image-2-official
		if req.EditsPath || req.Multipart || req.AsyncPath && req.HasUploadedImage {
			return false
		}
		return req.N >= 1 && req.N <= 4 && req.ImageURLCount <= 16 &&
			!req.HasStream && !req.HasPartialImages && req.InputFidelity == "" && req.ResponseFormat == "" &&
			req.Style == "" && !strings.EqualFold(req.Background, "transparent")
	case 72: // PackyAPI Images API
		// The public async endpoint is also compatible with Packy's synchronous
		// Images API: the adaptor rewrites /generations/async to /generations and
		// the response handler wraps the completed image in a local task.
		if req.ExplicitOfficial || req.N != 1 || req.HasStream || req.HasPartialImages {
			return false
		}
		if req.EditsPath {
			return req.Multipart && req.HasUploadedImage && req.ImageURLCount == 0 && !req.HasMaskURL
		}
		return !req.Multipart && req.ImageURLCount == 0 && !req.HasMaskURL && !req.HasUploadedMask &&
			!strings.EqualFold(req.OutputFormat, "webp") && !strings.EqualFold(req.Background, "transparent") &&
			req.InputFidelity == "" && req.Style == ""
	case 73, 81: // APIMart gpt-image-2 generation
		return !req.ExplicitOfficial && !req.EditsPath && !req.Multipart && req.N >= 1 && req.N <= 10 &&
			req.ImageURLCount <= 16 && !req.HasMaskURL && !req.HasStream && !req.HasPartialImages &&
			req.Background == "" && req.OutputFormat == "" && !req.OutputCompression &&
			req.ResponseFormat == "" && req.Moderation == "" && req.InputFidelity == "" && req.User == "" && req.Style == ""
	default:
		// Unknown channels must opt in with an explicit capability implementation;
		// silently treating them as fully compatible recreates the old tier bug.
		return false
	}
}

// ValidateGptImage2Channel rejects a pre-selected channel that cannot serve the request profile.
func ValidateGptImage2Channel(c *gin.Context, channel *model.Channel, modelName string) error {
	if channel == nil || !IsGptImage2Family(modelName) {
		return nil
	}
	filter := GptImage2ChannelPickFilter(c, modelName)
	if filter != nil && !filter(channel) {
		return ErrGptImage2ChannelTierMismatch
	}
	return nil
}

// ShouldHideGptImage2OfficialModel hides the legacy alias from public model listings.
func ShouldHideGptImage2OfficialModel(modelName string) bool {
	return strings.EqualFold(strings.TrimSpace(modelName), gptImage2OfficialAliasModel)
}

// ResolveChannelUpstreamModel applies a channel's own model_mapping chain to modelName,
// returning the upstream model id that channel expects. A channel without a matching
// mapping returns modelName unchanged. Used so a race-hedge resubmission derives the
// upstream model from the *hedge* channel's mapping rather than inheriting the primary
// channel's mapped name embedded in the reused request body.
func ResolveChannelUpstreamModel(channel *model.Channel, modelName string) string {
	if channel == nil {
		return modelName
	}
	mapping := strings.TrimSpace(channel.GetModelMapping())
	if mapping == "" || mapping == "{}" {
		return modelName
	}
	var modelMap map[string]string
	if err := json.Unmarshal([]byte(mapping), &modelMap); err != nil {
		return modelName
	}
	current := modelName
	visited := map[string]bool{current: true}
	for {
		mapped, ok := modelMap[current]
		if !ok || strings.TrimSpace(mapped) == "" {
			break
		}
		if visited[mapped] {
			break
		}
		visited[mapped] = true
		current = mapped
	}
	return current
}

// ClassifyGptImage2ProfileFromImageRequest classifies from a parsed ImageRequest (tests/helpers).
func ClassifyGptImage2ProfileFromImageRequest(req *dto.ImageRequest) GptImage2Profile {
	if req == nil {
		return GptImage2ProfileStandard
	}
	if strings.EqualFold(strings.TrimSpace(req.Model), gptImage2OfficialAliasModel) {
		return GptImage2ProfileOfficial
	}
	if req.N != nil && *req.N > 1 {
		return GptImage2ProfileOfficial
	}
	if len(req.ImageUrls) > 0 || strings.TrimSpace(req.MaskUrl) != "" {
		return GptImage2ProfileOfficial
	}
	if jsonFieldPresent(req.Mask) || jsonFieldPresent(req.Images) || jsonFieldPresent(req.Image) ||
		jsonFieldPresent(req.PartialImages) {
		return GptImage2ProfileOfficial
	}
	if jsonFieldPresent(req.Background) {
		if jsonFieldStringEquals(req.Background, "transparent") {
			return GptImage2ProfileOfficial
		}
		return GptImage2ProfilePacky
	}
	if jsonFieldPresent(req.OutputFormat) {
		if jsonFieldStringEquals(req.OutputFormat, "webp") {
			return GptImage2ProfileOfficial
		}
		return GptImage2ProfilePacky
	}
	if strings.TrimSpace(req.Quality) != "" {
		return GptImage2ProfilePacky
	}
	if jsonFieldPresent(req.Moderation) || jsonFieldPresent(req.OutputCompression) ||
		jsonFieldPresent(req.InputFidelity) {
		return GptImage2ProfilePacky
	}
	if req.Extra != nil {
		if v, ok := req.Extra["mask_url"]; ok && jsonFieldPresent(v) {
			return GptImage2ProfileOfficial
		}
		if v, ok := req.Extra["image_urls"]; ok && jsonFieldPresent(v) {
			return GptImage2ProfileOfficial
		}
	}
	return GptImage2ProfileStandard
}
