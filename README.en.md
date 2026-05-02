<div align="center">

# AIKanHub

**A video generation API platform for developers. One key, all major models.**

[中文](./README.md) · [License](./LICENSE) · [Acknowledgments](./NOTICE.md)

</div>

---

## What is this

AIKanHub is an API gateway that aggregates video generation models. Developers use a single key and interface to call Seedance, Pixverse, and other mainstream video models — no need to onboard each upstream, manage keys, or reconcile bills separately.

## Current Support

| Model | Status |
|---|---|
| ByteDance Seedance 2.0 / 2.0 fast | ✅ Supported (text-to-video, image-to-video, first/last frame, multimodal reference, audio) |
| Pixverse v5.5 | 🚧 Placeholder, planned |
| More video models | On demand |

## Quick Start (local)

Requires Docker and a Neon Postgres instance ([free tier works](https://console.neon.tech)).

```bash
# 1. Clone
git clone git@github.com:NekoAIKan/aikanhub.git
cd aikanhub

# 2. Configure env
cp .env.local.example .env.local
# Edit .env.local, paste Neon direct connection string

# 3. Start (first build takes ~5-10 min)
docker compose -f docker-compose.local.yml --env-file .env.local up -d

# 4. Open
open http://localhost:3000
```

## License

[AGPL-3.0](./LICENSE). If you run AIKanHub as a network service, you must offer your users access to the complete source (including modifications). For closed-source commercial use, contact upstream [QuantumNous](mailto:support@quantumnous.com).

## Acknowledgments

AIKanHub is forked from [Calcium-Ion/new-api](https://github.com/Calcium-Ion/new-api). See [NOTICE.md](./NOTICE.md) for details.
