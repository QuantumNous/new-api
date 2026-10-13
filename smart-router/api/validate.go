package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
)

var (
	signaturePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{32,256}$`)
	hashPattern      = regexp.MustCompile(`^[0-9a-f]{64}$`)
	bindingIDPattern = regexp.MustCompile(`^bnd_[A-Za-z0-9_-]{24}$`)
)

func DecodeStrict(reader io.Reader, dst Validatable) error {
	decoder := json.NewDecoder(reader)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return fmt.Errorf("decode: %w", err)
	}
	if err := ensureEOF(decoder); err != nil {
		return err
	}
	return dst.Validate()
}

func ensureEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("decode: multiple JSON values")
		}
		return fmt.Errorf("decode trailing value: %w", err)
	}
	return nil
}

func (request RouteRequest) Validate() error {
	if err := validateEnvelope(request.Kind, "route_request", request.SchemaVersion); err != nil {
		return err
	}
	if err := bounded("request_id", request.RequestID, 1, 128); err != nil {
		return err
	}
	if err := bounded("group", request.Group, 1, 128); err != nil {
		return err
	}
	if err := bounded("model", request.Model, 1, 256); err != nil {
		return err
	}
	if err := validateProtocol(request.Protocol); err != nil {
		return err
	}
	if request.AttemptLimit < 1 || request.AttemptLimit > 5 {
		return errors.New("attempt_limit must be between 1 and 5")
	}
	if len(request.SnapshotRevision) > 128 {
		return errors.New("snapshot_revision exceeds 128 characters")
	}
	if len(request.Bindings) > 5 {
		return errors.New("bindings exceeds five entries")
	}
	for _, binding := range request.Bindings {
		if err := binding.Validate(); err != nil {
			return err
		}
	}
	return nil
}

func (response RouteResponse) Validate() error {
	if err := validateEnvelope(response.Kind, "route_response", response.SchemaVersion); err != nil {
		return err
	}
	if err := bounded("request_id", response.RequestID, 1, 128); err != nil {
		return err
	}
	if err := bounded("snapshot_revision", response.SnapshotRevision, 1, 128); err != nil {
		return err
	}
	if response.ExpiresAt < 1 {
		return errors.New("expires_at must be positive")
	}
	if err := validateBindings(response.Bindings); err != nil {
		return err
	}
	return validateSignature(response.Signature)
}

func (route SnapshotRoute) Validate() error {
	if err := bounded("group", route.Group, 1, 128); err != nil {
		return err
	}
	if err := bounded("model", route.Model, 1, 256); err != nil {
		return err
	}
	if err := validateProtocol(route.Protocol); err != nil {
		return err
	}
	return validateBindings(route.Bindings)
}

func (snapshot SignedSnapshot) Validate() error {
	if err := validateEnvelope(snapshot.Kind, "signed_snapshot", snapshot.SchemaVersion); err != nil {
		return err
	}
	if err := bounded("revision", snapshot.Revision, 1, 128); err != nil {
		return err
	}
	if snapshot.IssuedAt < 1 || snapshot.ExpiresAt < 1 {
		return errors.New("snapshot timestamps must be positive")
	}
	if snapshot.ExpiresAt <= snapshot.IssuedAt {
		return errors.New("expires_at must be after issued_at")
	}
	if !hashPattern.MatchString(snapshot.ConfigSHA256) {
		return errors.New("config_sha256 must be lowercase SHA-256")
	}
	if !hashPattern.MatchString(snapshot.PluginManifestSHA256) {
		return errors.New("plugin_manifest_sha256 must be lowercase SHA-256")
	}
	for _, route := range snapshot.Routes {
		if err := route.Validate(); err != nil {
			return err
		}
	}
	return validateSignature(snapshot.Signature)
}

func (outcome AttemptOutcome) Validate() error {
	if err := validateEnvelope(outcome.Kind, "attempt_outcome", outcome.SchemaVersion); err != nil {
		return err
	}
	for name, value := range map[string]string{
		"event_id": outcome.EventID, "request_id": outcome.RequestID,
	} {
		if err := bounded(name, value, 1, 128); err != nil {
			return err
		}
	}
	if err := ValidateBindingID(outcome.BindingID); err != nil {
		return err
	}
	if err := validateProtocol(outcome.Protocol); err != nil {
		return err
	}
	switch outcome.Outcome {
	case OutcomeSuccess, OutcomeAuth401, OutcomeRateLimited429, OutcomeUpstream5xx,
		OutcomeClient4xx, OutcomeTransportPreWrite, OutcomeWriteUnknown, OutcomeResponseCommitted:
	default:
		return fmt.Errorf("unsupported outcome %q", outcome.Outcome)
	}
	if outcome.LatencyMS < 0 || outcome.TTFTMS < 0 || outcome.RetryAfterMS < 0 {
		return errors.New("outcome timings must not be negative")
	}
	if outcome.RetryAfterMS > MaximumRetryAfterMS {
		return errors.New("retry_after_ms must not exceed 24 hours")
	}
	return nil
}

func (contractError ContractError) Validate() error {
	if err := validateEnvelope(contractError.Kind, "error", contractError.SchemaVersion); err != nil {
		return err
	}
	switch contractError.Code {
	case ErrorInvalidRequest, ErrorContractMismatch, ErrorSnapshotUnavailable,
		ErrorSnapshotExpired, ErrorSignatureInvalid, ErrorBindingUnavailable, ErrorOutcomeConflict:
	default:
		return fmt.Errorf("unsupported error code %q", contractError.Code)
	}
	if len(contractError.RequestID) > 128 {
		return errors.New("request_id exceeds 128 characters")
	}
	if len(contractError.Message) > 512 {
		return errors.New("message exceeds 512 characters")
	}
	return nil
}

func (binding Binding) Validate() error {
	if err := ValidateBindingID(binding.BindingID); err != nil {
		return err
	}
	if err := bounded("protocol_plugin", binding.ProtocolPlugin, 1, 128); err != nil {
		return err
	}
	if binding.Rank < 1 || binding.Rank > 5 {
		return errors.New("binding rank must be between 1 and 5")
	}
	if binding.CostMicrounits < 0 {
		return errors.New("cost_microunits must not be negative")
	}
	return nil
}

func ValidateBindingID(bindingID string) error {
	if !bindingIDPattern.MatchString(bindingID) {
		return errors.New("binding_id must be a canonical opaque ID")
	}
	return nil
}

func validateEnvelope(actualKind, expectedKind string, version int) error {
	if actualKind != expectedKind {
		return fmt.Errorf("kind must be %q", expectedKind)
	}
	if version != 1 {
		return errors.New("schema_version must be 1")
	}
	return nil
}

func validateProtocol(protocol Protocol) error {
	switch protocol {
	case ProtocolChat, ProtocolResponses, ProtocolMessages, ProtocolTaskBridge:
		return nil
	default:
		return fmt.Errorf("unsupported protocol %q", protocol)
	}
}

func validateBindings(bindings []Binding) error {
	if len(bindings) < 1 || len(bindings) > 5 {
		return errors.New("bindings must contain between one and five entries")
	}
	for _, binding := range bindings {
		if err := binding.Validate(); err != nil {
			return err
		}
	}
	return nil
}

func validateSignature(signature string) error {
	if !signaturePattern.MatchString(signature) {
		return errors.New("signature is not base64url contract form")
	}
	return nil
}

func bounded(name, value string, minimum, maximum int) error {
	if len(value) < minimum || len(value) > maximum {
		return fmt.Errorf("%s length must be between %d and %d", name, minimum, maximum)
	}
	return nil
}
