# FATA — marketplace

Marketplace responsive en français pour FATA, réalisée avec React, TypeScript, Vite, React Router et une API NestJS/PostgreSQL/Prisma.

## Démarrer

```bash
npm run install:frontend
npm run install:backend

# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev
```

## API et base de données

L'API se trouve dans `backend/`. Elle nécessite Node.js 20+ et une base PostgreSQL ; Neon convient, sans installer PostgreSQL sur cet ordinateur. Crée un projet Neon puis copie son URL poolée (`-pooler`) dans `DATABASE_URL` et son URL directe dans `DIRECT_URL` du fichier `backend/.env` (créé depuis `backend/.env.example`). Garde ces URLs privées.

```bash
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run dev:backend
```

`prisma:deploy` applique les migrations déjà présentes (tables et champs des commandes, tentatives de paiement de test). Pour créer une nouvelle migration en développement après une modification du schéma, utilise `npm run prisma:migrate -- --name nom_de_migration`. Ensuite, la seed ajoute les catégories publiques de départ et, si les deux variables `INITIAL_ADMIN_*` sont renseignées, crée ou actualise le compte administrateur. Choisis un mot de passe unique d'au moins 12 caractères et garde les identifiants dans `backend/.env`, jamais dans le code.

Pour créer le premier compte administrateur, renseigne `INITIAL_ADMIN_EMAIL` et `INITIAL_ADMIN_PASSWORD` dans `backend/.env` avec une adresse et un mot de passe fort (12 caractères minimum), puis exécute `npm run prisma:seed` depuis la racine du projet. Connecte-toi ensuite sur `/admin/connexion` ou via le lien « Accès administrateur » sur le site. Aucun compte admin ne peut être créé par inscription publique.

L'API expose `GET /api/health`, l'inscription et la connexion, la lecture des catégories, produits et boutiques, ainsi que l'ajout, la modification, le masquage et la suppression des catégories par un administrateur connecté. La liste des produits accepte un filtre `ids` pour revérifier en une requête les articles sélectionnés du panier. Les catégories peuvent avoir une seule profondeur de sous-catégories ; les vendeurs peuvent classer leurs produits dans l'une ou l'autre, et le catalogue permet de filtrer une catégorie principale ou une sous-catégorie. Une catégorie ne peut être supprimée tant qu'elle contient des produits ou des sous-catégories. Les produits d'une catégorie désactivée sont également masqués des fiches, boutiques et nouvelles demandes de commande. Les vendeurs approuvés peuvent créer des produits et consulter leur propre catalogue (`POST /api/products`, `GET /api/products/mine`) ; les nouveaux produits restent masqués jusqu'à leur publication par l'administration. Dans l'espace admin, les produits peuvent être modifiés et masqués ou supprimés ; la suppression est refusée pour ceux liés à une commande ou une conversation afin de préserver l'historique. `GET /api/stores/mine` permet au vendeur de consulter le statut réel de sa boutique. La messagerie utilise `GET/POST /api/conversations`, `GET/POST /api/conversations/:id/messages`, `PATCH /api/conversations/:id/read`, `POST /api/messages/:id/report`, `GET /api/notifications`, `PATCH /api/notifications/:id/read` et les routes admin `/api/admin/message-reports`. Ces routes contrôlent l'appartenance aux fils et le rôle côté serveur. L'API applique validation des entrées, limitation de débit, hachage des mots de passe, JWT à courte durée de vie et en-têtes HTTP de sécurité. L'accueil, le catalogue, les fiches produits et les boutiques lisent leurs données depuis l'API.

Pour générer les fichiers de production :

```bash
npm run build
npm run preview
```

## Parcours actuellement disponibles

- Accueil, catalogue filtrable, recherche, tri, fiches produits et boutiques publiques.
- Espaces et connexions séparés : `/client/connexion` et `/client/inscription`, `/vendeur/connexion` et `/vendeur/inscription`, ainsi que `/admin/connexion`. Les comptes client et vendeur sont distincts ; chaque adresse e-mail ne peut porter qu'un seul rôle.
- Inscription et connexion réelles, session protégée par cookie HttpOnly.
- Inscription vendeur avec boutique en attente de validation.
- Espace vendeur connecté à l'API : statut réel de la boutique, modification du profil public après approbation, création et suivi des produits soumis à validation.
- Gestion des catégories et sous-catégories depuis l'espace administrateur : création, modification, activation/désactivation ; suppression lorsqu'aucun produit ou sous-catégorie ne leur est rattaché.
- Tableau de bord admin alimenté par les demandes vendeurs, la modération des produits et les commandes en base.
- Détails des commandes accessibles à l'administration : articles, livraison, adresse et instructions, sans possibilité de déclarer un paiement reçu.
- Approbation/refus des boutiques, modification, masquage et suppression des produits sans historique associé, ainsi qu'activation/désactivation des catégories.
- Demandes de commande enregistrées dans PostgreSQL et consultables par leur cliente ; les prix et frais sont recalculés par l'API.
- Préparation et livraison suivies séparément pour chaque boutique ; seuls les paiements réels confirmés ouvrent l'accès vendeur, puis le client confirme la réception.
- Notifications internes sur la préparation, l'expédition, le retrait prêt et la réception confirmée, liées à la commande et visibles seulement par leur destinataire.
- Avis publiés uniquement après un paiement confirmé et reliés à l'article acheté ; le nom public du client est abrégé.
- Messagerie client-vendeur persistante : démarrage depuis les fiches produits ou commandes, fils liés aux produits et commandes, notifications internes, suivi lu/non lu et signalements avec modération administrateur auditée.
- Formulaire de contact relié à une boîte de réception réservée à l'administration ; les demandes peuvent être suivies et la réponse s'ouvre dans le logiciel e-mail de l'administrateur.
- Les messages sont limités au texte et filtrent les liens, coordonnées téléphoniques ivoiriennes, e-mails et tentatives explicites de paiement hors FATA. La messagerie n'accepte ni pièces jointes ni paiement entre utilisateurs.
- GeniusPay utilise un checkout hébergé et une confirmation du statut vérifiée par l'API ; les paiements sont limités au mode sandbox.
- Panier conservé dans le navigateur.
- Pages d'aide, contact, livraison, confidentialité et conditions.
- Mise en page adaptée aux téléphones, tablettes et ordinateurs.

## Avant une mise en production

Avant le premier paiement GeniusPay, applique la migration qui stocke la référence du prestataire depuis la racine avec `npm run prisma:deploy`.

Les paiements réels restent désactivés. Pour tester GeniusPay, configure `GENIUSPAY_MODE="sandbox"`, `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `GENIUSPAY_WEBHOOK_SECRET` et `GENIUSPAY_WEBHOOK_URL` dans `backend/.env`, puis redémarre l'API. Garde les clés privées dans l'API et utilise seulement les clés sandbox. Enregistre comme webhook l'URL HTTPS `https://<api-publique>/api/payments/geniuspay/notify` et abonne-la aux événements `payment.success`, `payment.failed`, `payment.cancelled` et `payment.expired`. Stocke le secret renvoyé lors de la création du webhook dans `GENIUSPAY_WEBHOOK_SECRET`. Le tableau de bord admin, onglet « Finances », indique si ces variables sont présentes sans en révéler les valeurs. Les confirmations sont marquées `TEST_PAID` et ne transmettent pas la commande à une boutique ; le suivi vendeur est réservé à un futur paiement réel confirmé. Les revenus/retraits et les favoris multi-appareils ne sont pas activés.

La migration de messagerie est appliquée depuis la racine avec `npm run prisma:deploy`. Les conversations ne sont pas supprimées automatiquement afin de rester consultables ; FATA doit encore définir et publier la durée de conservation ainsi que le processus de suppression des données avant l'ouverture commerciale.

Tarifs prévus : Abidjan 2 000 FCFA, Grand-Bassam 1 000 FCFA, autres villes 3 500 FCFA ; retrait chez le vendeur gratuit. Chaque boutique organise sa livraison. Pour ouvrir réellement les ventes, configurez PostgreSQL et les variables de déploiement, validez GeniusPay en sandbox, puis définissez les commissions, remboursements, retours et engagements de livraison avant d'activer le mode live. Ne collectez pas de données de carte directement dans FATA.
