# Sentinel — l'audit qualité continu de votre concierge IA

*Inclus par défaut dans chaque licence Concierge by DUBUB.*

## En une phrase

**Sentinel** est le module qualité de la plateforme : un audit conversationnel automatisé qui teste votre concierge en continu, le fait juger par une IA dédiée et propose de nouveaux cas-limites pour qu'aucune régression ne passe entre les mailles.

---

## À quoi ça sert

Un concierge IA premium doit répondre correctement non pas dans 19 cas sur 20, mais dans 33 cas sur 33 — et continuer à le faire après chaque mise à jour, chaque nouveau scénario que vos visiteurs inventent.

Sentinel s'assure que ça reste vrai :

- **Banque de scénarios par tenant** — chaque client a sa propre banque (annulation, prix, intentions vagues, fautes de frappe, tons frustrés, demandes multi-catégories, etc.).
- **Juge IA intégré** — un évaluateur OpenAI dédié vérifie sémantiquement chaque réponse contre une grille de critères (« le bot a-t-il diagnostiqué une condition médicale ? », « le bot a-t-il proposé une visite alors qu'on lui demandait l'annulation ? »).
- **Génération automatique de nouveaux scénarios** — Sentinel demande à OpenAI de proposer 8 nouveaux cas-limites par tenant, en s'appuyant sur les règles de sécurité actives et l'historique des échecs récents. Vous validez, vous promouvez ce qui mérite de l'être.
- **Rapports persistés** — chaque exécution génère un rapport JSON horodaté, conservé par tenant. Vous voyez la tendance qualité en temps réel.
- **Tableau de bord dédié** — un panneau Sentinel dans l'interface d'administration de chaque tenant : taux de réussite, scénarios en échec, dernière exécution, mode (local / production), juge activé ou non.

---

## Pourquoi c'est un argument de vente

Un concierge IA qui se trompe sur l'annulation, sur un prix, ou qui invente un diagnostic médical, ça coûte cher au client.

Vendre un assistant sans **audit qualité continu**, c'est vendre un produit dont on ne mesure pas la dérive. Sentinel transforme cet enjeu de fiabilité en argument de vente : votre client voit, à tout moment, la santé conversationnelle de son concierge.

Concrètement, lors d'une démo, vous pouvez ouvrir le panneau Sentinel et montrer :

- **48 scénarios passés sur 48** sur la dernière exécution
- **Taux de réussite 100 %** sur les 10 dernières exécutions
- **Juge IA actif** sur chaque évaluation
- **0 régression** sur les cas critiques (annulation, prix contradictoire, douleur clinique, accès gym, etc.)

C'est un signal de maturité que les concurrents low-code n'ont pas.

---

## Architecture technique (synthèse)

| Composant | Rôle |
| :--- | :--- |
| `test-scenarios.ts` | Exécuteur déterministe + juge IA. Lance la banque par tenant, écrit un rapport horodaté. |
| `sentinel-generate.ts` | Demande à OpenAI de proposer N nouveaux scénarios par tenant à partir de l'historique et des règles. |
| `_sentinel-runs/` | Rapports persistés (un fichier JSON par tenant et par exécution). |
| `GET /v1/admin/sentinel/runs` | Endpoint d'administration filtrable par tenant. |
| Panneau `SentinelPanel` | Visualisation dans le dashboard admin. Aucun croisement entre tenants. |

**Isolation des tenants** : chaque scénario, chaque rapport, chaque proposition générée porte un `tenantCode`. MAA ne voit jamais les données de DUBUB et inversement. Cette séparation est structurelle, pas optionnelle.

---

## Commandes principales

```bash
# Exécution complète (juge IA activé par défaut)
pnpm.cmd --filter @platform/api sentinel:run

# Exécution pour un tenant donné
pnpm.cmd --filter @platform/api sentinel:run --tenant maa

# Génération de 8 nouveaux scénarios par OpenAI (pour validation humaine)
pnpm.cmd --filter @platform/api sentinel:generate --tenant maa

# Exécution rapide / hors-ligne (sans juge IA)
pnpm.cmd --filter @platform/api sentinel:run --no-judge

# Exécution contre la production live (vérifie la couche que voit le client)
pnpm.cmd --filter @platform/api sentinel:run --live
```

---

## Tarification (interne)

Sentinel est inclus par défaut dans toutes les licences. Le coût marginal est faible : ~0,001 $ par exécution complète (48 scénarios × ~0,000015 $ par appel juge). Une exécution quotidienne par tenant coûte environ **0,03 $ par mois**.

C'est l'un des modules les plus rentables du produit, et l'un des plus visibles côté client.
