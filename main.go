package main

import (
	"embed"
	"flag"
	"fmt"
	"log"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/controller"
	"one-api/metrics"
	"one-api/middleware"
	"one-api/model"
	"one-api/router"
	"one-api/service"
	"os"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	_ "net/http/pprof"

	"one-api/relay/channel/volcengine"
)

//go:embed web/dist
var buildFS embed.FS

//go:embed web/dist/index.html
var indexPage []byte

func main() {
	// 添加命令行参数支持
	configFile := flag.String("config", "", "path to config file")
	flag.Parse()

	// 打印时区和时间信息
	common.PrintTimeInfo()

	// 根据是否指定配置文件决定加载哪个文件
	if *configFile != "" {
		err := godotenv.Load(*configFile)
		if err != nil {
			common.SysLog(fmt.Sprintf("Failed to load config file %s: %v", *configFile, err))
		}
	} else {
		err := godotenv.Load(".env")
		if err != nil {
			common.SysLog("Support for .env file is disabled")
		}
	}

	common.LoadEnv()

	// 读取透传日志配置
	if os.Getenv("LOG_PASSTHROUGH_ENABLED") == "true" {
		common.LogPassthroughEnabled = true
		common.SysLog("log passthrough enabled")
	}

	// 读取日志采样比例配置
	if os.Getenv("LOG_SAMPLE_RATIO") != "" {
		ratio, err := strconv.Atoi(os.Getenv("LOG_SAMPLE_RATIO"))
		if err != nil {
			common.FatalLog("failed to parse LOG_SAMPLE_RATIO: " + err.Error())
		}
		if ratio < 0 || ratio > 100 {
			common.FatalLog("LOG_SAMPLE_RATIO must be between 0 and 100")
		}
		common.LogSampleRatio = ratio
		common.SysLog(fmt.Sprintf("log sample ratio set to %d%%", ratio))
	}

	// 读取请求体日志配置
	if os.Getenv("ENABLE_REQUEST_BODY_LOGGING") == "true" {
		middleware.EnableRequestBodyLogging = true
		common.SysLog("request body logging enabled")
	}

	common.SetupLogger()
	common.SysLog("New API " + common.Version + " started")
	if os.Getenv("GIN_MODE") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}
	if common.DebugEnabled {
		common.SysLog("running in debug mode")
	}
	// Initialize SQL Database
	err := model.InitDB()
	if err != nil {
		common.FatalLog("failed to initialize database: " + err.Error())
	}
	// Initialize SQL Database
	err = model.InitLogDB()
	if err != nil {
		common.FatalLog("failed to initialize database: " + err.Error())
	}
	// Initialize Central Control Database
	err = model.InitCentralDB()
	if err != nil {
		common.FatalLog("failed to initialize central control database: " + err.Error())
	}
	err = model.InitLogTable()
	if err != nil {
		common.FatalLog("failed to initialize database: " + err.Error())
	}
	model.GetLogTableName(time.Now().Unix())
	// 每5分钟执行一次GetLogTableName
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			model.GetLogTableName(time.Now().Unix())
		}
	}()

	// 初始化请求持久化存储
	if os.Getenv("REQUEST_PERSISTENCE_ENABLED") == "true" {
		model.RequestPersistenceEnabled = true
		common.SysLog("request persistence enabled")
		err = model.InitRequestPersistence()
		if err != nil {
			common.FatalLog("failed to initialize request persistence: " + err.Error())
		}
		model.StartTableCheckRoutine()
	}

	defer func() {
		err := model.CloseDB()
		if err != nil {
			common.FatalLog("failed to close database: " + err.Error())
		}
	}()

	// Initialize Redis
	err = common.InitRedisClient()
	if err != nil {
		common.FatalLog("failed to initialize Redis: " + err.Error())
	}

	// Initialize Keep-Alive Manager for Redis keys
	if err := volcengine.InitKeepAliveManager(); err != nil {
		common.FatalLog("failed to initialize keep-alive manager: " + err.Error())
	}
	// 在应用关闭时清理保活管理器
	defer func() {
		if err := volcengine.ShutdownKeepAliveManager(); err != nil {
			common.SysError("failed to shutdown keep-alive manager: " + err.Error())
		}
	}()

	// Initialize constants
	constant.InitEnv()
	// Initialize options
	model.InitOptionMap()
	model.InitGroups()

	// 初始化batch请求平均耗时
	volcengine.InitBatchRequestAverageDuration()

	if common.RedisEnabled {
		// for compatibility with old versions
		common.MemoryCacheEnabled = true
	}
	if common.MemoryCacheEnabled {
		common.SysLog("memory cache enabled")
		common.SysError(fmt.Sprintf("sync frequency: %d seconds", common.SyncFrequency))
		model.InitChannelCache()
	}
	if common.MemoryCacheEnabled {
		go model.SyncOptions(common.SyncFrequency)
		go model.SyncChannelCache(common.SyncFrequency)
	}

	// 数据看板
	go model.UpdateQuotaData()
	if os.Getenv("CHANNEL_UPDATE_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_UPDATE_FREQUENCY"))
		if err != nil {
			common.FatalLog("failed to parse CHANNEL_UPDATE_FREQUENCY: " + err.Error())
		}
		go controller.AutomaticallyUpdateChannels(frequency)
	}
	if os.Getenv("CHANNEL_TEST_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_TEST_FREQUENCY"))
		if err != nil {
			common.FatalLog("failed to parse CHANNEL_TEST_FREQUENCY: " + err.Error())
		}
		go controller.AutomaticallyTestChannels(frequency)
	}
	if common.IsMasterNode && constant.UpdateTask {
		gopool.Go(func() {
			controller.UpdateMidjourneyTaskBulk()
		})
		gopool.Go(func() {
			controller.UpdateTaskBulk()
		})
	}
	if os.Getenv("ENABLE_METRICS") != "" {
		register := prometheus.NewRegistry()
		metrics.RegisterMetrics(register)
		gatherersRegistry := prometheus.Gatherers{register}
		go func() {
			http.Handle("/metrics", promhttp.HandlerFor(gatherersRegistry, promhttp.HandlerOpts{}))
			metricsPort := "9090"
			if os.Getenv("METRICS_PORT") != "" {
				metricsPort = os.Getenv("METRICS_PORT")
			}
			log.Println(http.ListenAndServe(fmt.Sprintf("0.0.0.0:%s", metricsPort),
				nil))
		}()

	}
	if os.Getenv("BATCH_UPDATE_ENABLED") == "true" {
		common.BatchUpdateEnabled = true
		common.SysLog("batch update enabled with interval " + strconv.Itoa(common.BatchUpdateInterval) + "s")
		model.InitBatchUpdater()
	}

	if os.Getenv("ENABLE_PPROF") == "true" {
		common.PProfEnabled = true
	}
	common.InitPProfServer()

	service.InitTokenEncoders()

	// 初始化流量监控
	trafficConfig := common.TrafficMonitorConfig{
		Enabled:         os.Getenv("TRAFFIC_MONITOR_ENABLED") == "true",
		GracefulTimeout: time.Duration(common.GetEnvOrDefault("TRAFFIC_GRACEFUL_TIMEOUT", 30)) * time.Second, // 默认30秒
	}
	common.InitTrafficMonitor(trafficConfig)

	// Initialize HTTP server
	server := gin.New()
	server.Use(gin.CustomRecovery(func(c *gin.Context, err any) {
		common.SysError(fmt.Sprintf("panic detected: %v", err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": fmt.Sprintf("Panic detected, error: %v. Please submit a issue here: https://github.com/Calcium-Ion/new-api", err),
				"type":    "new_api_panic",
			},
		})
	}))
	// This will cause SSE not to work!!!
	//server.Use(gzip.Gzip(gzip.DefaultCompression))
	server.Use(middleware.RequestId())
	server.Use(middleware.RequestLogger())
	// 添加流量监控中间件
	server.Use(middleware.TrafficMonitorMiddleware())
	middleware.SetUpLogger(server)
	// Initialize session store
	store := cookie.NewStore([]byte(common.SessionSecret))
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   2592000, // 30 days
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteStrictMode,
	})
	server.Use(sessions.Sessions("session", store))

	router.SetRouter(server, buildFS, indexPage)
	var port = os.Getenv("PORT")
	if port == "" {
		port = strconv.Itoa(*common.Port)
	}

	// 创建 HTTP 服务器以支持优雅关闭
	httpServer := &http.Server{
		Addr:    ":" + port,
		Handler: server,
	}

	// 设置 HTTP 服务器实例到流量监控器
	common.SetHTTPServer(httpServer)

	common.SysLog("HTTP server starting on port " + port)
	err = httpServer.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		common.FatalLog("failed to start HTTP server: " + err.Error())
	}
}
