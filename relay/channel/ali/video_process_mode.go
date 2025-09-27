package ali

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"one-api/constant"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

type VideoProcessMode struct {
	Url            string
	Action         string
	ProcessRequest func(c *gin.Context, info *relaycommon.RelayInfo, request relaycommon.TaskSubmitReq) (io.Reader, error)
}

func isHttpUrl(str string) bool {
	u, err := url.Parse(str)
	if err != nil {
		return false
	}
	return u.Host != "" && (u.Scheme == "http" || u.Scheme == "https")
}

type VideoGenerationOutput struct {
	TaskStatus    string `json:"task_status"`
	TaskId        string `json:"task_id"`
	SubmitTime    string `json:"submit_time,omitempty"`
	ScheduledTime string `json:"scheduled_time,omitempty"`
	EndTime       string `json:"end_time,omitempty"`
	VideoUrl      string `json:"video_url,omitempty"`
	OriginPrompt  string `json:"orig_prompt,omitempty"`
	ActualPrompt  string `json:"actual_prompt,omitempty"`
}

type VideoGenrationUsage struct {
	Duration   int `json:"duration"`
	VideoCount int `json:"video_count"`
	SR         int `json:"SR"`
}

type VideoGenerationResponse struct {
	Output    VideoGenerationOutput `json:"output"`
	Usage     VideoGenrationUsage   `json:"usage,omitempty"`
	RequestId string                `json:"request_id"`
	Code      string                `json:"code,omitempty"`
	Message   string                `json:"message,omitempty"`
}

func (vgr *VideoGenerationResponse) HasError() bool {
	return vgr.Code != ""
}

func copyFromMetaData(req relaycommon.TaskSubmitReq, r any) error {
	metadata := req.Metadata
	medaBytes, err := json.Marshal(metadata)
	if err != nil {
		return errors.Wrap(err, "metadata marshal metadata failed")
	}
	err = json.Unmarshal(medaBytes, &r)
	if err != nil {
		return errors.Wrap(err, "unmarshal metadata failed")
	}
	return nil
}

func normalizeImageUrl(url string) string {
	if isHttpUrl(url) {
		return url
	} else {
		return fmt.Sprintf("data:image/png;base64,%s", url)
	}
}

func selectVideoProcessMode(info *relaycommon.RelayInfo) *VideoProcessMode {
	switch info.UpstreamModelName {
	case "wan2.2-i2v-flash", "wan2.2-i2v-plus", "wanx2.1-i2v-plus", "wanx2.1-i2v-turbo":
		return &VideoProcessMode{
			Url: "/api/v1/services/aigc/video-generation/video-synthesis",
			ProcessRequest: func(c *gin.Context, info *relaycommon.RelayInfo, request relaycommon.TaskSubmitReq) (io.Reader, error) {
				imageUrl := normalizeImageUrl(request.Image)
				aliReq := &struct {
					Model      string `json:"model"`
					Input      any    `json:"input"`
					Parameters any    `json:"parameters"`
				}{
					Model: request.Model,
					Input: struct {
						Prompt         string `json:"prompt"`
						ImageUrl       string `json:"img_url"`
						NegativePrompt string `json:"negative_prompt,omitempty"`
					}{
						Prompt:         request.Prompt,
						NegativePrompt: request.NegativePrompt,
						ImageUrl:       imageUrl,
					},
					Parameters: struct {
						Resolution   string `json:"resolution,omitempty"`
						Duration     *int   `json:"duration,omitempty"`
						PromptExtend *bool  `json:"prompt_extend,omitempty"`
					}{},
				}
				copyFromMetaData(request, aliReq)
				if data, err := json.Marshal(aliReq); err != nil {
					return nil, err
				} else {
					var reader io.Reader = bytes.NewBuffer(data)
					return reader, err
				}

			},
			Action: constant.TaskActionGenerate,
		}
	case "wanx2.1-kf2v-plus":
		return &VideoProcessMode{
			Url:    "/api/v1/services/aigc/image2video/video-synthesis",
			Action: constant.TaskActionGenerate,
			ProcessRequest: func(c *gin.Context, info *relaycommon.RelayInfo, request relaycommon.TaskSubmitReq) (io.Reader, error) {
				imageUrl := normalizeImageUrl(request.Image)
				var lastImageUrl string
				if request.ImageTail != "" {
					lastImageUrl = normalizeImageUrl(request.ImageTail)
				}
				aliReq := &struct {
					Model      string `json:"model"`
					Input      any    `json:"input"`
					Parameters any    `json:"parameters"`
				}{
					Model: request.Model,
					Input: struct {
						Prompt         string `json:"prompt"`
						FirstFrameUrl  string `json:"first_frame_url"`
						LastFrameUrl   string `json:"last_frame_url,omitempty"`
						NegativePrompt string `json:"negative_prompt,omitempty"`
					}{
						Prompt:         request.Prompt,
						NegativePrompt: request.NegativePrompt,
						FirstFrameUrl:  imageUrl,
						LastFrameUrl:   lastImageUrl,
					},
					Parameters: struct {
						Resolution   string `json:"resolution,omitempty"`
						Duration     *int   `json:"duration,omitempty"`
						PromptExtend *bool  `json:"prompt_extend,omitempty"`
					}{},
				}
				copyFromMetaData(request, aliReq)
				if data, err := json.Marshal(aliReq); err != nil {
					return nil, err
				} else {
					var reader io.Reader = bytes.NewBuffer(data)
					return reader, err
				}

			},
		}
	case "wan2.2-t2v-plus", "wanx2.1-t2v-turbo", "wanx2.1-t2v-plus":
		return &VideoProcessMode{
			Url:    "/api/v1/services/aigc/video-generation/video-synthesis",
			Action: constant.TaskActionTextGenerate,
			ProcessRequest: func(c *gin.Context, info *relaycommon.RelayInfo, request relaycommon.TaskSubmitReq) (io.Reader, error) {
				aliReq := &struct {
					Model     string `json:"model"`
					Input     any    `json:"input"`
					Paramters any    `json:"parameters"`
				}{
					Model: request.Model,
					Input: struct {
						Prompt         string `json:"prompt"`
						NegativePrompt string `json:"negative_prompt,omitempty"`
					}{
						Prompt:         request.Prompt,
						NegativePrompt: request.NegativePrompt,
					},
					Paramters: struct {
						Size string `json:"size,omitempty"`
					}{},
				}
				copyFromMetaData(request, aliReq)
				if data, err := json.Marshal(aliReq); err != nil {
					return nil, err
				} else {
					var reader io.Reader = bytes.NewBuffer(data)
					return reader, err
				}
			},
		}
	case "wanx2.1-vace-plus":
		return &VideoProcessMode{
			Url:    "/api/v1/services/aigc/video-generation/video-synthesis",
			Action: constant.TaskActionGenerate,
			ProcessRequest: func(c *gin.Context, info *relaycommon.RelayInfo, request relaycommon.TaskSubmitReq) (io.Reader, error) {
				aliReq := &struct {
					Model string `json:"model"`
					Input struct {
						Function     string   `json:"function"`
						Prompt       string   `json:"prompt"`
						RefImagesUrl []string `json:"ref_images_url,omitempty"`
						VideoUrl     string   `json:"video_url,omitempty"`
					} `json:"input"`
					Paramters struct {
						Size             string    `json:"size,omitempty"`
						ObjOrBg          *[]string `json:"obj_or_bg,omitempty"`
						PromptExtend     *bool     `json:"prompt_extend,omitempty"`
						ControlCondition string    `json:"control_condition,omitempty"`
						Strength         *float32  `json:"strength,omitempty"`
					} `json:"parameters"`
				}{}
				aliReq.Model = request.Model
				aliReq.Input.Prompt = request.Prompt
				aliReq.Input.VideoUrl = request.VideoUrl
				if len(request.ImageList) > 0 {
					aliReq.Input.RefImagesUrl = make([]string, 0, len(request.ImageList))
					for _, i := range request.ImageList {
						aliReq.Input.RefImagesUrl = append(aliReq.Input.RefImagesUrl, normalizeImageUrl(i.Image))
					}
				}
				copyFromMetaData(request, aliReq)
				if aliReq.Input.Function == "" {
					if aliReq.Input.VideoUrl != "" {
						aliReq.Input.Function = "video_repainting"
					} else {
						aliReq.Input.Function = "image_reference"
					}
				}
				if data, err := json.Marshal(aliReq); err != nil {
					return nil, err
				} else {
					var reader io.Reader = bytes.NewBuffer(data)
					return reader, err
				}
			},
		}
	default:
		return nil
	}
}

func videoHandler(ta *TaskAdaptor, c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()
	vgr := &VideoGenerationResponse{}
	err = json.Unmarshal(responseBody, vgr)
	if err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
	}
	if vgr.HasError() {
		taskErr = service.TaskErrorWrapper(errors.Errorf("%s(%s)", vgr.Message, vgr.Code), vgr.Code, http.StatusInternalServerError)
	}
	c.JSON(http.StatusOK, gin.H{"task_id": vgr.Output.TaskId})
	return vgr.Output.TaskId, responseBody, nil

}
