package metadata

import (
	"fmt"
	"strings"
)

// ValidateStatusReports checks a list of [StatusReport] structs against a list of desired and undesired [AuthenticatorStatus]
// values. If the reports contain all of the desired and none of the undesired status reports then no error is returned
// otherwise an error describing the issue is returned.
func ValidateStatusReports(reports []StatusReport, desired, undesired []AuthenticatorStatus) (err error) {
	if len(desired) == 0 && (len(undesired) == 0 || len(reports) == 0) {
		return nil
	}

	var present, absent []string

	if len(undesired) != 0 {
		for _, report := range reports {
			for _, status := range undesired {
				if report.Status == status {
					present = append(present, string(status))

					continue
				}
			}
		}
	}

	if len(desired) != 0 {
	desired:
		for _, status := range desired {
			for _, report := range reports {
				if report.Status == status {
					continue desired
				}
			}

			absent = append(absent, string(status))
		}
	}

	switch {
	case len(present) == 0 && len(absent) == 0:
		return nil
	case len(present) != 0 && len(absent) == 0:
		return &Error{
			Type:    "invalid_status",
			Details: fmt.Sprintf("The following undesired status reports were present: %s", strings.Join(present, ", ")),
		}
	case len(present) == 0 && len(absent) != 0:
		return &Error{
			Type:    "invalid_status",
			Details: fmt.Sprintf("The following desired status reports were absent: %s", strings.Join(absent, ", ")),
		}
	default:
		return &Error{
			Type:    "invalid_status",
			Details: fmt.Sprintf("The following undesired status reports were present: %s; the following desired status reports were absent: %s", strings.Join(present, ", "), strings.Join(absent, ", ")),
		}
	}
}
