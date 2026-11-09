# app.py - Point d'entrée principal de l'application Flask

# Importation des modules nécessaires
from flask import Flask  # Framework web
from flask_mysqldb import MySQL  # Extension pour MySQL
from werkzeug.middleware.proxy_fix import ProxyFix  # Pour détecter HTTPS derrière Nginx
import os  # Opérations système
from datetime import timedelta  # Gestion des durées
from config import Config  # Importation de la configuration
import json

# Détection de l'environnement
FLASK_ENV = os.getenv('FLASK_ENV', 'development')
IS_PRODUCTION = FLASK_ENV == 'production'

# Création et configuration de l'application Flask
app = Flask(__name__)
app.config.from_object(Config)  # Chargement de la configuration depuis config.py

# En production derrière Nginx, Flask doit faire confiance aux en-têtes X-Forwarded-*
# pour connaître le vrai schéma (https) et l'adresse IP client
if IS_PRODUCTION:
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1, x_for=1, x_prefix=1)

# Configuration des paramètres de sécurité des sessions
app.config['SESSION_COOKIE_HTTPONLY'] = True          # Protection XSS
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'         # Protection CSRF
app.config['SESSION_COOKIE_SECURE'] = IS_PRODUCTION   # HTTPS uniquement en prod
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)  # Durée de vie des sessions

# Configuration du système de téléchargement
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'}  # Extensions autorisées
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 Mo max


# Initialisation de la connexion MySQL
mysql = MySQL(app)

# Migration : ajout des colonnes manquantes
with app.app_context():
    try:
        cur = mysql.connection.cursor()
        cur.execute("SHOW COLUMNS FROM enseignants LIKE 'guide_accepte'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE enseignants ADD COLUMN guide_accepte TINYINT(1) DEFAULT 0")
        cur.execute("SHOW COLUMNS FROM enseignants LIKE 'date_debut_avancement'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE enseignants ADD COLUMN date_debut_avancement DATE")
        cur.execute("SHOW COLUMNS FROM enseignants LIKE 'date_fin_avancement'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE enseignants ADD COLUMN date_fin_avancement DATE")
        cur.execute("SHOW COLUMNS FROM enseignants LIKE 'cin'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE enseignants ADD COLUMN cin VARCHAR(20) DEFAULT NULL")
        cur.execute("SHOW COLUMNS FROM users LIKE 'grade'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE users ADD COLUMN grade VARCHAR(100) DEFAULT NULL")
        cur.execute("SHOW COLUMNS FROM dossiers LIKE 'pdf_evaluation'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE dossiers ADD COLUMN pdf_evaluation VARCHAR(255) DEFAULT NULL")
        cur.execute("SHOW COLUMNS FROM dossiers LIKE 'annexe_i_signe'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE dossiers ADD COLUMN annexe_i_signe VARCHAR(255) DEFAULT NULL")
        cur.execute("SHOW COLUMNS FROM dossiers LIKE 'annexe_ii_signe'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE dossiers ADD COLUMN annexe_ii_signe VARCHAR(255) DEFAULT NULL")
        cur.execute("SHOW COLUMNS FROM ae1_3_ntic LIKE 'ae1_3_support_ntic'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE ae1_3_ntic ADD COLUMN ae1_3_support_ntic TEXT")
        cur.execute("SHOW COLUMNS FROM ae2_1_encadrements LIKE 'ae2_1_intitule_module'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE ae2_1_encadrements ADD COLUMN ae2_1_intitule_module TEXT")
        cur.execute("SHOW COLUMNS FROM ar1_4_revues LIKE 'ar1_4_publication_url'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE ar1_4_revues ADD COLUMN ar1_4_publication_url VARCHAR(500) DEFAULT NULL")
        # Migration : ajout de 'COMMISSION' dans l'ENUM role_user si absent
        cur.execute("SHOW COLUMNS FROM users LIKE 'role_user'")
        row = cur.fetchone()
        if row and 'COMMISSION' not in row['Type']:
            cur.execute("ALTER TABLE users MODIFY COLUMN role_user ENUM('ENSEIGNANT','COMMISSION','COORDINATEUR','SUPERADMIN') NOT NULL")
        mysql.connection.commit()
        cur.close()
    except Exception as e:
        print(f"Migration warning: {e}")

# ========================
# MIDDLEWARE DE SÉCURITÉ
# ========================
@app.after_request
def add_security_headers(response):
    """
    Ajoute des en-têtes de sécurité à toutes les réponses.
    En développement : Flask gère le SSL (adhoc).
    En production   : Nginx gère le SSL et ajoute HSTS.
    """
    # Empêcher la mise en cache pour toutes les pages
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'

    # En-têtes de sécurité supplémentaires
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-XSS-Protection'] = '1; mode=block'

    # HSTS : force HTTPS pour tous les navigateurs (prod uniquement)
    if IS_PRODUCTION:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    return response

# Importation des routes de l'application
from routes import *

# Point d'entrée de l'application (python app.py)
if __name__ == '__main__':
    # Création du dossier d'upload s'il n'existe pas
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)

    port = int(os.getenv('PORT', 5001))

    # ─── Détermination du contexte SSL ────────────────────────────────────
    #
    #  3 modes possibles (configurable via .env) :
    #
    #  MODE 1 — Certificats réels (production avec vrai domaine)
    #    SSL_CERT_PATH=/chemin/fullchain.pem
    #    SSL_KEY_PATH=/chemin/privkey.pem
    #
    #  MODE 2 — Certificat auto-signé généré (dev ou prod interne)
    #    SSL_CERT_PATH=nginx/ssl/fullchain.pem
    #    SSL_KEY_PATH=nginx/ssl/privkey.pem
    #
    #  MODE 3 — Adhoc pyOpenSSL (dev rapide, défaut si rien n'est défini)
    #    (aucune variable SSL_* requise)
    #
    # ──────────────────────────────────────────────────────────────────────

    ssl_cert = os.getenv('SSL_CERT_PATH', '')
    ssl_key  = os.getenv('SSL_KEY_PATH', '')

    disable_ssl = os.getenv('DISABLE_SSL', '').lower() == 'true'

    if disable_ssl:
        ssl_context = None
        print("🔓 Mode HTTP (sans SSL) activé via DISABLE_SSL=true")
    elif ssl_cert and ssl_key and os.path.isfile(ssl_cert) and os.path.isfile(ssl_key):
        # Mode 1 ou 2 : certificats fournis (réels ou auto-signés)
        ssl_context = (ssl_cert, ssl_key)
        cert_type = "certificat fourni" if IS_PRODUCTION else "certificat auto-signé"
        print(f"🔐 HTTPS activé avec {cert_type}")
        print(f"   Certificat : {ssl_cert}")
    else:
        # Mode 3 : adhoc pyOpenSSL (dev rapide)
        try:
            import cryptography  # noqa: F401
            ssl_context = 'adhoc'
            print("🔐 HTTPS activé avec certificat adhoc (pyOpenSSL)")
        except ImportError:
            ssl_context = None
            print("🔓 Cryptography non installé : fallback automatique sur HTTP (sans SSL)")

    protocol = "https" if ssl_context else "http"
    print(f"📌 URL : {protocol}://localhost:{port}")
    if ssl_context and not IS_PRODUCTION:
        print("   Chrome : 'Paramètres avancés' → 'Continuer vers localhost'")

    app.run(
        host='0.0.0.0',
        port=port,
        debug=not IS_PRODUCTION,
        threaded=True,
        ssl_context=ssl_context
    )