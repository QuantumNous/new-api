package service

import (
	"slices"
	"strings"
	"sync"
	"time"
)

// hwModelSickFor is how long a supplier credit failure keeps a model sick when
// no good answer follows. Lumia's Anthropic credit runs dry intermittently
// (4 Nov 2026), so a short window is enough to keep the 503 alternative honest.
const hwModelSickFor = 5 * time.Minute

// hwModelHealthClock is the clock of the model health state; tests replace it.
var hwModelHealthClock = time.Now

// hwModelHealth is the process-wide health of each sold model: the time of its
// last supplier credit failure. The first good answer removes the entry.
var hwModelHealth = struct {
	sync.Mutex
	sickSince map[string]time.Time
}{sickSince: map[string]time.Time{}}

// HwNoteModelCreditFailure marks a model sick after a supplier credit failure.
func HwNoteModelCreditFailure(name string) {
	if name == "" {
		return
	}
	hwModelHealth.Lock()
	defer hwModelHealth.Unlock()
	hwModelHealth.sickSince[name] = hwModelHealthClock()
}

// HwNoteModelHealthy marks a model healthy again after a good answer.
func HwNoteModelHealthy(name string) {
	hwModelHealth.Lock()
	defer hwModelHealth.Unlock()
	delete(hwModelHealth.sickSince, name)
}

// HwModelSick reports whether name had a supplier credit failure within
// hwModelSickFor and no good answer since.
func HwModelSick(name string) bool {
	hwModelHealth.Lock()
	defer hwModelHealth.Unlock()
	since, ok := hwModelHealth.sickSince[name]
	return ok && hwModelHealthClock().Sub(since) < hwModelSickFor
}

// HwSickModels lists the sold models that are sick right now, in catalog order.
func HwSickModels() []string {
	var sick []string
	for _, sold := range hwSoldModels {
		if HwModelSick(sold.Name) {
			sick = append(sick, sold.Name)
		}
	}
	return sick
}

func hwResetModelHealth() {
	hwModelHealth.Lock()
	defer hwModelHealth.Unlock()
	clear(hwModelHealth.sickSince)
}

// HwHealthyAlternative names the model a customer of a sick model should try
// now: the first healthy model down the vendor's own step-down chain, else the
// most expensive healthy model of another vendor not above this model's price,
// else the cheapest healthy model of another vendor. Optional catalog entries
// are never suggested. Empty when nothing healthy is left or name is not sold.
func HwHealthyAlternative(name string) string {
	for lower := HwModelStepDown(name); lower != ""; lower = HwModelStepDown(lower) {
		if !HwModelSick(lower) {
			return lower
		}
	}
	index := slices.IndexFunc(hwSoldModels, func(sold HwSoldModel) bool { return sold.Name == name })
	if index < 0 {
		return ""
	}
	current := hwSoldModels[index]
	vendor, _, _ := strings.Cut(name, "-")
	var below, above *HwSoldModel
	for i := range hwSoldModels {
		sold := &hwSoldModels[i]
		soldVendor, _, _ := strings.Cut(sold.Name, "-")
		if soldVendor == vendor || sold.ListOptional || HwModelSick(sold.Name) {
			continue
		}
		if sold.InputMicroUsd <= current.InputMicroUsd {
			if below == nil || sold.InputMicroUsd > below.InputMicroUsd {
				below = sold
			}
		} else if above == nil || sold.InputMicroUsd < above.InputMicroUsd {
			above = sold
		}
	}
	if below != nil {
		return below.Name
	}
	if above != nil {
		return above.Name
	}
	return ""
}
