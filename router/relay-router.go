package router

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel/stepfun"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func SetRelayRouter(router *gin.Engine) {
	router.Use(middleware.CORS())
	router.Use(middleware.DecompressRequestMiddleware())
	router.Use(middleware.BodyStorageCleanup()) // 清理请求体存储
	router.Use(middleware.StatsMiddleware())
	// https://platform.openai.com/docs/api-reference/introduction
	modelsRouter := router.Group("/v1/models")
	modelsRouter.Use(middleware.RouteTag("relay"))
	modelsRouter.Use(middleware.TokenAuth())
	{
		modelsRouter.GET("", func(c *gin.Context) {
			switch {
			case c.GetHeader("x-api-key") != "" && c.GetHeader("anthropic-version") != "":
				controller.ListModels(c, constant.ChannelTypeAnthropic)
			case c.GetHeader("x-goog-api-key") != "" || c.Query("key") != "": // 单独的适配
				controller.ListModels(c, constant.ChannelTypeGemini)
			default:
				controller.ListModels(c, constant.ChannelTypeOpenAI)
			}
		})

		modelsRouter.GET("/:model", func(c *gin.Context) {
			switch {
			case c.GetHeader("x-api-key") != "" && c.GetHeader("anthropic-version") != "":
				controller.RetrieveModel(c, constant.ChannelTypeAnthropic)
			default:
				controller.RetrieveModel(c, constant.ChannelTypeOpenAI)
			}
		})
	}

	geminiRouter := router.Group("/v1beta/models")
	geminiRouter.Use(middleware.RouteTag("relay"))
	geminiRouter.Use(middleware.TokenAuth())
	{
		geminiRouter.GET("", func(c *gin.Context) {
			controller.ListModels(c, constant.ChannelTypeGemini)
		})
		geminiRouter.GET("/:model", func(c *gin.Context) {
			controller.RetrieveModel(c, constant.ChannelTypeGemini)
		})
	}

	geminiCompatibleRouter := router.Group("/v1beta/openai/models")
	geminiCompatibleRouter.Use(middleware.RouteTag("relay"))
	geminiCompatibleRouter.Use(middleware.TokenAuth())
	{
		geminiCompatibleRouter.GET("", func(c *gin.Context) {
			controller.ListModels(c, constant.ChannelTypeOpenAI)
		})
		geminiCompatibleRouter.GET("/:model", func(c *gin.Context) {
			controller.RetrieveModel(c, constant.ChannelTypeOpenAI)
		})
	}

	playgroundRouter := router.Group("/pg")
	playgroundRouter.Use(middleware.RouteTag("relay"))
	playgroundRouter.Use(middleware.SystemPerformanceCheck())
	playgroundRouter.Use(middleware.UserAuth(), middleware.Distribute(), middleware.GroupConcurrencyLimit())
	{
		// chat 接口
		playgroundRouter.POST("/chat/completions", controller.Playground)
		playgroundRouter.POST("/responses", controller.Playground)
		playgroundRouter.POST("/messages", controller.Playground)
		playgroundRouter.POST("/responses/compact", controller.Playground)

		// 图片接口
		playgroundRouter.POST("/images/generations", controller.Playground)
		playgroundRouter.POST("/images/edits", controller.Playground)

		// 视频接口
		playgroundRouter.POST("/videos/generations", controller.Playground)
		playgroundRouter.POST("/videos/edits", controller.Playground)
		playgroundRouter.POST("/videos/extensions", controller.Playground)

		// 音频接口
		playgroundRouter.POST("/audio/speech", controller.Playground)
		playgroundRouter.POST("/audio/transcriptions", controller.Playground)

		// Gemini 原生接口
		playgroundRouter.POST("/v1beta/models/*path", controller.Playground)
	}
	relayV1Router := router.Group("/v1")
	relayV1Router.Use(middleware.RouteTag("relay"))
	relayV1Router.Use(middleware.SystemPerformanceCheck())
	relayV1Router.Use(middleware.TokenAuth())
	relayV1Router.Use(middleware.ModelRequestRateLimit())
	relayV1Router.Use(middleware.TokenRateLimit())
	{
		// Cohere native v2 requests retain their original path and JSON/SSE format.
		cohereV2 := router.Group("/v2")
		cohereV2.Use(middleware.RouteTag("relay"), middleware.SystemPerformanceCheck(), middleware.TokenAuth(), middleware.ModelRequestRateLimit(), middleware.TokenRateLimit(), middleware.Distribute(), middleware.GroupConcurrencyLimit())
		for _, path := range []string{"/chat", "/embed", "/rerank"} {
			cohereV2.POST(path, func(c *gin.Context) {
				controller.Relay(c, types.RelayFormatCohereNative)
			})
		}
		// WebSocket 路由（统一到 Relay）
		wsRouter := relayV1Router.Group("")
		wsRouter.Use(middleware.Distribute(), middleware.GroupConcurrencyLimit())
		wsRouter.GET("/realtime", func(c *gin.Context) {
			// StepFun 双向实时语音与 OpenAI Realtime 共用 /v1/realtime，按模型分派
			if stepfun.IsRealtimeModel(c.Query("model")) {
				controller.Relay(c, types.RelayFormatStepFunWss)
				return
			}
			controller.Relay(c, types.RelayFormatOpenAIRealtime)
		})
		// StepFun 原生 WebSocket 端点（原始双向透传）
		wsRouter.GET("/realtime/audio", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatStepFunWss)
		})
		wsRouter.GET("/audio/asr/stream", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatStepFunWss)
		})
		wsRouter.GET("/tts", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAIRealtime)
		})
		wsRouter.GET("/stt", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAIRealtime)
		})
		wsRouter.GET("/responses", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAIRealtime)
		})
	}
	{
		//http router
		httpRouter := relayV1Router.Group("")
		httpRouter.Use(middleware.Distribute(), middleware.GroupConcurrencyLimit())

		// claude related routes
		httpRouter.POST("/messages/count_tokens", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatClaude)
		})
		httpRouter.POST("/messages", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatClaude)
		})

		// chat related routes
		httpRouter.POST("/completions", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAI)
		})
		httpRouter.POST("/chat/completions", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAI)
		})
		httpRouter.GET("/chat/deferred-completion/:request_id", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})

		// response related routes
		httpRouter.POST("/responses", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIResponses)
		})
		httpRouter.POST("/responses/compact", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIResponsesCompaction)
		})
		httpRouter.POST("/responses/input_tokens", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIResponses)
		})
		httpRouter.GET("/responses/:response_id", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.DELETE("/responses/:response_id", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})

		// image related routes
		httpRouter.POST("/edits", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIImage)
		})
		httpRouter.POST("/images/generations", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIImage)
		})
		httpRouter.POST("/image_generation", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIImage)
		})
		httpRouter.POST("/images/edits", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIImage)
		})

		// embedding related routes
		httpRouter.POST("/embeddings", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatEmbedding)
		})

		// audio related routes
		httpRouter.POST("/audio/transcriptions", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIAudio)
		})
		httpRouter.POST("/audio/translations", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIAudio)
		})
		httpRouter.POST("/audio/speech", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIAudio)
		})

		// StepFun native audio / music / voice routes（入站路径与上游 1:1，仅 StepFun 渠道生效）
		for _, route := range []struct {
			method string
			path   string
		}{
			{"POST", "/audio/generate"},
			{"POST", "/audio/music/submit"},
			{"POST", "/audio/music/query"},
			{"POST", "/audio/asr/sse"},
			{"POST", "/audio/asr/file/submit"},
			{"POST", "/audio/asr/file/query"},
			{"POST", "/audio/voices"},
			{"GET", "/audio/voices"},
			{"POST", "/audio/voices/preview"},
			{"GET", "/audio/system_voices"},
		} {
			method, path := route.method, route.path
			httpRouter.Handle(method, path, func(c *gin.Context) {
				controller.Relay(c, types.RelayFormatStepFunNative)
			})
		}

		// Moark native async/task routes
		httpRouter.POST("/async/*path", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatMoarkNative)
		})
		httpRouter.GET("/tasks", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatMoarkNative)
		})
		httpRouter.GET("/tasks/available-quota", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatMoarkNative)
		})
		httpRouter.GET("/task/:task_id", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatMoarkNative)
		})
		httpRouter.GET("/task/:task_id/get", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatMoarkNative)
		})
		httpRouter.POST("/task/:task_id/cancel", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatMoarkNative)
		})
		httpRouter.GET("/task/:task_id/status", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatMoarkNative)
		})

		// TypeSafe / OpenCode Zen System One 原生评估端点
		httpRouter.POST("/systemone", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatTypeSafe)
		})

		// xAI native voice routes
		httpRouter.POST("/realtime/client_secrets", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.POST("/tts", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.GET("/tts/voices", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.GET("/tts/voices/:voice_id", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.POST("/stt", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.POST("/custom-voices", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.GET("/custom-voices", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.GET("/custom-voices/:voice_id", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.PATCH("/custom-voices/:voice_id", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.DELETE("/custom-voices/:voice_id", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})
		httpRouter.GET("/custom-voices/:voice_id/audio", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatXAI)
		})

		// MiniMax native music routes
		httpRouter.POST("/music_generation", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatMiniMax)
		})
		httpRouter.POST("/music_cover_preprocess", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatMiniMax)
		})
		httpRouter.POST("/lyrics_generation", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatMiniMax)
		})

		// rerank related routes
		httpRouter.POST("/rerank", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatRerank)
		})

		// ocr relay route
		httpRouter.POST("/ocr", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOCR)
		})

		// gemini relay routes
		httpRouter.POST("/engines/:model/embeddings", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatGemini)
		})
		httpRouter.POST("/models/*path", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatGemini)
		})

		// other relay routes
		httpRouter.POST("/moderations", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAI)
		})

		// not implemented
		httpRouter.POST("/images/variations", controller.RelayNotImplemented)
		// StepFun Files（音色复刻前置依赖）：非 StepFun 渠道由 handler 返回等价的未实现语义
		stepFunFilesRelay := func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatStepFunNative)
		}
		httpRouter.GET("/files", stepFunFilesRelay)
		httpRouter.POST("/files", stepFunFilesRelay)
		httpRouter.DELETE("/files/:id", stepFunFilesRelay)
		httpRouter.GET("/files/:id", stepFunFilesRelay)
		httpRouter.GET("/files/:id/content", stepFunFilesRelay)
		httpRouter.POST("/fine-tunes", controller.RelayNotImplemented)
		httpRouter.GET("/fine-tunes", controller.RelayNotImplemented)
		httpRouter.GET("/fine-tunes/:id", controller.RelayNotImplemented)
		httpRouter.POST("/fine-tunes/:id/cancel", controller.RelayNotImplemented)
		httpRouter.GET("/fine-tunes/:id/events", controller.RelayNotImplemented)
		httpRouter.DELETE("/models/:model", controller.RelayNotImplemented)
	}

	relayMjRouter := router.Group("/mj")
	relayMjRouter.Use(middleware.RouteTag("relay"))
	relayMjRouter.Use(middleware.SystemPerformanceCheck())
	registerMjRouterGroup(relayMjRouter)

	relayMjModeRouter := router.Group("/:mode/mj")
	relayMjModeRouter.Use(middleware.RouteTag("relay"))
	relayMjModeRouter.Use(middleware.SystemPerformanceCheck())
	registerMjRouterGroup(relayMjModeRouter)
	//relayMjRouter.Use()

	relaySunoRouter := router.Group("/suno")
	relaySunoRouter.Use(middleware.RouteTag("relay"))
	relaySunoRouter.Use(middleware.SystemPerformanceCheck())
	relaySunoRouter.Use(middleware.TokenAuth(), middleware.TokenRateLimit(), middleware.Distribute(), middleware.GroupConcurrencyLimit())
	{
		relaySunoRouter.POST("/submit/:action", controller.RelayTask)
		relaySunoRouter.POST("/fetch", controller.RelayTaskFetch)
		relaySunoRouter.GET("/fetch/:id", controller.RelayTaskFetch)
	}

	relayGeminiRouter := router.Group("/v1beta")
	// :countTokens is not implemented. Answer it like an unregistered route
	// before auth/channel selection instead of silently relaying it as
	// generateContent (#7283).
	relayGeminiRouter.Use(func(c *gin.Context) {
		if strings.HasSuffix(c.Request.URL.Path, ":countTokens") {
			controller.RelayNotFound(c)
			c.Abort()
		}
	})
	relayGeminiRouter.Use(middleware.RouteTag("relay"))
	relayGeminiRouter.Use(middleware.SystemPerformanceCheck())
	relayGeminiRouter.Use(middleware.TokenAuth())
	relayGeminiRouter.Use(middleware.ModelRequestRateLimit())
	relayGeminiRouter.Use(middleware.TokenRateLimit())
	relayGeminiRouter.Use(middleware.Distribute(), middleware.GroupConcurrencyLimit())
	{
		// Gemini API 路径格式: /v1beta/models/{model_name}:{action}
		relayGeminiRouter.POST("/models/*path", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatGemini)
		})
	}

	// Gemini Interactions API: create 走标准分发;get/cancel/delete 经映射表路由到原渠道原 key
	for _, versionPrefix := range []string{"/v1beta", "/v1beta2", "/v1"} {
		interactionsRouter := router.Group(versionPrefix + "/interactions")
		interactionsRouter.Use(middleware.RouteTag("relay"))
		interactionsRouter.Use(middleware.SystemPerformanceCheck())
		interactionsRouter.Use(middleware.TokenAuth())
		interactionsRouter.Use(middleware.ModelRequestRateLimit())
		interactionsRouter.Use(middleware.TokenRateLimit())
		interactionsRouter.Use(middleware.Distribute(), middleware.GroupConcurrencyLimit())
		{
			interactionsRouter.POST("", func(c *gin.Context) {
				controller.Relay(c, types.RelayFormatGemini)
			})
			interactionsRouter.GET("/:id", controller.RelayGeminiInteractionState)
			interactionsRouter.POST("/:id/cancel", controller.RelayGeminiInteractionState)
			interactionsRouter.DELETE("/:id", controller.RelayGeminiInteractionState)
		}
	}
}

func registerMjRouterGroup(relayMjRouter *gin.RouterGroup) {
	relayMjRouter.GET("/image/:id", relay.RelayMidjourneyImage)
	relayMjRouter.Use(middleware.TokenAuth(), middleware.TokenRateLimit(), middleware.Distribute(), middleware.GroupConcurrencyLimit())
	{
		relayMjRouter.POST("/submit/action", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/shorten", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/modal", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/imagine", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/change", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/simple-change", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/describe", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/blend", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/edits", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/video", controller.RelayMidjourney)
		//relayMjRouter.POST("/notify", controller.RelayMidjourney)
		relayMjRouter.GET("/task/:id/fetch", controller.RelayMidjourney)
		relayMjRouter.GET("/task/:id/image-seed", controller.RelayMidjourney)
		relayMjRouter.POST("/task/list-by-condition", controller.RelayMidjourney)
		relayMjRouter.POST("/insight-face/swap", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/upload-discord-images", controller.RelayMidjourney)
	}
}
