# Plan détaillé de réalisation – Révilo

Nov 22, 2026 · @No B

Révilo se construit en quatre semaines environ : fondations et comptes, planning, cartes SM-2, puis hors-ligne, notifications et mise en ligne. Les quiz et les pubs sont les premiers à glisser si le délai se tend. Ce plan couvre tout ce qu'il faut, du cadrage à la mise en ligne.

## 1. Préparation

### 1.1 Décisions figées

- Révilo : application web installable (PWA), cible étudiants et lycéens, 0 € de budget, environ 1 mois.
- Stack : React Native, TypeScript, Expo (export web), Tamagui, Supabase, TanStack Query, Zustand, Dexie (IndexedDB).
- Cartes en texte seul, notation SM-2 de 0 à 5, partage de paquets après le MVP.

### 1.2 Comptes gratuits à créer

- GitHub (code et sauvegarde), Supabase (backend), un hébergeur statique (Cloudflare Pages, Netlify ou Vercel), Sentry (suivi des erreurs), Google Search Console et Google Cloud (connexion Google).
- AdSense : à demander dès que le site est en ligne, car l'approbation prend du temps.

### 1.3 Environnement de développement

- Node.js LTS, VS Code, Git, navigateur avec outils développeur.
- Un iPhone et un téléphone Android réels pour tester la PWA et les notifications.
- Dépôt Git avec une branche principale protégée et une branche par fonctionnalité.

### 1.4 Organisation du travail

- Un tableau simple (Notion, Trello ou issues GitHub) avec les colonnes À faire, En cours, Fait.
- Un ticket par fonctionnalité du cahier des charges, classé : indispensable, souhaitable, plus tard.

### 1.5 Identité et domaine

- Vérifier la disponibilité de Révilo (domaine, marque INPI, réseaux sociaux).
- Prendre un domaine à toi, probablement nécessaire pour AdSense, ou démarrer sur le sous-domaine gratuit de l'hébergeur en attendant.

## 2. Produit et design

### 2.1 Parcours utilisateur

- Premier usage : inscription, configuration (matières, examens, disponibilités), premier planning, première session, première série de cartes.
- Retour quotidien : ouvrir l'app, voir les sessions du jour, réviser, marquer comme fait.

### 2.2 Écrans à concevoir

- Accueil public (présentation, conseils), inscription et connexion.
- Aujourd'hui, calendrier, matières, examens et chapitres, disponibilités.
- Paquets, séance de cartes, quiz et résultats, statistiques, réglages et suppression de compte.

### 2.3 Système de design

- Couleurs, typographie, espacements et composants définis dans Tamagui, avec thèmes clair et sombre.
- Composants réutilisables : bouton, carte, liste, champ, calendrier, bannière de pub.

### 2.4 Maquettes

- Schémas rapides sur papier ou dans un outil gratuit comme Figma, mobile d'abord, puis adaptation écran large.
- Une maquette par écran du MVP, validée avant de coder l'écran.

### 2.5 Textes et ton

- Français clair et bienveillant, aucun message culpabilisant après une session manquée.
- Textes d'aide pour l'installation sur l'écran d'accueil et pour les notifications.

## 3. Socle technique

### 3.1 Projet

- Création du projet Expo en TypeScript avec Expo Router, export web activé.
- TypeScript strict, alias d'imports, variables d'environnement.

### 3.2 Interface

- Installation et configuration de Tamagui (thèmes, polices, composants de base).
- Navigation par fichiers, mise en page adaptée au mobile et aux grands écrans.

### 3.3 Qualité de code

- ESLint, Prettier, Jest et React Native Testing Library.
- Intégration continue sur GitHub Actions : types, lint et tests à chaque envoi.

### 3.4 Structure du projet

- `/app`, `/components`, `/features` (exams, sessions, stats, auth, decks, review).
- `/lib/planner`, `/lib/review`, `/lib/db`, `/lib/api`.

### 3.5 Base PWA

- Manifest (nom, icônes, couleurs), service worker, aide à l'installation.
- Vérification de l'installation sur iPhone et Android.

## 4. Backend et données

### 4.1 Projet Supabase

- Création du projet, clés publiques, configuration par environnement.

### 4.2 Schéma de base

- Tables : utilisateur, matière, examen, chapitre, disponibilité, jour bloqué, session, paquet, carte, progression de carte, résultat de quiz.
- Scripts de migration versionnés dans le dépôt.

### 4.3 Sécurité

- Row Level Security sur chaque table : un utilisateur ne lit et ne modifie que ses données.
- Test des règles avec deux comptes.

### 4.4 Authentification

- E-mail et mot de passe, Google, réinitialisation du mot de passe.
- Écrans d'inscription et de connexion, gestion de la session dans le navigateur.

### 4.5 Données personnelles

- Suppression du compte et de toutes les données liées.
- Sauvegardes régulières (export du schéma et des données de test).

## 5. Planification

### 5.1 Moteur de planification

- Module `/lib/planner` en TypeScript pur : entrées (examens, chapitres, disponibilités, jours bloqués, historique), sortie (liste de sessions).
- Règles : temps proportionnel à la difficulté, répartition sans accumulation, plafond quotidien, alerte si le temps est insuffisant.

### 5.2 Tests du moteur

- Cas limites : examen demain, aucun temps libre, plusieurs examens le même jour, jours bloqués, changement de date d'examen.
- Propriétés vérifiées : même entrée, même planning ; jamais plus que le temps disponible.

### 5.3 Fonctionnalités

- Gestion des matières, examens, chapitres, disponibilités et jours bloqués.
- Génération du planning, vue jour et vue calendrier.

### 5.4 Suivi

- Session faite, reportée ou manquée, replanification automatique.
- Statistiques de base : temps révisé, sessions faites, série de jours.

## 6. Cartes et quiz

### 6.1 Paquets et cartes

- Créer, renommer et supprimer des paquets, rattachés à une matière ou à un chapitre.
- Créer, modifier et supprimer des cartes recto-verso.

### 6.2 Import CSV

- Sélection du fichier, aperçu, vérification des colonnes, import avec rapport d'erreurs.

### 6.3 Moteur SM-2

- Module `/lib/review` en TypeScript pur : note de 0 à 5, facilité (départ 2,5, minimum 1,3), intervalles de 1 jour, 6 jours, puis multiplication par la facilité.
- Plafond réglable de nouvelles cartes et de révisions par jour.
- Tests unitaires sur des séries de notes connues.

### 6.4 Séance de cartes

- Retourner la carte, noter de 0 à 5, passer à la suivante, résumé en fin de séance.
- Accès direct depuis une session du planning.

### 6.5 Quiz

- QCM construits par règles à partir des cartes du paquet, réponse saisie, vrai ou faux.
- Choix du paquet et du nombre de questions, correction avec score et cartes ratées.
- À reporter après le premier lancement si le calendrier se tend.

## 7. Hors-ligne et PWA

### 7.1 Stockage local

- Base IndexedDB via Dexie : planning, paquets, cartes et progression disponibles sans réseau.

### 7.2 Synchronisation

- File d'attente des modifications faites hors-ligne, envoyée au retour du réseau.
- Conflits résolus simplement au départ : la modification la plus récente l'emporte, enregistrement par enregistrement.

### 7.3 Service worker

- Mise en cache des fichiers de l'application, page de secours hors-ligne, mise à jour contrôlée.

### 7.4 Tests hors-ligne

- Coupure du réseau pendant une séance, relance sans réseau, resynchronisation, sur iPhone et Android réels.

## 8. Notifications

### 8.1 Abonnement

- Demande de permission au bon moment (après l'installation), enregistrement de l'abonnement push dans Supabase.

### 8.2 Envoi

- Fonction serveur planifiée (Supabase Edge Function et tâche planifiée) qui envoie les rappels aux heures choisies.
- À vérifier : limites du plan gratuit de Supabase pour ces fonctions.

### 8.3 Réglages

- Heure du rappel, activation et désactivation, explication claire pour les utilisateurs qui n'ont pas installé l'app.

### 8.4 Plan de repli

- Pour les utilisateurs sans notifications : écran Aujourd'hui bien visible à l'ouverture.
- Rappel par e-mail possible après le MVP.

## 9. Publicité et monétisation

### 9.1 Site prêt pour AdSense

- Page d'accueil publique avec du contenu original (présentation, conseils de révision, fonctionnement), pages de confidentialité et de contact.
- Fichier `ads.txt`, site vérifié dans Search Console.

### 9.2 Consentement

- Bannière de consentement certifiée Google, pubs non personnalisées pour les mineurs ou les utilisateurs de statut incertain.

### 9.3 Emplacements

- Bannière discrète sur les écrans de consultation, jamais pendant une session ni au lancement.

### 9.4 Accès du robot

- Configuration de l'accès du robot AdSense aux pages protégées par connexion, avec un compte de test.

### 9.5 Après le MVP

- Abonnement sans pub à environ 1,99 € par mois via un service de paiement (frais à prévoir).
- Pubs récompensées, si elles sont disponibles sur le web.

## 10. Légal et conformité

### 10.1 RGPD

- Registre simple des données collectées, base légale, durées de conservation, droits d'accès, de rectification et de suppression.
- Guides gratuits de la CNIL comme référence.

### 10.2 Mineurs

- Consentement parental sous 15 ans en France : choisir entre un âge minimum à l'inscription et une procédure de consentement.
- Avis juridique recommandé avant le lancement.

### 10.3 Documents

- Politique de confidentialité, conditions d'utilisation, mentions légales.

### 10.4 Cookies et traceurs

- Inventaire des traceurs (session, pubs), bandeau conforme, mesure d'audience sans cookies si possible.

## 11. Tests, qualité et mise en ligne

### 11.1 Tests

- Tests unitaires (planification, SM-2), de composants, et de parcours complets avec Playwright.
- Tests manuels sur iPhone et Android réels.

### 11.2 Performance et accessibilité

- Audit Lighthouse, contrastes, navigation au clavier, lecteurs d'écran, tailles de texte.

### 11.3 Mise en ligne

- Hébergement statique, HTTPS, domaine, variables d'environnement de production.
- Suivi des erreurs avec Sentry, sauvegarde des données Supabase.

### 11.4 Lancement progressif

- Test fermé avec quelques étudiants, corrections, puis ouverture.
- Suivi : inscrits, rétention, sessions faites, cartes révisées.

## 12. Calendrier, suite et risques

### 12.1 Calendrier proposé

| Semaine | Objectifs | Livrable |
| --- | --- | --- |
| 1 | Préparation, socle technique, Supabase, comptes, maquettes | Application qui démarre, avec connexion |
| 2 | Moteur de planification, matières, examens, planning, suivi | Planning utilisable |
| 3 | Cartes, import CSV, SM-2, séance de cartes | Révision par cartes |
| 4 | Hors-ligne, notifications, pages légales, mise en ligne | Version web publiée |
| Après | Quiz, pubs (selon l'approbation AdSense), abonnement, tests étendus | Version 1.1 |

### 12.2 Après le MVP

- Quiz s'ils sont reportés, pubs récompensées, abonnement, images sur les cartes.
- Partage de paquets avec modération, apps natives iOS et Android.

### 12.3 Risques et réponses

- Délai trop serré : couper d'abord les quiz, puis les pubs, jamais le planning ni les cartes.
- Refus d'AdSense : enrichir la page publique, redemander, envisager une autre régie.
- Notifications peu fiables sur iPhone : écran Aujourd'hui, puis rappel par e-mail.
- Synchronisation hors-ligne instable : commencer par la lecture locale et une écriture simple.

### 12.4 Checklist de lancement

- [ ] Règles de sécurité testées avec deux comptes
- [ ] Suppression de compte fonctionnelle
- [ ] Documents légaux publiés
- [ ] Consentement aux pubs actif
- [ ] Notifications testées sur iPhone et Android
- [ ] Fonctionnement hors-ligne vérifié
- [ ] Sentry actif
- [ ] Sauvegarde des données faite
