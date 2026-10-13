package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
)

const maximumRequestBytes = 1 << 20

type Backend interface {
	Route(context.Context, RouteRequest) (RouteResponse, error)
	RecordOutcome(context.Context, AttemptOutcome) error
	Snapshot(context.Context) (SignedSnapshot, error)
}

type Metrics interface {
	ObserveHTTP(string, int)
	Handler() http.Handler
}

type Server struct {
	backend Backend
	metrics Metrics
}

func NewServer(backend Backend, metrics Metrics) *Server {
	return &Server{backend: backend, metrics: metrics}
}

func (server *Server) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	switch request.URL.Path {
	case "/v1/route":
		if request.Method != http.MethodPost {
			server.methodNotAllowed(writer, "route")
			return
		}
		server.handleRoute(writer, request)
	case "/v1/outcomes":
		if request.Method != http.MethodPost {
			server.methodNotAllowed(writer, "outcome")
			return
		}
		server.handleOutcome(writer, request)
	case "/v1/snapshot":
		if request.Method != http.MethodGet {
			server.methodNotAllowed(writer, "snapshot")
			return
		}
		server.handleSnapshot(writer, request)
	case "/healthz":
		if request.Method != http.MethodGet {
			server.methodNotAllowed(writer, "health")
			return
		}
		writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("ok\n"))
		server.metrics.ObserveHTTP("health", http.StatusOK)
	case "/metrics":
		if request.Method != http.MethodGet {
			server.methodNotAllowed(writer, "metrics")
			return
		}
		server.metrics.Handler().ServeHTTP(writer, request)
	default:
		server.writeError(writer, "unknown", http.StatusNotFound, ContractError{
			Code: ErrorInvalidRequest, Message: "endpoint not found",
		})
	}
}

func (server *Server) handleRoute(writer http.ResponseWriter, request *http.Request) {
	var routeRequest RouteRequest
	request.Body = http.MaxBytesReader(writer, request.Body, maximumRequestBytes)
	if err := DecodeStrict(request.Body, &routeRequest); err != nil {
		server.writeError(writer, "route", http.StatusBadRequest, ContractError{
			Code: ErrorInvalidRequest, RequestID: routeRequest.RequestID,
			Message: "request does not satisfy the route contract",
		})
		return
	}
	response, err := server.backend.Route(request.Context(), routeRequest)
	if err != nil {
		server.writeBackendError(writer, "route", routeRequest.RequestID, err)
		return
	}
	if err := response.Validate(); err != nil {
		server.writeBackendError(writer, "route", routeRequest.RequestID, err)
		return
	}
	server.writeJSON(writer, "route", http.StatusOK, response)
}

func (server *Server) handleOutcome(writer http.ResponseWriter, request *http.Request) {
	var outcome AttemptOutcome
	request.Body = http.MaxBytesReader(writer, request.Body, maximumRequestBytes)
	if err := DecodeStrict(request.Body, &outcome); err != nil {
		server.writeError(writer, "outcome", http.StatusBadRequest, ContractError{
			Code: ErrorInvalidRequest, RequestID: outcome.RequestID,
			Message: "request does not satisfy the outcome contract",
		})
		return
	}
	if err := server.backend.RecordOutcome(request.Context(), outcome); err != nil {
		server.writeBackendError(writer, "outcome", outcome.RequestID, err)
		return
	}
	writer.WriteHeader(http.StatusNoContent)
	server.metrics.ObserveHTTP("outcome", http.StatusNoContent)
}

func (server *Server) handleSnapshot(writer http.ResponseWriter, request *http.Request) {
	snapshot, err := server.backend.Snapshot(request.Context())
	if err != nil {
		server.writeBackendError(writer, "snapshot", "", err)
		return
	}
	if err := snapshot.Validate(); err != nil {
		server.writeBackendError(writer, "snapshot", "", err)
		return
	}
	server.writeJSON(writer, "snapshot", http.StatusOK, snapshot)
}

func (server *Server) methodNotAllowed(writer http.ResponseWriter, route string) {
	server.writeError(writer, route, http.StatusMethodNotAllowed, ContractError{
		Code: ErrorInvalidRequest, Message: "method not allowed",
	})
}

func (server *Server) writeBackendError(
	writer http.ResponseWriter,
	route string,
	requestID string,
	err error,
) {
	var contractError ContractError
	if errors.As(err, &contractError) {
		if contractError.RequestID == "" {
			contractError.RequestID = requestID
		}
		server.writeError(writer, route, statusForCode(contractError.Code), contractError)
		return
	}
	server.writeError(writer, route, http.StatusInternalServerError, ContractError{
		Code: ErrorSnapshotUnavailable, Retryable: true, RequestID: requestID,
		Message: "router state is temporarily unavailable",
	})
}

func (server *Server) writeError(
	writer http.ResponseWriter,
	route string,
	status int,
	contractError ContractError,
) {
	contractError.Kind = "error"
	contractError.SchemaVersion = 1
	server.writeJSON(writer, route, status, contractError)
}

func (server *Server) writeJSON(writer http.ResponseWriter, route string, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
	server.metrics.ObserveHTTP(route, status)
}

func statusForCode(code ErrorCode) int {
	switch code {
	case ErrorInvalidRequest:
		return http.StatusBadRequest
	case ErrorContractMismatch, ErrorOutcomeConflict:
		return http.StatusConflict
	case ErrorSignatureInvalid:
		return http.StatusUnauthorized
	case ErrorSnapshotExpired:
		return http.StatusGone
	case ErrorSnapshotUnavailable, ErrorBindingUnavailable:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}
