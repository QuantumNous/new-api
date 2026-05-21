package armsotel

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

const defaultServiceName = "new-api"

func init() {
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
}

func Init(ctx context.Context) (func(context.Context) error, error) {
	endpoint := firstEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "OTEL_EXPORTER_OTLP_ENDPOINT")
	if strings.TrimSpace(endpoint) == "" {
		return func(context.Context) error { return nil }, nil
	}
	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithEndpointURL(endpoint), otlptracegrpc.WithHeaders(parseHeaders(os.Getenv("OTEL_EXPORTER_OTLP_HEADERS"))))
	if err != nil {
		return nil, fmt.Errorf("init otlp trace exporter: %w", err)
	}
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewSchemaless(resourceAttributes()...)),
		sdktrace.WithSampler(sampler()),
	)
	otel.SetTracerProvider(provider)
	return provider.Shutdown, nil
}

func ServiceName() string {
	if name := strings.TrimSpace(os.Getenv("OTEL_SERVICE_NAME")); name != "" {
		return name
	}
	return defaultServiceName
}

func Tracer() trace.Tracer {
	return otel.Tracer(ServiceName())
}

func DetachedContext(ctx context.Context) context.Context {
	if ctx == nil {
		return context.Background()
	}
	return context.WithoutCancel(ctx)
}

func NewRequest(ctx context.Context, method, url string, body io.Reader) (*http.Request, error) {
	return http.NewRequestWithContext(DetachedContext(ctx), method, url, body)
}

func WrapTransport(base http.RoundTripper) http.RoundTripper {
	if base == nil {
		base = http.DefaultTransport
	}
	return traceTransport{base: base}
}

func TraceIDsFromContext(ctx context.Context) (string, string) {
	if ctx == nil {
		return "", ""
	}
	spanContext := trace.SpanContextFromContext(ctx)
	if !spanContext.IsValid() {
		return "", ""
	}
	return spanContext.TraceID().String(), spanContext.SpanID().String()
}

type traceTransport struct {
	base http.RoundTripper
}

func (t traceTransport) CloseIdleConnections() {
	if closer, ok := t.base.(interface{ CloseIdleConnections() }); ok {
		closer.CloseIdleConnections()
	}
}

func (t traceTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	ctx, span := Tracer().Start(req.Context(), "HTTP "+req.Method, trace.WithSpanKind(trace.SpanKindClient), trace.WithAttributes(
		attribute.String("http.request.method", req.Method),
		attribute.String("server.address", req.URL.Hostname()),
		attribute.String("url.path", req.URL.EscapedPath()),
	))
	defer span.End()
	req = req.Clone(ctx)
	otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(req.Header))
	resp, err := t.base.RoundTrip(req)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	span.SetAttributes(attribute.Int("http.response.status_code", resp.StatusCode))
	if resp.StatusCode >= http.StatusInternalServerError {
		span.SetStatus(codes.Error, http.StatusText(resp.StatusCode))
	}
	return resp, nil
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func parseHeaders(raw string) map[string]string {
	headers := map[string]string{}
	for _, item := range strings.Split(raw, ",") {
		key, value, ok := strings.Cut(item, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key != "" && value != "" {
			headers[key] = value
		}
	}
	return headers
}

func resourceAttributes() []attribute.KeyValue {
	attrs := []attribute.KeyValue{attribute.String("service.name", ServiceName())}
	if raw := strings.TrimSpace(os.Getenv("OTEL_RESOURCE_ATTRIBUTES")); raw != "" {
		for _, item := range strings.Split(raw, ",") {
			key, value, ok := strings.Cut(item, "=")
			if ok && strings.TrimSpace(key) != "" {
				attrs = append(attrs, attribute.String(strings.TrimSpace(key), strings.TrimSpace(value)))
			}
		}
	}
	return attrs
}

func sampler() sdktrace.Sampler {
	if strings.EqualFold(os.Getenv("OTEL_TRACES_SAMPLER"), "parentbased_traceidratio") {
		ratio, err := strconv.ParseFloat(os.Getenv("OTEL_TRACES_SAMPLER_ARG"), 64)
		if err != nil || ratio < 0 || ratio > 1 {
			ratio = 1
		}
		return sdktrace.ParentBased(sdktrace.TraceIDRatioBased(ratio))
	}
	return sdktrace.ParentBased(sdktrace.AlwaysSample())
}
