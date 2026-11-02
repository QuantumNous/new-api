package main

import (
	"bytes"
	"context"
	"embed"
	"fmt"
	"github.com/QuantumNous/new-api/internal/billing"
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/QuantumNous/new-api/internal/egress"
	"github.com/QuantumNous/new-api/internal/geoip"
	"github.com/QuantumNous/new-api/internal/identity"
	"github.com/QuantumNous/new-api/internal/task"
	"github.com/QuantumNous/new-api/internal/transport/handler"
	"github.com/QuantumNous/new-api/internal/usage"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	catalog "github.com/QuantumNous/new-api/internal/catalog"
	ratio_setting "github.com/QuantumNous/new-api/internal/catalog/configure_ratio"
	"github.com/QuantumNous/new-api/internal/catalog/routestats"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/QuantumNous/new-api/internal/dbinfra"
	"github.com/QuantumNous/new-api/internal/i18n"
	"github.com/QuantumNous/new-api/internal/identity/policy"
	"github.com/QuantumNous/new-api/internal/logger"
	"github.com/QuantumNous/new-api/internal/ops"
	"github.com/QuantumNous/new-api/internal/relay"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/security/oauth"
	"github.com/QuantumNous/new-api/internal/sensitive"
	"github.com/QuantumNous/new-api/internal/settings"
	compose "github.com/QuantumNous/new-api/internal/transport/compose"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/QuantumNous/new-api/internal/transport/middleware"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/joho/godotenv"

	_ "net/http/pprof"
)

//go:embed web/dist
var buildFS embed.FS

//go:embed web/dist/index.html
var indexPage []byte

func main() {
	startTime := time.Now()
	kitutil.SetLogging(common.SysLog, func(message string) {
		logger.LogError(nil, message)
	})
	kitutil.SetSystemErrorLogging(common.SysError)

	// Gateway channel selection goes through the port; the channel
	// capability implementation is registered before the router starts.
	catalog.SelectChannel = catalog.CacheGetRandomSatisfiedChannel

	err := InitResources()
	if err != nil {
		common.FatalLog("failed to initialize resources: " + err.Error())
		return
	}

	common.SysLog("New API " + common.Version + " started")
	if common.DebugEnabled {
		common.SysLog("running in debug mode")
	}

	kitutil.Debug.Store(common.DebugEnabled)

	defer func() {
		err := dbinfra.CloseDB()
		if err != nil {
			common.FatalLog("failed to close database: " + err.Error())
		}
	}()
	// Close the in-process sing-box dialer on shutdown (Issue #57).
	defer egress.CloseSingBoxDialer()

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
					_, _, fixErr := catalog.FixAbility()
					if fixErr != nil {
						common.FatalLog(fmt.Sprintf("InitChannelCache failed: %s", fixErr.Error()))
					}
				}
			}()
			catalog.InitChannelCache()
			// Restores the persisted per-unit health state. Without it a cooling
			// or terminal-disabled unit silently rejoins rotation on restart.
			catalog.InitUnitHealthCache()
		}()

		go catalog.SyncChannelCache(common.SyncFrequency)
	}

	// Warm pricing after channel cache initialization so Advanced Custom
	// endpoint inference can read cached route settings on first request.
	catalog.GetPricing()

	// 热更新配置
	outboxCtx, stopOutboxPublisher := context.WithCancel(context.Background())
	defer stopOutboxPublisher()
	go catalog.RunGatewayConfigOutboxPublisher(outboxCtx)

	// 热更新配置
	go dbinfra.SyncOptions(common.SyncFrequency)

	// 周期性重载授权策略，保证多节点/多 master 部署下权限变更能传播到每个实例
	go policy.StartPolicySync(common.SyncFrequency)

	// 数据看板
	go usage.UpdateQuotaData()

	// 周期性把内存中的用户画像增量合并进数据库
	go usage.UpdateInsightProfiles()
	usage.InitInsightSampleUsage()
	go usage.MaintainInsightSamples()
	// 定期把过期未领完的红包余额退回发送者
	go billing.MaintainQQRedPackets()

	// Route stats TTL sweep and share-pool eviction (runs hourly). Without it the
	// EWMA handles and share pools only ever grow: a retired route unit keeps its
	// entry forever.
	sweepCtx, stopRouteStatsSweep := context.WithCancel(context.Background())
	defer stopRouteStatsSweep()
	go runRouteStatsSweep(sweepCtx, time.Hour)

	if os.Getenv("CHANNEL_UPDATE_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_UPDATE_FREQUENCY"))
		if err != nil {
			common.FatalLog("failed to parse CHANNEL_UPDATE_FREQUENCY: " + err.Error())
		}
		go billing.AutomaticallyUpdateChannels(frequency)
	}

	// Codex credential auto-refresh check every 10 minutes, refresh when expires within 1 day
	catalog.StartCodexCredentialAutoRefreshTask()

	// Subscription quota reset task (daily/weekly/monthly/custom)
	billing.StartSubscriptionQuotaResetTask()

	// Report this process as a system instance so the System Info page can show
	// all currently alive nodes in multi-instance deployments.
	ops.StartSystemInstanceReporter()

	// Wire the task adaptor factory and the gateway port that reads it. Both must
	// run before the system task runner starts: the async_task_poll handler calls
	// task.RunTaskPollingOnce, which returns immediately while the port is nil.
	wireTaskAdaptorFactory()

	// Register the periodic channel test, upstream model update, and async task
	// polling (Midjourney / Suno / video) jobs as scheduled system tasks
	// (DB-lease dedup across masters + run history), then start the runner that
	// schedules and executes them. Master-only execution and the UpdateTask
	// switch are enforced inside the runner and each handler's Enabled().
	handler.RegisterScheduledSystemTasks()
	ops.StartSystemTaskRunner()

	if os.Getenv("BATCH_UPDATE_ENABLED") == "true" {
		common.BatchUpdateEnabled = true
		common.SysLog("batch update enabled with interval " + strconv.Itoa(common.BatchUpdateInterval) + "s")
		dbinfra.InitBatchUpdater()
	}

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
	onPanic := func(c contract.Context, recovered any) {
		common.SysLog(fmt.Sprintf("panic detected: %v", recovered))
		c.JSON(http.StatusInternalServerError, common.H{
			"error": common.H{
				"message": fmt.Sprintf("Panic detected, error: %v. Please submit a issue here: https://github.com/Calcium-Ion/new-api", recovered),
				"type":    "new_api_panic",
			},
		})
	}
	var server contract.Engine = fiberadapter.NewEngine(onPanic)
	if err := middleware.ConfigureTrustedProxies(server); err != nil {
		common.FatalLog("failed to configure trusted proxies: " + err.Error())
		return
	}
	// This will cause SSE not to work!!!
	//server.Use(gzip.Gzip(gzip.DefaultCompression))
	server.Use(middleware.RequestId())
	server.Use(middleware.Version())
	server.Use(middleware.I18n())
	server.Use(middleware.GeoBlock()) // 地理封禁挂引擎层：对 Web/API/静态全部生效
	middleware.SetUpLogger(server)
	InjectUmamiAnalytics()
	InjectGoogleAnalytics()

	// 设置路由
	compose.SetRouter(server, compose.WebAssets{
		BuildFS:   buildFS,
		IndexPage: indexPage,
	})
	var port = os.Getenv("PORT")
	if port == "" {
		port = strconv.Itoa(*common.Port)
	}

	go func() {
		if err := server.Serve(":" + port); err != nil {
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
	if err := server.Shutdown(ctx); err != nil {
		common.SysError(fmt.Sprintf("server forced to shutdown: %v", err))
	}
	// 内存中的看板数据保存入库，避免重启丢失未落库数据 (issue #5679)
	if common.DataExportEnabled {
		usage.SaveQuotaDataCache()
	}
	common.SysLog("server exited")
}

// wireTaskAdaptorFactory connects the async-task capability to the relay
// adaptors. It breaks the task -> relay import cycle: task declares the factory
// and the port, relay owns the adaptors, and bootstrap joins them.
//
// Order matters. GetTaskProviderFuncBinding closes over GetTaskAdaptorFunc, so
// the factory must be assigned first; a binding built before it resolves nothing.
func wireTaskAdaptorFactory() {
	task.GetTaskAdaptorFunc = func(platform constant.TaskPlatform) task.TaskPollingAdaptor {
		a := relay.GetTaskAdaptor(platform)
		if a == nil {
			return nil
		}
		return a
	}
	task.GetTaskProviderFunc = task.GetTaskProviderFuncBinding()
}

// runRouteStatsSweep evicts stale EWMA entries and orphaned share pools on every
// tick, and returns when ctx is cancelled.
//
// The ticker is held in a variable so it can be stopped. Building it inline in
// the range clause (`for range time.NewTicker(tick).C`) leaves the *time.Ticker
// unreachable, so its runtime timer lives for the life of the process and the
// loop has no way to exit.
//
// One sweep panic must not take the process down: the recover is inside the loop
// body so the next tick still runs.
func runRouteStatsSweep(ctx context.Context, tick time.Duration) {
	ticker := time.NewTicker(tick)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		func() {
			defer func() {
				if r := recover(); r != nil {
					common.SysError(fmt.Sprintf("route stats sweep panic: %v", r))
				}
			}()
			if removed := routestats.SweepTTL(); removed > 0 {
				common.SysLog(fmt.Sprintf("route stats sweep: removed %d stale entries", removed))
			}
			keep := catalog.GetActiveRouteStatsPoolKeys()
			if removed := routestats.SweepSharePools(keep); removed > 0 {
				common.SysLog(fmt.Sprintf("route stats sweep: removed %d orphaned share pools", removed))
			}
		}()
	}
}

func InjectUmamiAnalytics() {
	analyticsInjectBuilder := &strings.Builder{}
	if os.Getenv("UMAMI_WEBSITE_ID") != "" {
		umamiSiteID := os.Getenv("UMAMI_WEBSITE_ID")
		umamiScriptURL := os.Getenv("UMAMI_SCRIPT_URL")
		if umamiScriptURL == "" {
			umamiScriptURL = "https://analytics.umami.is/script.js"
		}
		analyticsInjectBuilder.WriteString("<script defer src=\"")
		analyticsInjectBuilder.WriteString(umamiScriptURL)
		analyticsInjectBuilder.WriteString("\" data-website-id=\"")
		analyticsInjectBuilder.WriteString(umamiSiteID)
		analyticsInjectBuilder.WriteString("\"></script>")
	}
	analyticsInjectBuilder.WriteString("<!--Umami QuantumNous-->\n")
	analyticsInject := []byte(analyticsInjectBuilder.String())
	placeholder := []byte("<!--umami-->\n")
	indexPage = bytes.ReplaceAll(indexPage, placeholder, analyticsInject)
}

func InjectGoogleAnalytics() {
	analyticsInjectBuilder := &strings.Builder{}
	if os.Getenv("GOOGLE_ANALYTICS_ID") != "" {
		gaID := os.Getenv("GOOGLE_ANALYTICS_ID")
		// Google Analytics 4 (gtag.js)
		analyticsInjectBuilder.WriteString("<script async src=\"https://www.googletagmanager.com/gtag/js?id=")
		analyticsInjectBuilder.WriteString(gaID)
		analyticsInjectBuilder.WriteString("\"></script>")
		analyticsInjectBuilder.WriteString("<script>")
		analyticsInjectBuilder.WriteString("window.dataLayer = window.dataLayer || [];")
		analyticsInjectBuilder.WriteString("function gtag(){dataLayer.push(arguments);}")
		analyticsInjectBuilder.WriteString("gtag('js', new Date());")
		analyticsInjectBuilder.WriteString("gtag('config', '")
		analyticsInjectBuilder.WriteString(gaID)
		analyticsInjectBuilder.WriteString("');")
		analyticsInjectBuilder.WriteString("</script>")
	}
	analyticsInjectBuilder.WriteString("<!--Google Analytics QuantumNous-->\n")
	analyticsInject := []byte(analyticsInjectBuilder.String())
	placeholder := []byte("<!--Google Analytics-->\n")
	indexPage = bytes.ReplaceAll(indexPage, placeholder, analyticsInject)
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

	egress.InitHttpClient()

	// Warms relay/common's encoder cache — that is the package CountTextToken
	// reads. A nil defaultTokenEncoder nil-panics on any OpenAI text model
	// tiktoken does not recognise (e.g. gpt-5-chat).
	relaycommon.InitTokenEncoders()

	// dbinfra must not import usage, so bootstrap wires this one. It MUST stay
	// above MigrateRetiredFrontendOptions and InitOptionMap below: a nil
	// OnValidateConsoleSettings would silently skip validation during the
	// migration. (identity.OnResolveServerAddress is registered by egress's own
	// init(), so every binary linking egress gets it, not just this one.)
	dbinfra.OnValidateConsoleSettings = usage.ValidateConsoleSettings

	// Initialize SQL Database
	err = dbinfra.InitDB()
	if err != nil {
		common.FatalLog("failed to initialize database: " + err.Error())
		return err
	}
	if err = policy.Init(dbx.DB); err != nil {
		common.FatalLog("failed to initialize authorization: " + err.Error())
		return err
	}

	dbinfra.CheckSetup()

	// Initialize options, should after dbinfra.InitDB()
	if common.IsMasterNode {
		if err := dbinfra.MigrateRetiredFrontendOptions(); err != nil {
			common.SysError("failed to migrate retired frontend options: " + err.Error())
		}
		// Runs before InitOptionMap so the migrated rows are loaded into the
		// option map and the flattened billing_setting config in one pass.
		if err := dbinfra.MigrateLegacyBillingOptions(); err != nil {
			common.SysError("failed to migrate legacy billing options: " + err.Error())
		}
	}
	dbinfra.InitOptionMap()

	// 地理封禁已启用而数据库缺失/过期时，后台补一次下载（失败不影响启动）。
	go geoip.RefreshStaleDatabaseOnStartup()

	// 清理旧的磁盘缓存文件
	common.CleanupOldCacheFiles()

	// Initialize SQL Database
	err = dbinfra.InitLogDB()
	if err != nil {
		return err
	}

	// Initialize Redis
	err = common.InitRedisClient()
	if err != nil {
		return err
	}

	settings.OnPerformanceSettingChanged = usage.UpdateAndSync

	// Starts the perf-metric flush loop. Without it hot buckets are never
	// written to perf_metrics: the dashboard stays empty and the in-memory
	// bucket map grows for the life of the process.
	usage.Init()

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
	i18n.SetUserLangLoader(identity.GetUserLanguage)

	// Load custom OAuth providers from database
	err = oauth.LoadCustomProviders()
	if err != nil {
		common.SysError("failed to load custom OAuth providers: " + err.Error())
		// Don't return error, custom OAuth is not critical
	}

	// Wire identity-domain functions that dbinfra still calls via variables.
	dbinfra.SetIdentityFunctions(
		identity.UserQuery, identity.TokenQuery,
		identity.LockUserRow, identity.ReadUserQuota,
		identity.GetUsernameById, identity.GetUserSetting,
		identity.IncreaseUserQuota, identity.DecreaseUserQuota,
		identity.RootUserExists,
	)
	dbinfra.GetTokenByIdFn = func(id int) (*identity.Token, error) {
		t, err := identity.GetTokenById(id)
		if err != nil {
			return nil, err
		}
		return t, nil
	}
	dbinfra.GetTokenByKeyWrFn = identity.GetTokenByKey
	dbinfra.GetUserCacheWrFn = identity.GetUserCache

	// ops owns notification delivery and imports catalog, so catalog reaches
	// root-user notifications through a hook wired here.
	catalog.RootUserNotifier = ops.NotifyRootUser

	// 与 main 对齐：先启动会话/审计工件清理，再启动敏感审计日志清理。
	// 两者都只在主节点跑，且都依赖上面已完成的 InitDB/InitLogDB。
	identity.StartAuthArtifactCleanup()

	sensitive.StartSensitiveAuditCleanup()

	return nil
}
