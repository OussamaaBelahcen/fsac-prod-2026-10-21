# FSAC - Espace Enseignant

## Description
FSAC (Formation Supérieure et Avancée Continue) est une application web permettant aux enseignants de gérer leurs dossiers de promotion et activités académiques.

## Prérequis
- Docker and Docker Compose
- Git

## Installation et Configuration (Environnement de Développement)

### 1. Cloner le référentiel
```bash
git clone <repository-url>
cd projet-fsac-cmepro
```

### 2. Configuration de l'environnement
Copiez le fichier d'exemple d'environnement :
```bash
cp .env.example .env
```

Le fichier `.env.example` contient déjà des valeurs par défaut pour le développement, y compris les identifiants du compte administrateur qui seront créés automatiquement :
```env
# Configuration Flask
SECRET_KEY=your-secret-key-here-change-in-production

# Configuration MySQL (utiliser le nom du service Docker 'db')
MYSQL_HOST=db
MYSQL_USER=root
MYSQL_PASSWORD=your-password-here
MYSQL_DB=Fsac

# Environnement Flask (development ou production)
FLASK_ENV=development

# Admin user credentials for automatic creation (development only)
ADMIN_EMAIL=admin@fsac.com
ADMIN_PASSWORD=admin123
ADMIN_ROLE=SUPERADMIN
ADMIN_FIRSTNAME=Admin
ADMIN_LASTNAME=System
```

Vous pouvez modifier ces valeurs si vous le souhaitez, mais les valeurs par défaut fonctionneront immédiatement.

> **Note** : Le fichier `.env` est déjà dans `.gitignore` pour éviter de commiter des informations sensibles par accident.

### 3. Lancer l'application avec Docker Compose
```bash
docker-compose up --build
```

La première exécution :
1. Télécharge l'image MySQL
2. Construit l'image de l'application web
3. Attend que la base de données soit prête
4. Initialise la base de données avec le schéma fourni
5. Crée automatiquement le compte administrateur (si il n'existe pas déjà)
6. Démarre l'application Flask

L'application sera accessible à l'adresse suivante : http://localhost:5000

### 4. Accès à l'application
- URL principale : http://localhost:5000
- Compte administrateur : 
  - Email : admin@fsac.com (ou celui défini dans `ADMIN_EMAIL`)
  - Mot de passe : admin123 (ou celui défini dans `ADMIN_PASSWORD`)

### 5. Arrêter l'application
```bash
docker-compose down
```

Pour arrêter et supprimer les volumes (y compris les données de la base de données) :
```bash
docker-compose down -v
```

## Développement
Pour modifier le code et voir les changements en temps réel, le code source est monté en volume dans le conteneur web. Les changements que vous apportez localement seront immédiatement visibles dans l'application.

## Variables d'environnement
| Variable | Description | Défaut |
|----------|-------------|--------|
| SECRET_KEY | Clé secrète pour Flask | fallback-secret-key-for-dev |
| MYSQL_HOST | Hôte MySQL (utiliser 'db' en Docker) | db |
| MYSQL_USER | Utilisateur MySQL | root |
| MYSQL_PASSWORD | Mot de passe MySQL | (à définir) |
| MYSQL_DB | Nom de la base de données | Fsac |
| FLASK_ENV | Environnement Flask (development/production) | development |
| ADMIN_EMAIL | Email du compte administrateur à créer | admin@fsac.com |
| ADMIN_PASSWORD | Mot de passe du compte administrateur | admin123 |
| ADMIN_ROLE | Rôle du compte administrateur | SUPERADMIN |
| ADMIN_FIRSTNAME | Prénom du compte administrateur | Admin |
| ADMIN_LASTNAME | Nom du compte administrateur | System |

## Dépannage
- Si vous rencontrez des problèmes de connexion à la base de données, assurez-vous que le conteneur MySQL est healthy en exécutant `docker-compose ps`
- Consultez les logs avec `docker-compose logs -f` pour voir les sorties en temps réel
- Pour reconstruire après avoir modifié les dépendances : `docker-compose up --build --no-deps web`
- Si vous modifiez le schéma de la base de données, vous devrez peut-être supprimer le volume de données MySQL : `docker-compose down -v` puis `docker-compose up --build`

## Note
Cet environnement de développement est conçu pour être simple et rapide à mettre en place. Pour un déploiement en production, référez-vous au fichier `deploy_guide.md` qui décrit l'utilisation de Gunicorn et Nginx.