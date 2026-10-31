# Example for go-redis OpenTelemetry instrumentation

See [Monitoring performance and errors](https://redis.uptrace.dev/guide/tracing.html) for details.

This example requires Redis Server on port `:6379`. You can start Redis Server using Docker:

```shell
docker-compose up -d
```

You can run this example with different OpenTelemetry exporters by providing environment variables.

**Stdout** exporter (default):

```shell
go run .
```

**Jaeger** exporter:

```shell
OTEL_EXPORTER_JAEGER_ENDPOINT=http://localhost:14268/api/traces go run .
```

**Uptrace** exporter:

```shell
UPTRACE_DSN="https://<token>@uptrace.dev/<project_id>" go run .
```

## Links

- [Find instrumentations](https://opentelemetry.uptrace.dev/instrumentations/?lang=go)
- [OpenTelemetry Tracing API](https://opentelemetry.uptrace.dev/guide/go-tracing.html)
