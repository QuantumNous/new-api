<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 **Passerelle LLM de nouvelle génération et système de gestion des actifs IA**

**Fork de développement secondaire** — basé sur [QuantumNous/new-api](https://github.com/QuantumNous/new-api)

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-brightgreen" alt="licence">
  </a><!--
  --><a href="https://github.com/ChinaToyHunter/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/ChinaToyHunter/new-api?color=brightgreen&include_prereleases" alt="version">
  </a>
</p>

</div>

## 📝 Description du projet

> [!IMPORTANT]
> - Ce projet est exclusivement destiné aux scénarios de passerelle API d'IA légalement autorisés, d'authentification organisationnelle, de gestion multi-modèles, d'analyse d'utilisation, de comptabilisation des coûts et de déploiement privé.
> - Les utilisateurs doivent obtenir légalement les clés API, comptes, services de modèles et autorisations d'interface en amont, et respecter les conditions d'utilisation en amont ainsi que les lois et réglementations applicables.
> - Lors de la fourniture de services d'IA générative au public, les utilisateurs doivent remplir les obligations réglementaires, de licence, de sécurité du contenu, de vérification d'identité, de conservation des journaux, de fiscalité et d'autorisation en amont applicables à leur juridiction.

---

## 🔀 À propos de ce fork

Ce dépôt est un fork de développement secondaire de [QuantumNous/new-api](https://github.com/QuantumNous/new-api). Il suit `main` en amont et cette page ne documente que les fonctionnalités et corrections ajoutées par ce fork. Pour la documentation complète en amont, consultez [docs.newapi.pro](https://docs.newapi.pro/en/docs).

### 📌 Situation

- Le contrat de quota du portefeuille en amont utilise une limite par recharge (`MaxQuota`, plafonnée à `math.MaxInt32`). Avec une valeur `QuotaPerUnit` élevée comme `500000`, les recharges, codes de rachat et ajustements administrateur répétés peuvent dépasser la limite int32 par opération.
- Le montant payable peut alors devenir silencieusement `0`, tandis que les chemins de paiement, de rachat et d'ajout administrateur ne partagent pas de plafond global du portefeuille.

### 🎯 Tâche

- Conserver des montants de recharge corrects avec une valeur `QuotaPerUnit` élevée sans casser les flux Epay ou Stripe existants.
- Ajouter un plafond global strict appliqué à chaque chemin de crédit, avec un échec fermé en cas de dépassement, compatible avec SQLite, MySQL et PostgreSQL.

### 🛠️ Action

- Conserver la limite int32 par recharge (`MaxQuota`) et ajouter le plafond global int64 `MaxWalletQuota` (équivalent à $2,000,000), avec les conversions centralisées dans `common/quota_math.go`.
- Protéger le règlement des paiements par des mises à jour conditionnelles atomiques ; vérifier la capacité avant les codes de rachat et les opérations administrateur `add_quota`, sans retour numérique.
- Déplacer les paramètres de prix et de recharge minimale d'Epay dans l'onglet de configuration Epay.
- Ajouter l'infrastructure du fork : mise à jour en un clic avec vérification de somme de contrôle et remplacement atomique, recréation Docker, synchronisation Compose, API et interface de mise à jour réservées à root, modes d'invitation d'inscription contrôlés par le serveur, âge minimal du compte GitHub pour OAuth et CI de publication basée sur le tag exact.

### 📈 Résultat

- Avec `QuotaPerUnit=500000`, les montants de recharge restent corrects et aucun crédit ne peut dépasser `MaxWalletQuota`.
- Les chemins de crédit sont protégés contre les dépassements et les courses concurrentes : un seul rachat réussit en cas de concurrence et le règlement du paiement est atomique.
- Publié sous [`v1.0.0-rc.25-th.13`](https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.25-th.13) (commit de fusion `ea0ba918`).

### 🆚 Comparaison rapide

| Domaine | Amont (QuantumNous/new-api) | Ce fork |
|---|---|---|
| Capacité du portefeuille | Limite int32 par recharge uniquement | Limite int32 par recharge + plafond global int64 ($2,000,000) |
| Dépassement avec un `QuotaPerUnit` élevé | Le montant payable peut devenir 0 | Calcul correct et garde-fous en échec fermé |
| Crédit par rachat / administrateur | Pas de plafond global partagé | Vérification atomique de la capacité du portefeuille |
| Paramètres Epay | Emplacement générique | Limités à l'onglet Epay |
| Mise à jour | Mise à niveau manuelle | Mise à jour vérifiée, recréation Docker, synchronisation Compose |
| Invitations à l'inscription | Interrupteur global unique | Modes facultatif / obligatoire / masqué |
| Versionnement | Tags amont | Ligne `v{upstream}-th.{x}` du fork |

### 🏷️ Publications du fork

Le fork publie ses versions `v{upstream}-th.{x}` sur la page [Releases](https://github.com/ChinaToyHunter/new-api/releases). Version actuelle : [`v1.0.0-rc.25-th.13`](https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.25-th.13).

---

## 📜 Licence

Ce projet est sous licence [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).

Les conditions supplémentaires de la section 7 de l'AGPLv3 s'appliquent. Les versions modifiées doivent conserver la mention d'attribution de l'auteur `Frontend design and development by New API contributors.` dans les mentions légales appropriées et dans tout emplacement important de présentation, de mentions légales, de pied de page ou d'attribution de l'interface utilisateur.

Les versions modifiées présentant une interface utilisateur doivent également conserver un lien visible vers le projet original : <https://github.com/QuantumNous/new-api>.

Il s'agit d'un projet open-source développé sur la base de [One API](https://github.com/songquanpeng/one-api) (licence MIT).

Si les politiques de votre organisation n'autorisent pas les logiciels sous licence AGPLv3, ou si vous souhaitez éviter ses obligations open-source, veuillez nous contacter à : [support@quantumnous.com](mailto:support@quantumnous.com)

---

## 🌟 Historique des étoiles

<div align="center">

[![Graphique de l'historique des étoiles](https://api.star-history.com/svg?repos=QuantumNous/new-api,ChinaToyHunter/new-api&type=Date)](https://star-history.com/#QuantumNous/new-api&ChinaToyHunter/new-api&Date)

</div>

Si ce fork vous est utile, pensez à mettre une ⭐️ à [ChinaToyHunter/new-api](https://github.com/ChinaToyHunter/new-api) — et, si vous utilisez directement l'amont, à [QuantumNous/new-api](https://github.com/QuantumNous/new-api).

---

<div align="center">

### 💖 Merci d'utiliser New API

<sub>Built with ❤️ by QuantumNous</sub>

<sub>Fork maintenu par <a href="https://github.com/ChinaToyHunter">ChinaToyHunter</a></sub>

</div>
