<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 **Passerelle de modèles étendus de nouvelle génération et système de gestion d'actifs d'IA**

<p align="center">
  <a href="./README.zh.md">中文</a> | 
  <a href="./README.md">English</a> | 
  <strong>Français</strong> | 
  <a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/Calcium-Ion/new-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/Calcium-Ion/new-api?color=brightgreen" alt="licence">
  </a>
  <a href="https://github.com/Calcium-Ion/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/Calcium-Ion/new-api?color=brightgreen&include_prereleases" alt="version">
  </a>
  <a href="https://github.com/users/Calcium-Ion/packages/container/package/new-api">
    <img src="https://img.shields.io/badge/docker-ghcr.io-blue" alt="docker">
  </a>
  <a href="https://hub.docker.com/r/CalciumIon/new-api">
    <img src="https://img.shields.io/badge/docker-dockerHub-blue" alt="docker">
  </a>
  <a href="https://goreportcard.com/report/github.com/Calcium-Ion/new-api">
    <img src="https://goreportcard.com/badge/github.com/Calcium-Ion/new-api" alt="GoReportCard">
  </a>
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/8227" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/8227" alt="Calcium-Ion%2Fnew-api | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/>
  </a>
  <br>
  <a href="https://hellogithub.com/repository/QuantumNous/new-api" target="_blank">
    <img src="https://api.hellogithub.com/v1/widgets/recommend.svg?rid=539ac4217e69431684ad4a0bab768811&claim_uid=tbFPfKIDHpc4TzR" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54" />
  </a>
  <a href="https://www.producthunt.com/products/new-api/launches/new-api?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-new-api" target="_blank" rel="noopener noreferrer">
    <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1047693&theme=light&t=1769577875005" alt="New API - All-in-one AI asset management gateway. | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" />
  </a>
</p>

<p align="center">
  <a href="#-démarrage-rapide">Démarrage rapide</a> •
  <a href="#-fonctionnalités-clés">Fonctionnalités clés</a> •
  <a href="#-déploiement">Déploiement</a> •
  <a href="#-documentation">Documentation</a> •
  <a href="#-aide-support">Aide</a>
</p>

</div>

## 📝 Description du projet

> [!NOTE]  
> Il s'agit d'un projet open-source développé sur la base de [One API](https://github.com/songquanpeng/one-api)

> [!IMPORTANT]  
> - Ce projet est uniquement destiné à des fins d'apprentissage personnel, sans garantie de stabilité ni de support technique.
> - Les utilisateurs doivent se conformer aux [Conditions d'utilisation](https://openai.com/policies/terms-of-use) d'OpenAI et aux **lois et réglementations applicables**, et ne doivent pas l'utiliser à des fins illégales.
> - Conformément aux [《Mesures provisoires pour la gestion des services d'intelligence artificielle générative》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm), veuillez ne fournir aucun service d'IA générative non enregistré au public en Chine.

---

## 🤝 Partenaires de confiance

<p align="center">
  <em>Sans ordre particulier</em>
</p>

<p align="center">
  <a href="https://www.cherry-ai.com/" target="_blank">
    <img src="./docs/images/cherry-studio.png" alt="Cherry Studio" height="80" />
  </a>
  <a href="https://bda.pku.edu.cn/" target="_blank">
    <img src="./docs/images/pku.png" alt="Université de Pékin" height="80" />
  </a>
  <a href="https://www.compshare.cn/?ytag=GPU_yy_gh_newapi" target="_blank">
    <img src="./docs/images/ucloud.png" alt="UCloud" height="80" />
  </a>
  <a href="https://www.aliyun.com/" target="_blank">
    <img src="./docs/images/aliyun.png" alt="Alibaba Cloud" height="80" />
  </a>
  <a href="https://io.net/" target="_blank">
    <img src="./docs/images/io-net.png" alt="IO.NET" height="80" />
  </a>
</p>

---

## 🙏 Remerciements spéciaux

<p align="center">
  <a href="https://www.jetbrains.com/?from=new-api" target="_blank">
    <img src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.png" alt="JetBrains Logo" width="120" />
  </a>
</p>

<p align="center">
  <strong>Merci à <a href="https://www.jetbrains.com/?from=new-api">JetBrains</a> pour avoir fourni une licence de développement open-source gratuite pour ce projet</strong>
</p>

---

## 🚀 Démarrage rapide

### Utilisation de Docker Compose (recommandé)

```bash
# Cloner le projet
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# Modifier la configuration docker-compose.yml
nano docker-compose.yml

# Démarrer le service
docker-compose up -d
```

<details>
<summary><strong>Utilisation des commandes Docker</strong></summary>

```bash
# Tirer la dernière image
docker pull calciumion/new-api:latest

# Utilisation de SQLite (par défaut)
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest

# Utilisation de MySQL
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

> **💡 Astuce:** `-v ./data:/data` sauvegardera les données dans le dossier `data` du répertoire actuel, vous pouvez également le changer en chemin absolu comme `-v /your/custom/path:/data`

</details>

---

🎉 Après le déploiement, visitez `http://localhost:3000` pour commencer à utiliser!

📖 Pour plus de méthodes de déploiement, veuillez vous référer à [Guide de déploiement](https://docs.newapi.pro/en/docs/installation)

---

## 📚 Documentation

<div align="center">

### 📖 [Documentation officielle](https://docs.newapi.pro/en/docs) | [![Demander à DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QuantumNous/new-api)

</div>

**Navigation rapide:**

| Catégorie | Lien |
|------|------|
| 🚀 Guide de déploiement | [Documentation d'installation](https://docs.newapi.pro/en/docs/installation) |
| ⚙️ Configuration de l'environnement | [Variables d'environnement](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables) |
| 📡 Documentation de l'API | [Documentation de l'API](https://docs.newapi.pro/en/docs/api) |
| ❓ FAQ | [FAQ](https://docs.newapi.pro/en/docs/support/faq) |
| 💬 Interaction avec la communauté | [Canaux de communication](https://docs.newapi.pro/en/docs/support/community-interaction) |

---

## ✨ Fonctionnalités clés

> Pour les fonctionnalités détaillées, veuillez vous référer à [Présentation des fonctionnalités](https://docs.newapi.pro/en/docs/guide/wiki/basic-concepts/features-introduction) |

### 🎨 Fonctions principales

| Fonctionnalité | Description |
|------|------|
| 🎨 Nouvelle interface utilisateur | Conception d'interface utilisateur moderne |
| 🌍 Multilingue | Prend en charge le chinois, l'anglais, le français, le japonais |
| 🔄 Compatibilité des données | Complètement compatible avec la base de données originale de One API |
| 📈 Tableau de bord des données | Console visuelle et analyse statistique |
| 🔒 Gestion des permissions | Regroupement de jetons, restrictions de modèles, gestion des utilisateurs |

### 💰 Paiement et facturation

- ✅ Recharge en ligne (EPay, Stripe)
- ✅ Tarification des modèles de paiement à l'utilisation
- ✅ Prise en charge de la facturation du cache (OpenAI, Azure, DeepSeek, Claude, Qwen et tous les modèles pris en charge)
- ✅ Configuration flexible des politiques de facturation

### 🔐 Autorisation et sécurité

- 😈 Connexion par autorisation Discord
- 🤖 Connexion par autorisation LinuxDO
- 📱 Connexion par autorisation Telegram
- 🔑 Authentification unifiée OIDC
- 🔍 Requête de quota d'utilisation de clé (avec [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool))

### 🚀 Fonctionnalités avancées

**Prise en charge des formats d'API:**
- ⚡ [OpenAI Responses](https://docs.newapi.pro/en/docs/api/ai-model/chat/openai/create-response)
- ⚡ [OpenAI Realtime API](https://docs.newapi.pro/en/docs/api/ai-model/realtime/create-realtime-session) (y compris Azure)
- ⚡ [Claude Messages](https://docs.newapi.pro/en/docs/api/ai-model/chat/create-message)
- ⚡ [Google Gemini](https://doc.newapi.pro/en/api/google-gemini-chat)
- 🔄 [Modèles Rerank](https://docs.newapi.pro/en/docs/api/ai-model/rerank/create-rerank) (Cohere, Jina)

**Routage intelligent:**
- ⚖️ Sélection aléatoire pondérée des canaux
- 🔄 Nouvelle tentative automatique en cas d'échec
- 🚦 Limitation du débit du modèle pour les utilisateurs

**Conversion de format:**
- 🔄 **OpenAI Compatible ⇄ Claude Messages**
- 🔄 **OpenAI Compatible → Google Gemini**
- 🔄 **Google Gemini → OpenAI Compatible** - Texte uniquement, les appels de fonction ne sont pas encore pris en charge
- 🚧 **OpenAI Compatible ⇄ OpenAI Responses** - En développement
- 🔄 **Fonctionnalité de la pensée au contenu**

**Prise en charge de l'effort de raisonnement:**

<details>
<summary>Voir la configuration détaillée</summary>

**Modèles de la série OpenAI :**
- `o3-mini-high` - Effort de raisonnement élevé
- `o3-mini-medium` - Effort de raisonnement moyen
- `o3-mini-low` - Effort de raisonnement faible
- `gpt-5-high` - Effort de raisonnement élevé
- `gpt-5-medium` - Effort de raisonnement moyen
- `gpt-5-low` - Effort de raisonnement faible

**Modèles de pensée de Claude:**
- `claude-3-7-sonnet-20250219-thinking` - Activer le mode de pensée

**Modèles de la série Google Gemini:**
- `gemini-2.5-flash-thinking` - Activer le mode de pensée
- `gemini-2.5-flash-nothinking` - Désactiver le mode de pensée
- `gemini-2.5-pro-thinking` - Activer le mode de pensée
- `gemini-2.5-pro-thinking-128` - Activer le mode de pensée avec budget de pensée de 128 tokens
- Vous pouvez également ajouter les suffixes `-low`, `-medium` ou `-high` aux modèles Gemini pour fixer le niveau d’effort de raisonnement (sans suffixe de budget supplémentaire).

</details>

---

## 🤖 Prise en charge des modèles

> Pour les détails, veuillez vous référer à [Documentation de l'API - Interface de relais](https://docs.newapi.pro/en/docs/api)

| Type de modèle | Description | Documentation |
|---------|------|------|
| 🤖 OpenAI-Compatible | Modèles compatibles OpenAI | [Documentation](https://docs.newapi.pro/en/docs/api/ai-model/chat/openai/createchatcompletion) |
| 🤖 OpenAI Responses | Format OpenAI Responses | [Documentation](https://docs.newapi.pro/en/docs/api/ai-model/chat/openai/createresponse) |
| 🎨 Midjourney-Proxy | [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy) | [Documentation](https://doc.newapi.pro/api/midjourney-proxy-image) |
| 🎵 Suno-API | [Suno API](https://github.com/Suno-API/Suno-API) | [Documentation](https://doc.newapi.pro/api/suno-music) |
| 🔄 Rerank | Cohere, Jina | [Documentation](https://docs.newapi.pro/en/docs/api/ai-model/rerank/creatererank) |
| 💬 Claude | Format Messages | [Documentation](https://docs.newapi.pro/en/docs/api/ai-model/chat/createmessage) |
| 🌐 Gemini | Format Google Gemini | [Documentation](https://docs.newapi.pro/en/docs/api/ai-model/chat/gemini/geminirelayv1beta) |
| 🔧 Dify | Mode ChatFlow | - |
| 🎯 Personnalisé | Prise en charge de l'adresse d'appel complète | - |

### 📡 Interfaces prises en charge

<details>
<summary>Voir la liste complète des interfaces</summary>

- [Interface de discussion (Chat Completions)](https://docs.newapi.pro/en/docs/api/ai-model/chat/openai/createchatcompletion)
- [Interface de réponse (Responses)](https://docs.newapi.pro/en/docs/api/ai-model/chat/openai/createresponse)
- [Interface d'image (Image)](https://docs.newapi.pro/en/docs/api/ai-model/images/openai/post-v1-images-generations)
- [Interface audio (Audio)](https://docs.newapi.pro/en/docs/api/ai-model/audio/openai/create-transcription)
- [Interface vidéo (Video)](https://docs.newapi.pro/en/docs/api/ai-model/audio/openai/createspeech)
- [Interface d'incorporation (Embeddings)](https://docs.newapi.pro/en/docs/api/ai-model/embeddings/createembedding)
- [Interface de rerank (Rerank)](https://docs.newapi.pro/en/docs/api/ai-model/rerank/creatererank)
- [Conversation en temps réel (Realtime)](https://docs.newapi.pro/en/docs/api/ai-model/realtime/createrealtimesession)
- [Discussion Claude](https://docs.newapi.pro/en/docs/api/ai-model/chat/createmessage)
- [Discussion Google Gemini](https://docs.newapi.pro/en/docs/api/ai-model/chat/gemini/geminirelayv1beta)

</details>

---

## 🚢 Déploiement

> [!TIP]
> **Dernière image Docker:** `calciumion/new-api:latest`

### 📋 Exigences de déploiement

| Composant | Exigence |
|------|------|
| **Base de données locale** | SQLite (Docker doit monter le répertoire `/data`)|
| **Base de données distante | MySQL ≥ 5.7.8 ou PostgreSQL ≥ 9.6 |
| **Moteur de conteneur** | Docker / Docker Compose |

### ⚙️ Configuration des variables d'environnement

<details>
<summary>Configuration courante des variables d'environnement</summary>

| Nom de variable | Description | Valeur par défaut |
|--------|------|--------|
| `SESSION_SECRET` | Secret de session (requis pour le déploiement multi-machines) |
| `CRYPTO_SECRET` | Secret de chiffrement (requis pour Redis) | - |
| `SQL_DSN` | Chaine de connexion à la base de données | - |
| `REDIS_CONN_STRING` | Chaine de connexion Redis | - |
| `STREAMING_TIMEOUT` | Délai d'expiration du streaming (secondes) | `300` |
| `STREAM_SCANNER_MAX_BUFFER_MB` | Taille max du buffer par ligne (Mo) pour le scanner SSE ; à augmenter quand les sorties image/base64 sont très volumineuses (ex. images 4K) | `64` |
| `MAX_REQUEST_BODY_MB` | Taille maximale du corps de requête (Mo, comptée **après décompression** ; évite les requêtes énormes/zip bombs qui saturent la mémoire). Dépassement ⇒ `413` | `32` |
| `AZURE_DEFAULT_API_VERSION` | Version de l'API Azure | `2025-04-01-preview` |
| `ERROR_LOG_ENABLED` | Interrupteur du journal d'erreurs | `false` |
| `PYROSCOPE_URL` | Adresse du serveur Pyroscope | - |
| `PYROSCOPE_APP_NAME` | Nom de l'application Pyroscope | `new-api` |
| `PYROSCOPE_BASIC_AUTH_USER` | Utilisateur Basic Auth Pyroscope | - |
| `PYROSCOPE_BASIC_AUTH_PASSWORD` | Mot de passe Basic Auth Pyroscope | - |
| `PYROSCOPE_MUTEX_RATE` | Taux d'échantillonnage mutex Pyroscope | `5` |
| `PYROSCOPE_BLOCK_RATE` | Taux d'échantillonnage block Pyroscope | `5` |
| `HOSTNAME` | Nom d'hôte tagué pour Pyroscope | `new-api` |

📖 **Configuration complète:** [Documentation des variables d'environnement](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables)

</details>

### 🔧 Méthodes de déploiement

<details>
<summary><strong>Méthode 1: Docker Compose (recommandé)</strong></summary>

```bash
# Cloner le projet
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# Modifier la configuration
nano docker-compose.yml

# Démarrer le service
docker-compose up -d
```

</details>

<details>
<summary><strong>Méthode 2: Commandes Docker</strong></summary>

**Utilisation de SQLite:**
```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

**Utilisation de MySQL:**
```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

> **💡 Explication du chemin:** 
> - `./data:/data` - Chemin relatif, données sauvegardées dans le dossier data du répertoire actuel
> - Vous pouvez également utiliser un chemin absolu, par exemple : `/your/custom/path:/data`

</details>

<details>
<summary><strong>Méthode 3: Panneau BaoTa</strong></summary>

1. Installez le panneau BaoTa (version ≥ 9.2.0)
2. Recherchez **New-API** dans le magasin d'applications
3. Installation en un clic

📖 [Tutoriel avec des images](./docs/BT.md)

</details>

### ⚠️ Considérations sur le déploiement multi-machines

> [!WARNING]
> - **Doit définir** `SESSION_SECRET` - Sinon l'état de connexion sera incohérent sur plusieurs machines
> - **Redis partagé doit définir** `CRYPTO_SECRET` - Sinon les données ne pourront pas être déchiffrées

### 🔄 Nouvelle tentative de canal et cache

**Configuration de la nouvelle tentative:** `Paramètres → Paramètres de fonctionnement → Paramètres généraux → Nombre de tentatives en cas d'échec`

**Configuration du cache:**
- `REDIS_CONN_STRING`: Cache Redis (recommandé)
- `MEMORY_CACHE_ENABLED`: Cache mémoire

---

## 🔗 Projets connexes

### Projets en amont

| Projet | Description |
|------|------|
| [One API](https://github.com/songquanpeng/one-api) | Base du projet original |
| [Midjourney-Proxy](https://github.com/novicezk/midjourney-proxy) | Prise en charge de l'interface Midjourney |

### Outils d'accompagnement

| Projet | Description |
|------|------|
| [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool) | Outil de recherche de quota d'utilisation avec une clé |
| [new-api-horizon](https://github.com/Calcium-Ion/new-api-horizon) | Version optimisée haute performance de New API |

---

## 💬 Aide et support

### 📖 Ressources de documentation

| Ressource | Lien |
|------|------|
| 📘 FAQ | [FAQ](https://docs.newapi.pro/en/docs/support/faq) |
| 💬 Interaction avec la communauté | [Canaux de communication](https://docs.newapi.pro/en/docs/support/community-interaction) |
| 🐛 Commentaires sur les problèmes | [Commentaires sur les problèmes](https://docs.newapi.pro/en/docs/support/feedback-issues) |
| 📚 Documentation complète | [Documentation officielle](https://docs.newapi.pro/en/docs) |

### 🤝 Guide de contribution

Bienvenue à toutes les formes de contribution!

- 🐛 Signaler des bogues
- 💡 Proposer de nouvelles fonctionnalités
- 📝 Améliorer la documentation
- 🔧 Soumettre du code

---

## 📜 Licence

Ce projet est sous licence [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).

Si les politiques de votre organisation ne permettent pas l'utilisation de logiciels sous licence AGPLv3, ou si vous souhaitez éviter les obligations open-source de l'AGPLv3, veuillez nous contacter à : [support@quantumnous.com](mailto:support@quantumnous.com)

---

## 🌟 Historique des étoiles

<div align="center">

[![Graphique de l'historique des étoiles](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)

</div>

---

<div align="center">

### 💖 Merci d'utiliser New API

Si ce projet vous est utile, bienvenue à nous donner une ⭐️ Étoile！

**[Documentation officielle](https://docs.newapi.pro/en/docs)** • **[Commentaires sur les problèmes](https://github.com/Calcium-Ion/new-api/issues)** • **[Dernière version](https://github.com/Calcium-Ion/new-api/releases)**

<sub>Construit avec ❤️ par QuantumNous</sub>

</div>
