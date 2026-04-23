terraform {
  required_version = ">= 1.5"

  required_providers {
    tencentcloud = {
      source  = "tencentcloudstack/tencentcloud"
      version = ">= 1.81.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.25.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6.0"
    }
  }

  # Terraform state 存储在腾讯云 COS
  # 首次使用前需手动创建 COS bucket
  backend "cos" {
    region = "ap-guangzhou"
    bucket = "burton-tfstate-1305184517"
    prefix = "terraform/state"
  }
}
