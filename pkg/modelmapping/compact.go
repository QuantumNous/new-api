package modelmapping

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

type CompactResolution struct {
	UpstreamModel           string
	LogicalBillingModel     string
	Mapped                  bool
	BaseMappingTargetsExact bool
}

func Parse(raw string) (map[string]string, error) {
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(raw) == "{}" {
		return nil, nil
	}
	mapping := make(map[string]string)
	if err := common.Unmarshal([]byte(raw), &mapping); err != nil {
		return nil, errors.New("unmarshal_model_mapping_failed")
	}
	return mapping, nil
}

func Resolve(modelName string, mapping map[string]string) (string, bool, error) {
	if modelName == "" || len(mapping) == 0 {
		return modelName, false, nil
	}

	current := modelName
	visited := map[string]struct{}{current: {}}
	mapped := false
	for {
		next, ok := mapping[current]
		if !ok || next == "" {
			return current, mapped, nil
		}
		if next == current {
			return current, mapped, nil
		}
		if _, ok := visited[next]; ok {
			return "", false, errors.New("model_mapping_contains_cycle")
		}
		visited[next] = struct{}{}
		current = next
		mapped = true
	}
}

func ResolveCompactExact(requestedModel string, mapping map[string]string) (CompactResolution, error) {
	requestedModel = ratio_setting.CompactModelBaseName(requestedModel)
	logicalModel, virtual := ratio_setting.VirtualCompactModelName(requestedModel)
	if !virtual {
		return ResolveCompactBase(requestedModel, mapping)
	}
	if _, ok := mapping[logicalModel]; ok {
		upstreamModel, mapped, err := Resolve(logicalModel, mapping)
		if err != nil {
			return CompactResolution{}, err
		}
		return CompactResolution{
			UpstreamModel:       upstreamModel,
			LogicalBillingModel: ratio_setting.WithCompactModelSuffix(strings.TrimSuffix(upstreamModel, ratio_setting.CompactModelSuffix)),
			Mapped:              mapped || upstreamModel != requestedModel,
		}, nil
	}

	if _, ok := mapping[requestedModel]; ok {
		mappedModel, mapped, err := Resolve(requestedModel, mapping)
		if err != nil {
			return CompactResolution{}, err
		}
		if strings.HasSuffix(mappedModel, ratio_setting.CompactModelSuffix) {
			return CompactResolution{
				UpstreamModel:           mappedModel,
				LogicalBillingModel:     mappedModel,
				Mapped:                  mapped,
				BaseMappingTargetsExact: true,
			}, nil
		}
	}

	return CompactResolution{
		UpstreamModel:       logicalModel,
		LogicalBillingModel: logicalModel,
		Mapped:              false,
	}, nil
}

func ResolveCompactBase(requestedModel string, mapping map[string]string) (CompactResolution, error) {
	requestedModel = ratio_setting.CompactModelBaseName(requestedModel)
	mappedModel, mapped, err := Resolve(requestedModel, mapping)
	if err != nil {
		return CompactResolution{}, err
	}
	upstreamModel := ratio_setting.CompactModelBaseName(mappedModel)
	logicalBillingModel := upstreamModel
	if _, virtual := ratio_setting.VirtualCompactModelName(requestedModel); virtual {
		logicalBillingModel = ratio_setting.WithCompactModelSuffix(upstreamModel)
	}
	return CompactResolution{
		UpstreamModel:       upstreamModel,
		LogicalBillingModel: logicalBillingModel,
		Mapped:              mapped || upstreamModel != requestedModel,
	}, nil
}
