package common

import (
	"fmt"
	"net/http"
	"os"
	"runtime/pprof"
	"sync"
	"time"

	"github.com/shirou/gopsutil/cpu"
)

var (
	PProfEnabled  bool
	PProfMutex    sync.RWMutex
	pprofServer   *http.Server
	serverRunning bool
)

// Monitor 定时监控cpu使用率，超过阈值输出pprof文件
func Monitor() {
	for {
		percent, err := cpu.Percent(time.Second, false)
		if err != nil {
			panic(err)
		}
		if percent[0] > 80 {
			fmt.Println("cpu usage too high")
			// write pprof file
			if _, err := os.Stat("./pprof"); os.IsNotExist(err) {
				err := os.Mkdir("./pprof", os.ModePerm)
				if err != nil {
					SysLog("创建pprof文件夹失败 " + err.Error())
					continue
				}
			}
			f, err := os.Create("./pprof/" + fmt.Sprintf("cpu-%s.pprof", time.Now().Format("20060102150405")))
			if err != nil {
				SysLog("创建pprof文件失败 " + err.Error())
				continue
			}
			err = pprof.StartCPUProfile(f)
			if err != nil {
				SysLog("启动pprof失败 " + err.Error())
				continue
			}
			time.Sleep(10 * time.Second) // profile for 30 seconds
			pprof.StopCPUProfile()
			f.Close()
		}
		time.Sleep(30 * time.Second)
	}
}

// InitPProfServer 初始化并启动 pprof 服务器
func InitPProfServer() {
	// 创建 pprof 服务器
	pprofServer = &http.Server{
		Addr:    "0.0.0.0:8005",
		Handler: http.DefaultServeMux,
	}

	// 启动监控协程
	go func() {
		for {
			PProfMutex.RLock()
			enabled := PProfEnabled
			PProfMutex.RUnlock()

			SysLog(fmt.Sprintf("[PPROF] Status check - enabled: %v, serverRunning: %v", enabled, serverRunning))

			if enabled && !serverRunning {
				// 启动服务器
				go func() {
					SysLog("[PPROF] Starting server on :8005")
					if err := pprofServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
						SysError(fmt.Sprintf("[PPROF] Server error: %v", err))
					}
				}()
				serverRunning = true
				SysLog("[PPROF] Server marked as running")
			} else if !enabled && serverRunning {
				// 关闭服务器
				SysLog("[PPROF] Stopping server")
				if err := pprofServer.Close(); err != nil {
					SysError(fmt.Sprintf("[PPROF] Server close error: %v", err))
				}
				// 重新创建服务器实例
				pprofServer = &http.Server{
					Addr:    "0.0.0.0:8005",
					Handler: http.DefaultServeMux,
				}
				serverRunning = false
				SysLog("[PPROF] Server marked as stopped")
			}
			time.Sleep(5 * time.Second)
		}
	}()

	SysLog("[PPROF] Server initialized and monitoring started")
}
