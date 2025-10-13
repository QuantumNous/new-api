package common

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/tencentyun/cos-go-sdk-v5"
)

var Writer *JSONLWriter

func init() {
	tempDir, err := os.MkdirTemp("./oss_log", "jsonl_log_")
	if err != nil {
		fmt.Printf("Failed to create temp dir: %v", err)
	}

	// 从环境变量获取COS配置参数
	cosBucket := os.Getenv("COS_BUCKET")
	cosRegion := os.Getenv("COS_REGION")
	cosPrefix := os.Getenv("COS_PREFIX")
	secretID := os.Getenv("COS_SECRET_ID")
	secretKey := os.Getenv("COS_SECRET_KEY")

	// 创建写入器，设置较小的文件大小限制来测试轮转
	writer, err := NewJSONLWriterWithCOS(tempDir, "jsonl_log_", "log", 10000,
		120*time.Second, 10000, 100*1024*1024,
		cosBucket, cosRegion, cosPrefix, secretID, secretKey)
	if err != nil {
		fmt.Printf("Failed to create writer: %v", err)
	}
	Writer = writer
}

type JSONLWriter struct {
	dir           string
	baseName      string
	customFile    string // 自定义文件名
	file          *os.File
	currentFile   string // 当前文件名（包含路径）
	buffer        []interface{}
	mu            sync.Mutex
	flushSize     int
	flushInterval time.Duration
	ch            chan interface{}
	wg            sync.WaitGroup
	ctxCancel     chan struct{}
	maxFileSize   int64
	closed        bool

	// COS 相关字段
	cosClient *cos.Client
	cosBucket string
	cosRegion string
	cosPrefix string // COS 对象前缀
}

// 初始化写入器（支持 COS 上传）
func NewJSONLWriterWithCOS(dir, baseName, customFile string, flushSize int, flushInterval time.Duration, channelBuffer int, maxFileSize int64, cosBucket, cosRegion, cosPrefix, secretID, secretKey string) (*JSONLWriter, error) {
	writer := &JSONLWriter{
		dir:           dir,
		baseName:      baseName,
		customFile:    customFile,
		buffer:        make([]interface{}, 0, flushSize),
		flushSize:     flushSize,
		flushInterval: flushInterval,
		ch:            make(chan interface{}, channelBuffer),
		ctxCancel:     make(chan struct{}),
		maxFileSize:   maxFileSize,
		closed:        false,
		cosBucket:     cosBucket,
		cosRegion:     cosRegion,
		cosPrefix:     cosPrefix,
	}

	// 初始化 COS 客户端
	if cosBucket != "" && cosRegion != "" && secretID != "" && secretKey != "" {
		u, err := url.Parse(fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cosBucket, cosRegion))
		if err != nil {
			return nil, fmt.Errorf("invalid COS URL: %v", err)
		}

		writer.cosClient = cos.NewClient(&cos.BaseURL{BucketURL: u}, &http.Client{
			Transport: &cos.AuthorizationTransport{
				SecretID:  secretID,
				SecretKey: secretKey,
			},
		})
	}

	if err := writer.newFile(); err != nil {
		return nil, err
	}

	writer.wg.Add(1)
	go writer.run()

	return writer, nil
}

// 写入一条记录
func (w *JSONLWriter) Write(data interface{}) {
	w.mu.Lock()
	if w.closed {
		w.mu.Unlock()
		return
	}
	w.mu.Unlock()

	// 阻塞等待，直到数据被成功写入 channel
	w.ch <- data
}

// 关闭写入器
func (w *JSONLWriter) Close() {
	w.mu.Lock()
	if w.closed {
		w.mu.Unlock()
		return
	}
	w.closed = true
	w.mu.Unlock()

	close(w.ch)
	close(w.ctxCancel)
	w.wg.Wait()

	w.mu.Lock()
	w.flushBuffer("Close()调用")
	if w.file != nil {
		// 上传最后一个文件到 COS
		if err := w.uploadToCOS(w.currentFile); err != nil {
			fmt.Printf("❌ 上传最后一个文件到 COS 失败: %v\n", err)
			// 不返回错误，继续关闭文件
		}
		w.file.Close()
	}
	w.mu.Unlock()
}

// 后台 goroutine
func (w *JSONLWriter) run() {
	defer w.wg.Done()
	ticker := time.NewTicker(w.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case data, ok := <-w.ch:
			if !ok {
				return
			}
			w.mu.Lock()
			w.buffer = append(w.buffer, data)
			if len(w.buffer) >= w.flushSize {
				w.flushBuffer("buffer满了")
			}
			w.mu.Unlock()
		case <-ticker.C:
			w.mu.Lock()
			if len(w.buffer) > 0 {
				w.flushBuffer("定时器触发")
			}
			w.mu.Unlock()
		case <-w.ctxCancel:
			return
		}
	}
}

// 批量写入文件
func (w *JSONLWriter) flushBuffer(reason string) {
	if len(w.buffer) == 0 {
		return
	}

	for _, data := range w.buffer {
		b, err := json.Marshal(data)
		if err != nil {
			// 记录错误但不阻塞处理
			fmt.Printf("json marshal error: %v\n", err)
			continue
		}
		if w.file != nil {
			_, err = w.file.Write(append(b, '\n'))
			if err != nil {
				fmt.Printf("file write error: %v\n", err)
			}
		}
	}

	// 检查文件大小（在写入整个 buffer 后检查）
	if w.file != nil {
		info, err := w.file.Stat()
		if err == nil {
			fileSize := info.Size()

			// 如果是 Close() 调用，打印最后一次文件状态
			if reason == "Close()调用" {
				fmt.Printf("📋 关闭前文件状态 - 文件: %s, 当前大小: %d 字节 (%.2f MB), 限制: %d 字节 (%.2f MB)\n",
					w.currentFile, fileSize, float64(fileSize)/1024/1024, w.maxFileSize, float64(w.maxFileSize)/1024/1024)
			}

			if fileSize > w.maxFileSize {
				oldFile := w.currentFile
				fmt.Printf("🔄 开始换文件 - 文件: %s, 原因: 文件大小超过限制 (%d 字节 > %d 字节), 触发来源: %s\n",
					oldFile, fileSize, w.maxFileSize, reason)

				// 关闭当前文件
				w.file.Close()

				// 上传上一个文件到 COS
				if err := w.uploadToCOS(oldFile); err != nil {
					fmt.Printf("❌ 上传文件到 COS 失败: %v\n", err)
					// 不返回错误，继续创建新文件
				}

				// 创建新文件
				if err := w.newFile(); err != nil {
					// 记录错误但不阻塞处理
					fmt.Printf("❌ 创建新文件失败: %v\n", err)
					return
				}
				fmt.Printf("✅ 文件切换完成 - 新文件: %s\n", w.currentFile)
			}
		} else {
			fmt.Printf("⚠️  获取文件信息失败: %v\n", err)
		}
	}

	// 清空 buffer
	w.buffer = w.buffer[:0]
}

// 上传文件到 COS
func (w *JSONLWriter) uploadToCOS(filePath string) error {
	if w.cosClient == nil {
		return nil // 没有配置 COS，跳过上传
	}

	// 生成 COS 对象键名
	fileName := filepath.Base(filePath)
	objectKey := fileName
	if w.cosPrefix != "" {
		objectKey = w.cosPrefix + "/" + fileName
	}

	// 上传文件
	_, err := w.cosClient.Object.PutFromFile(context.Background(), objectKey, filePath, nil)
	if err != nil {
		return fmt.Errorf("upload to COS failed: %v", err)
	}

	fmt.Printf("☁️  文件已上传到 COS - 本地文件: %s, COS 对象: %s\n", filePath, objectKey)
	return nil
}

// 新建文件（支持自定义文件名前缀 + 时间戳 + 随机数命名）
func (w *JSONLWriter) newFile() error {
	now := time.Now()
	timestamp := now.Format("20060102_150405")

	// 使用新的随机数生成方式，避免 rand.Seed 弃用问题
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	r := rng.Intn(1000000) // 6 位随机数

	var prefix string
	if w.customFile != "" {
		// 使用自定义文件名作为前缀
		prefix = w.customFile
	} else {
		// 使用 baseName 作为前缀
		prefix = w.baseName
	}

	filename := filepath.Join(w.dir, fmt.Sprintf("%s_%s_%06d.jsonl", prefix, timestamp, r))

	file, err := os.OpenFile(filename, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	w.file = file
	w.currentFile = filename // 记录当前文件名
	return nil
}
