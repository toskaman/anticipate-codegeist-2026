# ANTICIPATE — Avancement CORE (mis à jour le 2 novembre 2026, 01:45)

## 🚀 Session autonome via bridge — résultats réels (Windows)
- ✅ Bridge v2 opérationnel (`E:\Codegeist2026\bridge`), allowlist rechargée à chaque requête, auto-redémarrage si le script change.
- ✅ Sur ton PC : typecheck OK, tests backend 12/12, contrats 3/3, moteur 8/8 (perf 18 ms), build frontend OK, `forge lint` : aucune erreur.
- ✅ Commits poussés sur `origin/feat/core-engine` : `fad78cb` (backend complet), `35152d7` (fix bundling), + diagnostics.
- ✅ Déployé en **development** (v4) et installation mise à niveau sur `one-atlas-euza.atlassian.net` (id `2ae8efdf-…`) avec les nouvelles permissions.
- ✅ **Vérifié contre le vrai Jira** (web trigger de diagnostic lecture seule, en tant qu'app) : 25 projets lus, recherche JQL `search/jql` OK, lecture ticket + liens, permissions, types de tickets, extracteur de graphe sur de vrais liens (PLAT : `Blocks` → DEPENDS_ON CONFIRMED ; `Relates`/`Deployments` → INFERRED). Format de date Jira `-0400` géré.
- ⬜ Pas encore testé : les resolvers appelés **en tant qu'utilisateur** depuis l'UI (dépend du frontend de ta copine) et les écritures Jira réelles (aucune écriture faite).
- ✅ Module **Rovo MCP** (`anticipate-mcp`, 3 outils lecture seule) déployé en dev v4.2.0 → candidat bonus « Best app with Atlassian MCP » (activation externe = admin du site).
- ✅ CI GitHub Actions (`.github/workflows/ci.yml`) : typecheck + tests CORE + build frontend.
- ✅ Branche de ta copine récupérée (10 commits, `aa0e740`) : elle attendait les contrats CORE. Réponse complète : `docs/coordination/CORE_RESPONSE_TO_EXPERIENCE.md` (mapping de ses opérations → resolvers, enveloppe, erreurs, URL de lancement). Elle doit `git merge origin/feat/core-engine` puis brancher son ForgeClient.
- 🔁 Surveillance automatique : vérification de GitHub programmée (nouveaux push EXPERIENCE + CI), reprise automatique après le reset de 5 h.
- ✅ 02:10 UTC — ta copine a fusionné CORE et branché son client sur les contrats 0.2.0 (`d9d6109`, CI verte). J'ai monté un worktree d'intégration `E:\Codegeist2026\ANTICIPATE-INTEGRATION` (sa branche, détachée), tests backend OK, build frontend OK, **déployé en dev v4.3.0** = backend CORE + vraie interface.
- ⛔ Validation hébergée (appels en tant qu'utilisateur, écritures réelles) : le navigateur intégré de Claude n'est pas connecté à Atlassian et je n'ai pas le droit de me connecter à ta place. Il suffit d'ouvrir une fois le navigateur intégré de l'app Claude sur l'URL ci-dessous et de te connecter ; ensuite je peux tester tout le parcours.
- URL de l'app : `https://one-atlas-euza.atlassian.net/apps/full-page/2ae8efdf-84b8-4851-a341-e4fa2499595c/hello-world/`
- ⚠️ Le web trigger de diagnostic doit être retiré du manifest avant la version jury.


Légende : ✅ fait et testé · 🟡 fait, pas encore vérifié sur un vrai Jira · ⛔ bloqué (action humaine) · ⬜ à faire

## ✅ Ce qui a été fait

### Récupération du mauvais prompt
- ✅ Audit : repo + 2 worktrees propres sur `f898235`, App ID vérifié, aucun secret dans les fichiers ni l'historique.
- ✅ Le frontend produit par erreur est conservé pour ta copine dans `E:\Codegeist2026\recovery\experience-agent-handoff-2026-11-02\` (rien n'a touché sa branche).

### Backend Forge (dans `ANTICIPATE-CORE`, non commité)
- ✅ `packages/contracts` (v0.2.0) : schémas partagés zod, enveloppe `{ok, meta, data|error}`, 13 opérations, données de démo.
- ✅ `packages/simulation-core` : moteur déterministe (impacts directs/transitifs, cycles, profondeur max, 3 règles, hash reproductible). 100 nœuds ≈ 18 ms.
- 🟡 `src/forge-adapters.ts` : appels Jira réels en `asUser()` (projets, JQL, tickets, liens, composants, permissions, création ticket/lien/commentaire/label) + stockage Forge KVS.
- 🟡 `src/jira/extractor.ts` : construit le graphe de preuves depuis les liens Jira (blocks / depends / tests / relates) ; tout ticket illisible reste UNKNOWN.
- ✅ `src/engine/service.ts` : les 13 resolvers — snapshot, comparaison de scénarios, plan de prévention (lecture seule), approbation liée au hash du plan, exécution avec verrou, idempotence, réconciliation, vérification après écriture, statut PARTIAL/FAILED, Prevention Passport.
- ✅ Garde-fous : snapshot expiré après 24 h, plans privés à leur auteur, mode DEMO_FIXTURE toujours étiqueté et jamais exécutable, aucune IA payante.
- ✅ `src/rovo.ts` : 3 actions Rovo/MCP **lecture seule** (graphe, simulation, passport) ; config manifest prête dans `docs/integrations/manifest-rovo.yml` (pas encore fusionnée).
- 🟡 `manifest.yml` : seules les permissions ont été ajoutées (`read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app`). App ID, module et routePrefix inchangés.
- ✅ Tests : backend 12/12, contrats 3/3, moteur 8/8 ; bundle esbuild OK et resolvers invoqués directement avec succès.
- ✅ Docs : `docs/coordination/STATUS_CORE.md` (+ json), `docs/deployment/BOOTSTRAP.md`, `docs/demo/JIRA_DEMO_SETUP.md`, `docs/security/THREAT_MODEL.md`, `docs/research/VERIFIED_RULES_AND_APIS.md`.

## 🔌 Bridge Windows (créé)
- `E:\Codegeist2026\bridge\start-bridge.cmd` lance `anticipate-bridge.ps1` : l'agent dépose des requêtes JSON dans `inbox\`, le bridge exécute **uniquement une liste blanche** (git sur `feat/core-engine`, npm tests/build, Forge **développement** seulement) et écrit les résultats dans `outbox\` (secrets masqués).
- 11 requêtes sont déjà en file (whoami, status, install, typecheck, tests, build, lint, install list).
- Pas de déploiement production via le bridge (feu vert explicite requis).

## ⛔ Bloqué — il faut toi (je ne peux pas le faire sans tes identifiants)
1. ✅ Token : confirmé comme test par le propriétaire, conservé.
2. ✅ (fait) Double-cliquer `E:\Codegeist2026\bridge\start-bridge.cmd` et coller un **nouveau** token dans l'invite `forge login` (le bridge installe la CLI tout seul). Ensuite, l'agent s'occupe du commit, du push, du lint et du déploiement dev.
3. (géré par le bridge) Commit/push :
   ```powershell
   cd E:\Codegeist2026\ANTICIPATE-CORE
   git add -A; git commit -m "feat(core): contracts 0.2.0, simulation engine, Jira resolvers, verified writes, Rovo actions"
   git push origin feat/core-engine
   ```
4. ✅ (fait) `forge lint`, `forge deploy -e development`, `forge install -e development` sur ton site Jira de dev (accepter les nouvelles permissions).

## ⬜ Reste à faire (ordre de priorité)
### P0 — démo de bout en bout
- ⬜ Vérifier sur un vrai Jira : réponses `search/jql`, `project/search`, `mypermissions`, comportement `FAIL_IF_EXISTS` de KVS (ajuster si besoin).
- ⬜ Créer les données de démo à la main (`docs/demo/JIRA_DEMO_SETUP.md`) et dérouler : snapshot → 3 scénarios → plan → approbation → écritures vérifiées → passport.
- ⬜ Intégration avec le frontend de ta copine (elle consomme `packages/contracts` ; flow décrit dans `STATUS_CORE.md`).
- ⬜ Ouvrir la PR `feat/core-engine` → `main` (sans merge auto).
### P1
- ⬜ Fusionner `docs/integrations/manifest-rovo.yml` dans le manifest après un premier deploy réussi → bonus « Best app with Atlassian MCP ». Ajouter éventuellement un module `rovo:agent` (bonus Agents).
- ⬜ Étudier `jira:workflowValidator` sur un workflow de test isolé (avec rollback).
- ⬜ CI GitHub (typecheck + tests), lint ESLint du backend, `npm audit`.
- ⬜ Tests de pagination / rate-limit avec réponses Jira réelles enregistrées.
### Release / jury
- ⬜ Déploiement production **après ton feu vert**, puis lien de partage pour les juges (ne pas soumettre cette app au Marketplace).
- ⬜ Installation propre sur un site Jira vierge en suivant uniquement la doc.
- ⬜ Textes Devpost en anglais + vidéo YouTube < 5 min (avec ta copine).
### P2
- ⬜ Teamwork Graph, édition Marketplace séparée, intégration Confluence.

## Limites connues (à dire honnêtement aux juges)
- Les dépendances viennent des liens Jira ; « relates to » n'est qu'INFERRED et ne propage pas d'impact.
- Les politiques sont appliquées dans ANTICIPATE seulement (pas encore de validateur de workflow Jira).
- Le verrou d'exécution n'est pas une transaction distribuée ; la réconciliation par label/commentaire marqueur évite les doublons.
- `global:fullPage` est en Preview : l'app s'ouvre par URL, pas forcément depuis le menu Apps.
