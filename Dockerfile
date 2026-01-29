FROM golang:latest

WORKDIR /app

ENV GOOS=windows
ENV GOARCH=amd64
ENV CGO_ENABLED=0

# 复制源码（包含我们伪造的 web/dist）
COPY . .

# 下载依赖并编译
RUN go mod download
RUN go build -ldflags "-s -w" -o new-api-galaxy.exe
