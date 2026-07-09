FROM golang:1.26.1-alpine@sha256:2389ebfa5b7f43eeafbd6be0c3700cc46690ef842ad962f6c5bd6be49ed82039 AS builder

ENV GO111MODULE=on CGO_ENABLED=0
ARG GOPROXY=https://goproxy.cn,direct
ARG GOSUMDB=sum.golang.google.cn
ENV GOPROXY=${GOPROXY} GOSUMDB=${GOSUMDB}

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /out/ali-video-mock ./cmd/ali-video-mock

FROM alpine:3.22

RUN apk add --no-cache ca-certificates wget

COPY --from=builder /out/ali-video-mock /usr/local/bin/ali-video-mock

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/ali-video-mock"]
