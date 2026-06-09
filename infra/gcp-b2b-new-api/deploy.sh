#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

usage() {
  cat <<'EOF'
Deploy a dedicated new-api stack for one B2B customer on Google Cloud.

Usage:
  infra/gcp-b2b-new-api/deploy.sh <prefix> [options]

Required:
  <prefix>                         Lowercase customer prefix, e.g. acme

Options:
  --project <project-id>            GCP project ID. Defaults to PROJECT_ID or gcloud config.
  --region <region>                 GCP region. Defaults to REGION or us-east1.
  --repository <repo>               Artifact Registry Docker repository. Defaults to new-api-b2b.
  --image <image>                   Deploy an already-built image and skip Cloud Build.
  --image-tag <tag>                 Image tag suffix when building. Defaults to timestamp.
  --build-timeout <duration>        Cloud Build timeout. Defaults to 3600s.
  --tf-var <key=value>              Pass an extra Terraform variable. Repeatable.
  --skip-service-enable             Do not run gcloud services enable.
  --skip-adc-check                  Skip Terraform ADC credential preflight.
  --no-auto-approve                 Ask Terraform for apply confirmation.
  --dry-run                         Print the resolved inputs and exit before cloud changes.
  -h, --help                        Show this help.

Examples:
  infra/gcp-b2b-new-api/deploy.sh acme --project rezonaai --region us-east1

  infra/gcp-b2b-new-api/deploy.sh acme \
    --project rezonaai \
    --tf-var sql_tier=db-custom-2-7680 \
    --tf-var web_max_instances=10
EOF
}

log() {
  printf '[deploy-new-api] %s\n' "$*"
}

die() {
  printf '[deploy-new-api] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

PREFIX="${1:-}"
if [[ -z "${PREFIX}" || "${PREFIX}" == "-h" || "${PREFIX}" == "--help" ]]; then
  usage
  exit 0
fi
shift

if [[ ! "${PREFIX}" =~ ^[a-z][a-z0-9-]{1,19}[a-z0-9]$ ]]; then
  die "Prefix must be 3-21 lowercase letters/numbers/hyphens, start with a letter, and end with a letter or number."
fi

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-us-east1}"
REPOSITORY="${ARTIFACT_REPOSITORY:-new-api-b2b}"
IMAGE="${IMAGE:-}"
IMAGE_TAG="${IMAGE_TAG:-}"
BUILD_TIMEOUT="${BUILD_TIMEOUT:-3600s}"
AUTO_APPROVE=1
SKIP_SERVICE_ENABLE=0
SKIP_ADC_CHECK=0
DRY_RUN=0
TF_VARS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_ID="${2:-}"
      shift 2
      ;;
    --region)
      REGION="${2:-}"
      shift 2
      ;;
    --repository)
      REPOSITORY="${2:-}"
      shift 2
      ;;
    --image)
      IMAGE="${2:-}"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="${2:-}"
      shift 2
      ;;
    --build-timeout)
      BUILD_TIMEOUT="${2:-}"
      shift 2
      ;;
    --tf-var)
      TF_VARS+=("-var" "${2:-}")
      shift 2
      ;;
    --skip-service-enable)
      SKIP_SERVICE_ENABLE=1
      shift
      ;;
    --skip-adc-check)
      SKIP_ADC_CHECK=1
      shift
      ;;
    --no-auto-approve)
      AUTO_APPROVE=0
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

require_cmd gcloud
require_cmd terraform

if [[ -z "${PROJECT_ID}" ]]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
fi
[[ -n "${PROJECT_ID}" ]] || die "Project ID is required. Pass --project or set PROJECT_ID."

if [[ "${DRY_RUN}" -eq 1 ]]; then
  cat <<EOF
Dry run:
  prefix:     ${PREFIX}
  project:    ${PROJECT_ID}
  region:     ${REGION}
  repository: ${REPOSITORY}
  image:      ${IMAGE:-<build with Cloud Build>}
  image tag:  ${IMAGE_TAG:-<timestamp>}
  tf vars:    ${#TF_VARS[@]}
EOF
  exit 0
fi

if [[ "${SKIP_ADC_CHECK}" -eq 0 ]]; then
  log "Checking Terraform Application Default Credentials."
  if ! gcloud auth application-default print-access-token --quiet >/dev/null 2>&1; then
    die "Terraform ADC credentials are missing or expired. Run: gcloud auth application-default login --project ${PROJECT_ID}"
  fi
fi

if [[ "${SKIP_SERVICE_ENABLE}" -eq 0 ]]; then
  log "Enabling required GCP APIs in ${PROJECT_ID}."
  gcloud services enable \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    compute.googleapis.com \
    iam.googleapis.com \
    redis.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    servicenetworking.googleapis.com \
    sqladmin.googleapis.com \
    --project "${PROJECT_ID}"
fi

if [[ -z "${IMAGE}" ]]; then
  if [[ -z "${IMAGE_TAG}" ]]; then
    IMAGE_TAG="$(date -u +%Y%m%d%H%M%S)"
  fi

  if ! gcloud artifacts repositories describe "${REPOSITORY}" \
    --project "${PROJECT_ID}" \
    --location "${REGION}" >/dev/null 2>&1; then
    log "Creating Artifact Registry repository ${REPOSITORY} in ${REGION}."
    gcloud artifacts repositories create "${REPOSITORY}" \
      --project "${PROJECT_ID}" \
      --location "${REGION}" \
      --repository-format docker \
      --description "Dedicated new-api customer images"
  fi

  IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/new-api:${PREFIX}-${IMAGE_TAG}"
  log "Building and pushing image ${IMAGE} with Cloud Build."
  gcloud builds submit "${REPO_ROOT}" \
    --project "${PROJECT_ID}" \
    --timeout "${BUILD_TIMEOUT}" \
    --tag "${IMAGE}"
else
  log "Using provided image ${IMAGE}; skipping Cloud Build."
fi

log "Initializing Terraform in ${SCRIPT_DIR}."
cd "${SCRIPT_DIR}"
terraform init

if ! terraform workspace select "${PREFIX}" >/dev/null 2>&1; then
  log "Creating Terraform workspace ${PREFIX}."
  terraform workspace new "${PREFIX}"
else
  log "Using Terraform workspace ${PREFIX}."
fi

APPLY_ARGS=()
if [[ "${AUTO_APPROVE}" -eq 1 ]]; then
  APPLY_ARGS+=("-auto-approve")
fi

log "Applying dedicated stack for ${PREFIX}."
if [[ "${#TF_VARS[@]}" -gt 0 ]]; then
  terraform apply "${APPLY_ARGS[@]}" \
    -var "project_id=${PROJECT_ID}" \
    -var "region=${REGION}" \
    -var "name_prefix=${PREFIX}" \
    -var "image=${IMAGE}" \
    "${TF_VARS[@]}"
else
  terraform apply "${APPLY_ARGS[@]}" \
    -var "project_id=${PROJECT_ID}" \
    -var "region=${REGION}" \
    -var "name_prefix=${PREFIX}" \
    -var "image=${IMAGE}"
fi

WEB_URL="$(terraform output -raw web_url)"
MASTER_SERVICE="$(terraform output -raw cloud_run_master_service)"
WEB_SERVICE="$(terraform output -raw cloud_run_web_service)"

cat <<EOF

Deployment complete.

Customer prefix: ${PREFIX}
Project:         ${PROJECT_ID}
Region:          ${REGION}
Image:           ${IMAGE}
Cloud Run web:   ${WEB_SERVICE}
Cloud Run master:${MASTER_SERVICE}
Public URL:      ${WEB_URL}

EOF
