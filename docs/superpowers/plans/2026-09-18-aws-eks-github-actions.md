# AWS EKS GitHub Actions Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `thecybersailor/new-api` from GitHub Actions to the existing AWS EKS cluster `syngy-lancelot` in `ap-southeast-1`.

**Architecture:** GitHub Actions runs on the existing `thecybersailor-linux-amd64` ARC runner, builds the repository Docker image, pushes an immutable commit-tagged image to ECR, and uses GitHub OIDC to obtain short-lived AWS credentials. The workflow applies version-controlled Kubernetes manifests for a single-replica `new-api` Deployment with SQLite persisted on a `gp2` EBS PVC and an AWS LoadBalancer Service.

**Tech Stack:** GitHub Actions, GitHub OIDC, AWS IAM, Amazon ECR, Amazon EKS, Kubernetes, Kustomize, Docker, Go, Bun, SQLite.

**Spec:** `docs/superpowers/specs/2026-09-18-aws-eks-github-actions-design.md`

## Global Constraints

- AWS region: `ap-southeast-1`.
- EKS cluster: `syngy-lancelot`.
- GitHub repository: `thecybersailor/new-api`.
- GitHub deployment environment: `production`.
- ECR repository: `new-api`.
- Kubernetes namespace: `new-api`.
- Application deployment uses one replica and `Recreate` strategy because SQLite is single-writer.
- Persistent application data is mounted at `/data` from a `gp2` PVC.
- Do not commit AWS credentials, Kubernetes tokens, application secrets, or generated kubeconfig files.
- Do not modify the existing GitHub Runner Scale Set.
- Do not create RDS, ElastiCache, custom DNS, ACM certificates, or HTTPS Ingress in this change.
- Use immutable image tags based on `${{ github.sha }}`.
- The `new-api` Namespace is created once by an administrator; the namespace-scoped deployment role does not manage the Namespace object.
- Pin third-party GitHub Actions to commit SHAs, matching existing repository conventions.

---

### Task 1: Create and verify AWS ECR repository

**Files:**
- No repository files.

**Interfaces:**
- Produces ECR repository URI for the GitHub Actions workflow.

- [ ] **Step 1: Check whether the repository already exists**

Run:

```bash
aws ecr describe-repositories \
  --region ap-southeast-1 \
  --repository-names new-api
```

Expected: either the existing repository details or `RepositoryNotFoundException`.

- [ ] **Step 2: Create the repository when absent**

Run only when Step 1 reports `RepositoryNotFoundException`:

```bash
aws ecr create-repository \
  --region ap-southeast-1 \
  --repository-name new-api \
  --image-tag-mutability IMMUTABLE \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256
```

Expected: repository ARN and URI are returned.

- [ ] **Step 3: Record the repository URI without adding it to source control**

Run:

```bash
aws ecr describe-repositories \
  --region ap-southeast-1 \
  --repository-names new-api \
  --query 'repositories[0].repositoryUri' \
  --output text
```

Expected: `712090706271.dkr.ecr.ap-southeast-1.amazonaws.com/new-api`.

- [ ] **Step 4: Verify repository settings**

Run:

```bash
aws ecr describe-repositories \
  --region ap-southeast-1 \
  --repository-names new-api \
  --query 'repositories[0].[imageTagMutability,imageScanningConfiguration.scanOnPush,encryptionConfiguration.encryptionType]' \
  --output table
```

Expected: `IMMUTABLE`, `True`, and `AES256`.

---

### Task 2: Create GitHub OIDC provider and deployment IAM role

**Files:**
- Create: `/tmp/github-actions-new-api-trust-policy.json`
- Create: `/tmp/github-actions-new-api-policy.json`
- Create: `/tmp/github-actions-new-api-role-policy.json`

**Interfaces:**
- Produces IAM role ARN for the `AWS_DEPLOY_ROLE_ARN` GitHub environment secret.

- [ ] **Step 1: Check for the GitHub OIDC provider**

Run:

```bash
aws iam list-open-id-connect-providers
```

For each provider ARN, inspect:

```bash
aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn <provider-arn>
```

Expected: reuse the provider whose URL is `https://token.actions.githubusercontent.com`; otherwise create it.

- [ ] **Step 2: Create the provider when absent**

Run:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --tags Key=Name,Value=github-actions
```

Expected: provider ARN is returned.

- [ ] **Step 3: Write the restricted trust policy**

Create `/tmp/github-actions-new-api-trust-policy.json` with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::712090706271:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:thecybersailor/new-api:environment:production"
        }
      }
    }
  ]
}
```

- [ ] **Step 4: Write the least-privilege IAM policy**

Create `/tmp/github-actions-new-api-policy.json` with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrPushNewApi",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": "arn:aws:ecr:ap-southeast-1:712090706271:repository/new-api"
    },
    {
      "Sid": "EcrAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "EksDescribe",
      "Effect": "Allow",
      "Action": "eks:DescribeCluster",
      "Resource": "arn:aws:eks:ap-southeast-1:712090706271:cluster/syngy-lancelot"
    },
    {
      "Sid": "CallerIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    }
  ]
}
```

- [ ] **Step 5: Create or update the role**

Run:

```bash
aws iam get-role --role-name GitHubActionsNewApiDeploy
```

If absent:

```bash
aws iam create-role \
  --role-name GitHubActionsNewApiDeploy \
  --assume-role-policy-document file:///tmp/github-actions-new-api-trust-policy.json \
  --description "Deploy thecybersailor/new-api to EKS syngy-lancelot"
```

Create the inline policy:

```bash
aws iam put-role-policy \
  --role-name GitHubActionsNewApiDeploy \
  --policy-name NewApiDeploy \
  --policy-document file:///tmp/github-actions-new-api-policy.json
```

Expected: role ARN is `arn:aws:iam::712090706271:role/GitHubActionsNewApiDeploy`.

- [ ] **Step 6: Verify role trust and permissions**

Run:

```bash
aws iam get-role \
  --role-name GitHubActionsNewApiDeploy \
  --query 'Role.[Arn,AssumeRolePolicyDocument]' \
  --output json

aws iam get-role-policy \
  --role-name GitHubActionsNewApiDeploy \
  --policy-name NewApiDeploy
```

Expected: trust is limited to the repository's `production` environment and the inline policy contains only the ECR push, EKS describe, and caller identity actions.

---

### Task 3: Grant the deployment role namespace-scoped EKS access

**Files:**
- No repository files.

**Interfaces:**
- Gives the GitHub Actions IAM role Kubernetes permissions limited to namespace `new-api`.

- [ ] **Step 1: Check the cluster access configuration**

Run:

```bash
aws eks describe-cluster \
  --region ap-southeast-1 \
  --name syngy-lancelot \
  --query 'cluster.accessConfig.authenticationMode' \
  --output text
```

Expected: `API` or `API_AND_CONFIG_MAP`.

- [ ] **Step 2: Create the EKS access entry**

Run:

```bash
aws eks create-access-entry \
  --region ap-southeast-1 \
  --cluster-name syngy-lancelot \
  --principal-arn arn:aws:iam::712090706271:role/GitHubActionsNewApiDeploy \
  --type STANDARD
```

If the entry already exists, continue with its existing entry.

- [ ] **Step 3: Associate namespace-scoped edit access**

Run:

```bash
aws eks associate-access-policy \
  --region ap-southeast-1 \
  --cluster-name syngy-lancelot \
  --principal-arn arn:aws:iam::712090706271:role/GitHubActionsNewApiDeploy \
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSEditPolicy \
  --access-scope type=namespace,namespaces=new-api
```

Expected: the role can create and update namespaced resources in `new-api`, but cannot modify cluster-scoped resources.

- [ ] **Step 4: Verify the access entry and policy association**

Run:

```bash
aws eks describe-access-entry \
  --region ap-southeast-1 \
  --cluster-name syngy-lancelot \
  --principal-arn arn:aws:iam::712090706271:role/GitHubActionsNewApiDeploy

aws eks list-associated-access-policies \
  --region ap-southeast-1 \
  --cluster-name syngy-lancelot \
  --principal-arn arn:aws:iam::712090706271:role/GitHubActionsNewApiDeploy
```

Expected: one namespace-scoped association for `new-api`.

---

### Task 4: Add Kubernetes manifests for the application

**Files:**
- Create: `deploy/k8s/namespace.yaml`
- Create: `deploy/k8s/serviceaccount.yaml`
- Create: `deploy/k8s/configmap.yaml`
- Create: `deploy/k8s/secret.example.yaml`
- Create: `deploy/k8s/pvc.yaml`
- Create: `deploy/k8s/deployment.yaml`
- Create: `deploy/k8s/service.yaml`
- Create: `deploy/k8s/kustomization.yaml`

**Interfaces:**
- Produces a renderable Kubernetes base with image substitution through Kustomize.

- [ ] **Step 1: Write the namespace manifest**

Create `deploy/k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: new-api
  labels:
    app.kubernetes.io/name: new-api
    app.kubernetes.io/part-of: new-api
```

- [ ] **Step 2: Write the ServiceAccount and non-sensitive ConfigMap**

Create `deploy/k8s/serviceaccount.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: new-api
  namespace: new-api
```

Create `deploy/k8s/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: new-api
  namespace: new-api
data:
  PORT: "3000"
  TZ: "Asia/Shanghai"
  SESSION_COOKIE_SECURE: "false"
  ERROR_LOG_ENABLED: "true"
  BATCH_UPDATE_ENABLED: "true"
  NODE_NAME: new-api-0
```

- [ ] **Step 3: Write the example Secret manifest**

Create `deploy/k8s/secret.example.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: new-api
  namespace: new-api
type: Opaque
stringData:
  SESSION_SECRET: replace-me-with-a-high-entropy-value
```

The example file must not be applied by Kustomize and must not contain real credentials.

- [ ] **Step 4: Write the EBS PVC**

Create `deploy/k8s/pvc.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: new-api-data
  namespace: new-api
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: gp2
  resources:
    requests:
      storage: 20Gi
```

- [ ] **Step 5: Write the Deployment**

Create `deploy/k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: new-api
  namespace: new-api
  labels:
    app.kubernetes.io/name: new-api
    app.kubernetes.io/part-of: new-api
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app.kubernetes.io/name: new-api
  template:
    metadata:
      labels:
        app.kubernetes.io/name: new-api
        app.kubernetes.io/part-of: new-api
    spec:
      serviceAccountName: new-api
      terminationGracePeriodSeconds: 30
      securityContext:
        fsGroup: 1000
      containers:
        - name: new-api
          image: new-api:bootstrap
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: new-api
            - secretRef:
                name: new-api
          volumeMounts:
            - name: data
              mountPath: /data
          readinessProbe:
            httpGet:
              path: /api/status
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 6
          livenessProbe:
            httpGet:
              path: /api/status
              port: http
            initialDelaySeconds: 30
            periodSeconds: 20
            timeoutSeconds: 5
            failureThreshold: 6
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: "2"
              memory: 4Gi
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: new-api-data
```

- [ ] **Step 6: Write the LoadBalancer Service**

Create `deploy/k8s/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: new-api
  namespace: new-api
  labels:
    app.kubernetes.io/name: new-api
spec:
  type: LoadBalancer
  selector:
    app.kubernetes.io/name: new-api
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP
```

- [ ] **Step 7: Write Kustomize configuration**

Create `deploy/k8s/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - serviceaccount.yaml
  - configmap.yaml
  - pvc.yaml
  - deployment.yaml
  - service.yaml
images:
  - name: new-api
    newName: 712090706271.dkr.ecr.ap-southeast-1.amazonaws.com/new-api
    newTag: bootstrap
```

- [ ] **Step 8: Render and validate the manifests**

Run:

```bash
kubectl kustomize deploy/k8s > /tmp/new-api-rendered.yaml
kubectl apply --dry-run=client -f /tmp/new-api-rendered.yaml
```

Expected: rendering succeeds, and the output contains exactly one ServiceAccount, ConfigMap, PVC, Deployment, and LoadBalancer Service. `namespace.yaml` is provisioned separately and `secret.example.yaml` must not appear in the render.

---

### Task 5: Add the GitHub Actions deployment workflow

**Files:**
- Create: `.github/workflows/deploy-aws.yml`

**Interfaces:**
- Consumes GitHub environment secrets `AWS_DEPLOY_ROLE_ARN`, `SESSION_SECRET`, and optional `SQL_DSN`, `REDIS_CONN_STRING`, `CRYPTO_SECRET`, `SESSION_COOKIE_TRUSTED_URL`.
- Produces an ECR image and an updated EKS Deployment.

- [ ] **Step 1: Pin action versions**

Resolve the exact commit SHAs for the current major versions of:

- `actions/checkout`
- `aws-actions/configure-aws-credentials`
- `docker/setup-buildx-action`
- `docker/login-action`
- `docker/build-push-action`
- `azure/setup-kubectl`

Use the resolved full SHAs in the workflow and retain a version comment for each action.

- [ ] **Step 2: Write the workflow trigger and permissions**

Create `.github/workflows/deploy-aws.yml` with:

```yaml
name: Deploy to AWS EKS

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

concurrency:
  group: deploy-aws-production
  cancel-in-progress: false
```

- [ ] **Step 3: Add the build and ECR push job**

The job must:

- use `runs-on: thecybersailor-linux-amd64`;
- set `environment: production`;
- set `AWS_REGION`, `EKS_CLUSTER`, `ECR_REPOSITORY`, and `IMAGE_TAG`;
- configure AWS credentials with `role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}`;
- log into the regional ECR registry;
- build `.` with the repository `Dockerfile`;
- push `${ECR_REGISTRY}/new-api:${GITHUB_SHA}` only because the ECR repository uses immutable tags;
- expose the immutable image URI through `$GITHUB_OUTPUT`.

- [ ] **Step 4: Add the Kubernetes deployment steps**

The same job must:

- install `kubectl`;
- run `aws eks update-kubeconfig --region "$AWS_REGION" --name "$EKS_CLUSTER"`;
- create or replace the Kubernetes Secret from GitHub environment secrets using `kubectl create secret generic ... --dry-run=client -o yaml | kubectl apply -f -`;
- apply `kubectl apply -k deploy/k8s`;
- set the Deployment image to the immutable image URI;
- wait with `kubectl rollout status deployment/new-api --timeout=10m`;
- print Deployment, Pod, PVC, and Service status on failure.

Secret creation must only include non-empty optional values and must never print secret values. The command must set `SESSION_SECRET` as required and fail before deployment if it is absent.

- [ ] **Step 5: Add workflow summaries**

Write the deployed image URI and the Service status to `$GITHUB_STEP_SUMMARY`, without printing credentials or secret values.

- [ ] **Step 6: Validate the workflow syntax**

Run:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/deploy-aws.yml"); puts "workflow YAML OK"'
rg -n "AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|SESSION_SECRET:|replace-me|system:masters" .github/workflows/deploy-aws.yml deploy/k8s
```

Expected: YAML parses; the second command returns no forbidden long-lived credentials, committed application secret, placeholder Secret application, or `system:masters`.

---

### Task 6: Configure GitHub production environment secrets and protection

**Files:**
- No repository files.

**Interfaces:**
- Makes the workflow's `production` environment inputs available without storing secret material in Git.

- [ ] **Step 1: Confirm the GitHub CLI or GitHub API access method**

Run:

```bash
command -v gh
gh auth status
```

If the GitHub CLI is unavailable or unauthenticated, stop and request that the user configure the GitHub `production` environment manually; do not put secrets in the repository.

- [ ] **Step 2: Create or update the production environment**

Use the repository `thecybersailor/new-api` and create the `production` environment if absent. Restrict deployment branches to `main`. Leave required reviewers unchanged unless the user explicitly requests an approval gate.

- [ ] **Step 3: Set the AWS role ARN**

Set environment secret `AWS_DEPLOY_ROLE_ARN` to:

```text
arn:aws:iam::712090706271:role/GitHubActionsNewApiDeploy
```

- [ ] **Step 4: Generate and set the application session secret**

Generate a new value locally without writing it to the repository:

```bash
openssl rand -hex 32
```

Set the resulting value as the `SESSION_SECRET` environment secret. Do not echo it after setting it.

- [ ] **Step 5: Verify only secret names**

Run:

```bash
gh secret list --repo thecybersailor/new-api --env production
```

Expected: `AWS_DEPLOY_ROLE_ARN` and `SESSION_SECRET` are listed; values are not displayed.

---

### Task 7: Deploy and verify the first release

**Files:**
- No additional files.

**Interfaces:**
- Produces a running `new-api` workload and externally reachable Service in EKS.

- [ ] **Step 1: Verify AWS OIDC role assumption locally with a non-GitHub token check**

Confirm the role's trust policy and EKS access entry. Do not attempt to fake a GitHub OIDC token locally.

- [ ] **Step 2: Apply the initial Kubernetes resources**

Using a kubeconfig generated for the current AWS CLI profile and the EKS cluster:

```bash
aws eks update-kubeconfig \
  --region ap-southeast-1 \
  --name syngy-lancelot \
  --profile default \
  --kubeconfig /tmp/sg.aws.kubeconfig
KUBECONFIG=/tmp/sg.aws.kubeconfig kubectl apply -f deploy/k8s/namespace.yaml
KUBECONFIG=/tmp/sg.aws.kubeconfig kubectl apply -k deploy/k8s
```

Before applying, create the `new-api` Secret interactively or through the same non-logging command used by the workflow. Do not commit the Secret.

- [ ] **Step 3: Confirm PVC binding and deployment state**

Run:

```bash
KUBECONFIG=/tmp/sg.aws.kubeconfig kubectl -n new-api get pvc,pod,deployment,service -o wide
KUBECONFIG=/tmp/sg.aws.kubeconfig kubectl -n new-api rollout status deployment/new-api --timeout=10m
```

Expected: PVC is `Bound`, one pod is `Ready`, Deployment is available, and Service receives an external hostname or IP.

- [ ] **Step 4: Trigger the GitHub Actions workflow**

Push the workflow and manifests to the repository's `main` branch only after local validation passes, or use GitHub's manual workflow dispatch after the workflow is present on the remote default branch.

Expected: the job runs on `thecybersailor-linux-amd64`, authenticates through OIDC, pushes the image, applies the manifests, and completes the rollout.

- [ ] **Step 5: Verify the deployed image**

Run:

```bash
KUBECONFIG=/tmp/sg.aws.kubeconfig kubectl -n new-api get deployment new-api -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
KUBECONFIG=/tmp/sg.aws.kubeconfig kubectl -n new-api get pods -o wide
```

Expected: the image ends in the deployed commit SHA and the pod is `1/1 Running`.

- [ ] **Step 6: Verify the health endpoint**

Run:

```bash
KUBECONFIG=/tmp/sg.aws.kubeconfig kubectl -n new-api port-forward service/new-api 18080:80 >/tmp/new-api-port-forward.log 2>&1 &
port_forward_pid=$!
sleep 3
curl --fail --silent --show-error http://127.0.0.1:18080/api/status
kill "$port_forward_pid"
```

Expected: the endpoint returns the application's success response.

- [ ] **Step 7: Record the external Service endpoint**

Run:

```bash
KUBECONFIG=/tmp/sg.aws.kubeconfig kubectl -n new-api get service new-api -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{"\n"}{.status.loadBalancer.ingress[0].ip}{"\n"}'
```

Expected: an AWS LoadBalancer hostname or IP is returned.

---

### Task 8: Final verification and handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-09-18-aws-eks-github-actions-design.md` only if implementation decisions materially differ from the approved design.

**Interfaces:**
- Produces a verified deployment handoff with exact resource identifiers and known follow-ups.

- [ ] **Step 1: Run repository diff checks**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors; only the planned manifests, workflow, plan, and any required documentation are changed.

- [ ] **Step 2: Run Kubernetes manifest verification**

Run:

```bash
kubectl kustomize deploy/k8s >/tmp/new-api-rendered.yaml
kubectl apply --dry-run=client -f /tmp/new-api-rendered.yaml
```

Expected: no manifest errors.

- [ ] **Step 3: Run relevant project checks**

Run:

```bash
go test ./...
cd relaykit && go test ./...
cd ../web && bun install --frozen-lockfile && bun run typecheck && bun run test
```

Expected: all commands exit successfully, or any pre-existing/environment-specific failure is recorded precisely.

- [ ] **Step 4: Verify AWS and EKS state**

Run:

```bash
aws ecr describe-repositories --region ap-southeast-1 --repository-names new-api
aws iam get-role --role-name GitHubActionsNewApiDeploy
aws eks describe-access-entry --region ap-southeast-1 --cluster-name syngy-lancelot --principal-arn arn:aws:iam::712090706271:role/GitHubActionsNewApiDeploy
KUBECONFIG=/tmp/sg.aws.kubeconfig kubectl -n new-api get all,pvc
```

Expected: the resources exist and the application workload is healthy.

- [ ] **Step 5: Report exact handoff details**

Include:

- ECR repository URI.
- IAM role ARN.
- EKS cluster and namespace.
- Service hostname or IP.
- GitHub workflow path.
- Required production secrets by name only.
- SQLite/EBS single-replica limitation.
- Rollback command:

```bash
kubectl -n new-api rollout undo deployment/new-api
```
