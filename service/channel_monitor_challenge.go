package service

import (
	"fmt"
	"math/rand/v2"
	"regexp"
	"strconv"
)

const monitorChallengePromptTemplate = `Calculate and respond with ONLY the number, nothing else.

Q: 3 + 5 = ?
A: 8

Q: 12 - 7 = ?
A: 5

Q: %d %s %d = ?
A:`

var monitorChallengeNumberRegex = regexp.MustCompile(`-?\d+`)

type monitorChallenge struct {
	Prompt   string
	Expected string
}

func generateMonitorChallenge() monitorChallenge {
	a := monitorRandIntInRange(monitorChallengeMin, monitorChallengeMax)
	b := monitorRandIntInRange(monitorChallengeMin, monitorChallengeMax)
	if rand.IntN(2) == 0 {
		return monitorChallenge{
			Prompt:   fmt.Sprintf(monitorChallengePromptTemplate, a, "+", b),
			Expected: strconv.Itoa(a + b),
		}
	}
	hi, lo := a, b
	if lo > hi {
		hi, lo = lo, hi
	}
	return monitorChallenge{
		Prompt:   fmt.Sprintf(monitorChallengePromptTemplate, hi, "-", lo),
		Expected: strconv.Itoa(hi - lo),
	}
}

func monitorRandIntInRange(minVal, maxVal int) int {
	if maxVal <= minVal {
		return minVal
	}
	return minVal + rand.IntN(maxVal-minVal+1)
}

func validateMonitorChallenge(responseText, expected string) bool {
	if responseText == "" || expected == "" {
		return false
	}
	for _, match := range monitorChallengeNumberRegex.FindAllString(responseText, -1) {
		if match == expected {
			return true
		}
	}
	return false
}
