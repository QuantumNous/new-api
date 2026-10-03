package constant

import (
	"net/http"
	"strings"
)

const (
	RelayModeUnknown = iota
	RelayModeChatCompletions
	RelayModeCompletions
	RelayModeEmbeddings
	RelayModeModerations
	RelayModeImagesGenerations
	RelayModeImagesEdits
	RelayModeEdits

	RelayModeMidjourneyImagine
	RelayModeMidjourneyDescribe
	RelayModeMidjourneyBlend
	RelayModeMidjourneyChange
	RelayModeMidjourneySimpleChange
	RelayModeMidjourneyNotify
	RelayModeMidjourneyTaskFetch
	RelayModeMidjourneyTaskImageSeed
	RelayModeMidjourneyTaskFetchByCondition
	RelayModeMidjourneyAction
	RelayModeMidjourneyModal
	RelayModeMidjourneyShorten
	RelayModeSwapFace
	RelayModeMidjourneyUpload
	RelayModeMidjourneyVideo
	RelayModeMidjourneyEdits

	RelayModeAudioSpeech        // tts
	RelayModeAudioTranscription // whisper
	RelayModeAudioTranslation   // whisper

	RelayModeMiniMaxMusicGeneration
	RelayModeMiniMaxMusicCoverPreprocess
	RelayModeMiniMaxLyricsGeneration

	RelayModeSunoFetch
	RelayModeSunoFetchByID
	RelayModeSunoSubmit

	RelayModeVideoFetchByID
	RelayModeVideoSubmit

	RelayModeRerank

	RelayModeResponses

	RelayModeRealtime
	RelayModeXAINative
	RelayModeMoarkNative

	RelayModeGemini

	RelayModeResponsesCompact

	RelayModeResponsesInputTokens
	RelayModeClaudeCountTokens

	RelayModeOCR

	RelayModeGeminiInteractions

	RelayModeStepFunNative
	RelayModeCohereNative

	RelayModeTypeSafeNative
)

func Path2RelayMode(path string) int {
	relayMode := RelayModeUnknown
	// Normalize /pg/ prefix to /v1/ for playground routes
	normalizedPath := path
	if strings.HasPrefix(path, "/pg/v1beta/") {
		normalizedPath = strings.TrimPrefix(path, "/pg")
	} else if strings.HasPrefix(path, "/pg/") {
		normalizedPath = "/v1/" + path[4:]
	}
	path = normalizedPath
	if strings.HasPrefix(path, "/v1/chat/completions") {
	} else if strings.HasPrefix(path, "/v1/completions") {
		relayMode = RelayModeCompletions
	} else if strings.HasPrefix(path, "/v1/embeddings") {
		relayMode = RelayModeEmbeddings
	} else if strings.HasSuffix(path, "embeddings") {
		relayMode = RelayModeEmbeddings
	} else if strings.HasPrefix(path, "/v1/moderations") {
		relayMode = RelayModeModerations
	} else if strings.HasPrefix(path, "/v1/images/generations") || strings.HasPrefix(path, "/v1/image_generation") {
		relayMode = RelayModeImagesGenerations
	} else if strings.HasPrefix(path, "/v1/images/edits") {
		relayMode = RelayModeImagesEdits
	} else if strings.HasPrefix(path, "/v1/edits") {
		relayMode = RelayModeEdits
	} else if strings.HasPrefix(path, "/v1/messages/count_tokens") {
		relayMode = RelayModeClaudeCountTokens
	} else if strings.HasPrefix(path, "/v1/responses/compact") {
		relayMode = RelayModeResponsesCompact
	} else if strings.HasPrefix(path, "/v1/responses/input_tokens") {
		relayMode = RelayModeResponsesInputTokens
	} else if strings.HasPrefix(path, "/v1/responses/") {
		relayMode = RelayModeXAINative
	} else if strings.HasPrefix(path, "/v1/responses") {
		relayMode = RelayModeResponses
	} else if strings.HasPrefix(path, "/v1/chat/deferred-completion/") {
		relayMode = RelayModeXAINative
	} else if strings.HasPrefix(path, "/v1/audio/speech") {
		relayMode = RelayModeAudioSpeech
	} else if strings.HasPrefix(path, "/v1/audio/transcriptions") {
		relayMode = RelayModeAudioTranscription
	} else if strings.HasPrefix(path, "/v1/audio/translations") {
		relayMode = RelayModeAudioTranslation
	} else if strings.HasPrefix(path, "/v1/async/") ||
		path == "/v1/tasks" ||
		strings.HasPrefix(path, "/v1/tasks/") ||
		strings.HasPrefix(path, "/v1/task/") {
		relayMode = RelayModeMoarkNative
	} else if strings.HasPrefix(path, "/v1/realtime/client_secrets") ||
		strings.HasPrefix(path, "/v1/tts") ||
		strings.HasPrefix(path, "/v1/stt") ||
		strings.HasPrefix(path, "/v1/custom-voices") {
		relayMode = RelayModeXAINative
	} else if strings.HasPrefix(path, "/v1/music_generation") {
		relayMode = RelayModeMiniMaxMusicGeneration
	} else if strings.HasPrefix(path, "/v1/music_cover_preprocess") {
		relayMode = RelayModeMiniMaxMusicCoverPreprocess
	} else if strings.HasPrefix(path, "/v1/lyrics_generation") {
		relayMode = RelayModeMiniMaxLyricsGeneration
	} else if strings.HasPrefix(path, "/v1/ocr") {
		relayMode = RelayModeOCR
	} else if strings.HasPrefix(path, "/v1/rerank") {
		relayMode = RelayModeRerank
	} else if path == "/v1/systemone" {
		relayMode = RelayModeTypeSafeNative
	} else if strings.HasPrefix(path, "/v1/realtime") {
		relayMode = RelayModeRealtime
	} else if path == "/v1/video/generations" ||
		path == "/v1/videos/generations" ||
		path == "/v1/videos/edits" ||
		path == "/v1/videos/extensions" ||
		path == "/v1/videos" ||
		(strings.HasPrefix(path, "/v1/videos/") && strings.HasSuffix(path, "/remix")) {
		relayMode = RelayModeVideoSubmit
	} else if strings.HasPrefix(path, "/v1/video/generations/") ||
		strings.HasPrefix(path, "/v1/videos/") {
		relayMode = RelayModeVideoFetchByID
	} else if strings.HasPrefix(path, "/v1beta/interactions") || strings.HasPrefix(path, "/v1beta2/interactions") || strings.HasPrefix(path, "/v1/interactions") {
		relayMode = RelayModeGeminiInteractions
	} else if strings.HasPrefix(path, "/v1beta/models") || strings.HasPrefix(path, "/v1/models") {
		relayMode = RelayModeGemini
	} else if strings.HasPrefix(path, "/mj") {
		relayMode = Path2RelayModeMidjourney(path)
	}
	return relayMode
}

func Path2RelayModeMidjourney(path string) int {
	relayMode := RelayModeUnknown
	if strings.HasSuffix(path, "/mj/submit/action") {
		// midjourney plus
		relayMode = RelayModeMidjourneyAction
	} else if strings.HasSuffix(path, "/mj/submit/modal") {
		// midjourney plus
		relayMode = RelayModeMidjourneyModal
	} else if strings.HasSuffix(path, "/mj/submit/shorten") {
		// midjourney plus
		relayMode = RelayModeMidjourneyShorten
	} else if strings.HasSuffix(path, "/mj/insight-face/swap") {
		// midjourney plus
		relayMode = RelayModeSwapFace
	} else if strings.HasSuffix(path, "/submit/upload-discord-images") {
		// midjourney plus
		relayMode = RelayModeMidjourneyUpload
	} else if strings.HasSuffix(path, "/mj/submit/imagine") {
		relayMode = RelayModeMidjourneyImagine
	} else if strings.HasSuffix(path, "/mj/submit/video") {
		relayMode = RelayModeMidjourneyVideo
	} else if strings.HasSuffix(path, "/mj/submit/edits") {
		relayMode = RelayModeMidjourneyEdits
	} else if strings.HasSuffix(path, "/mj/submit/blend") {
		relayMode = RelayModeMidjourneyBlend
	} else if strings.HasSuffix(path, "/mj/submit/describe") {
		relayMode = RelayModeMidjourneyDescribe
	} else if strings.HasSuffix(path, "/mj/notify") {
		relayMode = RelayModeMidjourneyNotify
	} else if strings.HasSuffix(path, "/mj/submit/change") {
		relayMode = RelayModeMidjourneyChange
	} else if strings.HasSuffix(path, "/mj/submit/simple-change") {
		relayMode = RelayModeMidjourneyChange
	} else if strings.HasSuffix(path, "/fetch") {
		relayMode = RelayModeMidjourneyTaskFetch
	} else if strings.HasSuffix(path, "/image-seed") {
		relayMode = RelayModeMidjourneyTaskImageSeed
	} else if strings.HasSuffix(path, "/list-by-condition") {
		relayMode = RelayModeMidjourneyTaskFetchByCondition
	}
	return relayMode
}

func Path2RelaySuno(method, path string) int {
	relayMode := RelayModeUnknown
	if method == http.MethodPost && strings.HasSuffix(path, "/fetch") {
		relayMode = RelayModeSunoFetch
	} else if method == http.MethodGet && strings.Contains(path, "/fetch/") {
		relayMode = RelayModeSunoFetchByID
	} else if strings.Contains(path, "/submit/") {
		relayMode = RelayModeSunoSubmit
	}
	return relayMode
}
