# Configuration Supabase de Révilo

## Migrations

La migration `migrations/20261122_mvp.sql` crée le schéma initial. Elle a déjà été exécutée dans le projet Supabase de Révilo; ne pas la relancer telle quelle, car ses créations de politiques ne sont pas idempotentes.

Exécuter `migrations/20261122120000_owner_integrity.sql` dans le SQL Editor Supabase pour les nouveaux environnements. Elle a été appliquée au projet Revilo le 22 novembre 2026 et renforce les règles RLS pour empêcher l’association d’examens, paquets et sessions aux données d’un autre compte.

## Suppression de compte

La fonction Edge `delete-account` a été déployée au projet Revilo le 22 novembre 2026. Pour redéployer une version locale depuis la racine du projet:

```powershell
supabase functions deploy delete-account
```

La fonction utilise les secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` fournis côté serveur par Supabase. Ne jamais mettre la clé `service_role` dans l’application ou dans `.env` client. Le contrôle JWT de la passerelle est désactivé pour éviter de dépendre de l’ancien secret de signature; la fonction valide elle-même le jeton avec `auth.getUser()` avant toute suppression (`verify_jwt = false`).

## Configuration client

Les variables client requises sont `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Ces variables doivent contenir uniquement l’URL du projet et sa clé anon/publishable. Ajouter les URL de redirection web/mobile utilisées par l’application aux URL autorisées dans les réglages Auth de Supabase.

Google OAuth et le domaine de production restent à configurer avec les identifiants et domaines détenus par le propriétaire du projet.
