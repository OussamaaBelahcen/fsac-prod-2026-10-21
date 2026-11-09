#!/bin/bash
# =============================================================
# generate_ssl_dev.sh - Génère un certificat SSL auto-signé
# pour le développement local
# =============================================================
# Usage: bash nginx/generate_ssl_dev.sh
# =============================================================

SSL_DIR="$(dirname "$0")/ssl"
mkdir -p "$SSL_DIR"

echo "🔐 Génération du certificat SSL auto-signé pour le développement..."

openssl req -x509 \
    -nodes \
    -days 365 \
    -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out   "$SSL_DIR/fullchain.pem" \
    -subj "/C=MA/ST=Casablanca-Settat/L=Casablanca/O=FSAC-Dev/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo ""
echo "✅ Certificats générés dans : $SSL_DIR"
echo "   - fullchain.pem (certificat public)"
echo "   - privkey.pem   (clé privée)"
echo ""
echo "⚠️  Ce certificat est UNIQUEMENT pour le développement local."
echo "   En production, utilisez un vrai certificat (Let's Encrypt)."
echo ""
echo "📌 Chrome affichera 'Connexion non privée' → cliquez 'Paramètres avancés'"
echo "   puis 'Continuer vers localhost'. Les PDF se téléchargeront sans avertissement."
