package conversationarchive

import (
	"context"
	"fmt"
	"os"
	"path"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/logger"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const (
	r2UploadTimeout = 6 * time.Hour
	r2PartSize      = 64 * 1024 * 1024
	r2Concurrency   = 2
)

func (s *service) r2Client() *s3.Client {
	return s3.New(s3.Options{
		Region:                     s.cfg.R2Region,
		BaseEndpoint:               aws.String(strings.TrimRight(s.cfg.R2Endpoint, "/")),
		Credentials:                aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(s.cfg.R2AccessKeyID, s.cfg.R2SecretKey, "")),
		RequestChecksumCalculation: aws.RequestChecksumCalculationWhenRequired,
		UsePathStyle:               true,
	})
}

func (s *service) r2ObjectKey(date time.Time, fileName string) string {
	datePart := date.Format("2006/01/02")
	if s.cfg.R2Prefix == "" {
		return path.Join(datePart, fileName)
	}
	return path.Join(s.cfg.R2Prefix, datePart, fileName)
}

func (s *service) uploadDumpToR2(ctx context.Context, filePath string, key string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, r2UploadTimeout)
	defer cancel()

	client := s.r2Client()
	uploader := manager.NewUploader(client, func(u *manager.Uploader) {
		u.PartSize = r2PartSize
		u.Concurrency = r2Concurrency
		u.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
	})
	_, err = uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket:          aws.String(s.cfg.R2Bucket),
		Key:             aws.String(key),
		Body:            file,
		ContentLength:   aws.Int64(stat.Size()),
		ContentType:     aws.String("application/x-ndjson"),
		ContentEncoding: aws.String("gzip"),
	})
	if err != nil {
		return err
	}

	head, err := client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.cfg.R2Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return err
	}
	if head.ContentLength == nil || *head.ContentLength != stat.Size() {
		return fmt.Errorf("R2 对象大小校验失败: key=%s, local=%d, remote=%v", key, stat.Size(), head.ContentLength)
	}
	logger.LogInfo(ctx, fmt.Sprintf("会话归档 R2 上传成功: key=%s, size=%d", key, stat.Size()))
	return nil
}

func (s *service) dropArchiveTable(tableName string) error {
	if !validArchiveTableName(tableName) {
		return fmt.Errorf("非法归档表名: %s", tableName)
	}
	s.tableMu.Lock()
	defer s.tableMu.Unlock()
	if err := s.db.Exec(fmt.Sprintf(`DROP TABLE IF EXISTS "%s"`, tableName)).Error; err != nil {
		return err
	}
	delete(s.ensuredTables, tableName)
	logger.LogInfo(context.Background(), fmt.Sprintf("已删除完成归档的会话表: %s", tableName))
	return nil
}
