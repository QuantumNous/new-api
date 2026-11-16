# Pagoda panel deployment tutorial

This document provides a graphic tutorial for deploying New API using the Docker function of Pagoda Panel.

> 📖 Official document: [Pagoda Panel Deployment](https://docs.newapi.pro/zh/docs/installation/deployment-methods/bt-docker-installation)

***

## Prerequisites

| Projects | Requirements |
| ----- | ---------------------------------- |
| Pagoda Panel | ≥ version 9.2.0 |
| Recommended system | CentOS 7+, Ubuntu 18.04+, Debian 10+ |
| Server configuration | At least 1 core 2G memory |

***

## Step 1: Install the pagoda panel

1. Go to [Pagoda Panel Official Website](https://www.bt.cn/new/download.html) to download the installation script suitable for your system
2. Run the installation script to install the Pagoda panel
3. After the installation is complete, use the provided address, username and password to log in to the Pagoda panel

***

## Step 2: Install Docker

1. After logging in to the Pagoda panel, find and click **Docker** on the left menu bar
2. When you enter for the first time, you will be prompted to install the Docker service. Click **Install Now**
3. Follow the prompts to complete the installation of the Docker service

***

## Step 3: Install New API

### Method 1: Use Pagoda App Store (recommended)

1. In the Docker function of the Pagoda panel, click **App Store**
2. Search and find **New-API**
3. Click **Install**
4. Configure the following basic options:
- **Container name**: Customizable, default is `new-api`
- **Port Mapping**: Default is `3000:3000`
- **Environment variables**:
- `SESSION_SECRET`: session key (**required**, must be consistent when deployed on multiple machines)
- `CRYPTO_SECRET`: encryption key (required when using Redis)
5. Click **Confirm** to start the installation
6. After the installation is completed, visit `http://your server IP:3000` to use it.

### Method 2: Use Docker Compose

1. Create a website directory in the Pagoda panel, such as `/www/wwwroot/new-api`
2. Create the `docker-compose.yml` file:

```yaml
version: '3'
services:
  new-api:
    image: calciumion/new-api:latest
    container_name: new-api
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - SESSION_SECRET=your_session_secret_here # Please change it to a random string
      - TZ=Asia/Shanghai
```

1. Go to the directory in the terminal and start:

```bash
cd /www/wwwroot/new-api
docker-compose up -d
```

***

## Configuration instructions

### Necessary environment variables

| Variable name | Description | Is it required |
| ------------------- | ------------------ | ------ |
| `SESSION_SECRET` | Session key, multi-machine deployment must be consistent | **Required** |
| `CRYPTO_SECRET` | Encryption key, required when using Redis | Condition required |
| `SQL_DSN` | Database connection string (when using an external database) | Optional |
| `REDIS_CONN_STRING` | Redis connection string | Optional |

### Generate random key

```bash
# generate SESSION_SECRET
openssl rand -hex 16

# Or use Linux command
head -c 16 /dev/urandom | xxd -p
```

***

## FAQ

### Q1: Unable to access port 3000?

1. Check whether the server firewall opens port 3000
2. Release port 3000 in the Pagoda Panel **Security**
3. Check whether the cloud server security group has open ports

### Q2: Is it prompted that the session has expired after logging in?

Make sure the `SESSION_SECRET` environment variable is set and the value is not empty.

### Q3: How to persist data?

Use Docker volumes to map the data directory:

```yaml
volumes:
  - ./data:/data
```

### Q4: How to update the version?

```bash
# Pull the latest image
docker pull calciumion/new-api:latest

# Restart container
docker-compose down && docker-compose up -d
```

***

## Related links

- [Official Documentation](https://docs.newapi.pro/zh/docs/installation)
- [Environment variable configuration](https://docs.newapi.pro/zh/docs/installation/config-maintenance/environment-variables)
- [FAQ](https://docs.newapi.pro/zh/docs/support/faq)
- [GitHub repository](https://github.com/QuantumNous/new-api)

***

## Screenshot example

![Pagoda Panel Docker Installation](https://github.com/user-attachments/assets/7a6fc03e-c457-45e4-b8f9-184508fc26b0)

> ⚠️ Note: The key is the environment variable `SESSION_SECRET`, please be sure to set it!

