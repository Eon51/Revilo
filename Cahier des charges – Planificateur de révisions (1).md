# Cahier des charges – Planificateur de révisions

Version 1.0 – 22 novembre 2026 – Document de cadrage du MVP

## 1. Contexte et objectifs

L'application est un **planificateur de révisions** pour étudiants. L'utilisateur renseigne ses matières, ses examens et ses chapitres, et l'application génère automatiquement un planning de révision réparti sur le calendrier.

L'application permet aussi de **réviser directement à l'intérieur de l'app** grâce à des paquets de cartes mémoire et à des quiz, dans l'esprit de Quizlet. Les sessions du planning renvoient vers le paquet à réviser.

**Objectifs du produit**

- Aider l'étudiant à répartir son travail avant ses examens sans avoir à planifier à la main.
- S'adapter aux imprévus : une session manquée doit être replanifiée automatiquement.
- Fonctionner de manière fiable, rapide et légère, y compris hors connexion.
- Générer des revenus par la publicité, avec une option d'abonnement sans pub.

**Contrainte structurante : aucune IA.** La planification repose uniquement sur des règles et des algorithmes déterministes (répartition par échéance, difficulté, temps disponible, répétition espacée). Aucune fonctionnalité ne dépend d'un modèle d'IA.

## 2. Public cible

- Étudiants du supérieur (cible principale).
- Lycéens, notamment en terminale (cible dès le lancement, **avec contraintes légales renforcées**, voir section 8).
- Usage principal sur smartphone, dans le navigateur ou en application installée (PWA), usage secondaire possible sur plusieurs appareils grâce au compte.

## 3. Périmètre fonctionnel

### 3.1 MVP (indispensable)

**Compte et authentification**

- Création de compte et connexion par e-mail et mot de passe, Google.
- Réinitialisation du mot de passe.
- Suppression du compte et des données depuis l'application.

**Gestion des matières, examens et chapitres**

- Créer, modifier et supprimer une matière.
- Associer un ou plusieurs examens à une matière (date, éventuellement coefficient).
- Ajouter des chapitres à réviser pour chaque examen, avec un niveau de difficulté choisi par l'utilisateur.

**Disponibilités**

- Définir le temps disponible par jour de la semaine.
- Définir des jours bloqués (vacances, indisponibilités).

**Génération du planning**

- Génération automatique d'un planning de sessions de révision jusqu'à chaque examen.
- Prise en compte de la date d'examen, de la difficulté, du temps disponible et d'un système de répétition espacée.
- Affichage en vue jour et en vue calendrier.

**Suivi des sessions**

- Marquer une session comme faite, reportée ou manquée.
- Replanification automatique des sessions manquées ou reportées.

**Rappels**

- Notifications web push avant chaque session (heure réglable), disponibles une fois l'application installée sur l'écran d'accueil.

**Statistiques de base**

- Temps total révisé, nombre de sessions faites, série de jours consécutifs.

**Publicité**

- Bannière discrète sur les écrans de consultation, jamais pendant une session.
- Consentement publicitaire conforme (voir section 8).

**Révision dans l'app : cartes et quiz**

- Créer, renommer et supprimer des paquets de cartes, rattachables à une matière ou à un chapitre.
- Créer des cartes recto-verso (texte) à la main, une par une ou en série. Aucune génération par IA : l'utilisateur écrit ses cartes.
- Importer des cartes depuis un fichier CSV (une colonne recto, une colonne verso).
- Mode cartes : retourner une carte, puis la noter de 0 à 5. L'application reprogramme chaque carte selon un système de répétition espacée (algorithme SM-2).
- Mode quiz : QCM construits par règles à partir des cartes d'un paquet (les mauvaises réponses sont tirées des autres cartes du même paquet), questions à réponse saisie, et vrai ou faux.
- Choix du paquet et du nombre de questions, puis correction avec score et liste des cartes ratées.
- Lien avec le planning : une session de révision peut être associée à un paquet et ouvre directement la séance de cartes ou de quiz correspondante.
- Suivi : cartes maîtrisées, taux de réussite par paquet, nombre de cartes révisées par jour.
- Fonctionnement complet hors-ligne pour les paquets de l'utilisateur.

### 3.2 Après le MVP (souhaitable)

- SM2Pubs récompensées pour débloquer des options (statistiques détaillées, thèmes, export).
- Abonnement « sans pub » avec options supplémentaires.
- Mode « dernière semaine » qui réorganise le planning en révision intensive.
- Synchronisation complète hors-ligne avec résolution de conflits.
- Export du planning (calendrier, PDF).

* Images et audio sur les cartes.
* Mode association et quiz chronométré.
* Partage de paquets entre utilisateurs, avec modération.

### 3.3 Plus tard (optionnel)

- Partage d'un planning avec des camarades.
- Widgets sur l'écran d'accueil.
- Applications natives iOS et Android.

### 3.4 Hors périmètre

- Toute fonctionnalité d'intelligence artificielle (génération de fiches, résumés, chatbot, recommandations par modèle).
- Contenu pédagogique fourni par l'application (cours, fiches toutes faites, banques de questions) : l'utilisateur crée lui-même ses paquets et ses quiz.
- Messagerie ou réseau social.

## 4. Règles de l'algorithme de planification

L'algorithme est un module en **TypeScript pur**, indépendant de React et de l'interface, afin d'être testable et utilisable hors-ligne.

**Entrées**

- Liste des examens (date, coefficient éventuel) et de leurs chapitres (difficulté).
- Disponibilités par jour et jours bloqués.
- Historique des sessions déjà effectuées.

**Principes**

- Plus la difficulté d'un chapitre est élevée, plus il reçoit de temps et de sessions.
- Les sessions sont réparties de manière à éviter l'accumulation en fin de période.
- Une répétition espacée planifie des revisites à intervalles croissants (par exemple J+1, J+3, J+7, selon le temps restant avant l'examen).
- Un jour ne dépasse jamais le temps disponible déclaré.
- En cas de session manquée, le temps est redistribué sur les jours restants sans casser les échéances.
- Si le temps est insuffisant, l'application l'indique clairement à l'utilisateur plutôt que de produire un planning irréaliste.

**Propriétés attendues**

- Déterministe : mêmes entrées, même planning.
- Rapide : génération perceptible comme instantanée sur un téléphone d'entrée de gamme.
- Couvert par des tests unitaires sur les cas limites (examen demain, aucun temps libre, plusieurs examens le même jour, etc.).

**Moteur de révision des cartes**

Un second module en TypeScript pur, `/lib/review`, programme les cartes indépendamment de l'interface.

- Chaque carte a une date de prochaine révision et un niveau (facilité, intervalle et nombre de répétitions, selon SM-2).
- Une bonne réponse espace la prochaine révision, une mauvaise la ramène à court terme.
- Le nombre de nouvelles cartes et de cartes à revoir par jour est plafonné et réglable par l'utilisateur.
- À l'approche d'un examen, les cartes du paquet associé sont revues plus souvent.
- Déterministe et testé unitairement, comme le module de planification.

* Notation : après chaque carte, l'utilisateur donne une note de qualité de 0 à 5.
* Note inférieure à 3 : la carte repart au début, avec un intervalle de 1 jour et un nombre de répétitions remis à 0.
* Note de 3 ou plus : première répétition à 1 jour, deuxième à 6 jours, puis intervalle précédent multiplié par la facilité.
* La facilité démarre à 2,5, est ajustée après chaque réponse selon la note et ne descend jamais sous 1,3.

## 5. Architecture technique

| Domaine | Choix |
| --- | --- |
| Application web (PWA) | React Native avec TypeScript, Expo, exporté pour le web |
| Navigation | Expo Router |
| Interface | Tamagui |
| Animations et gestes | React Native Reanimated, Gesture Handler |
| Calendrier | react-native-calendars |
| Backend et comptes | Supabase (Postgres, Auth, Row Level Security) |
| Données serveur | TanStack Query |
| État local | Zustand |
| Stockage hors-ligne | IndexedDB (via Dexie) ; expo-sqlite sur le web est encore en alpha |
| Validation | Zod |
| Notifications | Web Push avec service worker (PWA installée sur l'écran d'accueil) |
| Publicité | Google AdSense, avec bannière de consentement certifiée Google |
| Build et hébergement | Export web Expo, hébergement statique gratuit (par exemple Cloudflare Pages, Netlify ou Vercel) |
| Tests | Jest, React Native Testing Library |
| Qualité et suivi | ESLint, Prettier, Sentry |

**Compléments pour les cartes et quiz** : gestes de retournement et de balayage des cartes avec Reanimated et Gesture Handler ; import CSV avec expo-document-picker et un lecteur CSV ; images éventuelles via Supabase Storage (après le MVP) ; moteur de répétition des cartes dans `/lib/review`.

**Structure du projet**

- `/app` : écrans
- `/components` : composants d'interface
- `/features` : exams, sessions, stats, auth, decks, review
- `/lib/planner` : algorithme de planification
- `/lib/db` : IndexedDB et synchronisation
- `/lib/api` : client Supabase

## 6. Modèle de données (aperçu)

- **Utilisateur** : identifiant, e-mail, préférences, date de création, statut d'abonnement.
- **Matière** : nom, couleur, utilisateur.
- **Examen** : matière, date, coefficient.
- **Chapitre** : examen, titre, difficulté, statut.
- **Disponibilité** : utilisateur, jour de la semaine, minutes disponibles.
- **Jour bloqué** : utilisateur, date.
- **Session** : chapitre, date prévue, durée, statut (planifiée, faite, reportée, manquée), type (première révision ou répétition).

* **Paquet** : utilisateur, titre, matière ou chapitre associé.
* **Carte** : paquet, recto, verso, date de création.
* **Progression de carte** : carte, niveau, prochaine révision, nombre de réussites et d'échecs.
* **Résultat de quiz** : paquet, date, nombre de questions, score, cartes ratées.
* **Session** : reçoit un paquet optionnel à réviser.

Chaque table est protégée par des règles Row Level Security : un utilisateur ne peut lire et modifier que ses propres données.

## 7. Exigences non fonctionnelles

**Performance**

- Démarrage de l'application rapide et affichage du planning sans attente réseau (lecture depuis la base locale).
- Fluidité des écrans et des animations sur des appareils d'entrée de gamme.

**Hors-ligne**

- Consultation et marquage des sessions possibles sans connexion.
- Resynchronisation automatique au retour du réseau.

**Fiabilité**

- Aucune perte de données lors d'une coupure réseau ou d'un crash.
- Rappels fiables, y compris application fermée (PWA installée).

**Sécurité**

- Communications chiffrées (HTTPS).
- Mots de passe gérés par Supabase Auth, jamais stockés par l'application.
- Jetons de session gérés par le client Supabase dans le navigateur.
- Règles Row Level Security vérifiées avant chaque mise en production.

**Accessibilité et ergonomie**

- Tailles de texte adaptables, contrastes suffisants, compatibilité avec les lecteurs d'écran.
- Thème clair et sombre.
- Interface en français au départ, structure prête pour d'autres langues.

**Compatibilité**

- Navigateurs récents sur iPhone (iOS 16.4 ou plus pour les notifications), Android et ordinateur. Seuils à fixer lors du développement.

## 8. Contraintes

### 8.1 Contraintes légales et conformité

- **RGPD** : information claire sur les données collectées, base légale, durée de conservation, droit d'accès, de rectification et de suppression. Politique de confidentialité obligatoire dans l'application et sur le site.
- **Mineurs** : en France, le consentement parental est requis pour le traitement des données d'un enfant de moins de 15 ans. Si des lycéens sont ciblés, prévoir une vérification de l'âge ou une restriction d'âge, et une configuration publicitaire adaptée.
- **Publicité** : consentement obtenu avant toute publicité personnalisée (bannière de consentement certifiée Google). Pour les utilisateurs mineurs ou de statut incertain, utiliser des pubs non personnalisées conformément aux règles d'AdSense.
- **Suppression de compte** : fonction accessible depuis l'application, exigée par le RGPD (et par les stores pour une future app native).
- **Mentions légales et conditions d'utilisation** à rédiger. Un avis juridique est recommandé avant le lancement, en particulier sur les mineurs.

* **Contenu créé par les utilisateurs** : les paquets et les cartes sont privés par défaut. Si le partage est ajouté, prévoir signalement, modération et conditions d'utilisation sur les droits d'auteur, car les utilisateurs recopient souvent des cours ou des extraits protégés.

### 8.2 Contraintes des stores (apps natives, plus tard)

Le MVP est une application web : aucun store n'est concerné. Ces règles valent pour de futures apps iOS et Android.

- **Apple** : si des connexions sociales (Google) sont proposées, « Se connecter avec Apple » est obligatoire. Compte développeur payant, et déclaration des données collectées (étiquettes de confidentialité).
- **Google Play (Android, après le MVP)** : compte développeur payant, fiche de sécurité des données, test fermé préalable pour les nouveaux comptes personnels selon les règles en vigueur.
- Les règles des stores évoluent : à revérifier avant la publication.

### 8.3 Contraintes techniques

- **Export web Expo** : l'application est exportée en site statique (PWA) et hébergée gratuitement, sans passer par un store.
- Notifications push sur iPhone : elles exigent iOS 16.4 ou plus récent et une application ajoutée à l'écran d'accueil, sans invite d'installation automatique. Apple a finalement conservé les web apps de l'écran d'accueil dans l'UE, mais les sources divergent : à tester sur un vrai iPhone.
- La planification doit rester indépendante de l'interface et du réseau.
- Le plan gratuit de Supabase a des limites (stockage, mise en pause en cas d'inactivité) : prévoir le passage à l'offre payante à l'approche du lancement.

* **Stockage hors-ligne** : expo-sqlite sur le web est en alpha et demande des en-têtes HTTP spécifiques (COOP et COEP). IndexedDB est plus sûr pour le MVP.
* **AdSense** : le site doit être approuvé, ce qui suppose du contenu public suffisant, et le robot de Google doit pouvoir accéder aux pages protégées par connexion (accès à configurer dans AdSense). Prévoir une page d'accueil publique soignée.
* **Connexion Apple** : sur le web, elle nécessite en principe un compte développeur Apple payant. Elle est donc écartée du MVP, qui propose e-mail et Google.

### 8.4 Contraintes économiques

- Les revenus publicitaires ne deviennent significatifs qu'avec un grand nombre d'utilisateurs actifs quotidiens : la **rétention** est l'enjeu principal.
- Les pubs non personnalisées, imposées pour les mineurs, rapportent moins.
- Coûts fixes à prévoir : nom de domaine (probablement nécessaire pour AdSense), hébergement Supabase, éventuel avis juridique.
- Budget et calendrier : 0 € et environ 1 mois (voir section 13).

* Les cartes et les images font croître le stockage et les coûts Supabase : limiter la taille des images et le nombre de cartes par compte gratuit.

- Le budget visé est de 0 € : la version web évite les frais de store (99 $ par an chez Apple, 25 $ une fois chez Google Play). Les outils prévus ont un palier gratuit.

### 8.5 Contraintes d'expérience

- Aucune publicité pendant une session de révision.
- Pas de pubs plein écran au lancement de l'application.
- Ton bienveillant lors des sessions manquées, sans message culpabilisant.

## 9. Monétisation

1. **Bannière** sur les écrans de consultation (revenu de base).
2. **Pubs récompensées** pour débloquer des options ponctuelles (après le MVP ; leur disponibilité sur le web est à vérifier).
3. **Abonnement sans pub** à environ 1,99 € par mois, avec fonctions bonus (après le MVP).

## 10. Indicateurs de succès

- Nombre d'inscrits et d'utilisateurs actifs quotidiens et hebdomadaires.
- Rétention à J1, J7 et J30.
- Nombre moyen de sessions marquées comme faites par utilisateur et par semaine.
- Taux de planning régénéré après une session manquée.
- Revenu publicitaire par utilisateur actif.
- Taux de plantage (Sentry) et avis des utilisateurs.

* Nombre de cartes révisées et de quiz terminés par utilisateur actif et par semaine.

## 11. Risques

| Risque | Impact | Réponse |
| --- | --- | --- |
| Marché très concurrentiel | Difficulté à se faire connaître | Se différencier par la replanification automatique, la légèreté et l'absence de friction |
| Faible rétention | Revenus pub insuffisants | Soigner les rappels et la boucle d'usage quotidienne |
| Non-conformité mineurs et RGPD | Refus de la régie publicitaire, sanctions | Avis juridique, configuration pub prudente, restriction d'âge si besoin |
| Complexité de la synchronisation hors-ligne | Bugs et perte de données | Commencer en lecture locale, synchroniser de façon simple, tester les conflits |
| Refus d'AdSense ou limites des PWA sur iPhone | Pas de revenus publicitaires, rappels moins fiables | Soigner une page d'accueil publique, tester les notifications sur un vrai iPhone, prévoir un rappel de repli |

## 12. Phasage proposé

Délai visé pour le MVP : environ 1 mois (phases 1 à 5).

**Phase 1 – Fondations** Projet Expo TypeScript exporté en PWA, Tamagui, navigation, Supabase, authentification.

**Phase 2 – Cœur du produit** Matières, examens, chapitres, disponibilités, et module de planification avec ses tests.

**Phase 3 – Usage quotidien** Affichage du planning, suivi des sessions, replanification, notifications web push, stockage hors-ligne (IndexedDB).

**Phase 3 bis – Cartes et quiz** Paquets et cartes, import CSV, mode cartes avec répétition espacée, quiz généré par règles, lien avec les sessions du planning.

**Phase 4 – Monétisation et conformité** AdSense, consentement, politique de confidentialité, suppression de compte, statistiques de base.

**Phase 5 – Lancement** Tests fermés, corrections, mise en ligne de la version web, suivi des indicateurs.

**Phase 6 – Évolutions** Pubs récompensées, abonnement, mode intensif, export, partage.

## 13. Décisions prises

- **Cible** : étudiants du supérieur et lycéens dès le lancement. Les contraintes liées aux mineurs (section 8.1) s'appliquent donc dès le MVP.
- **Plateformes** : version web (PWA) pour le MVP, utilisable sur iPhone et Android depuis le navigateur. Les apps natives viennent ensuite. Connexion par e-mail et Google, sans connexion Apple au MVP.
- **Partage de paquets** : après le MVP. Au MVP, les paquets restent privés.
- **Algorithme des cartes** : SM-2.
- **Stack** : React Native, TypeScript, Expo, Tamagui, Supabase (section 5).

* **Cartes du MVP** : texte seul, les images viennent après.
* **Notation des cartes** : note de 0 à 5.
* **Abonnement sans pub** : environ 1,99 € par mois.

- **Délai visé** : environ 1 mois pour le MVP.
- **Budget de lancement** : 0 € (la version web évite les frais de store).

* **Nom** : Révilo.

## 14. Points à décider

- Nom de domaine et approbation AdSense : à vérifier avant de compter sur les revenus publicitaires.
- Identité visuelle (logo, couleurs) et disponibilité du nom Révilo (domaine, marque).
