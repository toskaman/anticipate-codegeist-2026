# Bilan du prompt EXPERIENCE v2.0

Audit du 2 novembre 2026. Portée : comparer les nouvelles exigences à l'état réel, sans commencer une refonte ni modifier le backend. Le prompt v2 a été lu dans la pièce jointe fa574f86-4a6f-47ad-bf35-8b4a61bf7512. Les branches distantes ont été actualisées avec git fetch origin.

## Conclusion

Conserver la base frontend : sept écrans, thème, navigation, graphe, validation, tests et exports constituent un prototype local fonctionnel. La v2 change toutefois le critère de réussite : il faut maintenant un parcours Forge/Jira intégré et vérifié, et non seulement une démonstration locale. Ni les tests locaux ni les captures ne prouvent cette intégration. Aucune réécriture complète de l'interface n'est justifiée ; les contrats, les flux de données et le cycle approbation/exécution doivent en revanche être adaptés en profondeur.

## État du dépôt vérifié

- Dossier réel : C:\Users\Orpheane\Desktop\PROJECT-ANTIGRAVITY\ANTICIPATE. Les deux dossiers E:\Codegeist2026 cités dans la v2 sont absents ici. Ne pas déplacer le projet automatiquement.
- Origine : https://github.com/toskaman/anticipate-codegeist-2026.git.
- Branche : feat/product-experience, trois commits locaux devant origin/feat/product-experience : 1ca5179, 5d73829, 18b5b54. Aucun push ni PR effectué dans cette session.
- App ID du manifeste : 39a28f48-c891-4d86-a3cf-c14409cbd29e. Il correspond à la v2 ; les anciennes notes parlant d'une divergence d'identifiant doivent être corrigées.
- Module : global:fullPage ; routePrefix : hello-world ; ressource : static/hello-world/build. Manifeste et backend identiques à la branche distante EXPERIENCE.
- CORE distant : origin/feat/core-engine pointe sur f898235, bootstrap Forge. Aucun packages/contracts ni status-core.json dans cet arbre. Le resolver local expose uniquement getText. Cela ne prouve pas l'absence d'un travail CORE non publié.
- Des modifications de la session interrompue restent non commitées : CSS d'impression, test graph-print, scripts et preuves PDF/captures. Les conserver et les relire avant le prochain commit. Les scripts temporaires de diagnostic ne sont pas des livrables produit.

## Résultats relancés pour cet audit

| Vérification | Résultat réel | Limite |
|---|---|---|
| ESLint | PASS | Frontend ciblé ; pas un audit de sécurité |
| TypeScript | PASS | Contrats provisoires locaux |
| Vitest | 16 tests PASS | Fixtures, adaptateurs et cycle async |
| Playwright | 16 tests PASS | Navigateur local, aucun contexte Forge |
| Matrice visuelle/accessibilité | 7 écrans × 2 thèmes × 3 largeurs | 42 combinaisons automatisées ; inspection manuelle de toutes les images non terminée |
| Graphe | Sélection nœud/arête, zoom, déplacement et fit testés | Petit graphe fixe ; pas de cycles ni de charge 100+ nœuds |
| Export JSON | Contenu, données fictives, incertitude et chronologie vérifiés | Aucun état Jira vérifié |
| Impression | Palettes des deux thèmes testées ; PDF A4 une page inspecté lors de la session précédente | Preuve locale, pas export serveur ni attestation |
| Build | PASS ; build/index.html produit | Environ 80,49 Ko gzip JS initial, 58,42 Ko gzip graphe ; pas une mesure de latence |
| Prettier check | FAILED | tests/graph-print.spec.ts non formaté après les derniers ajustements interrompus |
| Secrets | Aucun motif connu trouvé dans les fichiers suivis de l'historique local/distant récupéré | Scan de motifs non exhaustif, sans impression des valeurs ; fichiers non suivis et captures non certifiés |
| Dépendances | Dernier rapport enregistré : 18 alertes, 13 modérées et 5 élevées | Pas de correction forcée ni de nouvelle certification de sécurité |

## Comparaison avec les sections v2

| Exigence v2 | Déjà en place | À poursuivre / modifier / refaire |
|---|---|---|
| §0, §3 — application existante, isolation, bootstrap | Bonne branche, identité conservée, frontend au bon endroit, Vite/TS/tests/build | Corriger les chemins du prompt pour cette machine ; vérifier une installation reproductible npm ci ; ne pas refaire l'application |
| §1 — parcours réel de bout en bout | Parcours visuel complet sur AUTH-142 fictif | Sélection de vrais projets/issues ; simulation CORE ; approbations individuelles authentifiées ; exécution Jira vérifiée |
| §2 — sources officielles et accès | Manifeste compatible avec le chemin de build ; premières sources revérifiées | docs/ux/verified-requirements.md absent ; achever la revue des sources, obtenir le site et l'UUID d'installation, tester le vrai lien d'accès |
| §4 — coordination et contrats | ExperienceAdapter, adaptateurs local/indisponible, Zod, opérations de lecture et plan | Unifier DataAdapter et ExperienceAdapter en AnticipateClient ; FixtureClient/ForgeClient ; provisional-contracts.ts ; getExecutionStatus ; contrats partagés et tests ; fichiers de coordination absents |
| §5 — design système | Navy/teal, modes clair/sombre, focus, modal, composants et galerie de développement | Activer le thème hôte en contexte Forge ; tokens Atlassian ; zoom 200 %, longs textes ; inventaire licences ; réutilisation composants à renforcer |
| §6A — onboarding / accès | Explication locale et statut d'intégration indisponible | Parcours site Jira vide ; permissions ; lien réel global:fullPage ; fixtures réservées développement/test |
| §6B — Mission Control | Dashboard et liens fonctionnels sur une fixture | Vrais projets/issues, disponibilité et fraîcheur ; CTA « Analyze a change » ; zéro donnée utile au lieu d'une erreur générique |
| §6C — Evidence Graph | React Flow, filtres, recherche, zoom/pan, sélection et liste clavier ; CONFIRMED/INFERRED/UNKNOWN | Sources URL réelles ; provenance causale ; relations directes/transitives ; fraîcheur ; cycles ; rendu borné et 100+ nœuds |
| §6D — Scenario Lab | Trois alternatives affichées avec résultats distincts déclarés comme fixtures | Le résultat actuel est lu dans une table statique : ce n'est pas un simulateur. Rebrancher des changements réellement distincts sur CORE, avec même snapshot, brouillons et invalidation |
| §6E — Prevention Plan | Cibles, raisons, preuves, confirmation, états locaux | Refaire le modèle de cycle de vie : actions identifiées, approbation par action, permissions, tentatives, idempotence, PARTIAL/FAILED et retry ; en fixture afficher « requires live backend » pour la vraie approbation |
| §6F — Passport | Écran, JSON, impression, snapshot fictif, preuves, incertitudes et chronologie locale | Consommer le rapport backend ; refléter tentatives et issues vérifiées ; ne plus reconstruire l'export directement à partir des constantes domain.ts |
| §6G — Firewall | Vérifications pass/fail/unknown en lecture | Résultats de politiques CORE ; préciser la portée d'application ; aucune édition ou enforcement Jira inventé |
| §6H — Rovo/MCP/Graph | Aucun faux chatbot ni faux bonus | DEFERRED jusqu'aux capacités CORE testées ; surfaces compactes et liens de preuve seulement ensuite |
| §6I — Settings | Thème local, statut indisponible, aide clavier | Capacités réelles, confidentialité et traitement des données, aide et accessibilité ; thème hôte |
| §7–8 — interactions et QA | Parcours local, modal clavier, erreurs/chargement, validation et captures | Aucun test FORGE DEV/JURY ; ajouter refus/expiration/stale/partial/échec d'écriture/double clic ; manifest de preuves avec révision et mode ; captures réelles comparées en régression |
| §9 — fiabilité / sécurité | Échappement React, pas de mutations Atlassian en démo, réponses obsolètes ignorées | Abort réel/timeouts centralisés, fuites sur changements répétés, performance représentative, audit dépendances ; les booléens du frontend ne valent pas autorisation |
| §10 — produit / commercial | Cas API v1 ciblé et textes de positionnement | Recherche concurrentielle vérifiée, persona/JTBD, matrice, mesures internes, hypothèses de prix et copie Marketplace |
| §11 — jury | Pitch, présentation anglaise et storyboard local honnête | Installation/site vierge et accès testés ; narration/sous-titres/vidéo de code réel ; pack Marketplace et licences ; distribution CORE ; publication uniquement autorisée |
| §12–15 — jalons / release / statut | Trois commits, docs et preuves locales | Jalons Forge non validés ; status-experience.json et demandes CORE ; PR examinée ; checklist finale fondée sur preuves |

## Corrections prioritaires

1. **P0 — séparer strictement fixture et Forge.** Le build de production démarre aujourd'hui aussi sur les fixtures et expose l'approbation/exécution simulées. C'était autorisé par l'ancien brief local ; la v2 réserve les fixtures au développement/test et exige un état backend requis pour une vraie approbation. Conserver la simulation dans l'outillage de démo, pas comme succès de production.
2. **P0 — coordination avant intégration.** Demander à CORE les schémas, opérations, erreurs, capacités, paramètres de snapshot, IDs d'action/plan/exécution et résultats vérifiés. Fournir les demandes exactes dans le fichier de coordination, sans modifier son backend.
3. **P0 — adapter les contrats et le cycle de vie.** Aujourd'hui simulateChange reçoit A/B/C et lit des constantes ; compareScenarios n'accepte pas de snapshot ; approve/execute manipulent approved/executed au niveau du plan. Ces éléments doivent changer, pas seulement leurs intitulés. getExecutionStatus manque.
4. **P0 — entrée et contexte Forge.** Vérifier avec CORE installation, URL réelle, Bridge, CSP, thème hôte et permissions. Aucun menu Apps automatique ni lien d'installation ne peut être promis depuis le seul manifeste.
5. **P0 — compléter les états réels.** Site vide, permission refusée/expirée, snapshot périmé, réseau, capacités non supportées, exécution partielle, échec, nouvelle tentative et double clic. Le loader actuel ignore les réponses obsolètes mais n'annule pas le travail sous-jacent.
6. **P1 — qualité et preuve.** Revoir le diff interrompu, formater le test, terminer la revue visuelle, mesurer de gros graphes et la fiabilité, classer les preuves MOCK/LOCAL/FORGE DEV/FORGE JURY, tenir les statuts de coordination.
7. **P1/P2 — crédibilité et jury.** Recherche produit, droits/licences, supports Marketplace et vidéo. Les bonus restent différés tant qu'ils ne sont pas réellement intégrés.

## Contraintes officielles vérifiées pour ce bilan

- Le règlement exige Forge, au moins une intégration Atlassian, une installation utilisable par les juges et des instructions de configuration. Vidéo publique YouTube de moins de cinq minutes ; visionnage au-delà de trois minutes non garanti. Échéance : 22 décembre 2026 à 12 h Pacific, soit 21 h à Paris/Amsterdam. Source : https://codegeist2026.devpost.com/rules .
- global:fullPage est documenté comme Preview ; accès documenté par /apps/full-page/{installation-id}/{route-prefix}/{app-route}. Le routePrefix existant est hello-world ; site et installation-id restent à obtenir et vérifier. Source : https://developer.atlassian.com/platform/forge/manifest-reference/modules/global-full-page/ .
- La synchronisation du thème Custom UI passe par view.theme.enable(), absent de l'implémentation active. Source : https://developer.atlassian.com/platform/forge/design-tokens-and-theming/ .
- La documentation de routage a été consultée : https://developer.atlassian.com/platform/forge/add-routing-to-a-full-page-app/ . Le hook hash local n'est pas une preuve de routage Forge.
- Toutes les autres affirmations externes de la v2 (notamment historique de retrait des anciens modules et restrictions propres à global:ui) doivent être vérifiées avant une décision de migration ; aucune migration n'a été engagée pendant cet audit.

## Décision

Ne pas repartir de zéro et ne pas présenter les jalons locaux comme VERIFIED_FORGE. Réutiliser l'interface et les tests, faire évoluer les contrats et le flux métier, puis intégrer et vérifier avec CORE. Le présent bilan est terminé ; la réalisation de la v2 est un chantier distinct et reste à exécuter.
