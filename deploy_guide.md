# Guide de déploiement pour production

## 1. Installation sur le serveur

```bash
# Installer gunicorn
pip install -r requirements.txt
```

## 2. Lancer l'application avec Gunicorn

```bash
# Lancer en mode production
gunicorn -c gunicorn_config.py wsgi:app

# Ou lancer en arrière-plan
nohup gunicorn -c gunicorn_config.py wsgi:app &
```

## 3. Configuration Nginx (Reverse Proxy)

Créer `/etc/nginx/sites-available/fsac`:

```nginx
server {
    listen 80;
    server_name votre-domaine.com;
 
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static {
        alias /var/www/FSAC/static;
    }
}
```

Activer le site:
```bash
sudo ln -s /etc/nginx/sites-available/fsac /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 4. Service systemd (Auto-démarrage)

Créer `/etc/systemd/system/fsac.service`:

```ini
[Unit]
Description=FSAC Flask Application
After=network.target

[Service]
User=fsac_com
WorkingDirectory=/var/www/FSAC
Environment="PATH=/var/www/FSAC/myvenv/bin"
ExecStart=/var/www/FSAC/myvenv/bin/gunicorn -c gunicorn_config.py wsgi:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Activer le service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fsac
sudo systemctl start fsac
sudo systemctl status fsac
```

## 5. Configuration du pare-feu

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 6. HTTPS avec Let's Encrypt (Recommandé)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

## 7. Vérifier que l'application fonctionne

```bash
# Vérifier Gunicorn
curl http://localhost:5000

# Vérifier Nginx
curl http://votre-domaine.com
```

## Notes importantes

- Modifier `.env` avec `FLASK_ENV=production`
- Changer `SECRET_KEY` pour une valeur sécurisée
- Configurer votre DNS pour pointer vers l'IP du serveur
- L'application sera accessible via: http://votre-domaine.com

## Base de données : exécution des scripts SQL

⚠️ Toujours exécuter `shema.sql` et les fichiers `migrations/*.sql` avec un
client **utf8mb4**, sinon les accents des définitions ENUM (« évalué », …) sont
corrompus (mojibake) et l'application échoue ensuite avec l'erreur MySQL 1265 :

```bash
mysql -u<user> -p -h <host> --default-character-set=utf8mb4 Fsac < shema.sql
# ou dans le conteneur :
docker exec -i fsac_mysql_prod mysql -uroot -p<pass> --default-character-set=utf8mb4 Fsac < migrations/<fichier>.sql
```

Correctifs applicables aux bases créées avant ce correctif :
`migrations/fix_enum_encoding.sql` (répare `dossiers.statut` et
`import_logs.statut`). Les bases créées depuis l'ajout de `SET NAMES utf8mb4;`
en tête de `shema.sql` n'ont pas besoin de ce correctif.

