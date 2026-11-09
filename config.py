# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY') or 'fallback-secret-key-for-dev'
    MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
    MYSQL_USER = os.getenv('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', 'root')
    MYSQL_DB = os.getenv('MYSQL_DB', 'Fsac')
    MYSQL_CURSORCLASS = 'DictCursor'

    # Options Flask supplémentaires (optionnel)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 86400  # 24h en secondes

    # SMTP
    MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
    MAIL_USERNAME = os.getenv('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD', '')
    MAIL_FROM = os.getenv('MAIL_FROM', 'noreply@univh2c.ma')
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'true').lower() == 'true'

    # Import
    IMPORT_MAX_LINES = 500
    IMPORT_MAX_SIZE_MB = 2

    # URL publique de l'application (liens dans les emails)
    APP_URL = os.getenv('APP_URL', 'http://127.0.0.1:5000')

# Mapping grade → rôle utilisateur
GRADE_ROLE_MAP = {
    'MC A':  'ENSEIGNANT', 'MC B':  'ENSEIGNANT', 'MC C':  'ENSEIGNANT',
    'MCH A': 'ENSEIGNANT', 'MCH B': 'ENSEIGNANT', 'MCH C': 'ENSEIGNANT',
    'PES A': 'ENSEIGNANT', 'PES B': 'ENSEIGNANT',
    'PES C': 'ENSEIGNANT', 'PES D': 'ENSEIGNANT',
}

# Suffixe du mot de passe par rôle
ROLE_PASSWORD_SUFFIX = {
    'ENSEIGNANT':   'ENSEIGNANT',
    'COMMISSION':   'COMMISSION',
    'COORDINATEUR': 'COORDINATEUR',
    'SUPERADMIN':   'SUPERADMIN',
}

ROLES_VALIDES = {'ENSEIGNANT', 'COMMISSION', 'COORDINATEUR', 'SUPERADMIN'}

# Regex
CIN_REGEX = r'^[A-Za-z]{1,2}\d{5,6}$'
PPR_REGEX = r'^\d+$'
TEL_REGEX = r'^(?:0)?[5-7]\d{8}$'