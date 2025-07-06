# Segarow - Backend (API Node.js / MongoDB)

## Nom Prénom
Hookoom Hans

---

## Liste des fonctionnalités

- Routes CRUD pour articles, reviews, commentaires, images, likes, users
- Structure MVC (dossiers `controllers/`, `models/`, `middleware/`)
- Authentification JWT (création, vérification, middleware de protection)
- Routes protégées par middleware JWT
- Base MongoDB (connexion centralisée, modèles Mongoose)
- Vérification des champs (types, required, etc. dans Mongoose)
- Validation avancée avec Joi sur tous les endpoints sensibles
- Codes status HTTP adéquats (200, 201, 400, 401, 403, 404, 500…)

---

## Liste des bonus

- **Suppression en cascade** : suppression des likes, articles, reviews et anonymisation des commentaires lors de la suppression d’un utilisateur
- **Logs détaillés** dans la console pour chaque action critique (suppression, création, erreurs)
- **Sécurité renforcée** : vérification du mot de passe et confirmation textuelle pour la suppression de compte
- **Gestion avancée des erreurs** : messages d’erreur explicites et structurés pour le frontend

---

## Lancer le serveur back

```bash
cd server
npm install
npm start dev
```

---

## Structure du dossier /server/

- `controllers/` : Logique métier (CRUD, auth…)
- `models/` : Schémas Mongoose pour chaque entité
- `routes/` : Définition des endpoints
- `middleware/` : Authentification, gestion des erreurs
- `config/` : Connexion à la base MongoDB

---