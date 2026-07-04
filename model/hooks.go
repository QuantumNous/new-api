package model

// OnConsumeLogRecorded 消费日志落库成功后的回调。
// 由 service 层启动时注册,避免 model 反向依赖 service。
var OnConsumeLogRecorded func(logId int64, userId int, modelName string, quota int)
