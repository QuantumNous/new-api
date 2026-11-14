package tests_test

import (
	"context"
	"time"

	"gorm.io/gorm/logger"
)

type Tracer struct {
	Logger logger.Interface
	Test   func(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error)
}

func (S Tracer) LogMode(level logger.LogLevel) logger.Interface {
	return S.Logger.LogMode(level)
}

func (S Tracer) Info(ctx context.Context, s string, i ...interface{}) {
	S.Logger.Info(ctx, s, i...)
}

func (S Tracer) Warn(ctx context.Context, s string, i ...interface{}) {
	S.Logger.Warn(ctx, s, i...)
}

func (S Tracer) Error(ctx context.Context, s string, i ...interface{}) {
	S.Logger.Error(ctx, s, i...)
}

func (S Tracer) Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	S.Logger.Trace(ctx, begin, fc, err)
	S.Test(ctx, begin, fc, err)
}
