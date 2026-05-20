package service

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const imageTaskQueueKey = "image_task_queue"

var ProcessImageTaskFunc func(taskId string)

func StartImageTaskWorker() {
	if !common.RedisEnabled {
		common.SysLog("Redis not enabled, image task worker will not start")
		return
	}
	if ProcessImageTaskFunc == nil {
		common.SysLog("ProcessImageTaskFunc not set, image task worker will not start")
		return
	}
	common.SysLog("Image task worker started")
	go imageTaskWorkerLoop()
}

func imageTaskWorkerLoop() {
	ctx := context.Background()
	for {
		result, err := common.RDB.BRPop(ctx, 30*time.Second, imageTaskQueueKey).Result()
		if err != nil {
			if err.Error() != "redis: nil" {
				time.Sleep(1 * time.Second)
			}
			continue
		}
		if len(result) < 2 {
			continue
		}
		taskId := result[1]
		ProcessImageTaskFunc(taskId)
	}
}

func EnqueueImageTask(taskId string) {
	if common.RedisEnabled {
		ctx := context.Background()
		common.RDB.LPush(ctx, imageTaskQueueKey, taskId)
	} else if ProcessImageTaskFunc != nil {
		go ProcessImageTaskFunc(taskId)
	}
}
