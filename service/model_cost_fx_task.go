package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

const (
	modelCostFXSource       = "cbr-xml-daily.ru"
	modelCostFXInterval     = time.Hour
	modelCostFXReloadPeriod = time.Minute
	modelCostFXHTTPTimeout  = 10 * time.Second
	modelCostFXMaxBodySize  = 1 << 20
)

var modelCostFXEndpoint = "https://www.cbr-xml-daily.ru/daily_json.js"

type modelCostFXProviderResponse struct {
	Date   string `json:"Date"`
	Valute map[string]struct {
		CharCode string  `json:"CharCode"`
		Value    float64 `json:"Value"`
		Nominal  float64 `json:"Nominal"`
	} `json:"Valute"`
}

type modelCostFXTaskResult struct {
	Source      string `json:"source"`
	Version     int64  `json:"version"`
	EffectiveAt int64  `json:"effective_at"`
	FetchedAt   int64  `json:"fetched_at"`
}

const modelCostFXTaskType = model.SystemTaskTypeModelCostFX

type modelCostFXTaskHandler struct{}

func (modelCostFXTaskHandler) Type() string            { return modelCostFXTaskType }
func (modelCostFXTaskHandler) Enabled() bool           { return true }
func (modelCostFXTaskHandler) Interval() time.Duration { return modelCostFXInterval }
func (modelCostFXTaskHandler) NewPayload() any         { return nil }

func (modelCostFXTaskHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	result, err := refreshModelCostFX(ctx)
	if err != nil {
		failSystemTask(task, runnerID, err)
		return
	}
	if err := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, result, ""); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("model cost FX task %s snapshot version %d but finish failed: %v", task.TaskID, result.Version, err))
	}
}

func refreshModelCostFX(ctx context.Context) (modelCostFXTaskResult, error) {
	var baseline model.ModelCostFXSnapshot
	loadedErr := model.LoadModelCostFX(ctx, modelCostFXSource)
	if loadedErr == nil {
		var err error
		baseline, err = model.CurrentModelCostFX(modelCostFXSource)
		if err != nil {
			return modelCostFXTaskResult{}, err
		}
	} else if !errors.Is(loadedErr, model.ErrModelCostFXUnavailable) {
		return modelCostFXTaskResult{}, loadedErr
	} else {
		// An absent row is the only case where version zero is a valid baseline.
		baseline = model.ModelCostFXSnapshot{Source: modelCostFXSource, Version: 0}
	}

	requestCtx, cancel := context.WithTimeout(ctx, modelCostFXHTTPTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, modelCostFXEndpoint, nil)
	if err != nil {
		return modelCostFXTaskResult{}, err
	}
	client := &http.Client{Timeout: modelCostFXHTTPTimeout, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(req)
	if err != nil {
		return modelCostFXTaskResult{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return modelCostFXTaskResult{}, fmt.Errorf("model cost FX provider returned HTTP %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, modelCostFXMaxBodySize+1))
	if err != nil {
		return modelCostFXTaskResult{}, err
	}
	if len(body) > modelCostFXMaxBodySize {
		return modelCostFXTaskResult{}, errors.New("model cost FX provider response is too large")
	}
	var provider modelCostFXProviderResponse
	if err := common.Unmarshal(body, &provider); err != nil {
		return modelCostFXTaskResult{}, fmt.Errorf("decode model cost FX provider response: %w", err)
	}
	providerDate, err := time.Parse(time.RFC3339, strings.TrimSpace(provider.Date))
	if err != nil {
		return modelCostFXTaskResult{}, fmt.Errorf("invalid model cost FX provider date: %w", err)
	}
	now := time.Now()
	moscow, err := time.LoadLocation("Europe/Moscow")
	if err != nil {
		return modelCostFXTaskResult{}, err
	}
	providerCalendarDate := providerDate.In(moscow)
	nowCalendarDate := now.In(moscow)
	providerMidnight := time.Date(providerCalendarDate.Year(), providerCalendarDate.Month(), providerCalendarDate.Day(), 0, 0, 0, 0, moscow)
	nowMidnight := time.Date(nowCalendarDate.Year(), nowCalendarDate.Month(), nowCalendarDate.Day(), 0, 0, 0, 0, moscow)
	if providerMidnight.After(nowMidnight.AddDate(0, 0, 1)) {
		return modelCostFXTaskResult{}, errors.New("model cost FX provider date is too far in the future")
	}
	usd, ok := provider.Valute["USD"]
	if !ok || !strings.EqualFold(strings.TrimSpace(usd.CharCode), "USD") {
		return modelCostFXTaskResult{}, errors.New("model cost FX provider response is missing USD")
	}
	if usd.Nominal <= 0 || math.IsNaN(usd.Nominal) || math.IsInf(usd.Nominal, 0) {
		return modelCostFXTaskResult{}, errors.New("model cost FX provider response has invalid USD nominal")
	}
	if usd.Value <= 0 || math.IsNaN(usd.Value) || math.IsInf(usd.Value, 0) {
		return modelCostFXTaskResult{}, errors.New("model cost FX provider response has invalid USD value")
	}
	rate := usd.Value / usd.Nominal
	if rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) {
		return modelCostFXTaskResult{}, errors.New("model cost FX provider response has invalid normalized USD")
	}
	fetchedAt := time.Now().Unix()
	if baseline.Version > 0 && baseline.EffectiveAt == providerDate.Unix() && baseline.Rates["USD"] == rate {
		return modelCostFXTaskResult{Source: modelCostFXSource, Version: baseline.Version, EffectiveAt: baseline.EffectiveAt, FetchedAt: baseline.FetchedAt}, nil
	}
	candidate := model.ModelCostFXSnapshot{Source: modelCostFXSource, EffectiveAt: providerDate.Unix(), FetchedAt: fetchedAt, Rates: map[string]float64{"USD": rate}}
	if err := model.SaveModelCostFX(ctx, candidate, baseline.Version); err != nil {
		return modelCostFXTaskResult{}, err
	}
	return modelCostFXTaskResult{Source: modelCostFXSource, Version: baseline.Version + 1, EffectiveAt: candidate.EffectiveAt, FetchedAt: candidate.FetchedAt}, nil
}

var modelCostFXStartupOnce sync.Once

// StartModelCostFX loads the durable snapshot on every node and keeps replicas
// current without putting database or network work on request paths.
func StartModelCostFX() {
	modelCostFXStartupOnce.Do(func() {
		go func() {
			loadModelCostFXFromDatabase()
			ticker := time.NewTicker(modelCostFXReloadPeriod)
			defer ticker.Stop()
			for range ticker.C {
				loadModelCostFXFromDatabase()
			}
		}()
	})
}

func loadModelCostFXFromDatabase() {
	ctx, cancel := context.WithTimeout(context.Background(), modelCostFXHTTPTimeout)
	defer cancel()
	if err := model.LoadModelCostFX(ctx, modelCostFXSource); err != nil && !errors.Is(err, model.ErrModelCostFXUnavailable) {
		logger.LogWarn(ctx, fmt.Sprintf("model cost FX startup/reload failed: %v", err))
	}
}

func init() { RegisterSystemTaskHandler(modelCostFXTaskHandler{}) }
