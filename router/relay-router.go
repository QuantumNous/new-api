package router

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

// Named relay handlers — each gets a unique function name that Fuego uses as operationId.

func RelayListModels(c *gin.Context) {
	switch {
	case c.GetHeader("x-api-key") != "" && c.GetHeader("anthropic-version") != "":
		controller.ListModels(c, constant.ChannelTypeAnthropic)
	case c.GetHeader("x-goog-api-key") != "" || c.Query("key") != "":
		controller.RetrieveModel(c, constant.ChannelTypeGemini)
	default:
		controller.ListModels(c, constant.ChannelTypeOpenAI)
	}
}

func RelayRetrieveModel(c *gin.Context) {
	switch {
	case c.GetHeader("x-api-key") != "" && c.GetHeader("anthropic-version") != "":
		controller.RetrieveModel(c, constant.ChannelTypeAnthropic)
	default:
		controller.RetrieveModel(c, constant.ChannelTypeOpenAI)
	}
}

func RelayListGeminiModels(c *gin.Context) {
	controller.ListModels(c, constant.ChannelTypeGemini)
}

func RelayListGeminiCompatModels(c *gin.Context) {
	controller.ListModels(c, constant.ChannelTypeOpenAI)
}

func RelayMessages(c *gin.Context) {
	controller.Relay(c, types.RelayFormatClaude)
}

func RelayCompletions(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAI)
}

func RelayChatCompletions(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAI)
}

func RelayResponses(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAIResponses)
}

func RelayResponsesCompact(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAIResponsesCompaction)
}

func RelayEdits(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAIImage)
}

func RelayImageGenerations(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAIImage)
}

func RelayImageEdits(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAIImage)
}

func RelayEmbeddings(c *gin.Context) {
	controller.Relay(c, types.RelayFormatEmbedding)
}

func RelayAudioTranscriptions(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAIAudio)
}

func RelayAudioTranslations(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAIAudio)
}

func RelayAudioSpeech(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAIAudio)
}

func RelayRerank(c *gin.Context) {
	controller.Relay(c, types.RelayFormatRerank)
}

func RelayEngineEmbeddings(c *gin.Context) {
	controller.Relay(c, types.RelayFormatGemini)
}

func RelayGeminiModel(c *gin.Context) {
	controller.Relay(c, types.RelayFormatGemini)
}

func RelayModerations(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAI)
}

func RelayRealtime(c *gin.Context) {
	controller.Relay(c, types.RelayFormatOpenAIRealtime)
}

func RelayGeminiBeta(c *gin.Context) {
	controller.Relay(c, types.RelayFormatGemini)
}

func SetRelayRouter(router *gin.Engine, engine *fuego.Engine) {
	router.Use(middleware.CORS())
	router.Use(middleware.DecompressRequestMiddleware())
	router.Use(middleware.BodyStorageCleanup())
	router.Use(middleware.StatsMiddleware())

	// ---- Models routes ----
	modelsRouter := router.Group("/v1/models")
	modelsRouter.Use(middleware.RouteTag("relay"))
	modelsRouter.Use(middleware.TokenAuth())
	models := dto.NewRouter(engine, modelsRouter, "Relay", secToken())
	{
		models.GinGet("", RelayListModels, dto.GinResp[dto.ApiResponse]())
		models.GinGet("/:model", RelayRetrieveModel, dto.GinResp[dto.OpenAIModels]())
	}

	geminiRouter := router.Group("/v1beta/models")
	geminiRouter.Use(middleware.RouteTag("relay"))
	geminiRouter.Use(middleware.TokenAuth())
	geminiModels := dto.NewRouter(engine, geminiRouter, "Relay", secToken())
	{
		geminiModels.GinGet("", RelayListGeminiModels, dto.GinResp[dto.GeminiModelList]())
	}

	geminiCompatibleRouter := router.Group("/v1beta/openai/models")
	geminiCompatibleRouter.Use(middleware.RouteTag("relay"))
	geminiCompatibleRouter.Use(middleware.TokenAuth())
	geminiCompatModels := dto.NewRouter(engine, geminiCompatibleRouter, "Relay", secToken())
	{
		geminiCompatModels.GinGet("", RelayListGeminiCompatModels, dto.GinResp[dto.ApiResponse]())
	}

	// ---- Playground route ----
	playgroundRouter := router.Group("/pg")
	playgroundRouter.Use(middleware.RouteTag("relay"))
	playgroundRouter.Use(middleware.SystemPerformanceCheck())
	playgroundRouter.Use(middleware.UserAuth(), middleware.Distribute())
	pg := dto.NewRouter(engine, playgroundRouter, "Playground", secDashboard())
	{
		pg.GinPost("/chat/completions", controller.Playground, dto.GinResp[dto.ChatCompletionResponse]())
	}

	// ---- Relay v1 routes ----
	relayV1Router := router.Group("/v1")
	relayV1Router.Use(middleware.RouteTag("relay"))
	relayV1Router.Use(middleware.SystemPerformanceCheck())
	relayV1Router.Use(middleware.TokenAuth())
	relayV1Router.Use(middleware.ModelRequestRateLimit())

	// WebSocket route
	wsRouter := relayV1Router.Group("")
	wsRouter.Use(middleware.Distribute())
	wsRouter.GET("/realtime", RelayRealtime)

	// HTTP relay routes
	httpRouter := relayV1Router.Group("")
	httpRouter.Use(middleware.Distribute())
	r := dto.NewRouter(engine, httpRouter, "Relay", secToken())

	// claude related routes
	r.GinPost("/messages", RelayMessages, dto.GinResp[dto.ClaudeMessageResponse]())

	// chat related routes
	r.GinPost("/completions", RelayCompletions, dto.GinResp[dto.CompletionResponse]())
	r.GinPost("/chat/completions", RelayChatCompletions, dto.GinResp[dto.ChatCompletionResponse]())

	// response related routes
	r.GinPost("/responses", RelayResponses, dto.GinResp[dto.ResponsesAPIResponse]())
	r.GinPost("/responses/compact", RelayResponsesCompact, dto.GinResp[dto.ResponsesAPIResponse]())

	// image related routes
	r.GinPost("/edits", RelayEdits, dto.GinResp[dto.ImageGenerationResponse]())
	r.GinPost("/images/generations", RelayImageGenerations, dto.GinResp[dto.ImageGenerationResponse]())
	r.GinPost("/images/edits", RelayImageEdits, dto.GinResp[dto.ImageGenerationResponse]())

	// embedding related routes
	r.GinPost("/embeddings", RelayEmbeddings, dto.GinResp[dto.EmbeddingResponse]())

	// audio related routes
	r.GinPost("/audio/transcriptions", RelayAudioTranscriptions, dto.GinResp[dto.AudioTranscriptionResponse]())
	r.GinPost("/audio/translations", RelayAudioTranslations, dto.GinResp[dto.AudioTranscriptionResponse]())
	r.GinPost("/audio/speech", RelayAudioSpeech, dto.GinResp[dto.MessageResponse]())

	// rerank related routes
	r.GinPost("/rerank", RelayRerank, dto.GinResp[dto.RerankResponse]())

	// gemini relay routes
	r.GinPost("/engines/:model/embeddings", RelayEngineEmbeddings, dto.GinResp[dto.EmbeddingResponse]())
	r.GinPost("/models/*path", RelayGeminiModel, dto.GinResp[dto.ChatCompletionResponse]())

	// other relay routes
	r.GinPost("/moderations", RelayModerations, dto.GinResp[dto.ModerationResponse]())

	// Not implemented routes
	r.GinPost("/images/variations", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinGet("/files", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinPost("/files", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinDelete("/files/:id", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinGet("/files/:id", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinGet("/files/:id/content", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinPost("/fine-tunes", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinGet("/fine-tunes", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinGet("/fine-tunes/:id", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinPost("/fine-tunes/:id/cancel", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinGet("/fine-tunes/:id/events", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())
	r.GinDelete("/models/:model", controller.RelayNotImplemented, dto.GinResp[dto.RelayNotImplementedError]())

	// ---- Midjourney relay routes ----
	relayMjRouter := router.Group("/mj")
	relayMjRouter.Use(middleware.RouteTag("relay"))
	relayMjRouter.Use(middleware.SystemPerformanceCheck())
	registerMjRouterGroup(dto.NewRouter(engine, relayMjRouter, "Midjourney", secToken()), relayMjRouter)

	relayMjModeRouter := router.Group("/:mode/mj")
	relayMjModeRouter.Use(middleware.RouteTag("relay"))
	relayMjModeRouter.Use(middleware.SystemPerformanceCheck())
	registerMjRouterGroup(dto.NewRouter(engine, relayMjModeRouter, "Midjourney", secToken()), relayMjModeRouter)

	// ---- Suno relay routes ----
	relaySunoRouter := router.Group("/suno")
	relaySunoRouter.Use(middleware.RouteTag("relay"))
	relaySunoRouter.Use(middleware.SystemPerformanceCheck())
	relaySunoRouter.Use(middleware.TokenAuth(), middleware.Distribute())
	suno := dto.NewRouter(engine, relaySunoRouter, "Suno", secToken())
	{
		suno.GinPost("/submit/:action", controller.RelayTask, dto.GinResp[dto.TaskResponseDoc]())
		suno.GinPost("/fetch", controller.RelayTaskFetch, dto.GinResp[dto.TaskResponseDoc]())
		suno.GinGet("/fetch/:id", controller.RelayTaskFetch, dto.GinResp[dto.TaskResponseDoc]())
	}

	// ---- Gemini relay routes ----
	relayGeminiRouter := router.Group("/v1beta")
	relayGeminiRouter.Use(middleware.RouteTag("relay"))
	relayGeminiRouter.Use(middleware.SystemPerformanceCheck())
	relayGeminiRouter.Use(middleware.TokenAuth())
	relayGeminiRouter.Use(middleware.ModelRequestRateLimit())
	relayGeminiRouter.Use(middleware.Distribute())
	gemini := dto.NewRouter(engine, relayGeminiRouter, "Relay", secToken())
	{
		// Gemini API 路径格式: /v1beta/models/{model_name}:{action}
		gemini.GinPost("/models/*path", RelayGeminiBeta, dto.GinResp[dto.ChatCompletionResponse]())
	}
}

func registerMjRouterGroup(mj *dto.Router, relayMjRouter *gin.RouterGroup) {
	relayMjRouter.GET("/image/:id", relay.RelayMidjourneyImage)
	relayMjRouter.Use(middleware.TokenAuth(), middleware.Distribute())
	{
		mj.GinPost("/submit/action", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/submit/shorten", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/submit/modal", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/submit/imagine", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/submit/change", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/submit/simple-change", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/submit/describe", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/submit/blend", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/submit/edits", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/submit/video", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/notify", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinGet("/task/:id/fetch", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinGet("/task/:id/image-seed", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/task/list-by-condition", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/insight-face/swap", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
		mj.GinPost("/submit/upload-discord-images", controller.RelayMidjourney, dto.GinResp[dto.MidjourneyResponse]())
	}
}
