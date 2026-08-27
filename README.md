# Bien En Ligne — Prospection

V1 mobile-first d’un cockpit interne de prospection. Elle permet de créer des campagnes et prospects, analyser/scorer une cible, préparer des messages, les valider explicitement, guider l’envoi manuel, planifier les relances, enregistrer les réponses et suivre les ventes.

> Règle centrale : cette V1 n’envoie aucun email ou DM. Un message ne peut être marqué comme envoyé que s’il a d’abord été explicitement approuvé.

## Stack

- Next.js 16, App Router, React, TypeScript strict
- Tailwind CSS 4 et CSS applicatif mobile-first
- Supabase Auth + PostgreSQL + RLS
- OpenAI Responses API côté serveur, sorties JSON validées par Zod
- Lucide React
- Vercel

## Fonctionnement actuel

Le fournisseur de données est choisi explicitement au démarrage :

- si les variables Supabase sont présentes, Supabase Auth protège toutes les routes privées et toutes les données métier proviennent de PostgreSQL sous RLS ;
- dans ce mode, aucune donnée de démonstration et aucun état `localStorage` ne sont lus ;
- le **mode local** avec seeds clairement marqués démo n’est utilisé que lorsque Supabase n’est pas configuré ;
- si `OPENAI_API_KEY` est présente, l’analyse et la génération appellent `/api/ai` avec une sortie structurée validée ;
- en mode Supabase, une erreur OpenAI interrompt l’opération sans fallback ni fausse persistance ; le fallback `Demo AI result` reste limité au vrai mode local.

Les lectures et mutations Supabase sont centralisées dans `src/lib/data/supabase-repository.ts`. Elles utilisent la session de l’utilisateur et ne transmettent jamais d’`owner_id` depuis le navigateur.

## Installation

```bash
npm install
copy .env.example .env.local
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000). Sans variables Supabase, le lien « Ouvrir la démo locale » permet d’accéder immédiatement à l’application.

Commandes de contrôle :

```bash
npm run typecheck
npm run lint
npm run build
```

## Variables d’environnement

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
OPENAI_WEB_SEARCH_ENABLED=false
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEOAPIFY_API_KEY=
```

L’enrichissement public utilise `GEOAPIFY_API_KEY` lorsqu’elle est configurée côté serveur, puis OpenStreetMap/Overpass en repli modéré et sans clé. La clé Geoapify est facultative et ne doit jamais être préfixée par `NEXT_PUBLIC_`. Elle s’obtient en créant un projet gratuit dans [Geoapify MyProjects](https://myprojects.geoapify.com/), sans jamais copier une vraie clé dans ce dépôt.

La découverte serveur expose un aperçu authentifié (`POST /api/discovery`) sans créer automatiquement de prospects. Elle géocode la ville puis utilise sa limite administrative Geoapify (`filter=place:{place_id}`), et non un petit rayon arbitraire. Elle limite la recherche à 100 résultats et utilise actuellement la correspondance vérifiée `Restaurant` → `catering.restaurant`. Les secteurs sans correspondance explicite restent non pris en charge plutôt que d’être approximés.

Les clés OpenAI et providers restent exclusivement serveur. Aucune clé `NEXT_PUBLIC_*` n’est prévue pour ces services et aucune service role n’est utilisée par le pipeline.

## Configurer Supabase

1. Créez un projet Supabase.
2. Copiez l’URL et la clé publique dans `.env.local`.
3. Appliquez [la migration initiale](supabase/migrations/202608260001_initial_schema.sql) avec la CLI Supabase ou le SQL Editor.
4. Créez un utilisateur dans Authentication → Users.
5. Facultatif : exécutez [le seed](supabase/seed.sql) après la création du premier utilisateur.
6. Redémarrez `npm run dev`, puis connectez-vous sur `/login`.

Avec la CLI :

```bash
supabase link --project-ref VOTRE_PROJECT_REF
supabase db push
supabase db seed
```

Le trigger `handle_new_user` crée automatiquement le profil et les réglages de chaque nouvel utilisateur.

## Architecture

```text
src/
  app/
    (app)/                 pages privées / mode local
    api/ai/                appels IA exclusivement serveur
    api/enrichment/        providers publics exclusivement serveur
    auth/                  connexion et déconnexion Supabase
  components/
    app-store.tsx          orchestration explicite Supabase/démo
    app-shell.tsx          navigation desktop/mobile
  lib/
    ai/                    prompts, schémas Zod et client OpenAI
    enrichment/            provenance, cache, conflits et providers
    data/                  repository Supabase centralisé
    supabase/              clients SSR/browser et session
    demo-data.ts           données explicitement démo
    providers.ts           interfaces d’extension V2
    scoring.ts             scoring déterministe configurable
supabase/
  migrations/              schéma, contraintes, triggers, index, RLS
  seed.sql                 démo facultative
```

Pages principales :

- `/dashboard` : cockpit « Aujourd’hui » ;
- `/prospects` et `/prospects/[id]` : base et fiche détaillée ;
- `/prospects/import` : import CSV avec mapping ;
- `/campaigns` : création et suivi des campagnes ;
- `/approval` : validation unitaire et en masse ;
- `/pipeline` : suivi commercial ;
- `/stats` : comparaisons V1 ;
- `/settings` : configuration et état des services.

## Approval Queue

Un message commence en `DRAFT`. Une approbation enregistre :

- `status = APPROVED` ;
- `approved_at` ;
- `approved_by` ;
- un événement d’audit.

La validation en masse reçoit uniquement les identifiants actuellement sélectionnés. Le passage à `SENT` est protégé à trois niveaux :

1. l’interface ne montre les actions d’envoi manuel que dans l’onglet « Approuvés » ;
2. `markSent()` refuse un message sans `approvedAt` ;
3. PostgreSQL impose `approved_state_is_auditable`, `sent_state_has_timestamps` et le trigger `messages_require_prior_approval`.

Après « Marquer comme envoyé », le prospect passe à `CONTACTED`, `contacted_at` est renseigné, un événement est créé et le follow-up 1 est planifié à J+3. Une réponse ou `DO_NOT_CONTACT` annule les relances.

## IA

Les fonctions sont séparées en prompts, schémas et transport serveur :

- `analyzeProspect()` ;
- `generateOutreachMessage()` et les variantes follow-up ;
- `analyzeReply()` ;
- scoring déterministe via `scoreProspect()`.

`/api/enrichment` exécute indépendamment Google Places et l’inspection d’URL, conserve la provenance et les conflits, puis le client authentifié persiste ces faits sous RLS avant l’appel Terra. `/api/ai` valide l’utilisateur, garde la clé côté serveur, limite timeout/retries et impose une sortie JSON structurée. Le score reste entièrement déterministe. La recherche web OpenAI est facultative via `OPENAI_WEB_SEARCH_ENABLED=true`, limitée et ne remplace jamais un provider structuré.

## Ajouter un provider d’enrichissement

Implémentez `ProspectEnrichmentProvider` dans [contracts.ts](src/lib/enrichment/contracts.ts). Les providers Google Places et inspection web servent de référence ; un provider social spécialisé peut être ajouté sans déduire l’activité de la simple présence d’une URL.

```ts
export class SocialProvider implements ProspectEnrichmentProvider {
  id = "social-provider";
  cacheTtlMs = 6 * 60 * 60 * 1000;
  async enrich(prospect, fetchedAt) {
    // Appel serveur fiable, faits sourcés, ou unknown.
  }
}
```

L’ajout manuel et l’import CSV restent disponibles quand un provider est absent ou en erreur.

## Ajouter plus tard l’envoi email

Implémentez `EmailProvider` dans un module strictement serveur. Avant tout appel fournisseur, exécutez `assertMessageApproved(message.approvedAt)` et relisez l’état en base dans la même opération. Ne faites jamais confiance à un état fourni par le client.

Gmail, Resend ou Instantly peuvent ainsi être branchés sans modifier le workflow d’approbation.

## Sécurité

- toutes les tables métier ont RLS et sont filtrées par `auth.uid()` ;
- `owner_id` utilise `auth.uid()` et n’est jamais accepté comme autorité depuis le client ;
- les entrées Auth/IA sont validées côté serveur ;
- OpenAI et les clés providers restent exclusivement serveur ; aucune service role n’est utilisée ;
- `activities` n’est pas modifiable ni supprimable par un utilisateur authentifié ;
- `DO_NOT_CONTACT` interdit les relances et la génération automatique ;
- aucun envoi automatique n’existe dans cette V1.

## Déploiement Vercel

1. Importez le dépôt dans Vercel ou utilisez `vercel link`.
2. Ajoutez les variables d’environnement pour Preview et Production.
3. Dans Supabase Auth, ajoutez l’URL Vercel aux Redirect URLs.
4. Exécutez `npm run build` localement avant le déploiement.
5. Déployez seulement après application de la migration Supabase.

L’application peut être installée sur l’écran d’accueil d’un smartphone grâce à son manifeste web et à sa navigation mobile adaptée aux zones tactiles.
