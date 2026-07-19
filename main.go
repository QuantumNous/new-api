package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/router"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	_ "github.com/QuantumNous/new-api/setting/performance_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	_ "net/http/pprof"
)


func main() {
	startTime := time.Now()
	mode, plane, err := parseRuntimeConfig(os.Getenv("RUN_MODE"), os.Getenv("APP_PLANE"), os.Getenv("NODE_TYPE"))
	if err != nil {
		log.Fatalf("invalid runtime configuration: %v", err)
	}

	err = InitResources()
	if err != nil {
		common.FatalLog("failed to initialize resources: " + err.Error())
		return
	}

	common.SysLog(fmt.Sprintf("New API %s started: run_mode=%s plane=%s", common.Version, mode, plane))
	if os.Getenv("GIN_MODE") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}
	if common.DebugEnabled {
		common.SysLog("running in debug mode")
	}

	defer func() {
		err := model.CloseDB()
		if err != nil {
			common.FatalLog("failed to close database: " + err.Error())
		}
	}()
	if mode == runModeMigrate {
		common.SysLog("database migration completed")
		return
	}

	if common.RedisEnabled {
		// for compatibility with old versions
		common.MemoryCacheEnabled = true
	}
	if common.MemoryCacheEnabled {
		common.SysLog("memory cache enabled")
		common.SysLog(fmt.Sprintf("sync frequency: %d seconds", common.SyncFrequency))

		// Add panic recovery and retry for InitChannelCache
		func() {
			defer func() {
				if r := recover(); r != nil {
					common.SysLog(fmt.Sprintf("InitChannelCache panic: %v, retrying once", r))
					// Retry once
					_, _, fixErr := model.FixAbility()
					if fixErr != nil {
						common.FatalLog(fmt.Sprintf("InitChannelCache failed: %s", fixErr.Error()))
					}
				}
			}()
			model.InitChannelCache()
		}()

		go model.SyncChannelCache(common.SyncFrequency)
	}

	// Warm pricing after channel cache initialization so Advanced Custom
	// endpoint inference can read cached route settings on first request.
	if mode.servesHTTP() || mode.runsWorker() {
		model.GetPricing()
	}

	// Hot-reload options for every long-lived process role.
	go model.SyncOptions(common.SyncFrequency)

	// Periodically reload authz policies so multi-node masters see updates.
	if mode.servesHTTP() {
		go authz.StartPolicySync(common.SyncFrequency)
	}

	if mode.runsWorker() {
		// Dashboard quota aggregation
		go model.UpdateQuotaData()

		if os.Getenv("CHANNEL_UPDATE_FREQUENCY") != "" {
			frequency, err := strconv.Atoi(os.Getenv("CHANNEL_UPDATE_FREQUENCY"))
			if err != nil {
				common.FatalLog("failed to parse CHANNEL_UPDATE_FREQUENCY: " + err.Error())
			}
			go controller.AutomaticallyUpdateChannels(frequency)
		}

		// Codex credential auto-refresh check every 10 minutes
		service.StartCodexCredentialAutoRefreshTask()

		// Subscription quota reset task (daily/weekly/monthly/custom)
		service.StartSubscriptionQuotaResetTask()

		if os.Getenv("BATCH_UPDATE_ENABLED") == "true" {
			common.BatchUpdateEnabled = true
			common.SysLog("batch update enabled with interval " + strconv.Itoa(common.BatchUpdateInterval) + "s")
			model.InitBatchUpdater()
		}
	}

	// Report this process as a system instance so the System Info page can show
	// all currently alive nodes in multi-instance deployments.
	service.StartSystemInstanceReporter()

	if mode.runsScheduler() {
		// Wire task polling adaptor factory (breaks service -> relay import cycle).
		service.GetTaskAdaptorFunc = func(platform constant.TaskPlatform) service.TaskPollingAdaptor {
			a := relay.GetTaskAdaptor(platform)
			if a == nil {
				return nil
			}
			return a
		}

		// Register periodic channel test / upstream model update / async task polling
		// jobs, then start the runner that schedules and executes them.
		controller.RegisterScheduledSystemTasks()
		service.StartSystemTaskRunner()
	}

	if mode.servesHTTP() {
		if os.Getenv("ENABLE_PPROF") == "true" {
			gopool.Go(func() {
				log.Println(http.ListenAndServe("0.0.0.0:8005", nil))
			})
			go common.Monitor()
			common.SysLog("pprof enabled")
		}

		err = common.StartPyroScope()
		if err != nil {
			common.SysError(fmt.Sprintf("start pyroscope error : %v", err))
		}

		// Initialize HTTP server
		server := gin.New()
		server.Use(gin.CustomRecovery(func(c *gin.Context, err any) {
			common.SysLog(fmt.Sprintf("panic detected: %v", err))
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{
					"message": fmt.Sprintf("Panic detected, error: %v. Please submit a issue here: https://github.com/Calcium-Ion/new-api", err),
					"type":    "new_api_panic",
				},
			})
		}))
		server.Use(middleware.RequestId())
		server.Use(middleware.Version())
		server.Use(middleware.I18n())
		middleware.SetUpLogger(server)
		// Initialize session store
		store := cookie.NewStore([]byte(common.SessionSecret))
		store.Options(sessions.Options{
			Path:     "/",
			MaxAge:   2592000, // 30 days
			HttpOnly: true,
			Secure:   common.SessionCookieSecure,
			SameSite: http.SameSiteStrictMode,
		})
		server.Use(sessions.Sessions("session", store))

		// FRONTEND_MODE / embedded vs pure backend decided by prepareFrontendAssets + SetRouterForPlane
		if err := router.SetRouterForPlane(server, prepareFrontendAssets(), plane); err != nil {
			common.FatalLog(err.Error())
			return
		}
		var port = os.Getenv("PORT")
		if port == "" {
			port = strconv.Itoa(*common.Port)
		}

		srv := &http.Server{
			Addr:    ":" + port,
			Handler: server,
		}

		go func() {
			if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				common.FatalLog("failed to start HTTP server: " + err.Error())
			}
		}()

		time.Sleep(100 * time.Millisecond)

		common.LogStartupSuccess(startTime, port)

		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		sig := <-quit
		common.SysLog(fmt.Sprintf("received signal: %v, shutting down...", sig))

		// SSE streams may run for minutes; give them time to finish before forced exit
		shutdownTimeout := time.Duration(common.GetEnvOrDefault("SHUTDOWN_TIMEOUT_SECONDS", 120)) * time.Second
		ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			common.SysError(fmt.Sprintf("server forced to shutdown: %v", err))
		}
		// 内存中的看板数据保存入库，避免重启丢失未落库数据 (issue #5679)
		if common.DataExportEnabled {
			model.SaveQuotaDataCache()
		}
		common.SysLog("server exited")
		return
	}

	// Worker / scheduler only: no HTTP listener. Block until signal.
	common.SysLog(fmt.Sprintf("running without HTTP listener (run_mode=%s)", mode))
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	common.SysLog(fmt.Sprintf("received signal: %v, shutting down...", sig))
	if common.DataExportEnabled {
		model.SaveQuotaDataCache()
	}
	common.SysLog("process exited")
}

func InitResources() error {
	// Initialize resources here if needed
	// This is a placeholder function for future resource initialization
	err := godotenv.Load(".env")
	if err != nil {
		if common.DebugEnabled {
			common.SysLog("No .env file found, using default environment variables. If needed, please create a .env file and set the relevant variables.")
		}
	}

	// 加载环境变量
	common.InitEnv()

	logger.SetupLogger()

	// Initialize model settings
	ratio_setting.InitRatioSettings()

	service.InitHttpClient()

	service.InitTokenEncoders()

	// Initialize SQL Database
	err = model.InitDB()
	if err != nil {
		common.FatalLog("failed to initialize database: " + err.Error())
		return err
	}
	if err = authz.Init(model.DB); err != nil {
		common.FatalLog("failed to initialize authorization: " + err.Error())
		return err
	}

	model.CheckSetup()

	// Initialize options, should after model.InitDB()
	model.InitOptionMap()

	// 清理旧的磁盘缓存文件
	common.CleanupOldCacheFiles()

	// Initialize SQL Database
	err = model.InitLogDB()
	if err != nil {
		return err
	}

	// Initialize Redis
	err = common.InitRedisClient()
	if err != nil {
		return err
	}

	perfmetrics.Init()

	// 启动系统监控
	common.StartSystemMonitor()

	// Initialize i18n
	err = i18n.Init()
	if err != nil {
		common.SysError("failed to initialize i18n: " + err.Error())
		// Don't return error, i18n is not critical
	} else {
		common.SysLog("i18n initialized with languages: " + strings.Join(i18n.SupportedLanguages(), ", "))
	}
	// Register user language loader for lazy loading
	i18n.SetUserLangLoader(model.GetUserLanguage)

	// Load custom OAuth providers from database
	err = oauth.LoadCustomProviders()
	if err != nil {
		common.SysError("failed to load custom OAuth providers: " + err.Error())
		// Don't return error, custom OAuth is not critical
	}

	return nil
}
