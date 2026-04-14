DEPLOY_HOST ?= hetzner

.PHONY: build deploy logs status restart sync-upstream

# === 本地编译 ===
build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
		-ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$$(cat VERSION 2>/dev/null || echo dev)'" \
		-o bin/new-api

# === 手动部署（CI 自动部署时不需要） ===
deploy: build
	ssh $(DEPLOY_HOST) 'mkdir -p /tmp/new-api-deploy'
	scp bin/new-api $(DEPLOY_HOST):/tmp/new-api-deploy/new-api
	rsync -avz deploy/ $(DEPLOY_HOST):/tmp/new-api-deploy/deploy/
	ssh $(DEPLOY_HOST) 'cd /tmp/new-api-deploy && chmod +x deploy/deploy.sh && sudo ./deploy/deploy.sh /tmp/new-api-deploy'

# === 运维 ===
logs:
	ssh $(DEPLOY_HOST) 'sudo journalctl -u new-api -f'

status:
	ssh $(DEPLOY_HOST) 'sudo systemctl status new-api'

restart:
	ssh $(DEPLOY_HOST) 'sudo systemctl restart new-api'

# === 同步上游代码 ===
sync-upstream:
	git fetch upstream && git merge upstream/main && git push origin main
