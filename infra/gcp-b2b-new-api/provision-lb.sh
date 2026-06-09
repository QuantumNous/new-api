#!/usr/bin/env bash
#
# Provision a single-backend Global External HTTPS Load Balancer for a
# dedicated new-api Cloud Run service.
#
# Required env vars:
#   PROJECT_ID    GCP project ID
#   REGION        Cloud Run / serverless NEG region
#   DOMAIN        Domain for the managed certificate, e.g. ex1.taluna.ai
#   RUN_SERVICE   Cloud Run service name, e.g. tln-special-1-new-api-web
#
# Optional env vars:
#   RESOURCE_PREFIX       Prefix for all LB resources. Defaults to RUN_SERVICE.
#   IP_NAME               Defaults to ${RESOURCE_PREFIX}-lb-ip
#   CERT_NAME             Defaults to ${RESOURCE_PREFIX}-cert
#   NEG_NAME              Defaults to ${RESOURCE_PREFIX}-neg
#   BACKEND_NAME          Defaults to ${RESOURCE_PREFIX}-backend
#   URLMAP_NAME           Defaults to ${RESOURCE_PREFIX}-urlmap
#   TARGET_HTTPS_PROXY    Defaults to ${RESOURCE_PREFIX}-https-proxy
#   TARGET_HTTP_PROXY     Defaults to ${RESOURCE_PREFIX}-http-proxy
#   HTTP_TO_HTTPS_URLMAP  Defaults to ${RESOURCE_PREFIX}-http-redirect
#   FWD_RULE_HTTPS        Defaults to ${RESOURCE_PREFIX}-https-fr
#   FWD_RULE_HTTP         Defaults to ${RESOURCE_PREFIX}-http-fr

set -euo pipefail

require() {
  local missing=()
  for v in "$@"; do
    if [[ -z "${!v:-}" ]]; then missing+=("$v"); fi
  done
  if (( ${#missing[@]} > 0 )); then
    echo "ERROR: missing env vars: ${missing[*]}" >&2
    exit 1
  fi
}

log() {
  echo "[provision-lb] $*"
}

require PROJECT_ID REGION DOMAIN RUN_SERVICE

RESOURCE_PREFIX="${RESOURCE_PREFIX:-$RUN_SERVICE}"
IP_NAME="${IP_NAME:-${RESOURCE_PREFIX}-lb-ip}"
CERT_NAME="${CERT_NAME:-${RESOURCE_PREFIX}-cert}"
NEG_NAME="${NEG_NAME:-${RESOURCE_PREFIX}-neg}"
BACKEND_NAME="${BACKEND_NAME:-${RESOURCE_PREFIX}-backend}"
URLMAP_NAME="${URLMAP_NAME:-${RESOURCE_PREFIX}-urlmap}"
TARGET_HTTPS_PROXY="${TARGET_HTTPS_PROXY:-${RESOURCE_PREFIX}-https-proxy}"
TARGET_HTTP_PROXY="${TARGET_HTTP_PROXY:-${RESOURCE_PREFIX}-http-proxy}"
HTTP_TO_HTTPS_URLMAP="${HTTP_TO_HTTPS_URLMAP:-${RESOURCE_PREFIX}-http-redirect}"
FWD_RULE_HTTPS="${FWD_RULE_HTTPS:-${RESOURCE_PREFIX}-https-fr}"
FWD_RULE_HTTP="${FWD_RULE_HTTP:-${RESOURCE_PREFIX}-http-fr}"

ensure_global_ip() {
  if gcloud compute addresses describe "$IP_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "global IP $IP_NAME exists"
  else
    log "reserving global IP $IP_NAME"
    gcloud compute addresses create "$IP_NAME" --global --project="$PROJECT_ID"
  fi
  IP_ADDR="$(gcloud compute addresses describe "$IP_NAME" --global --project="$PROJECT_ID" --format='value(address)')"
  log "  -> $IP_ADDR"
}

ensure_managed_cert() {
  if gcloud compute ssl-certificates describe "$CERT_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "managed cert $CERT_NAME exists"
  else
    log "creating managed cert $CERT_NAME for $DOMAIN"
    gcloud compute ssl-certificates create "$CERT_NAME" \
      --domains="$DOMAIN" \
      --global \
      --project="$PROJECT_ID"
  fi
}

ensure_serverless_neg() {
  if gcloud compute network-endpoint-groups describe "$NEG_NAME" --region="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "serverless NEG $NEG_NAME exists"
  else
    log "creating serverless NEG $NEG_NAME -> Cloud Run $RUN_SERVICE"
    gcloud compute network-endpoint-groups create "$NEG_NAME" \
      --region="$REGION" \
      --network-endpoint-type=serverless \
      --cloud-run-service="$RUN_SERVICE" \
      --project="$PROJECT_ID"
  fi
}

ensure_backend_service() {
  if gcloud compute backend-services describe "$BACKEND_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "backend-service $BACKEND_NAME exists"
  else
    log "creating backend-service $BACKEND_NAME"
    gcloud compute backend-services create "$BACKEND_NAME" \
      --global \
      --load-balancing-scheme=EXTERNAL_MANAGED \
      --protocol=HTTP \
      --project="$PROJECT_ID"
  fi

  if gcloud compute backend-services describe "$BACKEND_NAME" --global --project="$PROJECT_ID" --format='value(backends[].group)' | grep -q "$NEG_NAME"; then
    log "  $BACKEND_NAME already has NEG $NEG_NAME"
  else
    log "  attaching NEG $NEG_NAME -> $BACKEND_NAME"
    gcloud compute backend-services add-backend "$BACKEND_NAME" \
      --global \
      --network-endpoint-group="$NEG_NAME" \
      --network-endpoint-group-region="$REGION" \
      --project="$PROJECT_ID"
  fi
}

ensure_urlmap() {
  local backend="projects/${PROJECT_ID}/global/backendServices/${BACKEND_NAME}"
  if gcloud compute url-maps describe "$URLMAP_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "url-map $URLMAP_NAME exists; reconciling default service"
    gcloud compute url-maps set-default-service "$URLMAP_NAME" \
      --default-service="$backend" \
      --global \
      --project="$PROJECT_ID"
  else
    log "creating url-map $URLMAP_NAME"
    gcloud compute url-maps create "$URLMAP_NAME" \
      --default-service="$backend" \
      --global \
      --project="$PROJECT_ID"
  fi
}

ensure_https_proxy() {
  if gcloud compute target-https-proxies describe "$TARGET_HTTPS_PROXY" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "target-https-proxy $TARGET_HTTPS_PROXY exists; reconciling"
    gcloud compute target-https-proxies update "$TARGET_HTTPS_PROXY" \
      --url-map="$URLMAP_NAME" \
      --ssl-certificates="$CERT_NAME" \
      --global \
      --project="$PROJECT_ID"
  else
    log "creating target-https-proxy $TARGET_HTTPS_PROXY"
    gcloud compute target-https-proxies create "$TARGET_HTTPS_PROXY" \
      --url-map="$URLMAP_NAME" \
      --ssl-certificates="$CERT_NAME" \
      --global \
      --project="$PROJECT_ID"
  fi
}

ensure_https_forwarding_rule() {
  if gcloud compute forwarding-rules describe "$FWD_RULE_HTTPS" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "forwarding-rule $FWD_RULE_HTTPS exists"
  else
    log "creating forwarding-rule $FWD_RULE_HTTPS on 443"
    gcloud compute forwarding-rules create "$FWD_RULE_HTTPS" \
      --address="$IP_NAME" \
      --target-https-proxy="$TARGET_HTTPS_PROXY" \
      --load-balancing-scheme=EXTERNAL_MANAGED \
      --ports=443 \
      --global \
      --project="$PROJECT_ID"
  fi
}

ensure_http_redirect() {
  if gcloud compute url-maps describe "$HTTP_TO_HTTPS_URLMAP" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "http redirect url-map $HTTP_TO_HTTPS_URLMAP exists"
  else
    log "creating http redirect url-map $HTTP_TO_HTTPS_URLMAP"
    local redirect_yaml
    redirect_yaml="$(mktemp)"
    {
      echo "name: $HTTP_TO_HTTPS_URLMAP"
      echo "defaultUrlRedirect:"
      echo "  httpsRedirect: true"
      echo "  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT"
      echo "  stripQuery: false"
    } > "$redirect_yaml"
    gcloud compute url-maps import "$HTTP_TO_HTTPS_URLMAP" \
      --source="$redirect_yaml" \
      --global \
      --project="$PROJECT_ID"
    rm -f "$redirect_yaml"
  fi

  if gcloud compute target-http-proxies describe "$TARGET_HTTP_PROXY" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "target-http-proxy $TARGET_HTTP_PROXY exists"
  else
    log "creating target-http-proxy $TARGET_HTTP_PROXY"
    gcloud compute target-http-proxies create "$TARGET_HTTP_PROXY" \
      --url-map="$HTTP_TO_HTTPS_URLMAP" \
      --global \
      --project="$PROJECT_ID"
  fi

  if gcloud compute forwarding-rules describe "$FWD_RULE_HTTP" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "forwarding-rule $FWD_RULE_HTTP exists"
  else
    log "creating forwarding-rule $FWD_RULE_HTTP on 80"
    gcloud compute forwarding-rules create "$FWD_RULE_HTTP" \
      --address="$IP_NAME" \
      --target-http-proxy="$TARGET_HTTP_PROXY" \
      --load-balancing-scheme=EXTERNAL_MANAGED \
      --ports=80 \
      --global \
      --project="$PROJECT_ID"
  fi
}

ensure_global_ip
ensure_managed_cert
ensure_serverless_neg
ensure_backend_service
ensure_urlmap
ensure_https_proxy
ensure_https_forwarding_rule
ensure_http_redirect

CERT_STATUS="$(gcloud compute ssl-certificates describe "$CERT_NAME" --global --project="$PROJECT_ID" --format='value(managed.status)')"

cat <<EOF

[provision-lb] done.

Domain:      $DOMAIN
Cloud Run:   $RUN_SERVICE
LB IP:       $IP_ADDR
Cert:        $CERT_NAME ($CERT_STATUS)
Backend:     $BACKEND_NAME
URL map:     $URLMAP_NAME

DNS next step:
  Point $DOMAIN A record to $IP_ADDR.
  Google-managed certificate will become ACTIVE after DNS points to this IP.
EOF
