# AWS EKS GitHub Actions Deployment Design

**Date:** 2026-09-18

**Goal:** Deploy the `thecybersailor/new-api` container to the existing AWS EKS cluster `syngy-lancelot` in `ap-southeast-1` whenever the `main` branch changes.

## Context

The repository already builds a multi-stage Docker image containing the Go backend and React frontend. The AWS account has an active EKS cluster named `syngy-lancelot` in Singapore, with one `t3.large` node in the `system-ondemand` node group and an existing GitHub Actions Runner Scale Set for the `thecybersailor` organization. The cluster currently contains only runner and system workloads; it has no `new-api` workload, Service, Ingress, or application storage.

The local AWS CLI is authenticated as account `712090706271`. The existing Kubernetes context named `sg.aws` points at this cluster but references a missing local AWS profile named `syngy`; deployment tooling will use the current AWS account profile explicitly when verifying the cluster.

## Chosen Architecture

```text
push to main
  -> GitHub-hosted runner
  -> Docker build from repository Dockerfile
  -> Amazon ECR repository new-api
  -> GitHub OIDC assumes a short-lived AWS IAM role
  -> workflow obtains an EKS token and applies Kubernetes manifests
  -> new-api Deployment rolls to the immutable commit image
  -> LoadBalancer Service exposes port 80 to container port 3000
```

The first version uses SQLite on a single encrypted EKS Auto Mode `gp3` PVC. This matches the repository's documented single-node Docker deployment and keeps the initial chain small. The Deployment uses one replica and a `Recreate` strategy so the single-writer SQLite file is never mounted by two pods at once. A later production-hardening change can move the primary database to RDS PostgreSQL and enable multiple replicas with Redis.

## AWS Resources

Create or reuse these resources in `ap-southeast-1`:

- ECR repository `new-api`, with scan-on-push enabled and immutable tags.
- GitHub Actions OIDC provider for `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
- IAM role `GitHubActionsNewApiDeploy`.
- IAM policy allowing ECR image push operations for the `new-api` repository, EKS cluster description, and `sts:GetCallerIdentity`.
- EKS access entry for the role with namespace-scoped Kubernetes access to the `new-api` namespace. The `new-api` Namespace is provisioned once by an administrator because namespace-scoped access cannot create cluster-scoped Namespace objects. The deployment workflow still uses the AWS EKS token flow; it does not store a long-lived Kubernetes token.
- EKS Auto Mode StorageClass `auto-ebs-sc`, provisioned once by an administrator because StorageClass objects are cluster-scoped. It uses encrypted `gp3` volumes through `ebs.csi.eks.amazonaws.com`.

The IAM trust policy is restricted to the immutable `production` environment subject for `thecybersailor/new-api`: `repo:thecybersailor@235312835/new-api@1375746808:environment:production`. The workflow must use the `production` environment so the subject claim remains stable and can be protected by GitHub environment rules.

The deployment role does not receive account-wide `AdministratorAccess`, `system:masters`, or unrestricted EKS access. ECR permissions are repository-scoped. Kubernetes permissions are namespace-scoped through an EKS access policy where supported; the manifests are applied only to `new-api`.

## Kubernetes Resources

Add version-controlled manifests under `deploy/k8s`:

- `namespace.yaml`: Namespace `new-api`.
- `serviceaccount.yaml`: ServiceAccount for the application pod.
- `configmap.yaml`: Non-sensitive runtime settings such as `TZ`, `PORT`, and `SESSION_COOKIE_SECURE`.
- `secret.example.yaml`: Documentation-only example showing required secret keys without real values.
- `storageclass.yaml`: One-time administrator bootstrap for the EKS Auto Mode `gp3` StorageClass.
- `pvc.yaml`: An encrypted `auto-ebs-sc` PVC for `/data`.
- `deployment.yaml`: One-replica `new-api` Deployment with image placeholder, health probes, resource requests/limits, and `/data` mount.
- `service.yaml`: AWS LoadBalancer Service mapping port 80 to container port 3000.
- `kustomization.yaml`: Base resource list and image replacement target.

Sensitive settings are supplied by a Kubernetes Secret created by the workflow from GitHub environment secrets. Real secret values must not be committed. Required secret keys are `SESSION_SECRET`; optional keys include `SQL_DSN`, `REDIS_CONN_STRING`, `CRYPTO_SECRET`, and `SESSION_COOKIE_TRUSTED_URL`.

The application will use `SESSION_COOKIE_SECURE=true` only when deployed behind HTTPS with an exact `SESSION_COOKIE_TRUSTED_URL`. The initial Service is HTTP-only unless an existing TLS/Ingress layer is supplied, so the initial manifest defaults to `false` and clearly leaves HTTPS hardening as a follow-up.

## GitHub Actions Workflow

Add `.github/workflows/deploy-aws.yml`:

- Triggers on pushes to `main` and manual dispatch.
- Runs on `ubuntu-latest` because the repository is public and the existing organization ARC scale set is not configured to accept public-repository jobs.
- Uses workflow permissions `contents: read` and `id-token: write`.
- Checks out the repository, resolves the image tag from `${{ github.sha }}`, configures AWS credentials through `aws-actions/configure-aws-credentials`, logs into ECR, and builds/pushes the Docker image. Because the ECR repository uses immutable tags, only the commit SHA tag is pushed.
- Installs `kubectl`, updates a temporary kubeconfig for `syngy-lancelot`, creates/updates the Kubernetes Secret from GitHub environment secrets, applies the namespace-scoped manifests, waits for rollout, and performs an HTTP health check through the Service once an external address exists.
- Uses a concurrency group so only one production deployment runs at a time.
- Pins third-party actions to commit SHAs, following the repository's existing workflow convention.

Required GitHub configuration:

- Environment: `production`.
- Environment secret: `AWS_DEPLOY_ROLE_ARN`, containing the IAM role ARN.
- Environment secret: `SESSION_SECRET`, containing a newly generated high-entropy value.
- Optional environment secrets: `SQL_DSN`, `REDIS_CONN_STRING`, `CRYPTO_SECRET`, `SESSION_COOKIE_TRUSTED_URL`.
- Environment protection: restrict deployment to `main` and optionally require approval before production deployment.

## Rollback

Every image is tagged with its immutable Git commit SHA. To roll back:

```bash
kubectl -n new-api rollout undo deployment/new-api
```

or redeploy a previous image SHA with the workflow's manual dispatch. The EBS PVC and its SQLite data remain attached to the application workload.

## Verification

Before claiming completion:

1. Validate YAML and Kustomize rendering locally.
2. Build the Docker image locally when Docker is available.
3. Confirm ECR repository and IAM role trust/policy state through AWS CLI.
4. Apply the manifests to the EKS cluster.
5. Wait for `Deployment/new-api` rollout.
6. Confirm the Service receives an external address and the application health endpoint returns success.
7. Confirm the repository diff contains only the intended deployment files and documentation.

## Explicit Non-Goals

- No RDS or ElastiCache creation in the first version.
- No multi-replica application deployment.
- No custom domain, ACM certificate, or HTTPS Ingress creation.
- No changes to the existing GitHub Runner Scale Set.
- No use of long-lived AWS access keys in GitHub Actions.
