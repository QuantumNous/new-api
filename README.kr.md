<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 **차세대 대규모 모델 게이트웨이 및 AI 자산 관리 시스템**

<p align="center">
  <a href="./README.zh_CN.md">简体中文</a> |
  <a href="./README.zh_TW.md">繁體中文</a> |
  <a href="./README.md">English</a> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a> |
  <strong>한국어</strong>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/Calcium-Ion/new-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/Calcium-Ion/new-api?color=brightgreen" alt="license">
  </a><!--
  --><a href="https://github.com/Calcium-Ion/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/Calcium-Ion/new-api?color=brightgreen&include_prereleases" alt="release">
  </a><!--
  --><a href="https://hub.docker.com/r/CalciumIon/new-api">
    <img src="https://img.shields.io/badge/docker-dockerHub-blue" alt="docker">
  </a><!--
  --><a href="https://goreportcard.com/report/github.com/Calcium-Ion/new-api">
    <img src="https://goreportcard.com/badge/github.com/Calcium-Ion/new-api" alt="GoReportCard">
  </a>
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/20180" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/20180" alt="QuantumNous%2Fnew-api | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/>
  </a>
  <br>
  <a href="https://hellogithub.com/repository/QuantumNous/new-api" target="_blank">
    <img src="https://api.hellogithub.com/v1/widgets/recommend.svg?rid=539ac4217e69431684ad4a0bab768811&claim_uid=tbFPfKIDHpc4TzR" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54" />
  </a><!--
  --><a href="https://www.producthunt.com/products/new-api/launches/new-api?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-new-api" target="_blank" rel="noopener noreferrer">
    <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1047693&theme=light&t=1769577875005" alt="New API - All-in-one AI asset management gateway. | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" />
  </a>
</p>

<p align="center">
  <a href="#-빠른-시작">빠른 시작</a> •
  <a href="#-주요-기능">주요 기능</a> •
  <a href="#-배포">배포</a> •
  <a href="#-문서">문서</a> •
  <a href="#-도움말 및-지원">도움말</a>
</p>

</div>

## 📝 프로젝트 설명

> [!IMPORTANT]
> - 본 프로젝트는 개인 학습용으로만 사용하며, 안정성 보장이나 기술 지원은 제공하지 않습니다.
> - 사용자는 OpenAI의 [이용 약관](https://openai.com/policies/terms-of-use) 및 **관계 법령**을 준수해야 하며, 불법적인 목적으로 사용해서는 안 됩니다.
> - [《생성형 인공지능 서비스 관리 잠정 조치》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)에 따라 중국 지역에서 미등록 생성형 AI 서비스를 대중에게 제공하지 마십시오.

---

## 🤝 신뢰할 수 있는 파트너

<p align="center">
  <em>순서 없음</em>
</p>

<p align="center">
  <a href="https://www.cherry-ai.com/" target="_blank">
    <img src="./docs/images/cherry-studio.png" alt="Cherry Studio" height="80" />
  </a><!--
  --><a href="https://github.com/iOfficeAI/AionUi/" target="_blank">
    <img src="./docs/images/aionui.png" alt="Aion UI" height="80" />
  </a><!--
  --><a href="https://bda.pku.edu.cn/" target="_blank">
    <img src="./docs/images/pku.png" alt="베이징 대학" height="80" />
  </a><!--
  --><a href="https://www.compshare.cn/?ytag=GPU_yy_gh_newapi" target="_blank">
    <img src="./docs/images/ucloud.png" alt="UCloud" height="80" />
  </a><!--
  --><a href="https://www.aliyun.com/" target="_blank">
    <img src="./docs/images/aliyun.png" alt="Alibaba Cloud" height="80" />
  </a><!--
  --><a href="https://io.net/" target="_blank">
    <img src="./docs/images/io-net.png" alt="IO.NET" height="80" />
  </a>
</p>

---

## 🙏 특별 감사

<p align="center">
  <a href="https://www.jetbrains.com/?from=new-api" target="_blank">
    <img src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.png" alt="JetBrains Logo" width="120" />
  </a>
</p>

<p align="center">
  <strong><a href="https://www.jetbrains.com/?from=new-api">JetBrains</a>가 본 프로젝트에 무료 오픈소스 개발 라이선스를 제공해 주셔서 감사합니다</strong>
</p>

---

## 🚀 빠른 시작

### Docker Compose 사용 (권장)

```bash
# 프로젝트 클론
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# docker-compose.yml 설정 편집
nano docker-compose.yml

# 서비스 시작
docker-compose up -d
```

<details>
<summary><strong>Docker 명령어 사용</strong></summary>

```bash
# 최신 이미지 풀
docker pull calciumion/new-api:latest

# SQLite 사용 (기본값)
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest

# MySQL 사용
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

> **💡 팁:** `-v ./data:/data`는 현재 디렉토리의 `data` 폴더에 데이터를 저장합니다. 절대 경로로 변경할 수도 있습니다: `-v /your/custom/path:/data`

</details>

---

🎉 배포가 완료되면 `http://localhost:3000`에 접속하여 사용을 시작하세요!

📖 다른 배포 방법은 [배포 가이드](https://docs.newapi.pro/kr/docs/installation)를 참조하세요.

---

## 📚 문서

<div align="center">

### 📖 [공식 문서](https://docs.newapi.pro/kr/docs) | [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QuantumNous/new-api)

</div>

**빠른 탐색:**

| 카테고리 | 링크 |
|------|------|
| 🚀 배포 가이드 | [설치 문서](https://docs.newapi.pro/kr/docs/installation) |
| ⚙️ 환경 설정 | [환경 변수](https://docs.newapi.pro/kr/docs/installation/config-maintenance/environment-variables) |
| 📡 API 문서 | [API 문서](https://docs.newapi.pro/kr/docs/api) |
| ❓ 자주 묻는 질문 | [FAQ](https://docs.newapi.pro/kr/docs/support/faq) |
| 💬 커뮤니티 | [소통 채널](https://docs.newapi.pro/kr/docs/support/community-interaction) |

---

## ✨ 주요 기능

> 자세한 기능은 [기능 소개](https://docs.newapi.pro/kr/docs/guide/wiki/basic-concepts/features-introduction)를 참조하세요.

### 🎨 핵심 기능

| 기능 | 설명 |
|------|------|
| 🎨 새로운 UI | 현대적인 사용자 인터페이스 디자인 |
| 🌍 다국어 | 중국어 간체, 중국어 번체, 영어, 프랑스어, 일본어, 한국어 지원 |
| 🔄 데이터 호환성 | 기존 One API 데이터베이스와 완전 호환 |
| 📈 데이터 대시보드 | 시각화 콘솔 및 통계 분석 |
| 🔒 권한 관리 | 토큰 그룹화, 모델 제한, 사용자 관리 |

### 💰 결제 및 과금

- ✅ 온라인 충전 (EPay, Stripe)
- ✅ 모델 종량제 과금
- ✅ 캐시 과금 지원 (OpenAI, Azure, DeepSeek, Claude, Qwen 등 모든 지원 모델)
- ✅ 유연한 과금 정책 설정

### 🔐 인증 및 보안

- 😈 Discord 인증 로그인
- 🤖 LinuxDO 인증 로그인
- 📱 Telegram 인증 로그인
- 🔑 OIDC 통합 인증
- 🔍 키 사용량 쿼터 조회 ([neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool) 사용)

### 🚀 고급 기능

**API 포맷 지원:**
- ⚡ [OpenAI Responses](https://docs.newapi.pro/kr/docs/api/ai-model/chat/openai/create-response)
- ⚡ [OpenAI Realtime API](https://docs.newapi.pro/kr/docs/api/ai-model/realtime/create-realtime-session) (Azure 포함)
- ⚡ [Claude Messages](https://docs.newapi.pro/kr/docs/api/ai-model/chat/create-message)
- ⚡ [Google Gemini](https://doc.newapi.pro/kr/api/google-gemini-chat)
- 🔄 [Rerank 모델](https://docs.newapi.pro/kr/docs/api/ai-model/rerank/create-rerank) (Cohere, Jina)

**지능형 라우팅:**
- ⚖️ 채널 가중치 랜덤
- 🔄 실패 시 자동 재시도
- 🚦 사용자 수준 모델 속도 제한

**포맷 변환:**
- 🔄 **OpenAI Compatible ⇄ Claude Messages**
- 🔄 **OpenAI Compatible → Google Gemini**
- 🔄 **Google Gemini → OpenAI Compatible** - 텍스트만 지원, 함수 호출은 아직 미지원
- 🚧 **OpenAI Compatible ⇄ OpenAI Responses** - 개발 중
- 🔄 **사고-콘텐츠 변환 기능**

**Reasoning Effort 지원:**

<details>
<summary>상세 설정 보기</summary>

**OpenAI 시리즈 모델:**
- `o3-mini-high` - 높은 추론 강도
- `o3-mini-medium` - 중간 추론 강도
- `o3-mini-low` - 낮은 추론 강도
- `gpt-5-high` - 높은 추론 강도
- `gpt-5-medium` - 중간 추론 강도
- `gpt-5-low` - 낮은 추론 강도

**Claude 사고 모델:**
- `claude-3-7-sonnet-20250219-thinking` - 사고 모드 활성화

**Google Gemini 시리즈 모델:**
- `gemini-2.5-flash-thinking` - 사고 모드 활성화
- `gemini-2.5-flash-nothinking` - 사고 모드 비활성화
- `gemini-2.5-pro-thinking` - 사고 모드 활성화
- `gemini-2.5-pro-thinking-128` - 사고 모드 활성화, 사고 예산 128 토큰
- Gemini 모델 이름 끝에 `-low` / `-medium` / `-high`를 추가하여 추론 강도를 직접 지정할 수 있습니다 (추가 사고 예산 접미사 불필요).

</details>

---

## 🤖 모델 지원

> 자세한 내용은 [API 문서 - 릴레이 인터페이스](https://docs.newapi.pro/kr/docs/api) 참조

| 모델 타입 | 설명 | 문서 |
|---------|------|------|
| 🤖 OpenAI-Compatible | OpenAI 호환 모델 | [문서](https://docs.newapi.pro/kr/docs/api/ai-model/chat/openai/createchatcompletion) |
| 🤖 OpenAI Responses | OpenAI Responses 포맷 | [문서](https://docs.newapi.pro/kr/docs/api/ai-model/chat/openai/createresponse) |
| 🎨 Midjourney-Proxy | [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy) | [문서](https://doc.newapi.pro/api/midjourney-proxy-image) |
| 🎵 Suno-API | [Suno API](https://github.com/Suno-API/Suno-API) | [문서](https://doc.newapi.pro/api/suno-music) |
| 🔄 Rerank | Cohere, Jina | [문서](https://docs.newapi.pro/kr/docs/api/ai-model/rerank/creatererank) |
| 💬 Claude | Messages 포맷 | [문서](https://docs.newapi.pro/kr/docs/api/ai-model/chat/createmessage) |
| 🌐 Gemini | Google Gemini 포맷 | [문서](https://docs.newapi.pro/kr/docs/api/ai-model/chat/gemini/geminirelayv1beta) |
| 🔧 Dify | ChatFlow 모드 | - |
| 🎯 커스텀 | 완전한 호출 주소 입력 지원 | - |

### 📡 지원 인터페이스

<details>
<summary>전체 인터페이스 목록 보기</summary>

- [채팅 인터페이스 (Chat Completions)](https://docs.newapi.pro/kr/docs/api/ai-model/chat/openai/createchatcompletion)
- [응답 인터페이스 (Responses)](https://docs.newapi.pro/kr/docs/api/ai-model/chat/openai/createresponse)
- [이미지 인터페이스 (Image)](https://docs.newapi.pro/kr/docs/api/ai-model/images/openai/post-v1-images-generations)
- [오디오 인터페이스 (Audio)](https://docs.newapi.pro/kr/docs/api/ai-model/audio/openai/create-transcription)
- [비디오 인터페이스 (Video)](https://docs.newapi.pro/kr/docs/api/ai-model/videos)
- [임베딩 인터페이스 (Embeddings)](https://docs.newapi.pro/kr/docs/api/ai-model/embeddings/createembedding)
- [재순위 인터페이스 (Rerank)](https://docs.newapi.pro/kr/docs/api/ai-model/rerank/creatererank)
- [실시간 대화 인터페이스 (Realtime)](https://docs.newapi.pro/kr/docs/api/ai-model/realtime/createrealtimesession)
- [Claude 채팅](https://docs.newapi.pro/kr/docs/api/ai-model/chat/createmessage)
- [Google Gemini 채팅](https://docs.newapi.pro/kr/docs/api/ai-model/chat/gemini/geminirelayv1beta)

</details>

---

## 🚢 배포

> [!TIP]
> **최신 Docker 이미지:** `calciumion/new-api:latest`

### 📋 배포 요구사항

| 구성 요소 | 요구사항 |
|------|------|
| **로컬 데이터베이스** | SQLite (Docker는 `/data` 디렉토리 마운트 필수)|
| **원격 데이터베이스** | MySQL ≥ 5.7.8 또는 PostgreSQL ≥ 9.6 |
| **컨테이너 엔진** | Docker / Docker Compose |

### ⚙️ 환경 변수 설정

<details>
<summary>일반적인 환경 변수 설정</summary>

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `SESSION_SECRET` | 세션 시크릿 (다중 머신 배포 시 필수) | - |
| `CRYPTO_SECRET` | 암호화 시크릿 (Redis 사용 시 필수) | - |
| `SQL_DSN` | 데이터베이스 연결 문자열 | - |
| `REDIS_CONN_STRING` | Redis 연결 문자열 | - |
| `STREAMING_TIMEOUT` | 스트리밍 응답 타임아웃 (초) | `300` |
| `STREAM_SCANNER_MAX_BUFFER_MB` | 스트림 스캐너의 라인당 버퍼 상한 (MB). 4K 이미지 등 큰 base64 페이로드 처리 시 증가 권장 | `64` |
| `MAX_REQUEST_BODY_MB` | 요청 본문 최대 크기 (MB, **압축 해제 후** 측정. 대용량 요청/zip bomb으로 인한 메모리 고갈 방지). 초과 시 `413` 반환 | `32` |
| `AZURE_DEFAULT_API_VERSION` | Azure API 버전 | `2025-04-01-preview` |
| `ERROR_LOG_ENABLED` | 에러 로그 스위치 | `false` |
| `PYROSCOPE_URL` | Pyroscope 서버 주소 | - |
| `PYROSCOPE_APP_NAME` | Pyroscope 앱 이름 | `new-api` |
| `PYROSCOPE_BASIC_AUTH_USER` | Pyroscope Basic Auth 사용자 | - |
| `PYROSCOPE_BASIC_AUTH_PASSWORD` | Pyroscope Basic Auth 비밀번호 | - |
| `PYROSCOPE_MUTEX_RATE` | Pyroscope mutex 샘플링 비율 | `5` |
| `PYROSCOPE_BLOCK_RATE` | Pyroscope block 샘플링 비율 | `5` |
| `HOSTNAME` | Pyroscope용 호스트명 태그 | `new-api` |

📖 **전체 설정:** [환경 변수 문서](https://docs.newapi.pro/kr/docs/installation/config-maintenance/environment-variables)

</details>

### 🔧 배포 방법

<details>
<summary><strong>방법 1: Docker Compose (권장)</strong></summary>

```bash
# 프로젝트 클론
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# 설정 편집
nano docker-compose.yml

# 서비스 시작
docker-compose up -d
```

</details>

<details>
<summary><strong>방법 2: Docker 명령어</strong></summary>

**SQLite 사용:**
```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

**MySQL 사용:**
```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

> **💡 경로 설명:**
> - `./data:/data` - 상대 경로, 데이터는 현재 디렉토리의 data 폴더에 저장됨
> - 절대 경로 사용 가능: `/your/custom/path:/data`

</details>

<details>
<summary><strong>방법 3: 바오따 패널</strong></summary>

1. 바오따 패널(**9.2.0 버전** 이상) 설치 후, 애플리케이션 스토어에서 **New-API** 검색하여 설치

📖 [이미지 포함 튜토리얼](./docs/BT.md)

</details>

### ⚠️ 다중 머신 배포 주의사항

> [!WARNING]
> - **반드시 설정 필요** `SESSION_SECRET` - 그렇지 않으면 다중 머신 배포 시 로그인 상태 불일치 발생
> - **공유 Redis는 반드시 설정 필요** `CRYPTO_SECRET` - 그렇지 않으면 데이터 복호화 불가

### 🔄 채널 재시도 및 캐시

**재시도 설정:** `설정 → 운영 설정 → 일반 설정 → 실패 재시도 횟수`

**캐시 설정:**
- `REDIS_CONN_STRING`: Redis 캐시 (권장)
- `MEMORY_CACHE_ENABLED`: 메모리 캐시

---

## 🔗 관련 프로젝트

### 업스트림 프로젝트

| 프로젝트 | 설명 |
|------|------|
| [One API](https://github.com/songquanpeng/one-api) | 원본 프로젝트 베이스 |
| [Midjourney-Proxy](https://github.com/novicezk/midjourney-proxy) | Midjourney 인터페이스 지원 |

### 보조 도구

| 프로젝트 | 설명 |
|------|------|
| [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool) | 키 사용량 쿼터 조회 도구 |
| [new-api-horizon](https://github.com/Calcium-Ion/new-api-horizon) | New API 고성능 최적화 버전 |

---

## 💬 도움말 및 지원

### 📖 문서 리소스

| 리소스 | 링크 |
|------|------|
| 📘 자주 묻는 질문 | [FAQ](https://docs.newapi.pro/kr/docs/support/faq) |
| 💬 커뮤니티 | [소통 채널](https://docs.newapi.pro/kr/docs/support/community-interaction) |
| 🐛 문제 피드백 | [이슈 피드백](https://docs.newapi.pro/kr/docs/support/feedback-issues) |
| 📚 전체 문서 | [공식 문서](https://docs.newapi.pro/kr/docs) |

### 🤝 기여 가이드

모든 형태의 기여를 환영합니다!

- 🐛 버그 리포트
- 💡 새로운 기능 제안
- 📝 문서 개선
- 🔧 코드 제출

---

## 📜 라이선스

본 프로젝트는 [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE) 라이선스 하에 배포됩니다.

본 프로젝트는 [One API](https://github.com/songquanpeng/one-api) (MIT 라이선스)를 기반으로 개발된 오픈소스 프로젝트입니다.

귀하의 조직 정책상 AGPLv3 라이선스 소프트웨어 사용이 허용되지 않거나, AGPLv3의 오픈소스 의무를 회피하고 싶은 경우 문의해 주세요: [support@quantumnous.com](mailto:support@quantumnous.com)

---

## 🌟 스타 히스토리

<div align="center">

[![스타 히스토리 차트](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)

</div>

---

<div align="center">

### 💖 New API를 사용해 주셔서 감사합니다

이 프로젝트가 도움이 되셨다면 ⭐️ 스타를 눌러주세요!

**[공식 문서](https://docs.newapi.pro/kr/docs)** • **[이슈 피드백](https://github.com/Calcium-Ion/new-api/issues)** • **[최신 릴리스](https://github.com/Calcium-Ion/new-api/releases)**

<sub>❤️로 제작된 QuantumNous</sub>

</div>
