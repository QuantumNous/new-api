[English](README.en.md) | Français | [中文](README.md)

<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 La nouvelle génération de passerelle pour grands modèles de langage et système de gestion d'actifs IA

<a href="https://trendshift.io/repositories/8227" target="_blank"><img src="https://trendshift.io/api/badge/repositories/8227" alt="Calcium-Ion%2Fnew-api | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

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
</div>

## 📝 Description du Projet

> [!NOTE]
> Ce projet est un projet open-source, développé sur la base de [One API](https://github.com/songquanpeng/one-api).

> [!IMPORTANT]
> - Ce projet est destiné à un usage personnel et d'apprentissage uniquement, sa stabilité n'est pas garantie et aucun support technique n'est fourni.
> - Les utilisateurs doivent se conformer aux [conditions d'utilisation](https://openai.com/policies/terms-of-use) d'OpenAI ainsi qu'aux **lois et réglementations** en vigueur, et ne doivent pas l'utiliser à des fins illégales.
> - Conformément aux exigences du [《Règlement provisoire sur la gestion des services d'intelligence artificielle générative》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm), veuillez ne pas fournir de services d'intelligence artificielle générative non enregistrés au public dans la région de la Chine.

## 🤝 Nos partenaires de confiance

<p id="premium-sponsors">&nbsp;</p>
<p align="center"><strong>Le classement est aléatoire</strong></p>
<p align="center">
  <a href="https://www.cherry-ai.com/" target=_blank><img
    src="./docs/images/cherry-studio.png" alt="Cherry Studio" height="120"
  /></a>
  <a href="https://bda.pku.edu.cn/" target=_blank><img
    src="./docs/images/pku.png" alt="Université de Pékin" height="120"
  /></a>
  <a href="https://www.compshare.cn/?ytag=GPU_yy_gh_newapi" target=_blank><img
    src="./docs/images/ucloud.png" alt="UCloud" height="120"
  /></a>
  <a href="https://www.aliyun.com/" target=_blank><img
    src="./docs/images/aliyun.png" alt="Alibaba Cloud" height="120"
  /></a>
  <a href="https://io.net/" target=_blank><img
    src="./docs/images/io-net.png" alt="IO.NET" height="120"
  /></a>
</p>
<p>&nbsp;</p>

## 📚 Documentation

Pour une documentation détaillée, veuillez visiter notre Wiki officiel : [https://docs.newapi.pro/](https://docs.newapi.pro/)

Vous pouvez également visiter le DeepWiki généré par l'IA :
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QuantumNous/new-api)

## ✨ Fonctionnalités Principales

New API offre une multitude de fonctionnalités. Pour plus de détails, veuillez consulter la [description des fonctionnalités](https://docs.newapi.pro/wiki/features-introduction) :

1.  🎨 Nouvelle interface utilisateur
2.  🌍 Prise en charge multilingue
3.  💰 Prise en charge de la recharge en ligne (Easy Pay)
4.  🔍 Prise en charge de la requête du quota d'utilisation par clé (avec [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool))
5.  🔄 Compatibilité avec la base de données de la version originale de One API
6.  💵 Prise en charge de la facturation par modèle et par utilisation
7.  ⚖️ Prise en charge de la pondération aléatoire des canaux
8.  📈 Tableau de bord des données (console)
9.  🔒 Groupement de jetons, limitation des modèles
10. 🤖 Prise en charge de plus de méthodes de connexion autorisées (LinuxDO, Telegram, OIDC)
11. 🔄 Prise en charge des modèles Rerank (Cohere et Jina), [documentation de l'API](https://docs.newapi.pro/api/jinaai-rerank)
12. ⚡ Prise en charge de l'API OpenAI Realtime (y compris le canal Azure), [documentation de l'API](https://docs.newapi.pro/api/openai-realtime)
13. ⚡ Prise en charge du format Claude Messages, [documentation de l'API](https://docs.newapi.pro/api/anthropic-chat)
14. Prise en charge de l'accès à l'interface de discussion via la route /chat2link
15. 🧠 Prise en charge de la configuration de l'effort de raisonnement via le suffixe du nom du modèle :
    1.  Modèles de la série o d'OpenAI
        -   Ajoutez le suffixe `-high` pour définir un effort de raisonnement élevé (par exemple : `o3-mini-high`)
        -   Ajoutez le suffixe `-medium` pour définir un effort de raisonnement moyen (par exemple : `o3-mini-medium`)
        -   Ajoutez le suffixe `-low` pour définir un effort de raisonnement faible (par exemple : `o3-mini-low`)
    2.  Modèles de pensée Claude
        -   Ajoutez le suffixe `-thinking` pour activer le mode de pensée (par exemple : `claude-3-7-sonnet-20250219-thinking`)
16. 🔄 Fonction de conversion de la pensée en contenu
17. 🔄 Fonction de limitation du débit des modèles pour les utilisateurs
18. 🔄 Fonction de conversion du format de requête, prenant en charge les trois conversions suivantes :
    1.  OpenAI Chat Completions => Claude Messages
    2.  Claude Messages => OpenAI Chat Completions (peut être utilisé pour que Claude Code appelle des modèles tiers)
    3.  OpenAI Chat Completions => Gemini Chat
19. 💰 Prise en charge de la facturation du cache, qui peut être facturée à un taux défini lorsque le cache est atteint :
    1.  Définissez l'option `Ratio de cache de l'invite` dans `Paramètres système - Paramètres d'exploitation`
    2.  Définissez le `Ratio de cache de l'invite` dans le canal, plage de 0 à 1, par exemple, 0,5 signifie une facturation à 50 % lorsque le cache est atteint
    3.  Canaux pris en charge :
        -   [x] OpenAI
        -   [x] Azure
        -   [x] DeepSeek
        -   [x] Claude

## Prise en Charge des Modèles

Cette version prend en charge une variété de modèles. Pour plus de détails, veuillez consulter la [documentation de l'API - Interface de relais](https://docs.newapi.pro/api) :

1.  Modèle tiers **gpts** (gpt-4-gizmo-*)
2.  Interface du canal tiers [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy), [documentation de l'API](https://docs.newapi.pro/api/midjourney-proxy-image)
3.  Interface du canal tiers [Suno API](https://github.com/Suno-API/Suno-API), [documentation de l'API](https://docs.newapi.pro/api/suno-music)
4.  Canal personnalisé, prenant en charge l'adresse d'appel complète
5.  Modèles Rerank ([Cohere](https://cohere.ai/) et [Jina](https://jina.ai/)), [documentation de l'API](https://docs.newapi.pro/api/jinaai-rerank)
6.  Format Claude Messages, [documentation de l'API](https://docs.newapi.pro/api/anthropic-chat)
7.  Dify, ne prend actuellement en charge que chatflow

## Configuration des Variables d'Environnement

Pour des instructions de configuration détaillées, veuillez consulter le [Guide d'installation - Configuration des variables d'environnement](https://docs.newapi.pro/installation/environment-variables) :

-   `GENERATE_DEFAULT_TOKEN` : S'il faut générer un jeton initial pour les nouveaux utilisateurs enregistrés, la valeur par défaut est `false`
-   `STREAMING_TIMEOUT` : Délai d'attente pour la réponse en streaming, par défaut 300 secondes
-   `DIFY_DEBUG` : Si le canal Dify doit afficher les informations sur le flux de travail et les nœuds, la valeur par défaut est `true`
-   `FORCE_STREAM_OPTION` : S'il faut remplacer le paramètre stream_options du client, la valeur par défaut est `true`
-   `GET_MEDIA_TOKEN` : S'il faut compter les jetons d'image, la valeur par défaut est `true`
-   `GET_MEDIA_TOKEN_NOT_STREAM` : S'il faut compter les jetons d'image en mode non-streaming, la valeur par défaut est `true`
-   `UPDATE_TASK` : S'il faut mettre à jour les tâches asynchrones (Midjourney, Suno), la valeur par défaut est `true`
-   `COHERE_SAFETY_SETTING` : Paramètre de sécurité du modèle Cohere, les valeurs possibles sont `NONE`, `CONTEXTUAL`, `STRICT`, la valeur par défaut est `NONE`
-   `GEMINI_VISION_MAX_IMAGE_NUM` : Nombre maximum d'images pour le modèle Gemini, la valeur par défaut est `16`
-   `MAX_FILE_DOWNLOAD_MB` : Taille maximale de téléchargement de fichier, en Mo, la valeur par défaut est `20`
-   `CRYPTO_SECRET` : Clé de chiffrement, utilisée pour chiffrer le contenu de la base de données
-   `AZURE_DEFAULT_API_VERSION` : Version de l'API par défaut pour le canal Azure, la valeur par défaut est `2025-04-01-preview`
-   `NOTIFICATION_LIMIT_DURATION_MINUTE` : Durée de la limitation des notifications, par défaut `10` minutes
-   `NOTIFY_LIMIT_COUNT` : Nombre maximum de notifications utilisateur dans la durée spécifiée, la valeur par défaut est `2`
-   `ERROR_LOG_ENABLED=true` : S'il faut enregistrer et afficher les journaux d'erreurs, la valeur par défaut est `false`

## Déploiement

Pour un guide de déploiement détaillé, veuillez consulter le [Guide d'installation - Méthodes de déploiement](https://docs.newapi.pro/installation) :

> [!TIP]
> Dernière image Docker : `calciumion/new-api:latest`

### Remarques sur le déploiement multi-machines
-   Vous devez définir la variable d'environnement `SESSION_SECRET`, sinon cela entraînera un état de connexion incohérent lors du déploiement multi-machines
-   Si vous utilisez un Redis partagé, vous devez définir `CRYPTO_SECRET`, sinon cela entraînera une incapacité à récupérer le contenu de Redis lors du déploiement multi-machines

### Exigences de Déploiement
-   Base de données locale (par défaut) : SQLite (le déploiement Docker doit monter le répertoire `/data`)
-   Base de données distante : MySQL version >= 5.7.8, PgSQL version >= 9.6

### Méthodes de Déploiement

#### Déploiement avec la fonction Docker du panneau Baota
Installez le panneau Baota (**version 9.2.0** et supérieure), trouvez **New-API** dans l'App Store et installez-le.
[Tutoriel illustré](./docs/BT.md)

#### Déploiement avec Docker Compose (recommandé)
```shell
# Cloner le projet
git clone https://github.com/Calcium-Ion/new-api.git
cd new-api
# Modifier docker-compose.yml selon les besoins
# Démarrer
docker-compose up -d
```

#### Utilisation directe de l'image Docker
```shell
# Utilisation de SQLite
docker run --name new-api -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/new-api:/data calciumion/new-api:latest

# Utilisation de MySQL
docker run --name new-api -d --restart always -p 3000:3000 -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" -e TZ=Asia/Shanghai -v /home/ubuntu/data/new-api:/data calciumion/new-api:latest
```

## Nouvelle Tentative de Canal et Cache
La fonction de nouvelle tentative de canal a été implémentée, vous pouvez définir le nombre de tentatives dans `Paramètres -> Paramètres d'exploitation -> Paramètres généraux`, **il est recommandé d'activer la fonction de cache**.

### Méthode de Configuration du Cache
1.  `REDIS_CONN_STRING` : Définir Redis comme cache
2.  `MEMORY_CACHE_ENABLED` : Activer le cache mémoire (pas besoin de le définir manuellement si Redis est défini)

## Documentation de l'API

Pour une documentation détaillée de l'API, veuillez consulter la [Documentation de l'API](https://docs.newapi.pro/api) :

-   [Interface de discussion (Chat)](https://docs.newapi.pro/api/openai-chat)
-   [Interface d'image (Image)](https://docs.newapi.pro/api/openai-image)
-   [Interface de reclassement (Rerank)](https://docs.newapi.pro/api/jinaai-rerank)
-   [Interface de dialogue en temps réel (Realtime)](https://docs.newapi.pro/api/openai-realtime)
-   [Interface de discussion Claude (messages)](https://docs.newapi.pro/api/anthropic-chat)

## Projets Connexes
-   [One API](https://github.com/songquanpeng/one-api) : Projet original
-   [Midjourney-Proxy](https://github.com/novicezk/midjourney-proxy) : Prise en charge de l'interface Midjourney
-   [chatnio](https://github.com/Deeptrain-Community/chatnio) : Solution B/C de nouvelle génération pour l'IA
-   [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool) : Interroger le quota d'utilisation par clé

Autres projets basés sur New API :
-   [new-api-horizon](https://github.com/Calcium-Ion/new-api-horizon) : Version optimisée haute performance de New API

## Aide et Support

Si vous avez des questions, veuillez consulter la section [Aide et Support](https://docs.newapi.pro/support) :
-   [Communauté](https://docs.newapi.pro/support/community-interaction)
-   [Signaler un problème](https://docs.newapi.pro/support/feedback-issues)
-   [FAQ](https://docs.newapi.pro/support/faq)

## 🌟 Historique des Étoiles

[![Graphique de l'historique des étoiles](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)
