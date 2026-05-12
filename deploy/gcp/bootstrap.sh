#!/usr/bin/env bash
# One-time bootstrap: create the GCS bucket that holds Terraform remote state.
# Idempotent — safe to re-run.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-vocai-gemini-prod}"
REGION="${REGION:-us-west1}"
BUCKET="${BUCKET:-${PROJECT_ID}-newapi-tfstate}"

echo "== Bootstrap target =="
echo "  project: ${PROJECT_ID}"
echo "  region : ${REGION}"
echo "  bucket : gs://${BUCKET}"
echo

if ! gcloud config get-value project 2>/dev/null | grep -q "^${PROJECT_ID}$"; then
  echo "Setting active project to ${PROJECT_ID}"
  gcloud config set project "${PROJECT_ID}"
fi

# Enable the bare minimum APIs Terraform needs to bootstrap itself.
echo "Enabling baseline APIs (storage, serviceusage)..."
gcloud services enable \
  storage.googleapis.com \
  serviceusage.googleapis.com \
  --project "${PROJECT_ID}" \
  --quiet

# Create the state bucket if it doesn't exist.
if gcloud storage buckets describe "gs://${BUCKET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Bucket gs://${BUCKET} already exists, skipping create."
else
  echo "Creating bucket gs://${BUCKET} ..."
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access \
    --public-access-prevention
fi

# Enable Object Versioning so accidental state corruption can be rolled back.
echo "Enabling object versioning on gs://${BUCKET} ..."
gcloud storage buckets update "gs://${BUCKET}" --versioning

# Lifecycle: keep the 10 most recent versions of each object, delete older.
echo "Setting lifecycle rule (keep 10 most recent versions)..."
LIFECYCLE_FILE="$(mktemp)"
cat >"${LIFECYCLE_FILE}" <<'JSON'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"numNewerVersions": 10, "isLive": false}
    }
  ]
}
JSON
gcloud storage buckets update "gs://${BUCKET}" --lifecycle-file="${LIFECYCLE_FILE}"
rm -f "${LIFECYCLE_FILE}"

echo
echo "Bootstrap complete."
echo "Next:"
echo "  cd deploy/gcp/envs/prod"
echo "  terraform init"
echo "  terraform plan -out=tfplan"
