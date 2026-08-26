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

Le projet démarre immédiatement sans service externe :

- le **mode local** persiste les données dans `localStorage` et fournit des seeds clairement marqués démo ;
- si Supabase est configuré, les routes applicatives sont protégées par Supabase Auth ;
- la migration PostgreSQL et ses politiques RLS sont prêtes pour le stockage partagé ;
- si `OPENAI_API_KEY` est présente, l’analyse et la génération appellent `/api/ai`, puis remplacent le fallback local par une sortie OpenAI validée ;
- sans clé OpenAI, l’interface continue avec un résultat marqué `Demo AI result`.

Le mode local est intentionnellement utilisable seul. Pour une utilisation multi-appareils, ajoutez un repository Supabase aux mêmes opérations exposées par `AppStoreProvider`.

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
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Variables facultatives déjà réservées dans `.env.example` : `GOOGLE_PLACES_API_KEY`, `OUTSCRAPER_API_KEY`, `SERPER_API_KEY`, `CLAY_API_KEY`.

`SUPABASE_SERVICE_ROLE_KEY` n’est jamais utilisée dans le navigateur. Elle est réservée aux futures tâches serveur d’administration ou d’import contrôlé.

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
    auth/                  connexion et déconnexion Supabase
  components/
    app-store.tsx          modèle métier local et transitions auditées
    app-shell.tsx          navigation desktop/mobile
  lib/
    ai/                    prompts, schémas Zod et client OpenAI
    supabase/              clients SSR/browser
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

`/api/ai` valide l’utilisateur si Supabase est actif, valide l’entrée avec Zod, garde la clé côté serveur, limite timeout/retries et revalide le JSON de sortie. Les prompts imposent `unknown` lorsqu’une donnée manque et interdisent l’invention de faits.

## Ajouter un provider de découverte

Implémentez `ProspectDiscoveryProvider` dans [providers.ts](src/lib/providers.ts) :

```ts
export class GooglePlacesProvider implements ProspectDiscoveryProvider {
  name = "google-places";
  async discover(input) {
    // Appel serveur, normalisation, validation, puis retour de Partial<Prospect>[]
  }
}
```

La V1 ne dépend d’aucun provider et conserve toujours l’ajout manuel et l’import CSV.

## Ajouter plus tard l’envoi email

Implémentez `EmailProvider` dans un module strictement serveur. Avant tout appel fournisseur, exécutez `assertMessageApproved(message.approvedAt)` et relisez l’état en base dans la même opération. Ne faites jamais confiance à un état fourni par le client.

Gmail, Resend ou Instantly peuvent ainsi être branchés sans modifier le workflow d’approbation.

## Sécurité

- toutes les tables métier ont RLS et sont filtrées par `auth.uid()` ;
- `owner_id` utilise `auth.uid()` et n’est jamais accepté comme autorité depuis le client ;
- les entrées Auth/IA sont validées côté serveur ;
- OpenAI et la service role restent exclusivement serveur ;
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
