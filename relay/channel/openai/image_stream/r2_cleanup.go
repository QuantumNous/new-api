package image_stream

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	awsv4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
)

const (
	asyncImageInputOutboxBatch = 64
	asyncImageInputOutboxLease = 15 * time.Minute
)

type asyncImageInputCleanupTaskHandler struct{}

func (asyncImageInputCleanupTaskHandler) Type() string { return model.SystemTaskTypeImageInputGC }

func (asyncImageInputCleanupTaskHandler) Enabled() bool { return LoadR2Config().InputEnabled() }

func (asyncImageInputCleanupTaskHandler) Interval() time.Duration { return time.Hour }

func (asyncImageInputCleanupTaskHandler) NewPayload() any { return nil }

func (asyncImageInputCleanupTaskHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	completed, retried, err := drainDueImageInputCleanups(ctx)
	result := map[string]any{
		"outbox_completed": completed,
		"outbox_retried":   retried,
	}
	if err != nil {
		if finishErr := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusFailed, result, common.MaskSensitiveInfo(err.Error())); finishErr != nil {
			logger.LogWarn(ctx, fmt.Sprintf("async image input cleanup task finish failed: %v", finishErr))
		}
		return
	}
	if err := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, result, ""); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("async image input cleanup task finish failed: %v", err))
	}
}

func drainDueImageInputCleanups(ctx context.Context) (int, int, error) {
	now := common.GetTimestamp()
	completed := 0
	retried := 0
	var firstErr error
	for completed+retried < asyncImageInputOutboxBatch {
		if err := ctx.Err(); err != nil {
			return completed, retried, err
		}
		now = common.GetTimestamp()
		cleanups, err := model.ClaimDueImageInputCleanups(
			now,
			now+int64(asyncImageInputOutboxLease/time.Second),
			1,
		)
		if err != nil {
			return completed, retried, fmt.Errorf("claim image input cleanup: %w", err)
		}
		if len(cleanups) == 0 {
			break
		}
		cleanup := cleanups[0]
		keys, cleanupErr := cleanup.ResolvedObjectKeys()
		if cleanupErr == nil {
			for index, key := range keys {
				cleanupErr = deleteAsyncImageInputObject(ctx, key)
				if cleanupErr != nil {
					break
				}
				if index+1 < len(keys) {
					if updateErr := model.UpdateClaimedImageInputCleanupKeys(cleanup, keys[index+1:]); updateErr != nil {
						cleanupErr = updateErr
						break
					}
				}
			}
		}
		if cleanupErr == nil {
			if markErr := model.MarkImageInputCleanupCompleted(cleanup); markErr != nil {
				cleanupErr = markErr
			} else {
				completed++
				continue
			}
		}

		delay := asyncImageRetryDelay(cleanup.Attempts)
		message := common.MaskSensitiveInfo(cleanupErr.Error())
		if retryErr := model.MarkImageInputCleanupRetry(cleanup, time.Now().Add(delay).Unix(), message); retryErr != nil {
			cleanupErr = fmt.Errorf("%v; schedule retry: %w", cleanupErr, retryErr)
		}
		retried++
		if firstErr == nil {
			firstErr = cleanupErr
		}
	}
	return completed, retried, firstErr
}

var deleteAsyncImageInputObject = func(ctx context.Context, key string) error {
	_, err := LoadR2Config().deleteInputObject(ctx, key, "")
	return err
}

func (c R2Config) deleteInputObject(ctx context.Context, key string, etag string) (bool, error) {
	if !strings.HasPrefix(key, "inputs/") || strings.Contains(key, "..") || strings.ContainsAny(key, "?#\\") {
		return false, errors.New("invalid R2 input object key")
	}
	objectURL, err := c.objectURL(c.InputBucket, key)
	if err != nil {
		return false, err
	}
	req, cancel, err := c.newSignedR2Request(ctx, http.MethodDelete, objectURL, strings.TrimSpace(etag))
	if err != nil {
		return false, err
	}
	defer cancel()
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("R2 DELETE failed: %w", err)
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode/100 == 2:
		return true, nil
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusPreconditionFailed:
		return false, nil
	default:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return false, fmt.Errorf("R2 DELETE %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
}

func (c R2Config) newSignedR2Request(ctx context.Context, method string, target string, etag string) (*http.Request, context.CancelFunc, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	req, err := http.NewRequestWithContext(reqCtx, method, target, nil)
	if err != nil {
		cancel()
		return nil, nil, err
	}
	if etag != "" {
		req.Header.Set("If-Match", etag)
	}
	emptyDigest := sha256.Sum256(nil)
	payloadHash := hex.EncodeToString(emptyDigest[:])
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	if err := awsv4.NewSigner().SignHTTP(reqCtx, c.credentials(), req, payloadHash, "s3", "auto", time.Now(), func(options *awsv4.SignerOptions) {
		options.DisableURIPathEscaping = true
	}); err != nil {
		cancel()
		return nil, nil, fmt.Errorf("sign R2 %s request: %w", method, err)
	}
	return req, cancel, nil
}
