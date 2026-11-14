package memory

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/go-webauthn/webauthn/metadata"
)

// New returns a new memory Provider given a set of functional Option's.
func New(opts ...Option) (provider metadata.Provider, err error) {
	p := &Provider{
		undesired:   metadata.DefaultUndesiredAuthenticatorStatuses(),
		entry:       true,
		anchors:     true,
		status:      true,
		attestation: true,
	}

	for _, opt := range opts {
		if err = opt(p); err != nil {
			return nil, err
		}
	}

	if p.mds == nil {
		return nil, fmt.Errorf("memory metadata provider has not been initialized with metadata")
	}

	return p, nil
}

// Provider is a concrete implementation of the [metadata.Provider] that utilizes memory for validation. This provider is
// a simple one-shot that doesn't perform any locking, provide dynamic functionality, or download the metadata at any
// stage (it expects it's provided via one of the Option's).
type Provider struct {
	mds             map[uuid.UUID]*metadata.Entry
	desired         []metadata.AuthenticatorStatus
	undesired       []metadata.AuthenticatorStatus
	entry           bool
	entryPermitZero bool
	anchors         bool
	status          bool
	attestation     bool
}

func (p *Provider) GetEntry(ctx context.Context, aaguid uuid.UUID) (entry *metadata.Entry, err error) {
	if p.mds == nil {
		return nil, metadata.ErrNotInitialized
	}

	var ok bool

	if entry, ok = p.mds[aaguid]; ok {
		return entry, nil
	}

	return nil, nil
}

func (p *Provider) GetValidateEntry(ctx context.Context) (require bool) {
	return p.entry
}

func (p *Provider) GetValidateEntryPermitZeroAAGUID(ctx context.Context) (skip bool) {
	return p.entryPermitZero
}

func (p *Provider) GetValidateTrustAnchor(ctx context.Context) (validate bool) {
	return p.anchors
}

func (p *Provider) GetValidateStatus(ctx context.Context) (validate bool) {
	return p.status
}

func (p *Provider) GetValidateAttestationTypes(ctx context.Context) (validate bool) {
	return p.attestation
}

func (p *Provider) ValidateStatusReports(ctx context.Context, reports []metadata.StatusReport) (err error) {
	if !p.status {
		return nil
	}

	return metadata.ValidateStatusReports(reports, p.desired, p.undesired)
}

var (
	_ metadata.Provider = (*Provider)(nil)
)
