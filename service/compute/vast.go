// Package compute is a thin server-side wrapper around the upstream GPU
// marketplace API used to power the "flatkey Compute" rental line.
//
// WHITELABEL (critical): the upstream provider (Vast.ai) MUST NOT be perceived
// by customers or the admin UI. This package is the ONLY place that knows the
// provider's base URL, auth scheme, and wire format. Everything it returns to
// callers is mapped into flatkey-branded structs whose provider-identifying
// fields are tagged `json:"-"` so they can never leak through an API response.
// The API key is read from the VAST_API_KEY environment variable and is NEVER
// hardcoded or logged.
package compute

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	// vastAPIBaseURL is the upstream marketplace API base. Internal only.
	vastAPIBaseURL = "https://console.vast.ai/api/v0"
	// vastAPIKeyEnv is the env var holding the upstream bearer token.
	vastAPIKeyEnv      = "VAST_API_KEY"
	vastRequestTimeout = 20 * time.Second
)

// ErrProviderNotConfigured is returned when VAST_API_KEY is not set. Callers
// should surface a generic "compute provider not configured" message and must
// not echo the provider name to clients.
var ErrProviderNotConfigured = errors.New("compute provider is not configured")

// ErrOfferNotFound is returned when a requested offer is no longer rentable.
var ErrOfferNotFound = errors.New("compute offer is no longer available")

// ComputeRentalMarkup is the multiplier applied to the raw upstream GPU cost to
// set the customer price for a rental. Group discounts are intentionally NOT
// applied to raw hardware rental — a discount could push the price below what
// we pay upstream and lose money. This markup guarantees a fixed margin on
// every rental regardless of the customer's group.
const ComputeRentalMarkup = 1.30

// CustomerHourlyPrice converts the raw upstream $/hr we pay into the customer
// $/hr we charge (raw × markup). Single source of truth so the displayed price,
// the estimate, and the amount billed all agree.
func CustomerHourlyPrice(rawCostPerHour float64) float64 {
	return rawCostPerHour * ComputeRentalMarkup
}

// Offer is the whitelabeled view of an upstream GPU offer.
//
// Only GPU / price / spec fields are serialized. The upstream contract/host/
// machine identifiers are internal-only (`json:"-"`) so a proxied offers
// response can be returned to the admin UI without leaking the marketplace.
type Offer struct {
	// ---- Public / whitelabeled fields ----
	GpuName     string  `json:"gpu_name"`
	NumGpus     int     `json:"num_gpus"`
	GpuRamGB    float64 `json:"gpu_ram_gb"`
	CostPerHour float64 `json:"cost_per_hour"`
	CpuCores    float64 `json:"cpu_cores"`
	RamGB       float64 `json:"ram_gb"`
	DiskGB      float64 `json:"disk_gb"`
	Reliability float64 `json:"reliability"`

	// ---- INTERNAL-ONLY (whitelabel): upstream identifiers, never serialized ----
	ContractID int    `json:"-"`
	HostID     int    `json:"-"`
	MachineID  int    `json:"-"`
	Datacenter string `json:"-"`
}

// RemoteInstance is the whitelabeled view of an upstream running instance.
// The upstream instance/contract id is retained internally for reconciliation
// but is never serialized to clients.
type RemoteInstance struct {
	Status  string `json:"status"`
	GpuName string `json:"gpu_name"`

	ContractID int    `json:"-"`
	HostIP     string `json:"-"`
	HostPort   int    `json:"-"`
}

// --- upstream wire structs (internal only) ---

type vastBundlesResponse struct {
	Offers []vastOffer `json:"offers"`
}

type vastOffer struct {
	ID          int     `json:"id"`
	HostID      int     `json:"host_id"`
	MachineID   int     `json:"machine_id"`
	GpuName     string  `json:"gpu_name"`
	NumGpus     int     `json:"num_gpus"`
	GpuRam      float64 `json:"gpu_ram"` // MB
	DphTotal    float64 `json:"dph_total"`
	CpuCores    float64 `json:"cpu_cores"`
	CpuRam      float64 `json:"cpu_ram"`    // MB
	DiskSpace   float64 `json:"disk_space"` // GB
	Reliability float64 `json:"reliability2"`
	Geolocation string  `json:"geolocation"`
}

type vastInstancesResponse struct {
	Instances []vastInstance `json:"instances"`
}

type vastInstance struct {
	ID           int     `json:"id"`
	ActualStatus string  `json:"actual_status"`
	GpuName      string  `json:"gpu_name"`
	PublicIPAddr string  `json:"public_ipaddr"`
	SSHHost      string  `json:"ssh_host"`
	SSHPort      int     `json:"ssh_port"`
	DphTotal     float64 `json:"dph_total"`
}

// vastInstanceResponse is the per-id GET /instances/{id}/ shape, where
// "instances" is a single object (the LIST endpoint returns an array instead
// and is sometimes empty — see GetInstanceConnection).
type vastInstanceResponse struct {
	Instances vastInstance `json:"instances"`
}

// vastProvisionRequest is the PUT /asks/{offer_id}/ body that launches a rental.
type vastProvisionRequest struct {
	ClientID string            `json:"client_id"`
	Image    string            `json:"image"`
	Disk     int               `json:"disk"`
	Label    string            `json:"label"`
	OnStart  string            `json:"onstart"`
	Env      map[string]string `json:"env,omitempty"`
	RunType  string            `json:"runtype"`
}

// vastProvisionResponse is the PUT /asks/{offer_id}/ result.
type vastProvisionResponse struct {
	Success     bool `json:"success"`
	NewContract int  `json:"new_contract"`
}

// vastSSHKeyRequest is the POST /instances/{id}/ssh/ body.
type vastSSHKeyRequest struct {
	SSHKey string `json:"ssh_key"`
}

func apiKey() (string, error) {
	key := strings.TrimSpace(os.Getenv(vastAPIKeyEnv))
	if key == "" {
		return "", ErrProviderNotConfigured
	}
	return key, nil
}

func httpClient() *http.Client {
	return &http.Client{Timeout: vastRequestTimeout}
}

// doRequest performs an authenticated request against the upstream API and
// decodes the JSON body into out (when non-nil). The bearer token is attached
// here and nowhere else.
func doRequest(method, endpoint string, out any) error {
	return doRequestWithBody(method, endpoint, nil, out)
}

// doRequestWithBody is doRequest with an optional JSON request body. Body
// marshaling goes through common.Marshal (Rule 1). Used by the provisioning /
// ssh-key endpoints which are PUT/POST with a payload.
func doRequestWithBody(method, endpoint string, body any, out any) error {
	key, err := apiKey()
	if err != nil {
		return err
	}
	var reqBody io.Reader
	if body != nil {
		raw, err := common.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, endpoint, reqBody)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := httpClient().Do(req)
	if err != nil {
		// Deliberately do not wrap with the provider name.
		return fmt.Errorf("compute upstream request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("compute upstream returned HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if out == nil {
		return nil
	}
	return common.DecodeJson(resp.Body, out)
}

// buildOffersQuery constructs the JSON `q` query for the bundles endpoint.
// Marshaling goes through common.Marshal (Rule 1).
func buildOffersQuery(gpuName string) (string, error) {
	q := map[string]any{
		"rentable": map[string]any{"eq": true},
		"order":    [][]string{{"dph_total", "asc"}},
	}
	if strings.TrimSpace(gpuName) != "" {
		q["gpu_name"] = map[string]any{"eq": gpuName}
	}
	raw, err := common.Marshal(q)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

// SearchOffers queries available upstream GPU offers, optionally filtered by
// GPU name. Returned offers are whitelabeled — provider identifiers live only
// on the internal (`json:"-"`) fields.
func SearchOffers(gpuName string) ([]Offer, error) {
	q, err := buildOffersQuery(gpuName)
	if err != nil {
		return nil, err
	}
	endpoint := fmt.Sprintf("%s/bundles/?q=%s", vastAPIBaseURL, url.QueryEscape(q))

	var resp vastBundlesResponse
	if err := doRequest(http.MethodGet, endpoint, &resp); err != nil {
		return nil, err
	}

	offers := make([]Offer, 0, len(resp.Offers))
	for _, o := range resp.Offers {
		offers = append(offers, Offer{
			GpuName:     o.GpuName,
			NumGpus:     o.NumGpus,
			GpuRamGB:    mbToGB(o.GpuRam),
			CostPerHour: o.DphTotal,
			CpuCores:    o.CpuCores,
			RamGB:       mbToGB(o.CpuRam),
			DiskGB:      o.DiskSpace,
			Reliability: o.Reliability,
			ContractID:  o.ID,
			HostID:      o.HostID,
			MachineID:   o.MachineID,
			Datacenter:  o.Geolocation,
		})
	}
	return offers, nil
}

// FindOffer looks up a single rentable offer by its internal offer id and
// returns the whitelabeled Offer (authoritative cost/spec, so the server never
// trusts a client-supplied price). Returns ErrOfferNotFound when the offer is
// no longer rentable.
func FindOffer(offerID int) (*Offer, error) {
	if offerID <= 0 {
		return nil, ErrOfferNotFound
	}
	q := map[string]any{
		"rentable": map[string]any{"eq": true},
		"id":       map[string]any{"eq": offerID},
	}
	raw, err := common.Marshal(q)
	if err != nil {
		return nil, err
	}
	endpoint := fmt.Sprintf("%s/bundles/?q=%s", vastAPIBaseURL, url.QueryEscape(string(raw)))
	var resp vastBundlesResponse
	if err := doRequest(http.MethodGet, endpoint, &resp); err != nil {
		return nil, err
	}
	for _, o := range resp.Offers {
		if o.ID != offerID {
			continue
		}
		return &Offer{
			GpuName:     o.GpuName,
			NumGpus:     o.NumGpus,
			GpuRamGB:    mbToGB(o.GpuRam),
			CostPerHour: o.DphTotal,
			CpuCores:    o.CpuCores,
			RamGB:       mbToGB(o.CpuRam),
			DiskGB:      o.DiskSpace,
			Reliability: o.Reliability,
			ContractID:  o.ID,
			HostID:      o.HostID,
			MachineID:   o.MachineID,
			Datacenter:  o.Geolocation,
		}, nil
	}
	return nil, ErrOfferNotFound
}

// FindCheapestOffer returns the lowest-priced rentable offer for the given GPU
// name. Clients rent by GPU type — the upstream offer id is never exposed — so
// the backend resolves the concrete offer to provision at request time. This
// also sidesteps stale-offer errors from a client-cached id.
func FindCheapestOffer(gpuName string) (*Offer, error) {
	if gpuName == "" {
		return nil, ErrOfferNotFound
	}
	offers, err := SearchOffers(gpuName)
	if err != nil {
		return nil, err
	}
	var best *Offer
	for i := range offers {
		o := offers[i]
		if o.ContractID <= 0 || o.CostPerHour <= 0 {
			continue
		}
		if best == nil || o.CostPerHour < best.CostPerHour {
			best = &o
		}
	}
	if best == nil {
		return nil, ErrOfferNotFound
	}
	return best, nil
}

// ListRemoteInstances returns the caller's currently provisioned upstream
// instances, whitelabeled.
func ListRemoteInstances() ([]RemoteInstance, error) {
	endpoint := fmt.Sprintf("%s/instances/", vastAPIBaseURL)
	var resp vastInstancesResponse
	if err := doRequest(http.MethodGet, endpoint, &resp); err != nil {
		return nil, err
	}
	instances := make([]RemoteInstance, 0, len(resp.Instances))
	for _, in := range resp.Instances {
		instances = append(instances, RemoteInstance{
			Status:     mapUpstreamStatus(in.ActualStatus),
			GpuName:    in.GpuName,
			ContractID: in.ID,
			HostIP:     in.PublicIPAddr,
			HostPort:   in.SSHPort,
		})
	}
	return instances, nil
}

// StopNode tears down (deletes) the upstream instance identified by the
// internal contract id.
func StopNode(contractID string) error {
	contractID = strings.TrimSpace(contractID)
	if contractID == "" {
		return errors.New("compute node has no upstream contract to stop")
	}
	endpoint := fmt.Sprintf("%s/instances/%s/", vastAPIBaseURL, url.PathEscape(contractID))
	return doRequest(http.MethodDelete, endpoint, nil)
}

// defaultRentalImage is the base container image booted for whole-GPU rentals.
// A generic CUDA-capable image the customer SSHes into and uses freely. Kept
// internal — the client never sees which image/provider backs their node.
const defaultRentalImage = "pytorch/pytorch:latest"

// ProvisionParams describes a customer's whole-GPU rental request. All fields
// are flatkey-side concepts; none reveal the upstream provider.
type ProvisionParams struct {
	// OfferID is the upstream offer/ask id to rent (Offer.ContractID, internal).
	OfferID int
	// DiskGB is the requested disk for the instance.
	DiskGB int
	// SSHPublicKey is the customer's public key; it is mounted into the
	// instance's authorized_keys so the customer (and only the customer) can
	// SSH into the card they rented.
	SSHPublicKey string
	// Label is the flatkey-branded instance label (never a provider name).
	Label string
}

// ProvisionResult is the whitelabeled outcome of a successful provision. The
// contract id and host identifiers are internal-only; callers persist them on
// a ComputeNode's `json:"-"` fields and never serialize them.
type ProvisionResult struct {
	ContractID string
	Provider   string
	HostIP     string
	HostPort   int
}

// ProvisionNode rents a whole GPU: it PUTs /asks/{offer_id}/ to boot an
// instance from the customer's chosen offer, injecting an onstart script that
// installs the customer's SSH public key into authorized_keys so they can SSH
// straight into their rented card. Returns the internal contract id (Vast's
// new_contract) wrapped in a whitelabeled ProvisionResult.
//
// SSH key handling: the onstart script is the reliable, provider-agnostic path
// (it runs inside the container regardless of the account-level key state). We
// additionally best-effort attach the key via the account/instance ssh endpoint
// once the instance exists (see AttachSSHKey), but onstart is authoritative.
func ProvisionNode(params ProvisionParams) (*ProvisionResult, error) {
	if params.OfferID <= 0 {
		return nil, errors.New("compute: missing offer id")
	}
	pubKey := strings.TrimSpace(params.SSHPublicKey)
	if pubKey == "" {
		return nil, errors.New("compute: an SSH public key is required to access the node")
	}
	if !looksLikeSSHPublicKey(pubKey) {
		return nil, errors.New("compute: invalid SSH public key")
	}
	disk := params.DiskGB
	if disk <= 0 {
		disk = 20
	}
	label := strings.TrimSpace(params.Label)
	if label == "" {
		label = "flatkey-compute"
	}

	body := vastProvisionRequest{
		ClientID: "me",
		Image:    defaultRentalImage,
		Disk:     disk,
		Label:    label,
		OnStart:  buildAuthorizedKeysOnStart(pubKey),
		RunType:  "ssh",
	}
	endpoint := fmt.Sprintf("%s/asks/%d/", vastAPIBaseURL, params.OfferID)

	var resp vastProvisionResponse
	if err := doRequestWithBody(http.MethodPut, endpoint, body, &resp); err != nil {
		return nil, err
	}
	if !resp.Success || resp.NewContract == 0 {
		return nil, errors.New("compute: provider did not accept the provisioning request")
	}

	contractID := strconv.Itoa(resp.NewContract)

	// Best-effort: also register the key via the provider ssh endpoint. Never
	// fatal — the onstart script already guarantees access, and the instance
	// may not be fully registered yet. Errors are swallowed (and never carry a
	// provider name to the caller).
	_ = AttachSSHKey(contractID, pubKey)

	// Host ip/port are usually not available until the instance boots; the
	// caller reconciles them later via GetInstanceConnection.
	res := &ProvisionResult{
		ContractID: contractID,
		Provider:   "vast",
	}
	if conn, err := GetInstanceConnection(contractID); err == nil {
		res.HostIP = conn.HostIP
		res.HostPort = conn.HostPort
	}
	return res, nil
}

// Connection is the whitelabeled SSH connection view handed to the instance's
// owner. It is safe to show ssh host/port to the customer (it is their rented
// card) but it is deliberately unlabeled — nothing here names the provider.
type Connection struct {
	SSHHost  string `json:"ssh_host"`
	SSHPort  int    `json:"ssh_port"`
	Status   string `json:"status"`
	Username string `json:"username"`

	// Internal-only mirrors for persistence/reconciliation.
	HostIP   string `json:"-"`
	HostPort int    `json:"-"`
}

// GetInstanceConnection fetches SSH connection details for a single instance by
// its internal contract id. It uses the per-id GET (the LIST endpoint is
// sometimes empty) and returns a whitelabeled Connection. ssh_host falls back
// to public_ipaddr when the provider omits the dedicated proxy host.
func GetInstanceConnection(contractID string) (*Connection, error) {
	contractID = strings.TrimSpace(contractID)
	if contractID == "" {
		return nil, errors.New("compute node has no upstream contract")
	}
	endpoint := fmt.Sprintf("%s/instances/%s/", vastAPIBaseURL, url.PathEscape(contractID))
	var resp vastInstanceResponse
	if err := doRequest(http.MethodGet, endpoint, &resp); err != nil {
		return nil, err
	}
	in := resp.Instances
	host := strings.TrimSpace(in.SSHHost)
	if host == "" {
		host = strings.TrimSpace(in.PublicIPAddr)
	}
	return &Connection{
		SSHHost:  host,
		SSHPort:  in.SSHPort,
		Status:   mapUpstreamStatus(in.ActualStatus),
		Username: "root",
		HostIP:   host,
		HostPort: in.SSHPort,
	}, nil
}

// AttachSSHKey registers a customer's SSH public key against their instance via
// POST /instances/{id}/ssh/. Best-effort companion to the onstart script.
func AttachSSHKey(contractID, sshKey string) error {
	contractID = strings.TrimSpace(contractID)
	sshKey = strings.TrimSpace(sshKey)
	if contractID == "" || sshKey == "" {
		return errors.New("compute: missing contract id or ssh key")
	}
	endpoint := fmt.Sprintf("%s/instances/%s/ssh/", vastAPIBaseURL, url.PathEscape(contractID))
	return doRequestWithBody(http.MethodPost, endpoint, vastSSHKeyRequest{SSHKey: sshKey}, nil)
}

// looksLikeSSHPublicKey does a lightweight sanity check on a submitted key so we
// don't PUT obviously bogus input to the provider. Not a full validation.
func looksLikeSSHPublicKey(key string) bool {
	key = strings.TrimSpace(key)
	for _, prefix := range []string{"ssh-rsa ", "ssh-ed25519 ", "ecdsa-sha2-", "ssh-dss ", "sk-ssh-", "sk-ecdsa-"} {
		if strings.HasPrefix(key, prefix) {
			return true
		}
	}
	return false
}

// buildAuthorizedKeysOnStart returns an onstart shell script that appends the
// customer's public key to root's authorized_keys (idempotently). Single-quoted
// so the key content cannot break out of the shell command.
func buildAuthorizedKeysOnStart(pubKey string) string {
	// Guard against quote-injection: a public key never legitimately contains a
	// single quote; strip any to keep the single-quoted heredoc-free command safe.
	safe := strings.ReplaceAll(strings.TrimSpace(pubKey), "'", "")
	return "mkdir -p /root/.ssh && chmod 700 /root/.ssh && " +
		"grep -qxF '" + safe + "' /root/.ssh/authorized_keys 2>/dev/null || " +
		"echo '" + safe + "' >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys"
}

func mbToGB(mb float64) float64 {
	if mb <= 0 {
		return 0
	}
	return mb / 1024.0
}

// mapUpstreamStatus normalizes an upstream instance status string into the
// flatkey ComputeNode status vocabulary. Kept here so the mapping (and any
// provider-specific status vocabulary) never leaks past this package.
func mapUpstreamStatus(actual string) string {
	switch strings.ToLower(strings.TrimSpace(actual)) {
	case "running":
		return "running"
	case "exited", "stopped", "offline":
		return "stopped"
	case "created", "loading", "starting", "scheduling":
		return "provisioning"
	case "":
		return "provisioning"
	default:
		return "error"
	}
}
