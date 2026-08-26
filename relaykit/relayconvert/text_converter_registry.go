package relayconvert

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// TextConverterQuality is the projection quality of a text From→IR→To route.
type TextConverterQuality string

const (
	TextConverterQualityGood TextConverterQuality = "good"
	TextConverterQualityFair TextConverterQuality = "fair"
)

// TextRoute is audit metadata for a text conversion edge. Execution is always
// IR (From → To); this table does not hold pairwise Convert funcs.
type TextRoute struct {
	ID      string
	From    types.RelayFormat
	To      types.RelayFormat
	Quality TextConverterQuality
}

type textRouteKey struct {
	from types.RelayFormat
	to   types.RelayFormat
}

var (
	textRouteMu   sync.RWMutex
	textRoutes    = make(map[string]TextRoute)
	textRoutePair = make(map[textRouteKey]string)
)

var builtinTextRoutes = []TextRoute{
	{ID: ConverterClaudeMessagesToOpenAIChat, From: types.RelayFormatClaude, To: types.RelayFormatOpenAI, Quality: TextConverterQualityFair},
	{ID: ConverterOpenAIChatToClaudeMessages, From: types.RelayFormatOpenAI, To: types.RelayFormatClaude, Quality: TextConverterQualityFair},
	{ID: ConverterGeminiContentToOpenAIChat, From: types.RelayFormatGemini, To: types.RelayFormatOpenAI, Quality: TextConverterQualityFair},
	{ID: ConverterOpenAIChatToGeminiContent, From: types.RelayFormatOpenAI, To: types.RelayFormatGemini, Quality: TextConverterQualityFair},
	{ID: ConverterOpenAIChatToOpenAIResponses, From: types.RelayFormatOpenAI, To: types.RelayFormatOpenAIResponses, Quality: TextConverterQualityGood},
	{ID: ConverterOpenAIResponsesToOpenAIChat, From: types.RelayFormatOpenAIResponses, To: types.RelayFormatOpenAI, Quality: TextConverterQualityGood},
	{ID: requestConverterClaudeToGemini, From: types.RelayFormatClaude, To: types.RelayFormatGemini, Quality: TextConverterQualityFair},
	{ID: requestConverterClaudeToResponses, From: types.RelayFormatClaude, To: types.RelayFormatOpenAIResponses, Quality: TextConverterQualityFair},
	{ID: requestConverterGeminiToClaude, From: types.RelayFormatGemini, To: types.RelayFormatClaude, Quality: TextConverterQualityFair},
	{ID: requestConverterGeminiToResponses, From: types.RelayFormatGemini, To: types.RelayFormatOpenAIResponses, Quality: TextConverterQualityFair},
	{ID: requestConverterResponsesToClaude, From: types.RelayFormatOpenAIResponses, To: types.RelayFormatClaude, Quality: TextConverterQualityFair},
	{ID: ConverterOpenAIResponsesToGemini, From: types.RelayFormatOpenAIResponses, To: types.RelayFormatGemini, Quality: TextConverterQualityFair},
}

func init() {
	for _, route := range builtinTextRoutes {
		registerTextRoute(route)
	}
}

func registerTextRoute(route TextRoute) {
	route.ID = strings.TrimSpace(route.ID)
	if route.ID == "" {
		panic("text route ID is required")
	}
	if route.From == "" || route.To == "" {
		panic("text route " + route.ID + " must declare from and to formats")
	}
	if route.Quality == "" {
		panic("text route " + route.ID + " must declare quality")
	}
	if _, exists := textRoutes[route.ID]; exists {
		panic("text route " + route.ID + " is already registered")
	}
	key := textRouteKey{from: route.From, to: route.To}
	if existing, exists := textRoutePair[key]; exists {
		panic("text route from " + string(route.From) + " to " + string(route.To) + " is already registered by " + existing)
	}
	textRoutes[route.ID] = route
	textRoutePair[key] = route.ID
}

// LookupTextConverter returns IR route metadata for a converter ID.
func LookupTextConverter(converter string) (TextRoute, bool) {
	textRouteMu.RLock()
	defer textRouteMu.RUnlock()
	route, ok := textRoutes[strings.TrimSpace(converter)]
	return route, ok
}

func lookupTextRoute(from, to types.RelayFormat) (TextRoute, bool) {
	textRouteMu.RLock()
	defer textRouteMu.RUnlock()
	id, ok := textRoutePair[textRouteKey{from: from, to: to}]
	if !ok {
		return TextRoute{}, false
	}
	return textRoutes[id], true
}
