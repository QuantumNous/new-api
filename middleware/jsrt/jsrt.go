package jsrt

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/model"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/dop251/goja"
	"github.com/gin-gonic/gin"
)

// 池化
type JSRuntimePool struct {
	pool       chan *goja.Runtime
	maxSize    int
	createFunc func() *goja.Runtime
	scripts    string
	mu         sync.RWMutex
	httpClient *http.Client
}

var (
	jsRuntimePool *JSRuntimePool
	jsPoolOnce    sync.Once
)

func NewJSRuntimePool(maxSize int) *JSRuntimePool {
	// 创建HTTP客户端
	httpClient := &http.Client{
		Timeout: jsConfig.FetchTimeout,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: false,
			},
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	pool := &JSRuntimePool{
		pool:       make(chan *goja.Runtime, maxSize),
		maxSize:    maxSize,
		scripts:    "",
		httpClient: httpClient,
	}

	pool.createFunc = func() *goja.Runtime {
		vm := goja.New()
		pool.setupGlobals(vm)
		pool.loadScripts(vm)
		return vm
	}

	// 预创建VM
	preCreate := min(maxSize/2, 4)
	for range preCreate {
		select {
		case pool.pool <- pool.createFunc():
		default:
		}
	}

	return pool
}

func (p *JSRuntimePool) Get() *goja.Runtime {
	select {
	case vm := <-p.pool:
		return vm
	default:
		return p.createFunc()
	}
}

func (p *JSRuntimePool) Put(vm *goja.Runtime) {
	if vm == nil {
		return
	}

	select {
	case p.pool <- vm:
	default:
		// 池满，丢弃VM让GC回收
	}
}

func (p *JSRuntimePool) setupGlobals(vm *goja.Runtime) {
	// console
	console := vm.NewObject()
	console.Set("log", func(args ...any) {
		var strs []string
		for _, arg := range args {
			strs = append(strs, fmt.Sprintf("%v", arg))
		}
		common.SysLog("JS: " + strings.Join(strs, " "))
	})
	console.Set("error", func(args ...any) {
		var strs []string
		for _, arg := range args {
			strs = append(strs, fmt.Sprintf("%v", arg))
		}
		common.SysError("JS: " + strings.Join(strs, " "))
	})
	console.Set("warn", func(args ...any) {
		var strs []string
		for _, arg := range args {
			strs = append(strs, fmt.Sprintf("%v", arg))
		}
		common.SysError("JS WARN: " + strings.Join(strs, " "))
	})
	vm.Set("console", console)

	// JSON
	jsonObj := vm.NewObject()
	jsonObj.Set("parse", func(str string) any {
		var result any
		err := json.Unmarshal([]byte(str), &result)
		if err != nil {
			panic(vm.ToValue(err.Error()))
		}
		return result
	})
	jsonObj.Set("stringify", func(obj any) string {
		data, err := json.Marshal(obj)
		if err != nil {
			panic(vm.ToValue(err.Error()))
		}
		return string(data)
	})
	vm.Set("JSON", jsonObj)

	// fetch 实现
	vm.Set("fetch", func(url string, options ...any) *JSFetchResponse {
		return p.fetch(url, options...)
	})

	// 数据库
	setDB(vm, model.DB, "db")
	setDB(vm, model.LOG_DB, "logdb")

	// 定时器
	vm.Set("setTimeout", func(fn func(), delay int) {
		go func() {
			time.Sleep(time.Duration(delay) * time.Millisecond)
			fn()
		}()
	})
}

func (p *JSRuntimePool) loadScripts(vm *goja.Runtime) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// 如果已经缓存了合并的脚本，直接使用
	if p.scripts != "" {
		if _, err := vm.RunString(p.scripts); err != nil {
			common.SysError("Failed to load cached scripts: " + err.Error())
		}
		return
	}

	// 首次加载时，读取 scripts/ 文件夹中的所有脚本
	p.mu.RUnlock()
	p.mu.Lock()
	defer func() {
		p.mu.Unlock()
		p.mu.RLock()
	}()

	if p.scripts != "" {
		if _, err := vm.RunString(p.scripts); err != nil {
			common.SysError("Failed to load cached scripts: " + err.Error())
		}
		return
	}

	// 读取所有脚本文件
	var combinedScript strings.Builder
	scriptDir := jsConfig.ScriptDir

	// 检查目录是否存在
	if _, err := os.Stat(scriptDir); os.IsNotExist(err) {
		common.SysLog("Scripts directory does not exist: " + scriptDir)
		return
	}

	// 读取目录中的所有 .js 文件
	files, err := filepath.Glob(filepath.Join(scriptDir, "*.js"))
	if err != nil {
		common.SysError("Failed to read scripts directory: " + err.Error())
		return
	}

	if len(files) == 0 {
		common.SysLog("No JavaScript files found in: " + scriptDir)
		return
	}

	// 按文件名排序以确保加载顺序一致
	for _, file := range files {
		content, err := os.ReadFile(file)
		if err != nil {
			common.SysError("Failed to read script file " + file + ": " + err.Error())
			continue
		}

		// 添加文件注释和内容
		combinedScript.WriteString("// File: " + filepath.Base(file) + "\n")
		combinedScript.WriteString(string(content))
		combinedScript.WriteString("\n\n")

		common.SysLog("Loaded script: " + filepath.Base(file))
	}

	// 缓存合并后的脚本
	p.scripts = combinedScript.String()

	// 执行脚本
	if p.scripts != "" {
		if _, err := vm.RunString(p.scripts); err != nil {
			common.SysError("Failed to load combined scripts: " + err.Error())
		} else {
			common.SysLog("Successfully loaded and combined all JavaScript files from: " + scriptDir)
		}
	}
}

func (p *JSRuntimePool) ReloadScripts() {
	p.mu.Lock()
	defer p.mu.Unlock()

	// 清空缓存的脚本
	p.scripts = ""

	// 清空VM池，强制重新创建
	for {
		select {
		case <-p.pool:
		default:
			goto done
		}
	}
done:
	common.SysLog("JavaScript scripts reloaded")
}

func initJSRuntimePool() *JSRuntimePool {
	jsPoolOnce.Do(func() {
		jsRuntimePool = NewJSRuntimePool(jsConfig.MaxVMCount)
		common.SysLog("JavaScript runtime pool initialized successfully")
	})
	return jsRuntimePool
}

func validateGinContext(c *gin.Context) error {
	if c == nil {
		return fmt.Errorf("gin context is nil")
	}
	if c.Request == nil {
		return fmt.Errorf("gin context request is nil")
	}
	return nil
}

func (p *JSRuntimePool) executeWithTimeout(_ *goja.Runtime, fn func() (goja.Value, error)) (goja.Value, error) {
	type result struct {
		value goja.Value
		err   error
	}

	resultChan := make(chan result, 1)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				resultChan <- result{err: fmt.Errorf("JS panic: %v", r)}
			}
		}()

		value, err := fn()
		resultChan <- result{value: value, err: err}
	}()

	select {
	case res := <-resultChan:
		return res.value, res.err
	case <-time.After(jsConfig.ScriptTimeout):
		return nil, fmt.Errorf("script execution timeout after %v", jsConfig.ScriptTimeout)
	}
}

func (p *JSRuntimePool) PreProcessRequest(c *gin.Context) error {
	if err := validateGinContext(c); err != nil {
		common.SysError("JS PreProcess Validation Error: " + err.Error())
		return err
	}

	vm := p.Get()
	defer p.Put(vm)

	preProcessFunc := vm.Get("preProcessRequest")
	if preProcessFunc == nil || goja.IsUndefined(preProcessFunc) {
		return nil
	}

	jsReq, err := common.StructToMap(createJSReq(c))
	if err != nil {
		return fmt.Errorf("failed to create JS context: %v", err)
	}

	result, err := p.executeWithTimeout(vm, func() (goja.Value, error) {
		fn, ok := goja.AssertFunction(preProcessFunc)
		if !ok {
			return nil, fmt.Errorf("preProcessRequest is not a function")
		}
		return fn(goja.Undefined(), vm.ToValue(jsReq))
	})

	if err != nil {
		common.SysError("JS PreProcess Error: " + err.Error())
		return err
	}

	// 处理返回结果
	if result != nil && !goja.IsUndefined(result) {
		resultObj := result.Export()
		if resultMap, ok := resultObj.(map[string]any); ok {
			// 是否修改请求
			if newBody, exists := resultMap["body"]; exists {
				switch v := newBody.(type) {
				case string:
					c.Request.Body = io.NopCloser(strings.NewReader(v))
					c.Request.ContentLength = int64(len(v))
				case []byte:
					c.Request.Body = io.NopCloser(bytes.NewBuffer(v))
					c.Request.ContentLength = int64(len(v))
				case map[string]any:
					bodyBytes, err := json.Marshal(v)
					if err == nil {
						c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
						c.Request.ContentLength = int64(len(bodyBytes))
						c.Request.Header.Set("Content-Type", "application/json")
					} else {
						common.SysError("JS PreProcess JSON Marshal Error: " + err.Error())
					}
				default:
					common.SysError("JS PreProcess Unsupported Body Type: " + fmt.Sprintf("%T", newBody))
				}
			}

			// 是否修改 headers
			if newHeaders, exists := resultMap["headers"]; exists {
				if headersMap, ok := newHeaders.(map[string]any); ok {
					for key, value := range headersMap {
						if valueStr, ok := value.(string); ok {
							c.Request.Header.Set(key, valueStr)
						}
					}
				}
			}

			// 是否阻止请求
			if block, exists := resultMap["block"]; exists {
				if blockBool, ok := block.(bool); ok && blockBool {
					status := http.StatusForbidden
					if statusCode, exists := resultMap["statusCode"]; exists {
						if statusInt, ok := statusCode.(float64); ok {
							status = int(statusInt)
						}
					}

					message := "Request blocked by pre-process script"
					if msg, exists := resultMap["message"]; exists {
						if msgStr, ok := msg.(string); ok {
							message = msgStr
						}
					}

					c.JSON(status, gin.H{"error": message})
					c.Abort()
					return fmt.Errorf("request blocked")
				}
			}
		}
	}

	return nil
}

func (p *JSRuntimePool) PostProcessResponse(c *gin.Context, statusCode int, body []byte) (int, []byte, error) {
	if err := validateGinContext(c); err != nil {
		common.SysError("JS PostProcess Validation Error: " + err.Error())
		return statusCode, body, err
	}

	vm := p.Get()
	defer p.Put(vm)

	postProcessFunc := vm.Get("postProcessResponse")
	if postProcessFunc == nil || goja.IsUndefined(postProcessFunc) {
		return statusCode, body, nil
	}

	jsReq, err := common.StructToMap(createJSReq(c))
	if err != nil {
		return statusCode, body, fmt.Errorf("failed to create JS context: %v", err)
	}

	jsResp := &JSResponse{
		StatusCode: statusCode,
		Headers:    make(map[string]string),
		Body:       string(body),
	}

	// 获取响应头
	if c.Writer != nil {
		for key, values := range c.Writer.Header() {
			if len(values) > 0 {
				jsResp.Headers[key] = values[0]
			}
		}
	}
	jsResponse, err := common.StructToMap(jsResp)
	if err != nil {
		return statusCode, body, fmt.Errorf("failed to create JS response context: %v", err)
	}

	result, err := p.executeWithTimeout(vm, func() (goja.Value, error) {
		fn, ok := goja.AssertFunction(postProcessFunc)
		if !ok {
			return nil, fmt.Errorf("postProcessResponse is not a function")
		}
		return fn(goja.Undefined(), vm.ToValue(jsReq), vm.ToValue(jsResponse))
	})

	if err != nil {
		common.SysError("JS PostProcess Error: " + err.Error())
		return statusCode, body, err
	}

	// 处理返回
	if result != nil && !goja.IsUndefined(result) {
		resultObj := result.Export()
		if resultMap, ok := resultObj.(map[string]any); ok {
			if newStatusCode, exists := resultMap["statusCode"]; exists {
				if statusInt, ok := newStatusCode.(float64); ok {
					statusCode = int(statusInt)
				}
			}

			if newBody, exists := resultMap["body"]; exists {
				if bodyStr, ok := newBody.(string); ok {
					body = []byte(bodyStr)
				}
			}

			if newHeaders, exists := resultMap["headers"]; exists {
				if headersMap, ok := newHeaders.(map[string]any); ok {
					for key, value := range headersMap {
						if valueStr, ok := value.(string); ok {
							c.Header(key, valueStr)
						}
					}
				}
			}
		}
	}

	return statusCode, body, nil
}

func (p *JSRuntimePool) hasPostProcessFunction() bool {
	vm := p.Get()
	defer p.Put(vm)
	postProcessFunc := vm.Get("postProcessResponse")
	return postProcessFunc != nil && !goja.IsUndefined(postProcessFunc)
}

func JSRuntimeMiddleware() *gin.HandlerFunc {
	loadCfg()
	if !jsConfig.Enabled {
		common.SysLog("JavaScript Runtime is disabled")
		return nil
	}

	pool := initJSRuntimePool()
	var fn gin.HandlerFunc
	fn = func(c *gin.Context) {
		start := time.Now()

		// 预处理
		if err := pool.PreProcessRequest(c); err != nil {
			common.SysError("JS Runtime PreProcess Error: " + err.Error())
			return
		}

		duration := time.Since(start)
		if duration > time.Millisecond*100 {
			common.SysLog(fmt.Sprintf("JS Runtime PreProcess took %v", duration))
		}

		// 后处理
		if pool.hasPostProcessFunction() {
			writer := newResponseWriter(c.Writer)
			c.Writer = writer

			c.Next()

			// 后处理响应
			if writer.body.Len() > 0 {
				start := time.Now()

				statusCode, body, err := pool.PostProcessResponse(c, writer.statusCode, writer.body.Bytes())
				if err == nil {
					c.Writer = writer.ResponseWriter

					for k, v := range writer.headerMap {
						for _, value := range v {
							c.Writer.Header().Add(k, value)
						}
					}

					c.Status(statusCode)

					if len(body) >= 0 {
						c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", len(body)))
						c.Writer.Write(body)
					} else {
						c.Writer.Header().Del("Content-Length")
						c.Writer.Write(body)
					}
				} else {
					// 出错时回复原响应
					c.Writer = writer.ResponseWriter
					c.Status(writer.statusCode)

					common.SysError(fmt.Sprintf("JS Runtime PostProcess Error: %v", err))
				}

				duration := time.Since(start)
				if duration > time.Millisecond*100 {
					common.SysLog(fmt.Sprintf("JS Runtime PostProcess took %v", duration))
				}
			} else {
				// 没有响应体时，恢复原始writer
				c.Writer = writer.ResponseWriter
			}
		} else {
			c.Next()
		}
	}
	return &fn
}

func ReloadJSScripts() {
	if jsRuntimePool != nil {
		jsRuntimePool.ReloadScripts()
		common.SysLog("JavaScript scripts reloaded")
	}
}
