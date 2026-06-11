# Guide de Développement

<p align="center">
  <a href="./DEVELOPMENT.zh_CN.md">简体中文</a> |
  <a href="./DEVELOPMENT.zh_TW.md">繁體中文</a> |
  <a href="./DEVELOPMENT.md">English</a> |
  <strong>Français</strong> |
  <a href="./DEVELOPMENT.ja.md">日本語</a>
</p>

Ce document explique aux développeurs comment exécuter et développer le projet new-api localement.

## Prérequis

- **Go**: 1.22+ (le projet utilise 1.25.1)
- **Bun**: Gestionnaire de paquets frontend (préféré à npm/yarn)
- **Database**: SQLite (par défaut) / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6
- **Docker** (optionnel): Pour l'environnement de développement conteneurisé

## Démarrage Rapide

### Méthode 1: Développement Local (Recommandé)

> **Prérequis**: Puisque Go utilise `//go:embed` pour intégrer les fichiers frontend, vous devez compiler le frontend une fois avant le premier démarrage, sinon une erreur se produira.

#### 1. Configuration Initiale

```bash
# Compiler le frontend (générer le répertoire dist pour éviter l'erreur go:embed)
cd web/default
bun install
bun run build
cd ../..

# Supprimer immédiatement les artefacts de compilation (pour empêcher le backend de servir des fichiers statiques)
rm -rf web/default/dist web/classic/dist
```

#### 2. Démarrer le Backend

```bash
# Installer les dépendances Go
go mod download

# Démarrer le service backend (utilisant SQLite)
go run main.go
```

Le backend s'exécute par défaut sur `http://localhost:3000`, les données sont stockées dans `one-api.db`

#### 3. Démarrer le Frontend

```bash
# Entrer dans le répertoire frontend
cd web/default

# Installer les dépendances
bun install

# Démarrer le serveur de développement
bun run dev
```

Le serveur de développement frontend s'exécute sur `http://localhost:5173` et proxifie automatiquement les requêtes backend vers le port 3000.

### Méthode 2: Utilisation du Makefile

```bash
# Démarrer backend et frontend simultanément (Docker + serveur de développement frontend)
make dev

# Démarrer uniquement le backend (Docker Compose)
make dev-api

# Démarrer uniquement le frontend
make dev-web

# Démarrer le frontend classique
make dev-web-classic
```

## Développement Frontend

### Commandes Disponibles

Dans le répertoire `web/default/`:

```bash
bun run dev          # Démarrer le serveur de développement (http://localhost:5173)
bun run build        # Compilation de production
bun run preview      # Prévisualiser la compilation de production
bun run typecheck    # Vérification des types TypeScript
bun run lint         # Vérification du code ESLint
bun run format       # Formatage du code Prettier
bun run format:check # Vérifier le formatage du code
bun run i18n:sync    # Synchroniser les traductions d'internationalisation
```

### Stack Technique

- **React 19** + **TypeScript**
- **Rsbuild** - Outil de compilation
- **Base UI** - Bibliothèque de composants
- **Tailwind CSS** - Stylisation
- **TanStack Router** - Routage
- **TanStack Query** - Récupération de données
- **i18next** - Internationalisation (supporte en/zh/fr/ru/ja/vi)

### Développement de l'Internationalisation

Les fichiers de traduction sont situés dans `web/default/src/i18n/locales/{lang}.json`. Après avoir ajouté ou modifié des traductions, exécutez:

```bash
bun run i18n:sync
```

## Développement Backend

### Configuration de la Base de Données

#### SQLite (Par Défaut)

Aucune configuration nécessaire, exécutez simplement `go run main.go`.

#### MySQL

```bash
# Définir la variable d'environnement
export SQL_DSN="root:password@tcp(localhost:3306)/newapi"

# Démarrer le backend
go run main.go
```

#### PostgreSQL (Environnement de Développement Docker)

```bash
# Démarrer en utilisant docker-compose.dev.yml
make dev-api
```

### Structure du Projet

```
.
├── router/        # Routage HTTP
├── controller/    # Gestionnaires de requêtes
├── service/       # Logique métier
├── model/         # Modèles de données (GORM)
├── relay/         # Relais/proxy API AI
│   └── channel/   # Adaptateurs spécifiques aux fournisseurs (openai/, claude/, gemini/, etc.)
├── middleware/    # Middleware (auth, limitation de débit, CORS, etc.)
├── setting/       # Gestion de la configuration
├── common/        # Fonctions utilitaires
├── dto/           # Objets de transfert de données
├── constant/      # Définitions de constantes
├── i18n/          # Internationalisation backend (en/zh)
└── web/           # Projets frontend
    ├── default/   # Frontend par défaut (React 19)
    └── classic/   # Frontend classique (React 18)
```

### Directives de Développement

Voir [CLAUDE.md](../../CLAUDE.md) pour les détails, points clés:

1. **Opérations JSON**: Doit utiliser les fonctions wrapper dans `common/json.go`
2. **Compatibilité Base de Données**: Le code doit être compatible avec SQLite/MySQL/PostgreSQL
3. **Gestionnaire de Paquets**: Le frontend priorise Bun

## Compiler la Version de Production

```bash
# Compiler le frontend
make build-all-frontends

# Compiler le backend
go build -o new-api main.go

# Ou utiliser Docker
docker build -t new-api .
```

## Outils de Débogage

### Réinitialiser l'Assistant de Configuration

```bash
make reset-setup
```

Cette commande efface les paramètres et les comptes administrateur dans la base de données pour retester l'assistant d'initialisation.

## Problèmes Courants

### Erreur go:embed: no matching files found

**Problème**: Erreur au démarrage du backend `pattern web/*/dist: no matching files found`

**Cause**: `main.go` utilise `//go:embed` pour intégrer les fichiers frontend au moment de la compilation, si le répertoire `dist` n'existe pas, il y aura une erreur.

**Solution**:
```bash
# D'abord compiler le frontend pour générer dist
cd web/default && bun install && bun run build && cd ../..

# Supprimer immédiatement pour éviter l'occupation
rm -rf web/default/dist web/classic/dist

# Démarrer le backend
go run main.go
```

### Conflit de Port

- Port par défaut du backend: 3000
- Serveur de développement frontend: 5173
- Frontend classique: 5174

**Problème**: Le démarrage du frontend affiche `Port 3000 is occupied`

**Cause**: Rsbuild essaie d'utiliser le port 3000 par défaut, mais il est occupé par le backend.

**Solution**: `port: 5173` est déjà configuré dans `rsbuild.config.ts`, exécutez simplement `bun run dev`.

### Migration de Base de Données

GORM effectue automatiquement les migrations. Toutes les tables sont créées automatiquement lors de la première exécution.

### Configuration du Proxy Frontend

Le serveur de développement frontend est configuré avec un proxy, les requêtes API sont automatiquement transférées au backend `http://localhost:3000`.

## Documentation Associée

- [Conventions du Projet (CLAUDE.md)](../../CLAUDE.md)
- [Documentation Utilisateur](https://docs.newapi.pro/en/docs)
- [Documentation API](https://docs.newapi.pro/en/docs/api)

## Guide de Contribution

Les contributions sont les bienvenues! Avant de soumettre une PR, veuillez vous assurer:

1. Le code passe les vérifications lint
2. Suit les conventions du projet (voir CLAUDE.md)
3. Les tests passent
4. Messages de commit clairs

---

**Support Technique**: [support@quantumnous.com](mailto:support@quantumnous.com)
