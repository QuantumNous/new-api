package middleware

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/pkg/armsotel"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

const (
	TraceIdKey = "trace_id"
	SpanIdKey  = "span_id"
)

func Trace() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := otel.GetTextMapPropagator().Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))
		spanName := c.Request.Method + " " + c.Request.URL.Path
		ctx, span := armsotel.Tracer().Start(ctx, spanName, trace.WithSpanKind(trace.SpanKindServer), trace.WithAttributes(
			attribute.String("http.request.method", c.Request.Method),
			attribute.String("url.path", c.Request.URL.Path),
		))
		c.Request = c.Request.WithContext(ctx)
		setTraceKeys(c)
		defer finishTraceSpan(c, span)
		c.Next()
	}
}

func finishTraceSpan(c *gin.Context, span trace.Span) {
	if recovered := recover(); recovered != nil {
		err := fmt.Errorf("panic: %v", recovered)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		finishTraceStatus(c, span, http.StatusInternalServerError)
		span.End()
		panic(recovered)
	}
	if len(c.Errors) > 0 {
		span.RecordError(c.Errors.Last())
		span.SetStatus(codes.Error, c.Errors.Last().Error())
	}
	finishTraceStatus(c, span, c.Writer.Status())
	span.End()
}

func finishTraceStatus(c *gin.Context, span trace.Span, statusCode int) {
	if route := c.FullPath(); route != "" {
		span.SetName(c.Request.Method + " " + route)
		span.SetAttributes(attribute.String("http.route", route))
	}
	span.SetAttributes(attribute.Int("http.response.status_code", statusCode))
	if statusCode >= http.StatusInternalServerError {
		span.SetStatus(codes.Error, http.StatusText(statusCode))
	}
}

func setTraceKeys(c *gin.Context) {
	traceID, spanID := armsotel.TraceIDsFromContext(c.Request.Context())
	if traceID != "" {
		c.Set(TraceIdKey, traceID)
	}
	if spanID != "" {
		c.Set(SpanIdKey, spanID)
	}
}
