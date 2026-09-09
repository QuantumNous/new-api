package service

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// Report mismatches without changing pixels, inventing successful settings, or
// regenerating a paid image. Quality comparisons concern upstream metadata only.
func AddImageOutputWarnings(body []byte, request *dto.ImageRequest) []byte {
	if request == nil {
		return body
	}
	if (request.Size == "" || request.Size == "auto") && (request.Quality == "" || request.Quality == "auto") {
		return body
	}
	var response map[string]json.RawMessage
	var items []map[string]json.RawMessage
	if common.Unmarshal(body, &response) != nil || common.Unmarshal(response["data"], &items) != nil {
		return body
	}
	warnings := []map[string]any{}
	parts := strings.Split(request.Size, "x")
	if len(parts) == 2 {
		rw, e1 := strconv.Atoi(parts[0])
		rh, e2 := strconv.Atoi(parts[1])
		if e1 == nil && e2 == nil && rw > 0 && rh > 0 {
			response["requested_size"], _ = common.Marshal(request.Size)
			for i, item := range items {
				var width, height int
				var actual string
				_ = common.Unmarshal(item["width"], &width)
				_ = common.Unmarshal(item["height"], &height)
				_ = common.Unmarshal(item["size"], &actual)
				if width <= 0 || height <= 0 {
					item["size_matches_request"] = json.RawMessage("null")
					item["aspect_ratio_matches_request"] = json.RawMessage("null")
					warnings = append(warnings, map[string]any{"code": "image_dimensions_unverified", "image_index": i, "requested": request.Size})
					continue
				}
				matches := width == rw && height == rh
				ratioMatches := math.Abs((float64(width)/float64(height))/(float64(rw)/float64(rh))-1) <= 0.005
				item["size_matches_request"], _ = common.Marshal(matches)
				item["aspect_ratio_matches_request"], _ = common.Marshal(ratioMatches)
				if !matches {
					warnings = append(warnings, map[string]any{"code": "image_size_mismatch", "image_index": i, "requested": request.Size, "actual": actual})
				}
				if !ratioMatches {
					warnings = append(warnings, map[string]any{"code": "image_aspect_ratio_mismatch", "image_index": i, "requested": request.Size, "actual": actual})
				}
			}
		}
	}
	if request.Quality != "" && request.Quality != "auto" {
		response["requested_quality"], _ = common.Marshal(request.Quality)
		var reported string
		_ = common.Unmarshal(response["quality"], &reported)
		response["quality_report_matches_request"] = json.RawMessage("null")
		if reported != "" {
			response["quality_report_matches_request"], _ = common.Marshal(reported == request.Quality)
			if reported != request.Quality {
				warnings = append(warnings, map[string]any{"code": "image_quality_report_mismatch", "requested": request.Quality, "actual": reported})
			}
		}
	}
	response["data"], _ = common.Marshal(items)
	response["output_warnings"], _ = common.Marshal(warnings)
	result, err := common.Marshal(response)
	if err != nil {
		return body
	}
	return result
}
