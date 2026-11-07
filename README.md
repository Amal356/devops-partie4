# DevOps & Cloud – Partie 4 : CI/CD et DevSecOps

**Étudiante :** Amal Jemli – Master DevOps et Cloud Computing (2026/2027)
**Énoncés :** [Partie 4 – CI/CD et DevSecOps](https://docs.teknolabs.net/courses/devops-cloud/partie-4-cicd-devsecops/)

| TP | Sujet | Outils | Dossier | État |
|----|-------|--------|---------|------|
| TP9 | Pipeline as Code avec Jenkins | Jenkins 2.580.1, agents Docker, JUnit, Credentials, Multibranch, Docker Hub | [tp9-jenkins](tp9-jenkins) | ✅ |
| TP10 | DevSecOps « Shift Left » | Gitleaks, pre-commit, Semgrep, CodeQL, npm audit, Trivy, Dependabot, rulesets GitHub, Jenkins | [tp10-devsecops](tp10-devsecops) + dépôt [vuln-app](https://github.com/Amal356/vuln-app) | ✅ |
| TP11 | GitLab CI/CD | GitLab, runner auto-hébergé, Container Registry, templates de sécurité | `tp11-gitlab-ci` | à venir |
| TP12 | Supply chain logicielle | Harbor, Syft, Grype, Cosign, SLSA | `tp12-supply-chain` | à venir |

Chaque dossier `tpX-…` contient son README (étapes, commandes, explications, tableaux, réponses aux questions, difficultés) et son dossier `captures/`.

## Organisation du dépôt

```
devops-partie4/
├── Jenkinsfile          # pipeline de contact-api : TP9 + quality gates de sécurité du TP10
├── Dockerfile           # image multi-stage non-root (TP7)
├── src/ tests/ migrations/ package.json …   # application contact-api (TP8)
├── tp9-jenkins/         # README + captures + Jenkinsfile de fin de TP9
└── tp10-devsecops/      # README + captures
```

L'application **`contact-api`** (API Express du TP8) est à la **racine** : les quatre TP la font évoluer (Jenkins puis GitLab la construisent, le TP12 signe son image), et Jenkins attend le `Jenkinsfile` à la racine du dépôt.

## Pourquoi un deuxième dépôt, `vuln-app` ?

Le TP10 travaille sur une application **volontairement vulnérable** fournie par l'énoncé. Elle a son propre dépôt public, [`Amal356/vuln-app`](https://github.com/Amal356/vuln-app), parce que :

1. son **historique Git a été réécrit** pour supprimer un secret : impossible ici sans casser le TP9 (SHA des commits = tags des images Docker Hub, PR #1, jobs Jenkins) ;
2. les **réglages de sécurité GitHub sont par dépôt** : le ruleset `protect-main` (PR obligatoire, 4 checks, CodeQL bloquant) et les alertes de code scanning ne concernent que l'application vulnérable ;
3. le code vulnérable reste **isolé** : il n'est jamais construit par Jenkins ni publié sur Docker Hub ;
4. CodeQL, les rulesets et le secret scanning sont **gratuits sur un dépôt public**.

Les quality gates de la partie 6 du TP10 sont en revanche ajoutés **ici**, au `Jenkinsfile` de `contact-api`, pour prolonger le pipeline du TP9.

## Lancer le projet

```bash
npm ci
npm run lint && npm test        # 24 tests Vitest/Supertest
docker build -t contact-api .
```

## Environnement

VM VirtualBox `ubuntu-server-26` (Ubuntu Server 26.04.1 LTS, 3,3 Go RAM, 2 vCPU, disque 48 Go), réseau host-only `192.168.56.40` ; Docker 29.8, Node.js 24, Jenkins 2.580.1 natif.

## Sécurité

- Aucun secret dans le dépôt : seul `.env.example` est versionné ; Jenkins ne connaît que les **ID** des credentials (`dockerhub`, `github-pat`).
- Chaque build passe Gitleaks, Semgrep, `npm audit` et Trivy ; seule `main` publie l'image `amal878/contact-api:<sha>` sur Docker Hub.
- Jeton GitHub de Jenkins en lecture seule, limité à ce dépôt ; `docker logout` après chaque push.
