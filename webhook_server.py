from flask import Flask, request, jsonify
import subprocess
import os
import logging
import hmac
import hashlib
import threading

app = Flask(__name__)

# 配置
PROJECT_DIR = "/opt/new-api"
LOG_FILE = "/var/log/webhook-deploy.log"
SECRET_KEY = os.environ.get("WEBHOOK_SECRET", "new-api-deploy-secret")

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def verify_signature(payload, signature):
    """验证 webhook 签名"""
    if not signature:
        return False
    expected = "sha256=" + hmac.new(
        SECRET_KEY.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

def run_deploy():
    """执行部署"""
    try:
        logger.info("=" * 50)
        logger.info("Starting deployment...")
        
        # 1. 进入项目目录
        os.chdir(PROJECT_DIR)
        logger.info(f"Working directory: {PROJECT_DIR}")
        
        # 2. git pull 最新代码
        logger.info("Step 1: git pull origin main")
        result = subprocess.run(
            ["git", "pull", "origin", "main"],
            capture_output=True, text=True, timeout=60
        )
        logger.info(result.stdout)
        if result.returncode != 0:
            logger.error(f"git pull failed: {result.stderr}")
            return False
        
        # 3. docker build
        logger.info("Step 2: docker build")
        result = subprocess.run(
            ["docker", "build", "-t", "new-api:latest", "."],
            capture_output=True, text=True, timeout=600
        )
        output = result.stdout[-500:] if len(result.stdout) > 500 else result.stdout
        logger.info(output)
        if result.returncode != 0:
            logger.error(f"docker build failed: {result.stderr}")
            return False
        
        # 4. docker compose down
        logger.info("Step 3: docker compose down")
        result = subprocess.run(
            ["docker", "compose", "down"],
            capture_output=True, text=True, timeout=60
        )
        logger.info(result.stdout)
        
        # 5. docker compose up
        logger.info("Step 4: docker compose up -d")
        result = subprocess.run(
            ["docker", "compose", "up", "-d"],
            capture_output=True, text=True, timeout=60
        )
        logger.info(result.stdout)
        if result.returncode != 0:
            logger.error(f"docker compose up failed: {result.stderr}")
            return False
        
        # 6. 清理
        logger.info("Step 5: docker system prune -f")
        subprocess.run(["docker", "system", "prune", "-f"], capture_output=True)
        
        logger.info("Deployment completed successfully!")
        logger.info("=" * 50)
        return True
        
    except Exception as e:
        logger.error(f"Deployment error: {str(e)}")
        return False

@app.route('/webhook/deploy', methods=['POST'])
def deploy():
    """接收部署通知"""
    signature = request.headers.get('X-Hub-Signature-256', '')
    payload = request.get_data()
    
    if signature and not verify_signature(payload, signature):
        logger.warning("Invalid webhook signature")
        return jsonify({"status": "error", "message": "Invalid signature"}), 403
    
    data = request.json or {}
    logger.info(f"Received deploy notification: {data}")
    
    # 在后台线程执行部署，避免阻塞 HTTP 响应
    thread = threading.Thread(target=run_deploy)
    thread.start()
    
    return jsonify({
        "status": "accepted",
        "message": "Deploy started in background"
    })

@app.route('/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    logger.info("Webhook server starting on port 9000...")
    app.run(host='0.0.0.0', port=9000, threaded=True)
