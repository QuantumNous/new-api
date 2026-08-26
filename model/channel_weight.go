package model

import (
	"errors"
	"fmt"
	"math"
	"math/rand/v2"
)

func selectWeightedIndex(weights []uint) (int, error) {
	return selectWeightedIndexWithDraw(weights, rand.Uint64N)
}

func selectWeightedIndexWithDraw(weights []uint, draw func(uint64) uint64) (int, error) {
	if len(weights) == 0 {
		return -1, errors.New("cannot select a channel from an empty weight list")
	}

	var totalWeight uint64
	for _, weight := range weights {
		if uint64(weight) > math.MaxUint64-totalWeight {
			return -1, errors.New("channel weight sum overflows uint64")
		}
		totalWeight += uint64(weight)
	}

	useEqualWeights := totalWeight == 0
	if useEqualWeights {
		totalWeight = uint64(len(weights))
	}

	randomWeight := draw(totalWeight)
	if randomWeight >= totalWeight {
		return -1, fmt.Errorf("random channel weight %d is outside [0, %d)", randomWeight, totalWeight)
	}

	for index, weight := range weights {
		effectiveWeight := uint64(weight)
		if useEqualWeights {
			effectiveWeight = 1
		}
		if randomWeight < effectiveWeight {
			return index, nil
		}
		randomWeight -= effectiveWeight
	}

	return -1, errors.New("channel not found in weighted selection")
}
