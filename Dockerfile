# Utiliser l'image officielle Python comme image de base
FROM python:3.9-slim

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY requirements.txt .

# Installer les dépendances système nécessaires pour les bibliothèques requises par xhtml2pdf et mysqlclient
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    default-mysql-client \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libgdk-pixbuf-xlib-2.0-dev \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source
COPY . .

# Exposer le port sur lequel l'application s'exécutera
EXPOSE 5000

# Variable d'environnement pour Flask
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0

# Copier le script d'entrée
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Utiliser le script d'entrée
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# La commande par défaut sera passée au script d'entrée
CMD ["sh", "-c", "python app.py"]