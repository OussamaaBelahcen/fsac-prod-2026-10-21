from flask import render_template, request, redirect, url_for, session, flash, jsonify, send_file
from werkzeug.utils import secure_filename
from datetime import datetime, date
from functools import wraps
import bcrypt
import re
import os
import time
import json
import io
from xhtml2pdf import pisa
# Importer app et mysql depuis app.py
from app import app, mysql
from services.dossier_service import DossierService
from repositories.dossier_repository import DossierRepository
from repositories.activite_repository import ActiviteRepository
from services.file_service import FileService
from services.logger_service import LoggerService
from utils.validators import GRADE_HIERARCHY, can_evaluate
from config import Config

# ========================
# SÉCURITÉ — Empêcher la mise en cache des pages protégées
# ========================
@app.after_request
def set_cache_headers(response):
    """Empêche le navigateur de mettre en cache les pages HTML (protection boutons back/forward)."""
    if request.endpoint and request.endpoint not in ('login', 'sign_in', 'static'):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# ========================
# UTILITAIRES
# ========================
def is_valid_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def allowed_file(filename):
    """Vérifie que le fichier a une extension autorisée."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg','doc','pdf','docx'}

def is_valid_password(password):
    """
    Valide qu'un mot de passe respecte les critères de sécurité :
    - Au moins 8 caractères
    - Au moins 1 lettre majuscule
    - Au moins 1 chiffre
    - Au moins 1 caractère spécial
    
    Retourne (bool, str) : (valide, message_erreur)
    """
    if len(password) < 8:
        return False, "Le mot de passe doit contenir au moins 8 caractères."
    
    if not re.search(r'[A-Z]', password):
        return False, "Le mot de passe doit contenir au moins une lettre majuscule."
    
    if not re.search(r'[0-9]', password):
        return False, "Le mot de passe doit contenir au moins un chiffre."
    
    if not re.search(r'[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\\/;\'`~]', password):
        return False, "Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...)."
    
    return True, ""

# ========================
# DÉCORATEURS DE SÉCURITÉ
# ========================
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Vérifier si l'utilisateur est connecté
        if 'user_id' not in session:
            flash('Veuillez vous connecter pour accéder à cette page.', 'warning')
            return redirect(url_for('login'))
        
        # Exécuter la fonction protégée
        response = app.make_response(f(*args, **kwargs))
        
        # Ajouter des en-têtes pour empêcher la mise en cache
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
    return decorated_function

def role_required(*required_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                flash('Veuillez vous connecter pour accéder à cette page.', 'warning')
                return redirect(url_for('login'))
            if session.get('role') not in required_roles:
                flash('Accès refusé. Vous n\'avez pas les permissions nécessaires.', 'danger')
                return redirect(url_for('dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# ========================
# PREMIÈRE CONNEXION — forcer changement de mot de passe
# ========================
@app.before_request
def check_premiere_connexion():
    """Bloque l'accès aux modules si premiere_connexion = 1."""
    if 'user_id' not in session:
        return
    endpoint = request.endpoint
    allowed = ('login', 'static', 'force_change_password', 'api_force_change_password', 'api_check_auth')
    if endpoint and any(endpoint.startswith(a) for a in allowed):
        return
    if session.get('premiere_connexion'):
        return redirect(url_for('force_change_password'))

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

@app.route('/force-change-password')
@login_required
def force_change_password():
    """Page de changement obligatoire du mot de passe (première connexion)."""
    role = session.get('role')
    return render_template('force_change_password.html', role=role)

@app.route('/api/force-change-password', methods=['POST'])
@login_required
def api_force_change_password():
    data = request.get_json()
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')
    if not old_password or not new_password:
        return jsonify({'success': False, 'message': 'Veuillez remplir tous les champs.'}), 400
    cur = mysql.connection.cursor()
    cur.execute("SELECT mot_de_pass_user FROM users WHERE iduser = %s", (session['user_id'],))
    user = cur.fetchone()
    if not user:
        cur.close()
        return jsonify({'success': False, 'message': 'Utilisateur introuvable.'}), 404
    if not bcrypt.checkpw(old_password.encode('utf-8'), user['mot_de_pass_user'].encode('utf-8')):
        cur.close()
        return jsonify({'success': False, 'message': 'Ancien mot de passe incorrect.'}), 401
    is_valid, error_message = is_valid_password(new_password)
    if not is_valid:
        cur.close()
        return jsonify({'success': False, 'message': error_message}), 400
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    cur.execute("UPDATE users SET mot_de_pass_user = %s, premiere_connexion = 0 WHERE iduser = %s", (hashed, session['user_id']))

    mysql.connection.commit()
    cur.close()
    session['premiere_connexion'] = False
    flash('Mot de passe modifié avec succès !', 'welcome')
    # Rediriger les enseignants vers la grille d'avancement, les autres vers le dashboard
    if session.get('role') == 'ENSEIGNANT':
        redirect_url = url_for('guide_avancement')
    else:
        redirect_url = url_for('dashboard')
    return jsonify({'success': True, 'redirect': redirect_url})

@app.route('/api/check-auth')
def check_auth():
    """Vérifie si la session est active (pour le contrôle client)"""
    if 'user_id' in session:
        return jsonify({'authenticated': True}), 200
    return jsonify({'authenticated': False}), 401


# ========================
# FILTRES JINJA CUSTOM
# ========================
@app.template_filter('break_long_words')
def break_long_words_filter(text, length=7):
    """
    Coupe les mots trop longs en insérant un espace tous les 'length' caractères
    pour éviter le débordement dans les PDF générés par xhtml2pdf.
    """
    if not text or not isinstance(text, str):
        return text
    
    words = text.split(' ')
    processed_words = []
    
    for word in words:
        if len(word) > length:
            chunks = [word[i:i+length] for i in range(0, len(word), length)]
            processed_words.append(' '.join(chunks))
        else:
            processed_words.append(word)
            
    return ' '.join(processed_words)

    #if 'user_id' in session:
    #   return redirect(url_for('dashboard'))
    return redirect(url_for('login'))
@app.route('/login', methods=['GET', 'POST'])
def login():
    #if 'user_id' in session:
    #    return redirect(url_for('dashboard'))
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        mot_de_passe = request.form.get('mot_de_passe', '')
        if not email or not mot_de_passe:
            flash('Veuillez remplir tous les champs.', 'danger')
            return render_template('login.html')
        try:
            cur = mysql.connection.cursor()
            cur.execute("SELECT * FROM users WHERE email_user = %s", (email,))
            user = cur.fetchone()
            cur.close()
            if user and bcrypt.checkpw(
                mot_de_passe.encode('utf-8'), 
                user['mot_de_pass_user'].encode('utf-8')
            ):
                if user['statut'] == 'inactif':
                    LoggerService.log_action(email, user['role_user'], "LOGIN_BLOCKED", "Compte désactivé", status="FAILURE")
                    flash('Votre compte a été désactivé. Pour retrouver votre accès, veuillez contacter votre administrateur.', 'danger')
                    return render_template('login.html')
                session['user_id'] = user['iduser']
                session['email'] = user['email_user']
                session['role'] = user['role_user']
                session['premiere_connexion'] = bool(user.get('premiere_connexion', 0))
                # Charger les données métier selon le rôle
                if user['role_user'] == 'ENSEIGNANT':
                    cur = mysql.connection.cursor()
                    cur.execute("SELECT * FROM enseignants WHERE iduser = %s", (user['iduser'],))
                    enseignant = cur.fetchone()
                    cur.close()
                    if enseignant:
                        session['enseignant_id'] = enseignant['id']
                        session['enseignant_nom'] = enseignant['nom']
                        session['enseignant_prenom'] = enseignant['prenom']
                        # Mettre à jour dernière connexion
                        cur = mysql.connection.cursor()
                        cur.execute("UPDATE enseignants SET derniere_connexion = NOW() WHERE id = %s", (enseignant['id'],))
                        mysql.connection.commit()
                        cur.close()
                    else:
                        flash('Profil enseignant introuvable.', 'danger')
                        return render_template('login.html')
                
                LoggerService.log_action(email, user['role_user'], "LOGIN", "Connexion réussie")
                if not session.get('premiere_connexion'):
                    flash(f'Réussite d\'accès à l\'espace {user["prenom"]} !', 'welcome')
                return redirect(url_for('dashboard'))
            else:
                LoggerService.log_action(email, "UNKNOWN", "LOGIN_FAILED", "Email ou mot de passe incorrect", status="FAILURE")
                flash('Email ou mot de passe incorrect.', 'danger')
        except Exception as e:
            flash(f'Erreur: {str(e)}', 'danger')
            print(f"❌ SQL Error: {e}")
    return render_template('login.html')

@app.route('/sign-in', methods=['GET', 'POST'])
def sign_in():
    #if 'user_id' in session:
    #    return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        nom = request.form.get('nom', '').strip()
        prenom = request.form.get('prenom', '').strip()
        email = request.form.get('email', '').strip()
        mot_de_passe = request.form.get('mot_de_passe', '')
        confirmation = request.form.get('confirmation', '')
        role = request.form.get('role', '').strip().upper()
        
        # Validation des champs obligatoires
        if not all([nom, prenom, email, mot_de_passe, confirmation, role]):
            flash('Veuillez remplir tous les champs obligatoires.', 'danger')
            return render_template('login.html')

        # Validation de l'email
        if not is_valid_email(email):
            flash('Veuillez entrer une adresse email valide.', 'danger')
            return render_template('login.html')

        # Validation des mots de passe
        if mot_de_passe != confirmation:
            flash('Les mots de passe ne correspondent pas.', 'danger')
            return render_template('login.html')

        # Validation du mot de passe
        is_valid, error_message = is_valid_password(mot_de_passe)
        if not is_valid:
            flash(error_message, 'danger')
            return render_template('login.html')

        # Validation du rôle
        roles_valides = ['ENSEIGNANT', 'COMMISSION', 'COORDINATEUR', 'SUPERADMIN']
        if role not in roles_valides:
            flash('Rôle invalide. Veuillez sélectionner un rôle valide.', 'danger')
            return render_template('login.html')

        try:
            cur = mysql.connection.cursor()
            
            # Vérifier si l'email existe déjà
            cur.execute("SELECT iduser FROM users WHERE email_user = %s", (email,))
            if cur.fetchone():
                flash('Cet email est déjà utilisé.', 'danger')
                cur.close()
                return render_template('login.html')

            # Hacher le mot de passe
            hashed = bcrypt.hashpw(mot_de_passe.encode('utf-8'), bcrypt.gensalt())

            # Insérer dans `users` avec le rôle sélectionné
            cur.execute(
                "INSERT INTO users (email_user, mot_de_pass_user, role_user, statut, date_creation) VALUES (%s, %s, %s, 'actif', NOW())",
                (email, hashed.decode('utf-8'), role)
            )
            user_id = cur.lastrowid

            # Si le rôle est ENSEIGNANT, créer aussi l'entrée dans la table enseignants
            if role == 'ENSEIGNANT':
                cur.execute(
                    "INSERT INTO enseignants (iduser, nom, prenom, email) VALUES (%s, %s, %s, %s)",
                    (user_id, nom, prenom, email)
                )
            
            mysql.connection.commit()
            cur.close()

            LoggerService.log_action(email, role, "USER_REGISTER", "Nouvel utilisateur inscrit")

            flash(f'Inscription réussie en tant que {role} ! Vous pouvez maintenant vous connecter.', 'welcome')
            return redirect(url_for('login'))

        except Exception as e:
            mysql.connection.rollback()
            flash(f'Erreur: {str(e)}', 'danger')
            print(f"SQL Error: {e}")

    return render_template('login.html')

@app.route('/logout')
def logout():
    # Logging
    if 'email' in session:
        LoggerService.log_action(session.get('email'), session.get('role'), "LOGOUT", "Déconnexion utilisateur")

    # Effacer complètement la session
    session.clear()
    
    # Message de confirmation
    flash('Déconnecté avec succès.', 'info')
    
    # Créer une réponse de redirection
    response = app.make_response(redirect(url_for('login')))
    
    # Ajouter des en-têtes pour empêcher la mise en cache
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    # Suppression du header Clear-Site-Data qui cause des lenteurs (20s)
    # response.headers['Clear-Site-Data'] = '"cache", "cookies", "storage", "executionContexts"'

    # Supprimer les cookies de session
    response.set_cookie('session', '', expires=0)
    
    return response

# ========================
# DASHBOARD PRINCIPAL
# ========================
@app.route('/dashboard')
@login_required
def dashboard():
    role = session.get('role')
    if role == 'ENSEIGNANT':
        return redirect(url_for('enseignant_page'))
    elif role == 'COORDINATEUR':
        return redirect(url_for('coordinateurpage'))
    elif role == 'COMMISSION':
        return redirect(url_for('membrecommission'))
    elif role == 'SUPERADMIN':
        return redirect(url_for('superadmin_dashboard'))
    else:
        flash('Rôle non reconnu.', 'danger')
        return redirect(url_for('login'))

@app.route('/profil')
@login_required
def profil():
    role = session.get('role')
    cur = mysql.connection.cursor()
    # Récupérer les infos de base depuis la table `users`
    
    cur.execute("SELECT email_user, nom, prenom FROM users WHERE iduser = %s", (session['user_id'],))
    user = cur.fetchone()
    cur.close()

    if not user:
        flash('Profil introuvable.', 'danger')
        return redirect(url_for('dashboard'))

    # Si c'est un enseignant, on peut aussi charger les données métier
    enseignant_data = None
    commission_grade = None
    if role == 'ENSEIGNANT':
        cur = mysql.connection.cursor()
        cur.execute("SELECT grade, departement, ppr ,nom , prenom FROM enseignants WHERE iduser = %s", (session['user_id'],))
        enseignant_data = cur.fetchone()
        cur.close()
    elif role == 'COMMISSION':
        cur = mysql.connection.cursor()
        cur.execute("SELECT grade FROM users WHERE iduser = %s", (session['user_id'],))
        row = cur.fetchone()
        commission_grade = row['grade'] if row else None
        cur.close()

    return render_template('profil.html', user=user, enseignant_data=enseignant_data, role=role, commission_grade=commission_grade)

# ========================
# NOTIFICATIONS
# ========================
def add_notification(user_id, message, lien=None):
    """Ajoute une notification pour un utilisateur."""
    try:
        cur = mysql.connection.cursor()
        cur.execute("INSERT INTO notifications (user_id, message, lien) VALUES (%s, %s, %s)", (user_id, message, lien))
        mysql.connection.commit()
        cur.close()
    except Exception as e:
        print(f"Erreur add_notification: {e}")

@app.route('/api/notifications/count')
@login_required
def notifications_count():
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = %s AND lu = 0", (session['user_id'],))
        row = cur.fetchone()
        cur.close()
        return jsonify({'count': row['cnt']})
    except:
        return jsonify({'count': 0})

@app.route('/api/notifications')
@login_required
def notifications_list():
    try:
        role = session.get('role')
        user_id = session['user_id']
        c = mysql.connection.cursor()

        # Fixer les anciens liens consulter-dossier → membrecommission
        if role == 'COMMISSION':
            c.execute("SELECT id, lien FROM notifications WHERE user_id = %s", (user_id,))
            for old in c.fetchall():
                if old['lien'] and '/consulter-dossier/' in old['lien']:
                    m = re.search(r'/consulter-dossier/(\d+)', old['lien'])
                    if m:
                        c.execute("UPDATE notifications SET lien = %s WHERE id = %s", (url_for('membrecommission', evaluate=int(m.group(1))), old['id']))
            mysql.connection.commit()

        c.execute("SELECT id, message, lien, lu, date_creation FROM notifications WHERE user_id = %s ORDER BY date_creation DESC LIMIT 20", (user_id,))
        rows = c.fetchall()
        c.close()

        items = []
        for r in rows:
            lien = r['lien']
            if role == 'COMMISSION' and lien and '/consulter-dossier/' in lien:
                m = re.search(r'/consulter-dossier/(\d+)', lien)
                if m:
                    lien = url_for('membrecommission', evaluate=int(m.group(1)))
            items.append({
                'id': r['id'],
                'message': r['message'],
                'lien': lien,
                'lu': bool(r['lu']),
                'date': r['date_creation'].strftime('%d/%m %H:%M') if r['date_creation'] else ''
            })
        return jsonify({'notifications': items})
    except Exception as e:
        print(f"Erreur notifications_list: {e}")
        return jsonify({'notifications': []})

@app.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
@login_required
def notification_read(notif_id):
    try:
        cur = mysql.connection.cursor()
        cur.execute("UPDATE notifications SET lu = 1 WHERE id = %s AND user_id = %s", (notif_id, session['user_id']))
        mysql.connection.commit()
        cur.close()
        return jsonify({'success': True})
    except:
        return jsonify({'success': False}), 500

@app.route('/api/notifications/read-all', methods=['POST'])
@login_required
def notifications_read_all():
    try:
        cur = mysql.connection.cursor()
        cur.execute("UPDATE notifications SET lu = 1 WHERE user_id = %s AND lu = 0", (session['user_id'],))
        mysql.connection.commit()
        cur.close()
        return jsonify({'success': True})
    except:
        return jsonify({'success': False}), 500

@app.route('/api/change-password', methods=['POST'])
@login_required
def change_password():
    """Changer le mot de passe (accessible par tous les rôles sauf SUPERADMIN)"""
    try:
        data = request.get_json()
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        if not old_password or not new_password:
            return jsonify({'success': False, 'message': 'Veuillez remplir tous les champs.'}), 400
        
        cur = mysql.connection.cursor()
        
        # Chercher le mot de passe dans la table `users`
        cur.execute("SELECT mot_de_pass_user FROM users WHERE iduser = %s", (session['user_id'],))
        user = cur.fetchone()
        if not user:
            return jsonify({'success': False, 'message': 'Utilisateur introuvable.'}), 404
        
        # Vérifier l'ancien mot de passe
        if not bcrypt.checkpw(old_password.encode('utf-8'), user['mot_de_pass_user'].encode('utf-8')):
            return jsonify({'success': False, 'message': 'Ancien mot de passe incorrect.'}), 401
        
        # Valider le nouveau mot de passe
        is_valid, error_message = is_valid_password(new_password)
        if not is_valid:
            return jsonify({'success': False, 'message': error_message}), 400
        
        # Hacher le nouveau mot de passe
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        # Mettre à jour dans `users`
        cur.execute("UPDATE users SET mot_de_pass_user = %s WHERE iduser = %s", (hashed.decode('utf-8'), session['user_id']))
        mysql.connection.commit()
        cur.close()
        
        return jsonify({'success': True, 'message': 'Mot de passe modifié avec succès.'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ========================
# NOTIFICATIONS
# ========================
# ROUTES ENSEIGNANT
# ========================
@app.route('/dossier-enseignant')
@login_required
@role_required('ENSEIGNANT')
def dossier_enseignant():
    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM enseignants WHERE id = %s", (session['enseignant_id'],))
    enseignant = cur.fetchone()
    cur.execute("""
        SELECT * FROM dossiers 
        WHERE enseignant_id = %s 
        ORDER BY date_soumission DESC 
        LIMIT 1
    """, (session['enseignant_id'],))
    dossier = cur.fetchone()
    cur.close()
    return render_template('dossier_enseignant.html', enseignant=enseignant, dossier=dossier)

@app.route('/annexes-signees')
@login_required
@role_required('ENSEIGNANT')
def annexes_signees():
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT * FROM dossiers 
        WHERE enseignant_id = %s 
        ORDER BY date_soumission DESC 
        LIMIT 1
    """, (session['enseignant_id'],))
    dossier = cur.fetchone()
    cur.close()
    return render_template('annexes_signees.html', dossier=dossier)

@app.route('/guide-avancement')
@login_required
@role_required('ENSEIGNANT')
def guide_avancement():
    return render_template('guide_avancement.html')

@app.route('/api/accept-guide', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def accept_guide():
    data = request.get_json() or {}
    if not data.get('accepted'):
        return jsonify({'success': False, 'message': 'Acceptation requise.'}), 400
    enseignant_id = session.get('enseignant_id')
    cur = mysql.connection.cursor()
    cur.execute("UPDATE enseignants SET guide_accepte = 1 WHERE id = %s", (enseignant_id,))
    mysql.connection.commit()
    cur.close()
    return jsonify({'success': True, 'redirect': url_for('enseignant_page')})

@app.route('/enseignant-page')
@login_required
@role_required('ENSEIGNANT')
def enseignant_page():
    enseignant_id = session.get('enseignant_id')
    
    # Vérifier si l'enseignant a accepté la grille d'avancement
    cur = mysql.connection.cursor()
    cur.execute("SELECT guide_accepte FROM enseignants WHERE id = %s", (enseignant_id,))
    ens = cur.fetchone()
    cur.close()
    if not ens or not ens.get('guide_accepte'):
        return redirect(url_for('guide_avancement'))
    
    # Vérifier si un dossier existe déjà (brouillon ou soumis)
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT id, statut, note FROM dossiers 
        WHERE enseignant_id = %s 
        ORDER BY date_soumission DESC, id DESC 
        LIMIT 1
    """, (enseignant_id,))
    dossier = cur.fetchone()
    cur.close()
    
    # Récupérer les infos de l'enseignant pour pré-remplissage
    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM enseignants WHERE id = %s", (enseignant_id,))
    enseignant = cur.fetchone()
    cur.close()

    evaluations = {}
    note_generale = None
    if dossier and dossier['statut'] == 'évalué':
        note_generale = dossier.get('note')
        cur = mysql.connection.cursor()
        cur.execute(
            "SELECT section_key, commentaire FROM evaluations_details WHERE dossier_id = %s",
            (dossier['id'],),
        )
        evaluations = {row['section_key']: (row['commentaire'] or '') for row in cur.fetchall()}
        cur.close()

    if dossier:
        # Déterminer si le mode lecture seule doit être activé
        is_readonly = dossier['statut'] in ['soumis', 'évalué', 'validé', 'rejeté']
        
        # Passer le statut et le mode readonly au template
        return render_template('enseignant.html', 
                             dossier_exists=True, 
                             dossier_statut=dossier['statut'],
                             readonly_mode=is_readonly,
                             enseignant=enseignant,
                             evaluations=evaluations,
                             note_generale=note_generale,
                             annee=datetime.now().year - 1)
    
    # Aucun dossier n'existe, permettre la création
    return render_template('enseignant.html', dossier_exists=False, enseignant=enseignant, annee=datetime.now().year - 1)


# ===========================================
# API : UPLOAD DE FICHIERS JUSTIFICATIFS (Cross-Step)
# ===========================================
@app.route('/api/upload-evidence', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def upload_evidence():
    """
    Endpoint générique pour uploader des preuves (PDF/Image) de manière asynchrone.
    Retourne le chemin relatif du fichier sauvegardé.
    """
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'Aucun fichier fourni.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Nom de fichier vide.'}), 400
        
    # Vérifier l'extension (PDF ou Image)
    if not (file.filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg'))):
        return jsonify({'success': False, 'message': 'Format non autorisé. Utilisez PDF ou Image.'}), 400

    try:
        enseignant_id = session.get('enseignant_id')
        user_id = session.get('user_id')
        
        # Récupérer le dossier (pour nommer le dossier de destination)
        cur = mysql.connection.cursor()
        cur.execute("SELECT id, statut FROM dossiers WHERE enseignant_id = %s ORDER BY id DESC LIMIT 1", (enseignant_id,))
        dossier = cur.fetchone()
        cur.close()

        if not dossier:
             # Création d'un dossier brouillon si inexistant (cas rare ici mais possible)
            cur = mysql.connection.cursor()
            cur.execute("INSERT INTO dossiers (enseignant_id, annee, statut) VALUES (%s, %s, 'brouillon')", (enseignant_id, datetime.now().year))
            dossier_id = cur.lastrowid
            mysql.connection.commit()
            cur.close()
        else:
            dossier_id = dossier['id']
            if dossier['statut'] != 'brouillon':
                 return jsonify({'success': False, 'message': 'Dossier déjà soumis.'}), 403

        # Récupérer infos enseignant pour le nom du dossier
        cur = mysql.connection.cursor()
        cur.execute("SELECT nom, prenom FROM enseignants WHERE id = %s", (enseignant_id,))
        ens_data = cur.fetchone()
        cur.close()
        
        nom_safe = secure_filename(ens_data['nom'] or 'nom')
        prenom_safe = secure_filename(ens_data['prenom'] or 'prenom')
        folder_name = f"{nom_safe}_{prenom_safe}_{dossier_id}"
        
        # Dossier spécifique pour les preuves (evidence) ou général ?
        # On met tout dans le dossier de l'enseignant pour simplifier
        upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], folder_name) 
        if not os.path.exists(upload_folder):
             os.makedirs(upload_folder)

        # Générer un nom de fichier unique
        ext = file.filename.rsplit('.', 1)[1].lower()
        # Préfixe 'evidence_' pour distinguer
        filename = secure_filename(f"evidence_{user_id}_{int(time.time())}.{ext}")
        filepath = os.path.join(upload_folder, filename)
        
        file.save(filepath)
        
        # Chemin relatif à retourner
        relative_path = f"uploads/{folder_name}/{filename}"
        
        return jsonify({
            'success': True,
            'path': relative_path,
            'filename': filename
        })

    except Exception as e:
        print(f"❌ Erreur upload_evidence : {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ===========================================
# API : UPLOAD ANNEXE SIGNÉE
# ===========================================
@app.route('/api/upload-annexe-signe/<int:dossier_id>/<int:annexe_num>', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def upload_annexe_signe(dossier_id, annexe_num):
    """Upload d'une annexe signée (PDF scanné) par l'enseignant"""
    if annexe_num not in (1, 2):
        return jsonify({'success': False, 'message': 'Numéro d\'annexe invalide.'}), 400

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'Aucun fichier fourni.'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Nom de fichier vide.'}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'success': False, 'message': 'Seuls les fichiers PDF sont acceptés.'}), 400

    try:
        enseignant_id = session.get('enseignant_id')
        # Vérifier que le dossier appartient à l'enseignant
        cur = mysql.connection.cursor()
        cur.execute("SELECT id, statut FROM dossiers WHERE id = %s AND enseignant_id = %s", (dossier_id, enseignant_id))
        dossier = cur.fetchone()
        cur.close()

        if not dossier:
            return jsonify({'success': False, 'message': 'Dossier non trouvé.'}), 404

        if dossier['statut'] not in ('brouillon', 'soumis'):
            return jsonify({'success': False, 'message': 'Le dossier n\'est plus modifiable.'}), 403

        # Récupérer infos enseignant pour le dossier de destination
        cur = mysql.connection.cursor()
        cur.execute("SELECT nom, prenom FROM enseignants WHERE id = %s", (enseignant_id,))
        ens = cur.fetchone()
        cur.close()

        nom_safe = secure_filename(ens['nom'] or 'nom')
        prenom_safe = secure_filename(ens['prenom'] or 'prenom')
        folder_name = f"{nom_safe}_{prenom_safe}_{dossier_id}"
        upload_folder = os.path.join(app.root_path, 'static', 'uploads', folder_name)
        os.makedirs(upload_folder, exist_ok=True)

        # Supprimer l'ancienne annexe signée si elle existe
        col_name = f'annexe_{["i","ii"][annexe_num-1]}_signe'
        cur = mysql.connection.cursor()
        cur.execute(f"SELECT {col_name} FROM dossiers WHERE id = %s", (dossier_id,))
        old = cur.fetchone()
        if old and old[col_name]:
            old_path = os.path.join(app.root_path, 'static', old[col_name])
            if os.path.exists(old_path):
                os.remove(old_path)

        # Générer le nom du fichier
        timestamp = int(time.time())
        filename = secure_filename(f"annexe_{['i','ii'][annexe_num-1]}_signe_{enseignant_id}_{timestamp}.pdf")
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)

        relative_path = f"uploads/{folder_name}/{filename}"

        # Mettre à jour la BDD
        cur.execute(f"UPDATE dossiers SET {col_name} = %s WHERE id = %s", (relative_path, dossier_id))
        mysql.connection.commit()
        cur.close()

        return jsonify({
            'success': True,
            'path': relative_path,
            'message': f'Annexe {["I","II"][annexe_num-1]} signée uploadée avec succès.'
        })

    except Exception as e:
        print(f"Erreur upload_annexe_signe: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ===========================================
# API : CRÉATION DU DOSSIER
# ===========================================
@app.route('/api/create-dossier', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def create_dossier():
    try:
        enseignant_id = session.get('enseignant_id')
        if not enseignant_id:
            return jsonify({'success': False, 'message': 'Session invalide.'}), 401
            
        dossier_id = DossierService.create_dossier(enseignant_id)
        
        return jsonify({
            'success': True,
            'message': 'Dossier créé avec succès',
            'dossier_id': dossier_id
        })
    except Exception as e:
        print(f"❌ Erreur create_dossier : {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ===========================================
# HELPER : Invalider le cache PDF annexes
# ===========================================
def invalidate_annexe_cache(dossier_id):
    """Supprime les PDFs d'annexes cached pour un dossier donné"""
    annexes_folder = os.path.join(app.root_path, 'static', 'uploads', 'annexes_pdf')
    for num in [1, 2]:
        f = os.path.join(annexes_folder, f'annexe_{num}_{dossier_id}.pdf')
        if os.path.isfile(f):
            try:
                os.remove(f)
            except OSError:
                pass

# ===========================================
# API : ÉTAPES ""01"" DU DOSSIER (ENSEIGNANT) 
# ===========================================
@app.route('/api/save-step1', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def save_step1():
    try:
        enseignant_id = session.get('enseignant_id')
        user_id = session.get('user_id')
        if not enseignant_id or not user_id:
            return jsonify({'success': False, 'message': 'Session invalide.'}), 401

        #  VÉRIFICATION: Bloquer si dossier déjà soumis
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT statut FROM dossiers 
            WHERE enseignant_id = %s 
            AND statut != 'brouillon'
            LIMIT 1
        """, (enseignant_id,))
        dossier_soumis = cur.fetchone()
        cur.close()
        
        if dossier_soumis:
            return jsonify({
                'success': False, 
                'message': 'Votre dossier a déjà été soumis. Vous ne pouvez plus le modifier.'
            }), 403

        # -------------------------------
        # Gestion de la photo
        # -------------------------------
        photo_path = None
        if 'photo' in request.files:
            file = request.files['photo']
            if file and file.filename != '' and allowed_file(file.filename):
                # Limiter la taille du fichier (1 Mo)
                file.seek(0, os.SEEK_END)
                size = file.tell()
                file.seek(0)
                if size > 1 * 1024 * 1024:
                    return jsonify({'success': False, 'message': 'La photo ne doit pas dépasser 1 Mo.'}), 400

                # Récupérer ou créer le dossier pour avoir l'ID
                cur = mysql.connection.cursor()
                cur.execute("SELECT id FROM dossiers WHERE enseignant_id = %s AND statut = 'brouillon'", (enseignant_id,))
                dossier = cur.fetchone()
                
                if not dossier:
                    cur.execute("INSERT INTO dossiers (enseignant_id, annee, statut) VALUES (%s, %s, 'brouillon')", (enseignant_id, datetime.now().year))
                    dossier_id = cur.lastrowid
                    mysql.connection.commit()
                else:
                    dossier_id = dossier['id']
                cur.close()

                # Récupérer nom/prénom pour le dossier
                cur = mysql.connection.cursor()
                cur.execute("SELECT nom, prenom FROM enseignants WHERE id = %s", (enseignant_id,))
                ens_data = cur.fetchone()
                cur.close()
                
                nom_safe = secure_filename(ens_data['nom'] or 'nom')
                prenom_safe = secure_filename(ens_data['prenom'] or 'prenom')
                
                # Créer le dossier spécifique
                folder_name = f"{nom_safe}_{prenom_safe}_{dossier_id}"
                folder_path = os.path.join(app.config['UPLOAD_FOLDER'], folder_name)
                if not os.path.exists(folder_path):
                    os.makedirs(folder_path)

                # Générer un nom de fichier sécurisé
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = secure_filename(f"photo_{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.{ext}")
                filepath = os.path.join(folder_path, filename)
                
                file.save(filepath)
                # Stocker le chemin relatif incluant le sous-dossier
                photo_path = f"uploads/{folder_name}/{filename}"

        # -------------------------------
        # Récupération et validation des champs
        # -------------------------------
        data = request.form
        nom = data.get('nom', '').strip()
        prenom = data.get('prenom', '').strip()
        grade = data.get('grade', '').strip()
        etablissement = data.get('etablissement', '').strip()
        departement = data.get('departement', '').strip()
        date_naissance = data.get('date_naissance', '').strip()
        lieu_naissance = data.get('lieu_naissance', '').strip()
        date_recrutement = data.get('date_recrutement', '').strip()
        ppr = data.get('ppr', '').strip()
        laboratoire = data.get('laboratoire', '').strip()
        equipe_recherche = data.get('equipe_recherche', '').strip()
        adresse_personnelle = data.get('adresse_personnelle', '').strip()
        telephone = data.get('telephone', '').strip()

        # Validation des champs obligatoires (déplacée vers le client)

        # -------------------------------
        # Mise à jour de la base de données
        # -------------------------------
        cur = mysql.connection.cursor()

        # Si aucun nouveau fichier photo n'a été uploadé, conserver l'ancienne
        if not photo_path:
            cur.execute("SELECT photo FROM enseignants WHERE id = %s", (enseignant_id,))
            existing = cur.fetchone()
            if existing and existing.get('photo'):
                photo_path = existing['photo']

        cur.execute("""
            UPDATE enseignants SET
                photo = %s, nom = %s, prenom = %s, grade = %s, etablissement = %s,
                departement = %s, date_naissance = %s,
                lieu_naissance = %s, date_recrutement = %s, ppr = %s,
                laboratoire = %s, equipe_recherche = %s, adresse_personnelle = %s, telephone = %s
            WHERE id = %s
        """, (
            photo_path, nom, prenom, grade, etablissement, departement,
            date_naissance or None, lieu_naissance, date_recrutement or None,
            ppr, laboratoire, equipe_recherche, adresse_personnelle, telephone,
            enseignant_id
        ))

        # Créer ou récupérer le dossier en statut 'brouillon'
        cur.execute("""
            SELECT id FROM dossiers 
            WHERE enseignant_id = %s AND statut = 'brouillon'
            FOR UPDATE
        """, (enseignant_id,))
        dossier = cur.fetchone()

        if not dossier:
            cur.execute("""
                INSERT INTO dossiers (enseignant_id, annee, statut) 
                VALUES (%s, %s, 'brouillon')
            """, (enseignant_id, datetime.now().year))
            dossier_id = cur.lastrowid
        else:
            dossier_id = dossier['id']

        mysql.connection.commit()
        cur.close()

        return jsonify({
            'success': True, 
            'dossier_id': dossier_id,
            'photo_path': photo_path
        })

    except Exception as e:
        # En cas d'exception, la transaction est annulée automatiquement
        print(f"❌ Erreur save_step1 : {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': 'Erreur serveur inattendue.'}), 500
# ===========================================
# API : ÉTAPES ""02"" DU DOSSIER (ENSEIGNANT) 
# ===========================================
@app.route('/api/save-step2', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def save_step2():
    if 'enseignant_id' not in session:
        return jsonify({'success': False, 'message': 'Non authentifié'}), 401
    
    enseignant_id = session['enseignant_id']
    user_id = session.get('user_id')
    
    # 🔒 VÉRIFICATION: Bloquer si dossier déjà soumis
    if DossierRepository.is_submitted(enseignant_id):
        return jsonify({
            'success': False, 
            'message': 'Votre dossier a déjà été soumis. Vous ne pouvez plus le modifier.'
        }), 403
    
    for attempt in range(3):
        try:
            # --- Parsing des données (FormData ou JSON) ---
            data = None
            files = {}
            if request.mimetype.startswith('multipart/form-data'):
                 # Cas FormData (Nouveau standard)
                 data = {}
                 data['enseignements_licence'] = json.loads(request.form.get('enseignements_licence', '[]'))
                 data['encadrements_licence'] = json.loads(request.form.get('encadrements_licence', '[]'))
                 data['enseignements_master'] = json.loads(request.form.get('enseignements_master', '[]'))
                 data['encadrements_master'] = json.loads(request.form.get('encadrements_master', '[]'))
                 files = request.files
            elif request.is_json:
                 # Cas Legacy (JSON pur) - Backup au cas où
                 data = request.get_json()
            else:
                 return jsonify({'success': False, 'message': 'Format de données invalide.'}), 400
            
            dossier = DossierRepository.get_brouillon_by_enseignant(enseignant_id)
            if not dossier:
                return jsonify({'success': False, 'message': 'Dossier introuvable'}), 404
            
            dossier_id = dossier['id']

            # --- Préparation gestion fichiers ---
            # On récupère nom/prénom pour le dossier d'upload
            cur = mysql.connection.cursor()
            cur.execute("SELECT nom, prenom FROM enseignants WHERE id = %s", (enseignant_id,))
            ens_data = cur.fetchone()
            cur.close()
            
            nom_safe = secure_filename(ens_data['nom'] or 'nom')
            prenom_safe = secure_filename(ens_data['prenom'] or 'prenom')
            folder_name = f"{nom_safe}_{prenom_safe}_{dossier_id}"
            folder_path = os.path.join(app.config['UPLOAD_FOLDER'], folder_name)

            # Il faudrait récupérer les anciens fichiers pour les préserver si pas de modif
            # Pour l'instant, on suppose que le frontend nous envoie tout ou rien, ou gère l'état old
            # Mais avec le nouveau design, le frontend n'envoie PAS l'ancien chemin dans le JSON
            # Il faut donc lire l'existant en base pour fusionner si besoin.
            
            # --- Lecture de l'existant pour préservation (Encadrements uniquement) ---
            old_enc_lic = {} # Map idx -> path (approximatif car l'ordre peut changer, mais on fait confiance à l'ordre d'envoi)
            # Mieux : on récupère tout et on map par ID si on avait des ID stables, mais ici on delete/insert.
            # Stratégie Step 4 : Il récupère les old_filenames par index.
            # On va faire pareil : lire les anciens rows dans l'ordre.
            cur = mysql.connection.cursor()
            cur.execute("SELECT page_de_garde FROM encadrements_licence WHERE dossier_id = %s", (dossier_id,))
            old_lic_rows = cur.fetchall()
            old_lic_paths = [r['page_de_garde'] for r in old_lic_rows]

            cur.execute("SELECT page_de_garde FROM encadrements_master WHERE dossier_id = %s", (dossier_id,))
            old_mast_rows = cur.fetchall()
            old_mast_paths = [r['page_de_garde'] for r in old_mast_rows]
            cur.close()

            
            # Supprimer les anciennes données (BDD)
            DossierRepository.clear_step2_data(dossier_id)
            
            # Insérer enseignements licence
            if 'enseignements_licence' in data:
                for ens in data['enseignements_licence']:
                    DossierRepository.add_enseignement_licence(dossier_id, ens)

            # Insérer encadrements licence (AVEC FICHIERS)
            licence_paths = {}
            if 'encadrements_licence' in data:
                for idx, enc in enumerate(data['encadrements_licence']):
                    # Gestion Fichier
                    file_key = f"enc_licence_file_{idx}"
                    file = files.get(file_key)
                    
                    old_path = old_lic_paths[idx] if idx < len(old_lic_paths) else None
                    
                    final_path = old_path # Par défaut on garde l'ancien
                    
                    if file:
                        # Nouveau fichier uploadé
                        # FileService.handle_upload retourne le chemin relatif complet "uploads/dossier/fichier.pdf"
                        final_path = FileService.handle_upload(file, folder_path, old_path, 'enc_lic', user_id, nom_safe, prenom_safe, idx)
                    
                    enc['page_de_garde'] = final_path
                    DossierRepository.add_encadrement_licence(dossier_id, enc)
                    licence_paths[idx] = final_path

            # Insérer enseignements master
            if 'enseignements_master' in data:
                for ens in data['enseignements_master']:
                    DossierRepository.add_enseignement_master(dossier_id, ens)

            # Insérer encadrements master (AVEC FICHIERS)
            master_paths = {}
            if 'encadrements_master' in data:
                for idx, enc in enumerate(data['encadrements_master']):
                     # Gestion Fichier
                    file_key = f"enc_master_file_{idx}"
                    file = files.get(file_key)
                    
                    old_path = old_mast_paths[idx] if idx < len(old_mast_paths) else None
                    final_path = old_path

                    if file:
                        final_path = FileService.handle_upload(file, folder_path, old_path, 'enc_mast', user_id, nom_safe, prenom_safe, idx)
                    
                    enc['page_de_garde'] = final_path
                    DossierRepository.add_encadrement_master(dossier_id, enc)
                    master_paths[idx] = final_path

            DossierRepository.commit()
            return jsonify({
                'success': True, 
                'message': 'Enseignements enregistrés',
                'licence_paths': licence_paths,
                'master_paths': master_paths
            })
            
        except Exception as e:
            DossierRepository.rollback()
            if "Deadlock" in str(e):
                time.sleep(0.5)
                continue
            else:
                print(f"Erreur dans save_step2 : {str(e)}")
                import traceback
                traceback.print_exc()
                return jsonify({'success': False, 'message': f'Erreur serveur: {str(e)}'}), 500

    return jsonify({'success': False, 'message': 'Échec après 3 tentatives.'}), 500
# ===========================================
# API : ÉTAPES ""03"" DU DOSSIER (ENSEIGNANT) 
# ===========================================
@app.route('/api/save-step3', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def save_step3():
    if 'enseignant_id' not in session:
        return jsonify({'success': False, 'message': 'Non authentifié'}), 401
    
    enseignant_id = session['enseignant_id']
    
    # 🔒 VÉRIFICATION: Bloquer si dossier déjà soumis
    if DossierRepository.is_submitted(enseignant_id):
        return jsonify({
            'success': False, 
            'message': 'Votre dossier a déjà été soumis. Vous ne pouvez plus le modifier.'
        }), 403
    
    for attempt in range(3):
        try:
            if request.is_json:
                data = request.get_json()
            else:
                return jsonify({'success': False, 'message': 'Données invalides. JSON attendu.'}), 400
            
            dossier = DossierRepository.get_brouillon_by_enseignant(enseignant_id)
            if not dossier:
                return jsonify({'success': False, 'message': 'Dossier introuvable'}), 404
            
            dossier_id = dossier['id']
            
            # Supprimer les anciennes données
            DossierRepository.clear_responsabilites(dossier_id)
            
            if 'responsabilites' in data:
                for resp in data['responsabilites']:
                    cycle = resp.get('cycle', '')
                    if cycle not in ['Licence', 'Master']:
                        return jsonify({'success': False, 'message': 'Cycle invalide.'}), 400
                    
                    DossierRepository.add_responsabilite(dossier_id, resp)

            DossierRepository.commit()
            return jsonify({'success': True, 'message': 'Responsabilités enregistrées'})
            
        except Exception as e:
            DossierRepository.rollback()
            if "Deadlock" in str(e):
                time.sleep(0.5)
                continue
            else:
                print(f"Erreur dans save_step3 : {str(e)}")
                return jsonify({'success': False, 'message': f'Erreur serveur: {str(e)}'}), 500
        break
    return jsonify({'success': False, 'message': 'Échec après 3 tentatives.'}), 500

# ===========================================
# API : ÉTAPE 04 DU DOSSIER (ENSEIGNANT)
# ===========================================
@app.route('/api/save-step4', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def save_step4():
    if 'enseignant_id' not in session:
        return jsonify({'success': False, 'message': 'Non authentifié'}), 401
    
    enseignant_id = session['enseignant_id']
    
    #  VÉRIFICATION: Bloquer si dossier déjà soumis
    if DossierRepository.is_submitted(enseignant_id):
        return jsonify({
            'success': False, 
            'message': 'Votre dossier a déjà été soumis. Vous ne pouvez plus le modifier.'
        }), 403
    
    for attempt in range(3):
        try:
            user_id = session.get('user_id', enseignant_id)
            
            # --- Récupérer nom/prénom de l'enseignant ---
            cur = mysql.connection.cursor()
            cur.execute("SELECT nom, prenom, date_debut_avancement, date_fin_avancement FROM enseignants WHERE id = %s", (enseignant_id,))
            enseignant = cur.fetchone()
            cur.close()
            
            if not enseignant:
                return jsonify({'success': False, 'message': 'Enseignant introuvable'}), 404
            
            nom = (enseignant['nom'] or '').replace(' ', '_')
            prenom = (enseignant['prenom'] or '').replace(' ', '_')
            
            # --- Validation de la période d'avancement ---
            period_errors = []
            debut_av = enseignant.get('date_debut_avancement')
            fin_av = enseignant.get('date_fin_avancement')
            if debut_av and fin_av:
                try:
                    debut_dt = datetime.strptime(str(debut_av).split()[0], '%Y-%m-%d') if isinstance(debut_av, str) else debut_av
                    fin_dt = datetime.strptime(str(fin_av).split()[0], '%Y-%m-%d') if isinstance(fin_av, str) else fin_av
                    if isinstance(debut_dt, datetime):
                        debut_dt = debut_dt.date()
                    if isinstance(fin_dt, datetime):
                        fin_dt = fin_dt.date()
                    min_date = date(debut_dt.year - 1, debut_dt.month, debut_dt.day)
                    max_date = fin_dt
                    min_year = min_date.year
                    max_year = max_date.year
                    
                    def validate_year(val, field_label):
                        try:
                            y = int(str(val).strip()[:4])
                            if y < min_year or y > max_year:
                                period_errors.append(f"{field_label} ({val}) : hors période [{min_year}-{max_year}]")
                        except (ValueError, TypeError):
                            pass
                    
                    def validate_academic_year(val, field_label):
                        try:
                            y = int(str(val).strip().split('-')[0])
                            if y < min_year or y > max_year:
                                period_errors.append(f"{field_label} ({val}) : hors période [{min_year}-{max_year}]")
                        except (ValueError, TypeError):
                            pass
                    
                    def validate_date(val, field_label):
                        try:
                            d = datetime.strptime(str(val).strip()[:10], '%Y-%m-%d').date()
                            if d < min_date or d > max_date:
                                period_errors.append(f"{field_label} ({val}) : hors période [{min_date} - {max_date}]")
                        except (ValueError, TypeError):
                            pass
                    
                    # AE1-1: annees (single year)
                    for row_data_list in [json.loads(request.form.get('ae1_1_rows', '[]'))]:
                        for row in row_data_list:
                            if row.get('annees'):
                                validate_year(row['annees'], 'AE1-1 Année de publication')
                    
                    # AE1-2: annees (single year)
                    for row_data_list in [json.loads(request.form.get('ae1_2_rows', '[]'))]:
                        for row in row_data_list:
                            if row.get('annees'):
                                validate_year(row['annees'], 'AE1-2 Année d\'élaboration')
                    
                    # AE1-3: annees (academic year)
                    for row_data_list in [json.loads(request.form.get('ae1_3_rows', '[]'))]:
                        for row in row_data_list:
                            if row.get('annees'):
                                validate_academic_year(row['annees'], 'AE1-3 Année universitaire')
                    
                    # AE2-1: annees_univ (academic year)
                    for row_data_list in [json.loads(request.form.get('ae2_1_rows', '[]'))]:
                        for row in row_data_list:
                            if row.get('annees_univ'):
                                validate_academic_year(row['annees_univ'], 'AE2-1 Année universitaire')
                    
                    # AE2-2: annees_univ (academic year)
                    for row_data_list in [json.loads(request.form.get('ae2_2_rows', '[]'))]:
                        for row in row_data_list:
                            if row.get('annees_univ'):
                                validate_academic_year(row['annees_univ'], 'AE2-2 Année universitaire')
                    
                    # AE2-3: dates
                    for row_data_list in [json.loads(request.form.get('ae2_3_rows', '[]'))]:
                        for row in row_data_list:
                            if row.get('dates'):
                                validate_date(row['dates'], 'AE2-3 Date')
                    
                    if period_errors:
                        return jsonify({'success': False, 'message': 'Certains champs sont hors période d\'avancement.', 'errors': period_errors}), 400
                except Exception:
                    pass  # Si erreur de parsing, on laisse passer la validation serveur
            
            # --- Récupérer le dossier en brouillon ---
            dossier = DossierRepository.get_brouillon_by_enseignant(enseignant_id)
            if not dossier:
                return jsonify({'success': False, 'message': 'Dossier introuvable'}), 404
            dossier_id = dossier['id']
            
            # --- Préparer le dossier d'upload ---
            nom_safe = secure_filename(enseignant['nom'] or 'nom')
            prenom_safe = secure_filename(enseignant['prenom'] or 'prenom')
            folder_name = f"{nom_safe}_{prenom_safe}_{dossier_id}"
            folder_path = os.path.join(app.config['UPLOAD_FOLDER'], folder_name)

            # --- Lire les anciens fichiers ---
            # --- Lire les anciens fichiers depuis les nouvelles tables ---
            old_filenames = {}
            cur = mysql.connection.cursor()
            
            # AE1-1
            cur.execute("SELECT ae1_1_justificatifs FROM ae1_1_ouvrages WHERE dossier_id = %s", (dossier_id,))
            old_filenames['ae1_1'] = [row.get('ae1_1_justificatifs') or '' for row in cur.fetchall() if row]

            # AE1-2
            cur.execute("SELECT ae1_2_fichiers FROM ae1_2_manuels WHERE dossier_id = %s", (dossier_id,))
            old_filenames['ae1_2'] = [row.get('ae1_2_fichiers') or '' for row in cur.fetchall() if row]

            # AE1-3
            cur.execute("SELECT ae1_3_fichiers FROM ae1_3_ntic WHERE dossier_id = %s", (dossier_id,))
            old_filenames['ae1_3'] = [row.get('ae1_3_fichiers') or '' for row in cur.fetchall() if row]

            # AE2-1, AE2-2, AE2-3
            for section in ['ae2_1', 'ae2_2', 'ae2_3']:
                cur.execute(f"SELECT {section}_fichiers FROM {section}_encadrements WHERE dossier_id = %s", (dossier_id,))
                old_filenames[section] = [row.get(f'{section}_fichiers') or '' for row in cur.fetchall() if row]

            # AE3
            for i in range(1, 8):
                cur.execute(f"SELECT ae3_{i}_fichiers FROM ae3_{i} WHERE dossier_id = %s", (dossier_id,))
                old_filenames[f'ae3_{i}'] = [row.get(f'ae3_{i}_fichiers') or '' for row in cur.fetchall() if row]
                
            cur.close()
            # --- Supprimer les anciennes données (BDD uniquement, fichiers gérés par FileService) ---
            # On vide les tables spécifiques
            for table in ['ae1_1_ouvrages', 'ae1_2_manuels', 'ae1_3_ntic', 'ae2_1_encadrements', 'ae2_2_encadrements', 'ae2_3_encadrements'] + [f'ae3_{i}' for i in range(1, 8)]:
                ActiviteRepository.clear_section_data(table, dossier_id)

            # --- Compatibilité schéma (colonnes parfois absentes en BDD existante) ---
            def _table_columns(table_name):
                cur = mysql.connection.cursor()
                try:
                    cur.execute(f"SHOW COLUMNS FROM {table_name}")
                    return {row['Field'] for row in cur.fetchall() if row and row.get('Field')}
                finally:
                    cur.close()

            ae2_3_cols = _table_columns('ae2_3_encadrements')
            ae3_7_cols = _table_columns('ae3_7')

            # --- Utilitaire pour champs texte ---
            def get_form_str(name):
                return request.form.get(name, '').strip() or ''

            # --- Préparation des données à sauvegarder ---
            # --- Gestion AE2 (avec fichiers pour ae2-1 et ae2-2) ---
            ae2_mappings = {
                'ae2_1': {
                    'annee_univ': 'annees_univ', 'type': 'types',
                    'intitule_licence': 'filieres', 'cours_td_tp': 'intitules', 'intitule_module': 'intitule_module', 'intitule_pfe': 'details',
                    'modules': 'modules', 'departements': 'departements', 'coenseignants': 'coenseignants',
                    'type_encadrement': 'type_encadrement'
                },
                'ae2_2': {
                    'annee_univ': 'annees_univ', 'type': 'types',
                    'intitule_master': 'filieres', 'cours': 'intitules', 'intitule_memoire': 'nom_etudiants',
                    'coordonnateurs': 'coordonnateurs', 'coenseignants': 'coenseignants',
                    'departements': 'departements',
                    'type_encadrement': 'type_encadrement'
                },
                'ae2_3': {
                    'type': 'types', 'etablissement': 'nom_etudiants',
                    'dates': 'dates', 'lieux': 'lieux', 'periode': 'durees'
                }
            }
            
            ae2_filenames = {}
            for section in ['ae2_1', 'ae2_2', 'ae2_3']:
                section_filenames = []
                rows = json.loads(request.form.get(f'{section}_rows', '[]'))
                table_name = f'{section}_encadrements'
                for idx, row in enumerate(rows):
                    row_data = {}
                    for json_key, db_key in ae2_mappings[section].items():
                        if section == 'ae2_3':
                            desired_col = f'ae2_3_{db_key}'
                            if desired_col not in ae2_3_cols:
                                if db_key == 'institutions' and 'ae2_3_institution' in ae2_3_cols:
                                    desired_col = 'ae2_3_institution'
                                elif db_key == 'institutions' and 'ae2_3_institution_concernee' in ae2_3_cols:
                                    desired_col = 'ae2_3_institution_concernee'
                                else:
                                    continue
                            row_data[desired_col] = (str(row.get(json_key) or '')).strip()
                        else:
                            row_data[f'{section}_{db_key}'] = (str(row.get(json_key) or '')).strip()
                    # AE2-1: inférer type_encadrement si vide
                    if section == 'ae2_1':
                        type_enc = row_data.get('ae2_1_type_encadrement', '')
                        if not type_enc:
                            details = (row.get('intitule_pfe') or '').strip()
                            row_data['ae2_1_type_encadrement'] = 'pfe' if details else 'cours_td_tp'
                    # AE2-2: inférer type_encadrement si vide
                    if section == 'ae2_2':
                        type_enc = row_data.get('ae2_2_type_encadrement', '')
                        if not type_enc:
                            details = (row.get('intitule_memoire') or '').strip()
                            row_data['ae2_2_type_encadrement'] = 'memoire' if details else 'cours'
                    # Gestion du fichier justificatif pour ae2-1, ae2-2, ae2-3
                    if section in ('ae2_1', 'ae2_2', 'ae2_3'):
                        file = request.files.get(f'{section.replace("_", "")}_file_{idx}')
                        old_name = old_filenames.get(section, [])[idx] if idx < len(old_filenames.get(section, [])) else ''
                        new_name = FileService.handle_upload(file, folder_path, old_name, section.replace('_', ''), user_id, nom, prenom, idx)
                        if new_name:
                            row_data[f'{section}_fichiers'] = new_name
                        elif old_name and not file:
                            row_data[f'{section}_fichiers'] = old_name
                        section_filenames.append(row_data.get(f'{section}_fichiers', ''))
                    ActiviteRepository.add_section_data(table_name, dossier_id, row_data)
                if section in ('ae2_1', 'ae2_2', 'ae2_3'):
                    ae2_filenames[f'{section}_new_filenames'] = section_filenames

            # --- Gestion AE1-1 (Tableau + Fichiers) ---
            ae1_1_rows = json.loads(request.form.get('ae1_1_rows', '[]'))
            ae1_1_files = []
            for idx, row in enumerate(ae1_1_rows):
                file = request.files.get(f'ae11_file_{idx}')
                old_name = old_filenames['ae1_1'][idx] if idx < len(old_filenames['ae1_1']) else ''
                new_name = FileService.handle_upload(file, folder_path, old_name, 'ae11', user_id, nom, prenom, idx)
                ae1_1_files.append(new_name)
                
                row_data = {
                    'ae1_1_titres': (row.get('titres') or '').strip(),
                    'ae1_1_auteurs': (row.get('auteurs') or '').strip(),
                    'ae1_1_niveaux': (row.get('niveaux') or '').strip(),
                    'ae1_1_editeurs': (row.get('editeurs') or '').strip(),
                    'ae1_1_annees': (row.get('annees') or '').strip(),
                    'ae1_1_numero_depot': (row.get('numero_depot') or '').strip(),
                    'ae1_1_justificatifs': new_name
                }
                ActiviteRepository.add_section_data('ae1_1_ouvrages', dossier_id, row_data)

            # --- Gestion AE1-2 (Tableau + Fichiers) ---
            ae1_2_rows = json.loads(request.form.get('ae1_2_rows', '[]'))
            ae1_2_files = []
            for idx, row in enumerate(ae1_2_rows):
                file = request.files.get(f'ae12_file_{idx}')
                old_name = old_filenames['ae1_2'][idx] if idx < len(old_filenames['ae1_2']) else ''
                new_name = FileService.handle_upload(file, folder_path, old_name, 'ae12', user_id, nom, prenom, idx)
                ae1_2_files.append(new_name)
                
                row_data = {
                    'ae1_2_auteurs': (row.get('auteurs') or '').strip(),
                    'ae1_2_departements': (row.get('departements') or '').strip(),
                    'ae1_2_annees': (row.get('annees') or '').strip(),
                    'ae1_2_filieres': (row.get('filieres') or '').strip(),
                    'ae1_2_semestres': (row.get('semestres') or '').strip(),
                    'ae1_2_types': (row.get('types') or '').strip(),
                    'ae1_2_fichiers': new_name
                }
                ActiviteRepository.add_section_data('ae1_2_manuels', dossier_id, row_data)

            # --- Gestion AE1-3 (Tableau + Fichiers) ---
            ae1_3_rows = json.loads(request.form.get('ae1_3_rows', '[]'))
            ae1_3_files = []
            for idx, row in enumerate(ae1_3_rows):
                file = request.files.get(f'ae13_file_{idx}')
                old_name = old_filenames['ae1_3'][idx] if idx < len(old_filenames['ae1_3']) else ''
                new_name = FileService.handle_upload(file, folder_path, old_name, 'ae13', user_id, nom, prenom, idx)
                ae1_3_files.append(new_name)
                
                row_data = {
                    'ae1_3_objectifs': (row.get('objectifs') or '').strip(),
                    'ae1_3_auteurs': (row.get('auteurs') or '').strip(),
                    'ae1_3_filieres': (row.get('filieres') or '').strip(),
                    'ae1_3_niveaux': (row.get('niveaux') or '').strip(),
                    'ae1_3_annees': (row.get('annees') or '').strip(),
                    'ae1_3_liens': (row.get('liens') or '').strip(),
                    'ae1_3_support_ntic': (row.get('support_ntic') or '').strip(),
                    'ae1_3_types': (row.get('types') or '').strip(),
                    'ae1_3_fichiers': new_name
                }
                ActiviteRepository.add_section_data('ae1_3_ntic', dossier_id, row_data)

            # --- Gestion AE3-1 à AE3-7 (Fichiers multiples) ---
            response_filenames = {
                'ae1_1_new_filenames': ae1_1_files,
                'ae1_2_new_filenames': ae1_2_files,
                'ae1_3_new_filenames': ae1_3_files,
                **ae2_filenames
            }

            ae3_mappings = {
                1: {'natures': 'natures', 'periodes': 'periodes', 'mandats': 'mandats'},
                2: {'titres': 'titres', 'accreditations': 'accreditations', 'periodes': 'periodes'},
                3: {'titres': 'titres', 'filieres': 'filieres', 'periodes': 'periodes'},
                4: {'periodes': 'periodes'},
                5: {'periodes': 'periodes'},
                6: {'periodes': 'periodes'},
                7: {'natures': 'natures', 'dates': 'dates', 'lieux': 'lieux'}
            }

            for i in range(1, 8):
                key = f'ae3_{i}'
                rows = json.loads(request.form.get(f'{key}_rows', '[]'))
                files_list = []
                for idx, row in enumerate(rows):
                    file = request.files.get(f'ae3{i}_file_{idx}')
                    old_name = old_filenames[f'ae3_{i}'][idx] if idx < len(old_filenames[f'ae3_{i}']) else ''
                    new_name = FileService.handle_upload(file, folder_path, old_name, f'ae3{i}', user_id, nom, prenom, idx)
                    files_list.append(new_name)
                    
                    row_data = {f'ae3_{i}_fichiers': new_name}
                    for json_key, db_key in ae3_mappings[i].items():
                        if i == 7:
                            desired_col = f'ae3_7_{db_key}'
                            if desired_col not in ae3_7_cols:
                                # Bases plus anciennes : seulement quelques colonnes existent
                                continue
                        # Utiliser 'dates' comme fallback pour 'periodes' dans AE3-7 si nécessaire
                        val = row.get(json_key)
                        if i == 7 and json_key == 'periodes' and not val:
                            val = row.get('dates')
                        row_data[f'ae3_{i}_{db_key}'] = (str(val or '')).strip()
                    
                    ActiviteRepository.add_section_data(f'ae3_{i}', dossier_id, row_data)
                    
                response_filenames[f'ae3_{i}_new_filenames'] = files_list
            ActiviteRepository.commit()

            # --- Réponse au frontend ---
            response = {
                'success': True,
                'message': 'Activités d\'enseignement enregistrées avec succès.',
            }
            response.update(response_filenames)
            return jsonify(response)

        except Exception as e:
            ActiviteRepository.rollback()
            if "Deadlock" in str(e):
                time.sleep(0.5)
                continue
            else:
                print(f" Erreur dans save_step4 : {str(e)}")
                import traceback
                traceback.print_exc()
                return jsonify({'success': False, 'message': f'Erreur lors de l\'enregistrement: {str(e)}'}), 500

    return jsonify({'success': False, 'message': 'Échec après 3 tentatives (deadlock persistant).'}), 500

# ===========================================
# API : ÉTAPES ""05"" DU DOSSIER (ENSEIGNANT) 
# ===========================================
@app.route('/api/save-step5', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def save_step5():
    if 'enseignant_id' not in session:
        return jsonify({'success': False, 'message': 'Non authentifié'}), 401
    
    enseignant_id = session['enseignant_id']
    
    if DossierRepository.is_submitted(enseignant_id):
        return jsonify({'success': False, 'message': 'Dossier déjà soumis.'}), 403
    
    for attempt in range(3):
        try:
            user_id = session.get('user_id', enseignant_id)
            
            cur = mysql.connection.cursor()
            cur.execute("SELECT nom, prenom FROM enseignants WHERE id = %s", (enseignant_id,))
            enseignant = cur.fetchone()
            cur.close()
            
            if not enseignant:
                return jsonify({'success': False, 'message': 'Enseignant introuvable'}), 404
            
            nom = secure_filename(enseignant['nom'] or 'nom')
            prenom = secure_filename(enseignant['prenom'] or 'prenom')
            
            dossier = DossierRepository.get_brouillon_by_enseignant(enseignant_id)
            if not dossier:
                return jsonify({'success': False, 'message': 'Dossier introuvable'}), 404
            dossier_id = dossier['id']
            
            folder_name = f"{nom}_{prenom}_{dossier_id}"
            folder_path = os.path.join(app.config['UPLOAD_FOLDER'], folder_name)
            
            # Configuration AR1 : chaque section possède des colonnes textuelles
            # et, pour certaines lignes, une ou plusieurs pièces jointes PDF.
            ar1_config = {
                'ar1-1': {
                    'table': 'ar1_1_articles',
                    'rows_key': 'ar1_1_rows_json',
                    'fields': {
                        'lien': 'ar1_1_lien',
                        'reference_complete': 'ar1_1_referenceComplete',
                        'annee_publication': 'ar1_1_anneePublication',
                        'doctorants': 'ar1_1_doctorantsCoAuteurs'
                    },
                    'file_fields': {
                        'ced_list': 'ar1_1_cedList'
                    },
                    'prefix': 'ar1_1'
                },
                'ar1-2': {
                    'table': 'ar1_2_actes',
                    'rows_key': 'ar1_2_rows_json',
                    'fields': {
                        'lien': 'ar1_2_lienSite',
                        'reference': 'ar1_2_reference',
                        'nature_activite': 'ar1_2_natureTravail',
                        'manifestation': 'ar1_2_nomEvenement',
                        'lieu': 'ar1_2_lieu',
                        'date': 'ar1_2_dateEvenement'
                    },
                    'file_fields': {
                        'attestation': 'ar1_2_attestation',
                        'premiere_page': 'ar1_2_premiere_page'
                    },
                    'prefix': 'ar1_2'
                },
                'ar1-3': {
                    'table': 'ar1_3_ouvrages',
                    'rows_key': 'ar1_3_rows_json',
                    'fields': {
                        'type_ouvrage': 'ar1_3_typeOuvrage',
                        'titre': 'ar1_3_titreOuvrage',
                        'auteurs': 'ar1_3_auteurs',
                        'maison_editions': 'ar1_3_maisonEditions',
                        'annee': 'ar1_3_annee',
                        'issn_isbn': 'ar1_3_issn'
                    },
                    'file_fields': {
                        'page_garde': 'ar1_3_page_garde'
                    },
                    'prefix': 'ar1_3'
                },
                'ar1-4': {
                    'table': 'ar1_4_revues',
                    'rows_key': 'ar1_4_rows_json',
                    'fields': {
                        'reference_complete': 'ar1_4_referenceComplete',
                        'annee_publication': 'ar1_4_anneePublication',
                        'doctorants': 'ar1_4_doctorantsCoAuteurs',
                        'lien_publication': 'ar1_4_publication_url'
                    },
                    'file_fields': {
                        'publication_file': 'ar1_4_lien',
                        'ced_list': 'ar1_4_cedList'
                    },
                    'prefix': 'ar1_4'
                }
            }

            ar_other_config = {
                'ar2-1': {
                    'table': 'ar2_1_theses',
                    'rows_key': 'ar2_1_rows',
                    'file_col': 'ar2_1_these',
                    'prefix': 'ar2_1',
                    'fields': {
                        'auteur_these': 'ar2_1_nomAuteur',
                        'titre_these': 'ar2_1_titreThese',
                        'institution': 'ar2_1_institution',
                        'date_soutenance': 'ar2_1_dateSoutenance',
                        'type_encadrement': 'ar2_1_type'
                    }
                },
                'ar2-2': {
                    'table': 'ar2_2_jurys',
                    'rows_key': 'ar2_2_rows',
                    'file_col': 'ar2_2_fichiers',
                    'prefix': 'ar2_2',
                    'file_fields': {
                        'invitation_file': 'ar2_2_fichiers',
                        'page_garde': 'ar2_2_page_garde'
                    },
                    'fields': {
                        'auteur': 'ar2_2_nomAuteur',
                        'type_travail': 'ar2_2_typeTravail',
                        'titre': 'ar2_2_titre',
                        'institution': 'ar2_2_institution',
                        'date_soutenance': 'ar2_2_dateSoutenance',
                        'role': 'ar2_2_role'
                    }
                },
                'ar3-1': {
                    'table': 'ar3_1_structures',
                    'rows_key': 'ar3_1_rows',
                    'file_col': 'ar3_1_fichiers',
                    'prefix': 'ar3_1',
                    'fields': {
                        'structure': 'ar3_1_nomStructure',
                        'adresse': 'ar3_1_adresseStructure',
                        'periode': 'ar3_1_periode'
                    }
                },
                'ar3-2': {
                    'table': 'ar3_2_equipes',
                    'rows_key': 'ar3_2_rows',
                    'file_col': 'ar3_2_fichiers',
                    'prefix': 'ar3_2',
                    'fields': {
                        'equipe': 'ar3_2_nomEquipe',
                        'adresse': 'ar3_2_adresseEquipe',
                        'structure_parente': 'ar3_2_structure_parente',
                        'periode': 'ar3_2_periode'
                    }
                },
                'ar3-3': {
                    'table': 'ar3_3_projets',
                    'rows_key': 'ar3_3_rows',
                    'file_col': 'ar3_3_fichiers',
                    'prefix': 'ar3_3',
                    'file_fields': {
                        'contrat': 'ar3_3_fichiers',
                        'attestation_responsable': 'ar3_3_attestation_responsable'
                    },
                    'fields': {
                        'responsable': 'ar3_3_nomResponsable',
                        'role': 'ar3_3_role',
                        'nature': 'ar3_3_nature',
                        'titre': 'ar3_3_titre',
                        'montant': 'ar3_3_montant',
                        'duree': 'ar3_3_duree',
                        'partenaire': 'ar3_3_partenaire'
                    }
                },
                'ar3-4': {
                    'table': 'ar3_4_expertises',
                    'rows_key': 'ar3_4_rows',
                    'file_col': 'ar3_4_fichiers',
                    'prefix': 'ar3_4',
                    'fields': {
                        'type_activite': 'ar3_4_typeActivite',
                        'objet': 'ar3_4_objet',
                        'date': 'ar3_4_date'
                    }
                },
                'ar4-1': {
                    'table': 'ar4_1_animations',
                    'rows_key': 'ar4_1_rows',
                    'file_col': 'ar4_1_fichiers',
                    'prefix': 'ar4_1',
                    'fields': {
                        'titre': 'ar4_1_titre',
                        'lieu': 'ar4_1_lieu',
                        'date': 'ar4_1_date',
                        'role': 'ar4_1_role'
                    }
                },
                'ar4-2': {
                    'table': 'ar4_2',
                    'rows_key': 'ar4_2_rows',
                    'file_col': 'ar4_2_fichiers',
                    'prefix': 'ar4_2',
                    'fields': {
                        'nature': 'ar4_2_nature',
                        'organisme': 'ar4_2_organisme',
                        'lieu': 'ar4_2_lieu',
                        'date': 'ar4_2_date'
                    }
                },
                'ar4-3': {
                    'table': 'ar4_3',
                    'rows_key': 'ar4_3_rows',
                    'file_col': 'ar4_3_fichiers',
                    'prefix': 'ar4_3',
                    'fields': {
                        'type_activite': 'ar4_3_type_activite',
                        'nature_activite': 'ar4_3_nature_activite',
                        'date': 'ar4_3_date'
                    }
                }
            }

            def _row_value(value):
                return str(value or '')

            response_filenames = {}

            # AR1 : lignes détaillées + pièces jointes spécifiques
            for sec_key, cfg in ar1_config.items():
                cur = mysql.connection.cursor()
                cur.execute(f"SELECT * FROM {cfg['table']} WHERE dossier_id = %s ORDER BY id ASC", (dossier_id,))
                old_rows = [dict(row) for row in cur.fetchall()]
                cur.close()

                ActiviteRepository.clear_section_data(cfg['table'], dossier_id)

                rows_json = request.form.get(cfg['rows_key'], '[]')
                try:
                    rows = json.loads(rows_json)
                except Exception:
                    rows = []

                if not rows and cfg['fields'] and request.form.get(cfg.get('legacy_key', ''), ''):
                    raw = request.form.get(cfg['legacy_key'], '')
                    rows = [{'lien': lien.strip()} for lien in raw.split('\n') if lien.strip()]

                new_rows = []
                for idx, row in enumerate(rows):
                    old_row = old_rows[idx] if idx < len(old_rows) else {}
                    row_data = {}
                    form_key_prefix = sec_key.replace('-', '_')

                    for json_field, db_col in cfg['fields'].items():
                        row_data[db_col] = _row_value(row.get(json_field))

                    if sec_key == 'ar1-3':
                        issn_isbn_value = _row_value(row.get('issn_isbn'))
                        row_data['ar1_3_issn'] = issn_isbn_value
                        row_data['ar1_3_isbn'] = issn_isbn_value

                    for json_field, db_col in cfg['file_fields'].items():
                        old_path = _row_value(old_row.get(db_col))
                        file = request.files.get(f'{form_key_prefix}_{json_field}_file_{idx}')
                        new_path = FileService.handle_upload(
                            file, folder_path, old_path, f'{cfg["prefix"]}_{json_field}',
                            user_id, nom, prenom, idx
                        )
                        row_data[db_col] = new_path
                        row[json_field] = new_path
                        response_filenames.setdefault(f'{sec_key.replace("-", "_")}_{json_field}_new_filenames', []).append(new_path)

                    if sec_key == 'ar1-4':
                        has_url = bool(row_data.get('ar1_4_publication_url', '').strip())
                        has_file = bool(row_data.get('ar1_4_lien', '').strip())
                        if not has_url and not has_file:
                            return jsonify({'success': False, 'message': f'AR1-4 ligne {idx+1} : veuillez remplir \"Lien de la publication\" ou joindre \"Copie de la 1ère page de l\'article\".'}), 400

                    ActiviteRepository.add_section_data(cfg['table'], dossier_id, row_data)
                    new_rows.append(row)

                if len(old_rows) > len(rows):
                    for old_row in old_rows[len(rows):]:
                        for db_col in cfg['file_fields'].values():
                            FileService.delete_file(old_row.get(db_col))

                # Réponse de compatibilité pour le chargement côté frontend
                if sec_key == 'ar1-1':
                    response_filenames['ar1_1_new_filenames'] = [row.get('ced_list', '') for row in new_rows]
                elif sec_key == 'ar1-2':
                    response_filenames['ar1_2_new_filenames'] = [row.get('attestation', '') for row in new_rows]
                    response_filenames['ar1_2_premiere_page_new_filenames'] = [row.get('premiere_page', '') for row in new_rows]
                elif sec_key == 'ar1-3':
                    response_filenames['ar1_3_new_filenames'] = [row.get('page_garde', '') for row in new_rows]

            # AR2, AR3, AR4 : fichiers uniques par ligne
            for sec_key, cfg in ar_other_config.items():
                cur = mysql.connection.cursor()
                cur.execute(f"SELECT * FROM {cfg['table']} WHERE dossier_id = %s ORDER BY id ASC", (dossier_id,))
                old_rows = [dict(row) for row in cur.fetchall()]
                cur.close()

                ActiviteRepository.clear_section_data(cfg['table'], dossier_id)

                rows_json = request.form.get(cfg['rows_key'], '[]')
                try:
                    rows = json.loads(rows_json)
                except Exception:
                    rows = []

                new_files_list = []
                for idx, row in enumerate(rows):
                    old_row = old_rows[idx] if idx < len(old_rows) else {}
                    row_data = {}

                    if cfg.get('file_col'):
                        file = request.files.get(f'{sec_key.replace("-", "_")}_file_{idx}')
                        old_path = _row_value(old_row.get(cfg['file_col']))
                        new_path = FileService.handle_upload(
                            file, folder_path, old_path, cfg['prefix'], user_id, nom, prenom, idx
                        )
                        row_data[cfg['file_col']] = new_path
                        new_files_list.append(new_path)

                    form_key_prefix = sec_key.replace('-', '_')
                    for json_field, db_col in cfg.get('file_fields', {}).items():
                        file = request.files.get(f'{form_key_prefix}_{json_field}_file_{idx}')
                        old_path = _row_value(old_row.get(db_col))
                        new_path = FileService.handle_upload(
                            file, folder_path, old_path, f'{cfg["prefix"]}_{json_field}',
                            user_id, nom, prenom, idx
                        )
                        row_data[db_col] = new_path
                        response_filenames.setdefault(f'{form_key_prefix}_{json_field}_new_filenames', []).append(new_path)

                    for json_field, db_col in cfg['fields'].items():
                        row_data[db_col] = _row_value(row.get(json_field))

                    ActiviteRepository.add_section_data(cfg['table'], dossier_id, row_data)

                if len(old_rows) > len(rows):
                    for old_row in old_rows[len(rows):]:
                        if cfg.get('file_col'):
                            FileService.delete_file(old_row.get(cfg['file_col']))
                        for db_col in cfg.get('file_fields', {}).values():
                            FileService.delete_file(old_row.get(db_col))

                if cfg.get('file_col'):
                    response_filenames[f'{sec_key.replace("-", "_")}_new_filenames'] = new_files_list

            ActiviteRepository.commit()

            return jsonify({
                'success': True,
                'message': 'Activités de recherche enregistrées avec succès.',
                **response_filenames
            })
            
        except Exception as e:
            ActiviteRepository.rollback()
            if "Deadlock" in str(e):
                time.sleep(0.5)
                continue
            else:
                print(f"❌ Erreur save_step5 : {e}")
                import traceback
                traceback.print_exc()
                return jsonify({'success': False, 'message': f'Erreur serveur: {str(e)}'}), 500
                
    return jsonify({'success': False, 'message': 'Échec après 3 tentatives.'}), 500

# ===================================================================
# API : ÉTAPES ""01-02-03-04-05"" DU DOSSIER (ENSEIGNANT) POUR SUBMIT 
# ===================================================================
@app.route('/api/submit-dossier', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def submit_dossier():
    try:
        enseignant_id = session['enseignant_id']
        cur = mysql.connection.cursor()
        
        # 🔒 Vérifier qu'aucun dossier n'a déjà été soumis
        cur.execute("""
            SELECT id, statut FROM dossiers 
            WHERE enseignant_id = %s 
            AND statut IN ('soumis', 'évalué', 'validé', 'rejeté')
            LIMIT 1
        """, (enseignant_id,))
        dossier_deja_soumis = cur.fetchone()
        
        if dossier_deja_soumis:
            cur.close()
            return jsonify({
                'success': False, 
                'message': 'Vous avez déjà soumis un dossier. Vous ne pouvez pas soumettre à nouveau.',
                'redirect': '/dossier-enseignant'
            }), 403
        
        # Soumettre le dossier en brouillon
        cur.execute("""
            UPDATE dossiers 
            SET statut = 'soumis', date_soumission = NOW()
            WHERE enseignant_id = %s AND statut = 'brouillon'
        """, (enseignant_id,))
        
        affected_rows = cur.rowcount
        mysql.connection.commit()
        cur.close()
        
        if affected_rows == 0:
            return jsonify({
                'success': False, 
                'message': 'Aucun dossier en brouillon trouvé.'
            }), 404
        
        LoggerService.log_action(session.get('email'), 'ENSEIGNANT', "DOSSIER_SUBMIT", f"Dossier soumis pour l'enseignant {enseignant_id}")
        
        # Notifier tous les coordinateurs
        try:
            enseignant_nom = f"{session.get('prenom', '')} {session.get('nom', '')}".strip()
            if not enseignant_nom:
                cur2 = mysql.connection.cursor()
                cur2.execute("SELECT nom, prenom FROM users WHERE iduser = %s", (session['user_id'],))
                u = cur2.fetchone()
                cur2.close()
                if u: enseignant_nom = f"{u['prenom']} {u['nom']}"
            cur2 = mysql.connection.cursor()
            cur2.execute("SELECT iduser FROM users WHERE role_user = 'COORDINATEUR' AND statut = 'actif'")
            coords = cur2.fetchall()
            cur2.close()
            for c in coords:
                add_notification(c['iduser'], f"Nouveau dossier soumis par {enseignant_nom}.", url_for('coordinateurpage'))
        except Exception:
            pass
        
        return jsonify({
            'success': True, 
            'message': 'Dossier soumis avec succès',
            'redirect': '/dossier-enseignant'
        })
    except Exception as e:
        print(f"Erreur dans submit_dossier : {str(e)}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500

# ===========================================================================
# API : VÉRIFICATION DU STATUT DU DOSSIER (ENSEIGNANT)
# ===========================================================================
@app.route('/api/check-dossier-status', methods=['GET'])
@login_required
@role_required('ENSEIGNANT')
def check_dossier_status():
    # Vérifie si l'enseignant a déjà un dossier et son statut
    try:
        enseignant_id = session.get('enseignant_id')
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT id, statut, date_soumission, note, commentaire
            FROM dossiers 
            WHERE enseignant_id = %s 
            ORDER BY date_soumission DESC, id DESC 
            LIMIT 1
        """, (enseignant_id,))
        dossier = cur.fetchone()
        cur.close()
        
        if not dossier:
            return jsonify({
                'has_dossier': False,
                'can_create': True,
                'can_modify': False,
                'can_submit': False
            })
        
        statut = dossier['statut']
        is_brouillon = statut == 'brouillon'
        is_soumis = statut in ['soumis', 'évalué', 'validé', 'rejeté']
        
        return jsonify({
            'has_dossier': True,
            'dossier_id': dossier['id'],
            'statut': statut,
            'can_create': False,  # Ne peut plus créer de dossier
            'can_modify': is_brouillon,  # Peut modifier seulement si brouillon
            'can_submit': is_brouillon,  # Peut soumettre seulement si brouillon
            'date_soumission': dossier['date_soumission'].strftime('%d/%m/%Y %H:%M') if dossier['date_soumission'] else None,
            'note': float(dossier['note']) if dossier['note'] else None,
            'commentaire': dossier['commentaire']
        })
    except Exception as e:
        print(f"Erreur dans check_dossier_status : {str(e)}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500


# ===========================================================================
# API : ÉTAPES ""01-02-03-04-05"" DU DOSSIER (ENSEIGNANT) POUR LOAD-FORM-DATA
# ===========================================================================
@app.route('/api/load-form-data', methods=['GET'])
@login_required
@role_required('ENSEIGNANT')
def load_form_data():
    """Charge les données du formulaire depuis la base de données (tous statuts)"""
    try:
        enseignant_id = session['enseignant_id']
        cur = mysql.connection.cursor()

        # Charger le dossier le plus récent (tous statuts)
        cur.execute("""
            SELECT * FROM dossiers 
            WHERE enseignant_id = %s 
            ORDER BY date_soumission DESC, id DESC 
            LIMIT 1
        """, (enseignant_id,))
        dossier = cur.fetchone()

        # Étape 1 : Informations personnelles (toujours chargées, même sans dossier)
        cur.execute("SELECT * FROM enseignants WHERE id = %s", (enseignant_id,))
        enseignant = cur.fetchone()
        if not enseignant:
            cur.close()
            return jsonify({'success': False, 'message': 'Enseignant introuvable'}), 404

        step1_data = {
            'nom': enseignant.get('nom') or '',
            'prenom': enseignant.get('prenom') or '',
            'grade': enseignant.get('grade') or '',
            'etablissement': enseignant.get('etablissement') or '',
            'departement': enseignant.get('departement') or '',
            'date_debut_avancement': str(enseignant['date_debut_avancement']) if enseignant.get('date_debut_avancement') else '',
            'date_fin_avancement': str(enseignant['date_fin_avancement']) if enseignant.get('date_fin_avancement') else '',
            'date_naissance': str(enseignant['date_naissance']) if enseignant.get('date_naissance') else '',
            'lieu_naissance': enseignant.get('lieu_naissance') or '',
            'date_recrutement': str(enseignant['date_recrutement']) if enseignant.get('date_recrutement') else '',
            'ppr': enseignant.get('ppr') or '',
            'laboratoire': enseignant.get('laboratoire') or '',
            'equipe_recherche': enseignant.get('equipe_recherche') or '',
            'photo': enseignant.get('photo') or '',
            'adresse_personnelle': enseignant.get('adresse_personnelle') or '',
            'telephone': enseignant.get('telephone') or '',
            'email': enseignant.get('email') or ''
        }

        if not dossier:
            cur.close()
            # Retourner les infos personnelles sans données de dossier
            return jsonify({
                'success': True,
                'data': {
                    'dossier_id': None,
                    'step1': step1_data,
                    'step2': {},
                    'step3': {},
                    'step4': {},
                    'step5': {}
                }
            }), 200

        dossier_id = dossier['id']

        # Étape 2 : Enseignements
        cur.execute("SELECT * FROM enseignements_licence WHERE dossier_id = %s", (dossier_id,))
        enseignements_licence = [dict(row) for row in cur.fetchall()]
        cur.execute("SELECT * FROM encadrements_licence WHERE dossier_id = %s", (dossier_id,))
        encadrements_licence = [dict(row) for row in cur.fetchall()]
        cur.execute("SELECT * FROM enseignements_master WHERE dossier_id = %s", (dossier_id,))
        enseignements_master = [dict(row) for row in cur.fetchall()]
        cur.execute("SELECT * FROM encadrements_master WHERE dossier_id = %s", (dossier_id,))
        encadrements_master = [dict(row) for row in cur.fetchall()]

        step2_data = {
            'enseignements_licence': enseignements_licence,
            'encadrements_licence': encadrements_licence,
            'enseignements_master': enseignements_master,
            'encadrements_master': encadrements_master
        }

        # Étape 3 : Responsabilités
        cur.execute("SELECT * FROM responsabilites WHERE dossier_id = %s", (dossier_id,))
        responsabilites = [dict(row) for row in cur.fetchall()]
        step3_data = {'responsabilites': responsabilites}

        # Étape 4 : Activités d'enseignement
        step4_data = {}

        _columns_cache = {}

        def _table_columns(table_name):
            if table_name in _columns_cache:
                return _columns_cache[table_name]
            cur.execute(f"SHOW COLUMNS FROM {table_name}")
            cols = {r.get('Field') for r in cur.fetchall() if r and r.get('Field')}
            _columns_cache[table_name] = cols
            return cols

        def get_list_data(table_name, prefix, field_map):
            cols = _table_columns(table_name)
            cur.execute(f"SELECT * FROM {table_name} WHERE dossier_id = %s", (dossier_id,))
            rows = []
            for row in cur.fetchall():
                row_data = {}
                for db_field, json_field in field_map.items():
                    candidates = db_field if isinstance(db_field, (list, tuple)) else [db_field]
                    value = ''
                    for candidate in candidates:
                        col = f'{prefix}_{candidate}'
                        if col in cols:
                            value = str(row.get(col) or '')
                            break
                    row_data[json_field] = value
                row_data['row_id'] = row.get('id')
                rows.append(row_data)
            return rows

        # AE1-1
        step4_data['ae1_1'] = get_list_data('ae1_1_ouvrages', 'ae1_1', {
            'titres': 'titres', 'auteurs': 'auteurs', 'niveaux': 'niveaux',
            'editeurs': 'editeurs', 'annees': 'annees', 'numero_depot': 'numero_depot',
            'justificatifs': 'PDF'
        })

        # AE1-2
        step4_data['ae1_2'] = get_list_data('ae1_2_manuels', 'ae1_2', {
            'auteurs': 'auteurs',
            'departements': 'departements', 'annees': 'annees', 'filieres': 'filieres',
            'semestres': 'semestres', 'types': 'types', 'fichiers': 'PDF'
        })

        # AE1-3
        step4_data['ae1_3'] = get_list_data('ae1_3_ntic', 'ae1_3', {
            'objectifs': 'objectifs', 'auteurs': 'auteurs', 'filieres': 'filieres',
            'niveaux': 'niveaux', 'annees': 'annees', 'liens': 'liens', 'support_ntic': 'support_ntic', 'types': 'types',
            'fichiers': 'PDF'
        })

        # AE2-1
        step4_data['ae2_1'] = get_list_data('ae2_1_encadrements', 'ae2_1', {
            'annees_univ': 'annee_univ', 'types': 'type',
            'filieres': 'intitule_licence', 'intitules': 'cours_td_tp', 'intitule_module': 'intitule_module', 'details': 'intitule_pfe',
            'modules': 'modules', 'departements': 'departements', 'coenseignants': 'coenseignants',
            'fichiers': 'PDF', 'type_encadrement': 'type_encadrement'
        })

        # AE2-2
        step4_data['ae2_2'] = get_list_data('ae2_2_encadrements', 'ae2_2', {
            'annees_univ': 'annee_univ', 'types': 'type',
            'filieres': 'intitule_master', 'intitules': 'cours', 'nom_etudiants': 'intitule_memoire',
            'coordonnateurs': 'coordonnateurs', 'coenseignants': 'coenseignants',
            'departements': 'departements',
            'fichiers': 'PDF', 'type_encadrement': 'type_encadrement'
        })

        # AE2-3 (Fixé pour correspondre à la DB et frontend)
        step4_data['ae2_3'] = get_list_data('ae2_3_encadrements', 'ae2_3', {
            'types': 'type', 'nom_etudiants': 'etablissement',
            'dates': 'dates', 'lieux': 'lieux', 'durees': 'periode',
            'fichiers': 'PDF'
        })

        # AE3
        ae3_fields = {
            1: ['natures', 'periodes', 'mandats'],
            2: ['titres', 'accreditations', 'periodes'],
            3: ['titres', 'filieres', 'periodes'],
            4: ['periodes'],
            5: ['periodes'],
            6: ['periodes'],
            7: ['natures', 'dates', 'lieux']
        }

        for i in range(1, 8):
            field_map = {f: f for f in ae3_fields[i]}
            field_map['fichiers'] = 'PDF'
            if i == 6:
                # La DB utilise 'commissions' mais main.js s'attend à 'noms'
                field_map['commissions'] = 'noms'
            if i == 7:
                # Ajouté missing fields mapping
                pass
            step4_data[f'ae3_{i}'] = get_list_data(f'ae3_{i}', f'ae3_{i}', field_map)

        # Étape 5 : Activités de recherche
        step5_data = {}

        def _safe_str(value):
            return str(value or '')

        def _rows_as_dicts(table_name):
            cur.execute(f"SELECT * FROM {table_name} WHERE dossier_id = %s ORDER BY id ASC", (dossier_id,))
            return [dict(row) for row in cur.fetchall()]

        # AR1 : reconstruire les tableaux détaillés attendus par le frontend
        ar1_sections = {
            'ar1_1': {
                'table': 'ar1_1_articles',
                'fields': {
                    'lien': 'ar1_1_lien',
                    'reference_complete': 'ar1_1_referenceComplete',
                    'annee_publication': 'ar1_1_anneePublication',
                    'doctorants': 'ar1_1_doctorantsCoAuteurs'
                },
                'file_fields': {
                    'ced_list': 'ar1_1_cedList'
                },
                'legacy_key': 'ar1_1_publications'
            },
            'ar1_2': {
                'table': 'ar1_2_actes',
                'fields': {
                    'lien': 'ar1_2_lienSite',
                    'reference': 'ar1_2_reference',
                    'nature_activite': 'ar1_2_natureTravail',
                    'manifestation': 'ar1_2_nomEvenement',
                    'lieu': 'ar1_2_lieu',
                    'date': 'ar1_2_dateEvenement'
                },
                'file_fields': {
                    'attestation': 'ar1_2_attestation',
                    'premiere_page': 'ar1_2_premiere_page'
                },
                'legacy_key': 'ar1_2_actes'
            },
            'ar1_3': {
                'table': 'ar1_3_ouvrages',
                'fields': {
                    'type_ouvrage': 'ar1_3_typeOuvrage',
                    'titre': 'ar1_3_titreOuvrage',
                    'auteurs': 'ar1_3_auteurs',
                    'maison_editions': 'ar1_3_maisonEditions',
                    'annee': 'ar1_3_annee',
                    'issn_isbn': 'ar1_3_issn'
                },
                'file_fields': {
                    'page_garde': 'ar1_3_page_garde'
                },
                'legacy_key': 'ar1_3_ouvrages'
            },
            'ar1_4': {
                'table': 'ar1_4_revues',
                'fields': {
                    'reference_complete': 'ar1_4_referenceComplete',
                    'annee_publication': 'ar1_4_anneePublication',
                    'doctorants': 'ar1_4_doctorantsCoAuteurs',
                    'lien_publication': 'ar1_4_publication_url'
                },
                'file_fields': {
                    'publication_file': 'ar1_4_lien',
                    'ced_list': 'ar1_4_cedList'
                },
                'legacy_key': 'ar1_4_revues'
            }
        }

        for section, cfg in ar1_sections.items():
            rows = _rows_as_dicts(cfg['table'])
            step5_data[section] = []
            for row in rows:
                row_data = {}
                for json_field, db_field in cfg['fields'].items():
                    row_data[json_field] = _safe_str(row.get(db_field))
                for json_field, db_field in cfg['file_fields'].items():
                    row_data[json_field] = _safe_str(row.get(db_field))
                if section == 'ar1_3':
                    issn_isbn_value = _safe_str(row.get('ar1_3_issn') or row.get('ar1_3_isbn'))
                    row_data['issn_isbn'] = issn_isbn_value
                    row_data['issn'] = issn_isbn_value
                    row_data['isbn'] = issn_isbn_value
                row_data['row_id'] = row.get('id')
                step5_data[section].append(row_data)

            if cfg['legacy_key'] == 'ar1_1_publications':
                step5_data[cfg['legacy_key']] = '\n'.join([row.get('lien', '') for row in step5_data[section]])
            elif cfg['legacy_key'] == 'ar1_2_actes':
                step5_data[cfg['legacy_key']] = '\n'.join([row.get('lien', '') for row in step5_data[section]])
            elif cfg['legacy_key'] == 'ar1_3_ouvrages':
                step5_data[cfg['legacy_key']] = '\n'.join([row.get('lien', '') for row in step5_data[section]])
            elif cfg['legacy_key'] == 'ar1_4_revues':
                step5_data[cfg['legacy_key']] = '\n'.join([row.get('lien', '') for row in step5_data[section]])

        # AR2, AR3, AR4 : récupérer les fichiers et les champs texte dans des tableaux
        ar_other_sections = {
            'ar2_1': {
                'table': 'ar2_1_theses',
                'file_col': 'ar2_1_these',
                'file_key': 'PDF',
                'fields': {
                    'auteur_these': 'ar2_1_nomAuteur',
                    'titre_these': 'ar2_1_titreThese',
                    'institution': 'ar2_1_institution',
                    'date_soutenance': 'ar2_1_dateSoutenance',
                    'type_encadrement': 'ar2_1_type'
                },
                'legacy_key': 'ar2_1_fichiers'
            },
            'ar2_2': {
                'table': 'ar2_2_jurys',
                'file_col': 'ar2_2_fichiers',
                'file_key': 'invitation_file',
                'file_fields': {
                    'invitation_file': 'ar2_2_fichiers',
                    'page_garde': 'ar2_2_page_garde'
                },
                'fields': {
                    'auteur': 'ar2_2_nomAuteur',
                    'type_travail': 'ar2_2_typeTravail',
                    'titre': 'ar2_2_titre',
                    'institution': 'ar2_2_institution',
                    'date_soutenance': 'ar2_2_dateSoutenance',
                    'role': 'ar2_2_role'
                },
                'legacy_key': 'ar2_2_fichiers'
            },
            'ar3_1': {
                'table': 'ar3_1_structures',
                'file_col': 'ar3_1_fichiers',
                'file_key': 'PDF',
                'fields': {
                    'structure': 'ar3_1_nomStructure',
                    'adresse': 'ar3_1_adresseStructure',
                    'periode': 'ar3_1_periode'
                },
                'legacy_key': 'ar3_1_fichiers'
            },
            'ar3_2': {
                'table': 'ar3_2_equipes',
                'file_col': 'ar3_2_fichiers',
                'file_key': 'PDF',
                'fields': {
                    'equipe': 'ar3_2_nomEquipe',
                    'adresse': 'ar3_2_adresseEquipe',
                    'structure_parente': 'ar3_2_structure_parente',
                    'periode': 'ar3_2_periode'
                },
                'legacy_key': 'ar3_2_fichiers'
            },
            'ar3_3': {
                'table': 'ar3_3_projets',
                'file_col': 'ar3_3_fichiers',
                'file_key': 'contrat',
                'file_fields': {
                    'contrat': 'ar3_3_fichiers',
                    'attestation_responsable': 'ar3_3_attestation_responsable'
                },
                'fields': {
                    'responsable': 'ar3_3_nomResponsable',
                    'role': 'ar3_3_role',
                    'nature': 'ar3_3_nature',
                    'titre': 'ar3_3_titre',
                    'montant': 'ar3_3_montant',
                    'duree': 'ar3_3_duree',
                    'partenaire': 'ar3_3_partenaire'
                },
                'legacy_key': 'ar3_3_fichiers'
            },
            'ar3_4': {
                'table': 'ar3_4_expertises',
                'file_col': 'ar3_4_fichiers',
                'file_key': 'PDF',
                'fields': {
                    'type_activite': 'ar3_4_typeActivite',
                    'objet': 'ar3_4_objet',
                    'date': 'ar3_4_date'
                },
                'legacy_key': 'ar3_4_fichiers'
            },
            'ar4_1': {
                'table': 'ar4_1_animations',
                'file_col': 'ar4_1_fichiers',
                'file_key': 'PDF',
                'fields': {
                    'titre': 'ar4_1_titre',
                    'lieu': 'ar4_1_lieu',
                    'date': 'ar4_1_date',
                    'role': 'ar4_1_role'
                },
                'legacy_key': 'ar4_1_fichiers'
            },
            'ar4_2': {
                'table': 'ar4_2',
                'file_col': 'ar4_2_fichiers',
                'file_key': 'PDF',
                'fields': {
                    'nature': 'ar4_2_nature',
                    'organisme': 'ar4_2_organisme',
                    'lieu': 'ar4_2_lieu',
                    'date': 'ar4_2_date'
                },
                'legacy_key': 'ar4_2_fichiers'
            },
            'ar4_3': {
                'table': 'ar4_3',
                'file_col': 'ar4_3_fichiers',
                'file_key': 'PDF',
                'fields': {
                    'type_activite': 'ar4_3_type_activite',
                    'nature_activite': 'ar4_3_nature_activite',
                    'date': 'ar4_3_date'
                },
                'legacy_key': 'ar4_3_fichiers'
            },
        }

        for section, cfg in ar_other_sections.items():
            rows = _rows_as_dicts(cfg['table'])
            step5_data[section] = []
            for row in rows:
                row_data = {cfg['file_key']: _safe_str(row.get(cfg['file_col']))}
                for file_field, db_col in cfg.get('file_fields', {}).items():
                    row_data[file_field] = _safe_str(row.get(db_col))
                for json_field, db_field in cfg['fields'].items():
                    row_data[json_field] = _safe_str(row.get(db_field))
                row_data['row_id'] = row.get('id')
                step5_data[section].append(row_data)

            step5_data[cfg['legacy_key']] = '\n'.join([row.get(cfg['file_key'], '') for row in step5_data[section]])
        cur.close()

        return jsonify({
            'success': True,
            'data': {
                'dossier_id': dossier_id,
                'step1': step1_data,
                'step2': step2_data,
                'step3': step3_data,
                'step4': step4_data,
                'step5': step5_data
            }
        }), 200

    except Exception as e:
        print(f"❌ Erreur dans load_form_data : {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Erreur serveur: {str(e)}'}), 500


# ===========================================
# API : SUPPRESSION IMMÉDIATE D'UNE LIGNE D'ACTIVITÉ
# ===========================================
ACTIVITY_ROW_TABLES = {
    'table-licence': 'enseignements_licence',
    'table-encadrement-licence': 'encadrements_licence',
    'table-master': 'enseignements_master',
    'table-encadrement-master': 'encadrements_master',
    'table-responsabilites': 'responsabilites',
    'table-ae1-1': 'ae1_1_ouvrages',
    'table-ae1-2': 'ae1_2_manuels',
    'table-ae1-3': 'ae1_3_ntic',
    'table-ae2-1': 'ae2_1_encadrements',
    'table-ae2-2': 'ae2_2_encadrements',
    'table-ae2-3': 'ae2_3_encadrements',
    'table-ae3-1': 'ae3_1',
    'table-ae3-2': 'ae3_2',
    'table-ae3-3': 'ae3_3',
    'table-ae3-4': 'ae3_4',
    'table-ae3-5': 'ae3_5',
    'table-ae3-6': 'ae3_6',
    'table-ae3-7': 'ae3_7',
    'table-ar1-1': 'ar1_1_articles',
    'table-ar1-2': 'ar1_2_actes',
    'table-ar1-3': 'ar1_3_ouvrages',
    'table-ar1-4': 'ar1_4_revues',
    'table-ar2-1': 'ar2_1_theses',
    'table-ar2-2': 'ar2_2_jurys',
    'table-ar3-1': 'ar3_1_structures',
    'table-ar3-2': 'ar3_2_equipes',
    'table-ar3-3': 'ar3_3_projets',
    'table-ar3-4': 'ar3_4_expertises',
    'table-ar4-1': 'ar4_1_animations',
    'table-ar4-2': 'ar4_2',
    'table-ar4-3': 'ar4_3',
}


@app.route('/api/delete-activity-row', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def delete_activity_row():
    """Supprime immédiatement une ligne d'activité de la base de données."""
    try:
        data = request.get_json(silent=True) or {}
        table_id = data.get('table_id', '')
        row_id = data.get('row_id')

        if table_id not in ACTIVITY_ROW_TABLES:
            return jsonify({'success': False, 'message': 'Table inconnue.'}), 400
        try:
            row_id = int(row_id)
        except (TypeError, ValueError):
            return jsonify({'success': False, 'message': 'Identifiant de ligne invalide.'}), 400

        table_name = ACTIVITY_ROW_TABLES[table_id]
        enseignant_id = session.get('enseignant_id')

        cur = mysql.connection.cursor()

        # Vérifier que la ligne appartient au dossier brouillon de cet enseignant
        cur.execute(f"""
            SELECT d.id
            FROM dossiers d
            JOIN {table_name} t ON t.dossier_id = d.id
            WHERE t.id = %s AND d.enseignant_id = %s AND d.statut = 'brouillon'
        """, (row_id, enseignant_id))
        dossier = cur.fetchone()
        if not dossier:
            cur.close()
            return jsonify({'success': False, 'message': 'Ligne introuvable ou non modifiable.'}), 404

        # Supprimer les fichiers associés
        try:
            cur.execute(f"SELECT * FROM {table_name} WHERE id = %s", (row_id,))
            row = cur.fetchone()
            if row:
                for key, value in row.items():
                    if isinstance(value, str) and value.startswith('uploads/'):
                        FileService.delete_file(value)
        except Exception:
            pass

        cur.execute(f"DELETE FROM {table_name} WHERE id = %s", (row_id,))
        mysql.connection.commit()
        cur.close()

        LoggerService.log_action(session.get('email'), 'ENSEIGNANT', "ACTIVITE_SUPPRIMEE",
                                 f"Ligne {row_id} supprimée de {table_name}")
        return jsonify({'success': True, 'message': 'Ligne supprimée.'})
    except Exception as e:
        print(f"❌ Erreur suppression ligne activité : {e}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500


# ========================
# ROUTES COORDINATEUR
# ========================
@app.route('/coordinateurpage')
@login_required
@role_required('COORDINATEUR')
def coordinateurpage():
    cur = mysql.connection.cursor()
    statut_filter = request.args.get('statut', 'all')
    grade_filter = request.args.get('grade', '')
    # Récupérer les dossiers + info d'assignation
    params = []
    query = """
        SELECT 
            d.id, 
            e.nom, 
            e.prenom, 
            e.date_naissance, 
            d.date_soumission, 
            e.departement, 
            e.grade, 
            d.statut,
            d.note,
            CASE 
                WHEN ac.dossier_id IS NOT NULL THEN 1 
                ELSE 0 
            END AS assigned,
            membre.nom AS membre_nom,
            membre.prenom AS membre_prenom
        FROM dossiers d
        JOIN enseignants e ON d.enseignant_id = e.id
        JOIN users u ON e.iduser = u.iduser
        LEFT JOIN assignations_commission ac ON d.id = ac.dossier_id
        LEFT JOIN users membre ON ac.membre_user_id = membre.iduser
        WHERE d.statut IN ('soumis', 'évalué') AND u.statut = 'actif'
    """
    if statut_filter == 'assigned':
        query += " AND ac.dossier_id IS NOT NULL"
    elif statut_filter == 'unassigned':
        query += " AND ac.dossier_id IS NULL"
    grade_families = {'MC': 'MC %', 'MCH': 'MCH %', 'PES': 'PES %'}
    if grade_filter in grade_families:
        query += " AND e.grade LIKE %s"
        params.append(grade_families[grade_filter])
    cur.execute(query, params)
    dossiers = cur.fetchall()
    cur.close()
    # Récupérer les membres de commission avec leur grade
    cur = mysql.connection.cursor()
    cur.execute("SELECT iduser, email_user, nom, prenom, grade FROM users WHERE role_user = 'COMMISSION'")
    membres_commission = [dict(row) for row in cur.fetchall()]
    cur.close()
    return render_template('coordinateur.html', dossiers=dossiers, membres_commission=membres_commission, annee=datetime.now().year - 1)

@app.route('/api/assign-commission-member', methods=['POST'])
@login_required
@role_required('COORDINATEUR')
def assign_commission_member():
    try:
        data = request.get_json()
        dossier_id = data.get('dossier_id')
        member_email = data.get('member_email')
        if not dossier_id or not member_email:
            return jsonify({'success': False, 'message': 'Données manquantes.'}), 400
        cur = mysql.connection.cursor()
        # Vérifier que le membre existe
        cur.execute("SELECT iduser FROM users WHERE email_user = %s AND role_user = 'COMMISSION'", (member_email,))
        membre = cur.fetchone()
        if not membre:
            return jsonify({'success': False, 'message': 'Membre non valide.'}), 400

        # --- VALIDATION DU GRADE ---
        # Récupérer le grade du membre de commission depuis la table users
        cur.execute("SELECT grade FROM users WHERE iduser = %s", (membre['iduser'],))
        membre_info = cur.fetchone()
        membre_grade = membre_info['grade'] if membre_info else None

        # Récupérer le grade de l'enseignant du dossier
        cur.execute("""
            SELECT e.grade
            FROM dossiers d
            JOIN enseignants e ON d.enseignant_id = e.id
            WHERE d.id = %s
        """, (dossier_id,))
        ens_info = cur.fetchone()
        enseignant_grade = ens_info['grade'] if ens_info else None

        # Vérifier la hiérarchie des grades
        ok, msg = can_evaluate(membre_grade, enseignant_grade)
        if not ok:
            cur.close()
            return jsonify({'success': False, 'message': msg}), 400

        # Insérer dans assignations_commission
        cur.execute("""
            INSERT INTO assignations_commission (dossier_id, membre_user_id, coordinateur_user_id)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE 
                membre_user_id = VALUES(membre_user_id),
                coordinateur_user_id = VALUES(coordinateur_user_id)
        """, (dossier_id, membre['iduser'], session['user_id']))
        mysql.connection.commit()
        cur.close()
        add_notification(membre['iduser'], 'Un nouveau dossier vous a été assigné pour évaluation.', url_for('membrecommission', evaluate=dossier_id))
        return jsonify({'success': True, 'message': 'Membre assigné.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ========================
# ROUTES MEMBRE COMMISSION
# ========================
@app.route('/membrecommission')
@login_required
@role_required('COMMISSION')
def membrecommission():
    cur = mysql.connection.cursor()
    # Récupérer les dossiers assignés à ce membre
    query = """
        SELECT d.id, e.nom, e.prenom, e.grade, d.date_soumission, d.statut, e.departement, e.date_naissance, d.pdf_evaluation, d.date_evaluation
        FROM dossiers d
        JOIN enseignants e ON d.enseignant_id = e.id
        JOIN users u ON e.iduser = u.iduser
        JOIN assignations_commission ac ON d.id = ac.dossier_id
        WHERE ac.membre_user_id = %s AND u.statut = 'actif'
    """
    cur.execute(query, (session['user_id'],))
    dossiers = cur.fetchall()
    cur.close()
    evaluate_id = request.args.get('evaluate', type=int)
    evaluate_statut = None
    if evaluate_id:
        for d in dossiers:
            if d['id'] == evaluate_id:
                evaluate_statut = d['statut']
                break
    return render_template('membrecommission.html', dossiers=dossiers, annee=datetime.now().year - 1, evaluate_id=evaluate_id, evaluate_statut=evaluate_statut)


    
@app.route('/api/dossier-complet/<int:dossier_id>', methods=['GET'])
@login_required
@role_required('COMMISSION')
def get_dossier_complet(dossier_id):
    cur = mysql.connection.cursor()
    # Vérifier que le dossier existe
    cur.execute("""
        SELECT d.*, e.* 
        FROM dossiers d
        JOIN enseignants e ON d.enseignant_id = e.id
        JOIN users u ON e.iduser = u.iduser
        WHERE d.id = %s AND u.statut = 'actif'
    """, (dossier_id,))
    dossier = cur.fetchone()
    if not dossier:
        cur.close()
        return jsonify({'success': False, 'message': 'Dossier non autorisé.'}), 403

    # Charger les données associées
    ens_lic = []
    enc_lic = []
    ens_mast = []
    enc_mast = []
    resp = []
    ae = {}
    ar = {}
    evaluations_details = {}

    cur.execute("SELECT * FROM enseignements_licence WHERE dossier_id = %s", (dossier_id,))
    ens_lic = [dict(row) for row in cur.fetchall()]
    cur.execute("SELECT * FROM encadrements_licence WHERE dossier_id = %s", (dossier_id,))
    enc_lic = [dict(row) for row in cur.fetchall()]
    cur.execute("SELECT * FROM enseignements_master WHERE dossier_id = %s", (dossier_id,))
    ens_mast = [dict(row) for row in cur.fetchall()]
    cur.execute("SELECT * FROM encadrements_master WHERE dossier_id = %s", (dossier_id,))
    enc_mast = [dict(row) for row in cur.fetchall()]
    cur.execute("SELECT * FROM responsabilites WHERE dossier_id = %s", (dossier_id,))
    resp = [dict(row) for row in cur.fetchall()]

    # Helper: récupère les lignes d'une table individuelle
    def _get_rows(table_name, d_id):
        cur2 = mysql.connection.cursor()
        try:
            cur2.execute(f"SELECT * FROM {table_name} WHERE dossier_id = %s", (d_id,))
            return [dict(r) for r in cur2.fetchall()]
        finally:
            cur2.close()

    def _rows_to_textcols(table_name, d_id):
        rows = _get_rows(table_name, d_id)
        if not rows:
            return {}
        cols = [k for k in rows[0].keys() if k not in ('id', 'dossier_id')]
        result = {}
        for col in cols:
            values = [str(r[col] or '') for r in rows]
            result[col] = '\n'.join(values)
        return result

    # Tables AE (activités d'enseignement) individuelles
    ae_tables = {
        'ae1_1': 'ae1_1_ouvrages',
        'ae1_2': 'ae1_2_manuels',
        'ae1_3': 'ae1_3_ntic',
        'ae2_1': 'ae2_1_encadrements',
        'ae2_2': 'ae2_2_encadrements',
        'ae2_3': 'ae2_3_encadrements',
    }
    for i in range(1, 8):
        ae_tables[f'ae3_{i}'] = f'ae3_{i}'

    ae_data = {}
    for key, table_name in ae_tables.items():
        ae.update(_rows_to_textcols(table_name, dossier_id))
        ae_data[key] = _get_rows(table_name, dossier_id)

    # Tables AR (activités de recherche) individuelles
    ar_table_map = {
        'ar1_1': 'ar1_1_articles',
        'ar1_2': 'ar1_2_actes',
        'ar1_3': 'ar1_3_ouvrages',
        'ar1_4': 'ar1_4_revues',
        'ar2_1': 'ar2_1_theses',
        'ar2_2': 'ar2_2_jurys',
        'ar3_1': 'ar3_1_structures',
        'ar3_2': 'ar3_2_equipes',
        'ar3_3': 'ar3_3_projets',
        'ar3_4': 'ar3_4_expertises',
        'ar4_1': 'ar4_1_animations',
        'ar4_2': 'ar4_2',
        'ar4_3': 'ar4_3',
    }
    ar_data = {}
    for key, table_name in ar_table_map.items():
        ar.update(_rows_to_textcols(table_name, dossier_id))
        ar_data[key] = _get_rows(table_name, dossier_id)

    # Compatibilité : le JS attend ar1_X_publications mais la colonne réelle est ar1_X_lien
    for section in ['ar1_1', 'ar1_2', 'ar1_3', 'ar1_4']:
        lien_key = f'{section}_lien'
        pub_key = f'{section}_publications'
        if lien_key in ar and pub_key not in ar:
            ar[pub_key] = ar[lien_key]

    # Compatibilité : AR2-1 stocke le fichier dans ar2_1_these mais le JS attend ar2_1_fichiers
    if 'ar2_1_these' in ar and 'ar2_1_fichiers' not in ar:
        ar['ar2_1_fichiers'] = ar['ar2_1_these']

    # Charger les évaluations détaillées
    cur.execute("SELECT * FROM evaluations_details WHERE dossier_id = %s", (dossier_id,))
    eval_rows = cur.fetchall()
    for row in eval_rows:
        evaluations_details[row['section_key']] = row

    cur.close()
    return jsonify({
        'success': True,
        'dossier': dict(dossier),
        'enseignements_licence': ens_lic,
        'encadrements_licence': enc_lic,
        'enseignements_master': ens_mast,
        'encadrements_master': enc_mast,
        'responsabilites': resp,
        'activites_enseignement': dict(ae),
        'activites_recherche': dict(ar),
        'ae_data': ae_data,
        'ar_data': ar_data,
        'evaluations_details': evaluations_details
    })

@app.route('/api/evaluer-dossier/<int:dossier_id>', methods=['POST'])
@login_required
@role_required('COMMISSION')
def api_evaluer_dossier(dossier_id):
    try:
        data = request.get_json()
        commentaire_global = data.get('commentaire', '').strip()
        details = data.get('details', {}) # Dictionnaire { 'section_key': { 'commentaire': '...' } }
        note = data.get('note')
        try:
            note = float(note)
        except (TypeError, ValueError):
            return jsonify({'success': False, 'message': 'La note générale est requise.'}), 400
        if note < 0 or note > 100:
            return jsonify({'success': False, 'message': 'La note générale doit être comprise entre 0 et 100.'}), 400

        cur = mysql.connection.cursor()
        # Vérifier que le dossier est bien assigné et en statut 'soumis'
        cur.execute("""
            SELECT d.statut 
            FROM dossiers d
            JOIN assignations_commission ac ON d.id = ac.dossier_id
            WHERE d.id = %s AND ac.membre_user_id = %s
        """, (dossier_id, session['user_id']))
        dossier = cur.fetchone()
        if not dossier or dossier['statut'] != 'soumis':
            return jsonify({'success': False, 'message': 'Dossier non éligible à l\'évaluation.'}), 400

        # --- VALIDATION DU GRADE (filet de sécurité) ---
        cur.execute("""
            SELECT u.grade AS membre_grade, e.grade AS enseignant_grade
            FROM assignations_commission ac
            JOIN users u ON ac.membre_user_id = u.iduser
            JOIN dossiers d ON ac.dossier_id = d.id
            JOIN enseignants e ON d.enseignant_id = e.id
            WHERE ac.dossier_id = %s AND ac.membre_user_id = %s
        """, (dossier_id, session['user_id']))
        grades = cur.fetchone()
        if grades:
            ok, msg = can_evaluate(grades['membre_grade'], grades['enseignant_grade'])
            if not ok:
                cur.close()
                return jsonify({'success': False, 'message': msg}), 403

        statut_final = 'évalué'

        # Mise à jour du dossier principal
        cur.execute("""
            UPDATE dossiers 
            SET statut = %s, commentaire = %s, note = %s, date_evaluation = NOW()
            WHERE id = %s
        """, (statut_final, commentaire_global, note, dossier_id))

        # Enregistrement des détails
        for section_key, eval_data in details.items():
            comm_section = eval_data.get('commentaire', '')
            
            # Upsert (Insert or Update)
            cur.execute("""
                INSERT INTO evaluations_details (dossier_id, section_key, commentaire)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE commentaire = VALUES(commentaire)
            """, (dossier_id, section_key, comm_section))

        mysql.connection.commit()
        cur.close()
        
        # Générer le PDF d'évaluation
        try:
            pdf_bytes = generer_evaluation_pdf(dossier_id)
            if pdf_bytes:
                # Récupérer le nom de l'enseignant
                c = mysql.connection.cursor()
                c.execute("""
                    SELECT e.nom, e.prenom FROM enseignants e
                    JOIN dossiers d ON d.enseignant_id = e.id
                    WHERE d.id = %s
                """, (dossier_id,))
                ens = c.fetchone()
                c.close()
                if ens:
                    base_folder = os.path.join(app.root_path, 'static', 'uploads', 'evaluations_pdf')
                    os.makedirs(base_folder, exist_ok=True)
                    pdf_filename = f"Evaluation_{ens['nom']}_{ens['prenom']}_{dossier_id}.pdf".replace(' ', '_')
                    pdf_path = os.path.join(base_folder, pdf_filename)
                    with open(pdf_path, 'wb') as f:
                        f.write(pdf_bytes)
                    cur3 = mysql.connection.cursor()
                    cur3.execute("UPDATE dossiers SET pdf_evaluation = %s WHERE id = %s",
                                 (f"uploads/evaluations_pdf/{pdf_filename}", dossier_id))
                    mysql.connection.commit()
                    cur3.close()
        except Exception as e:
            print(f"Erreur génération PDF évaluation: {e}")
        
        try:
            cur2 = mysql.connection.cursor()
            cur2.execute("""
                SELECT e.user_id FROM dossiers d
                JOIN enseignants e ON d.enseignant_id = e.id
                WHERE d.id = %s
            """, (dossier_id,))
            enseignant_user = cur2.fetchone()
            cur2.close()
            if enseignant_user:
                add_notification(enseignant_user['user_id'], f"Votre dossier (ID {dossier_id}) a été évalué.", url_for('consulter_dossier', dossier_id=dossier_id))
        except Exception:
            pass
        
        LoggerService.log_action(session.get('email'), 'COMMISSION', "DOSSIER_EVALUATION", f"Dossier {dossier_id} évalué. Statut : {statut_final}")
        
        return jsonify({'success': True, 'message': 'Évaluation enregistrée.'})
    except Exception as e:
        print(f"Erreur évaluation : {e}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500




@app.route('/api/download-evaluation-pdf/<int:dossier_id>')
@login_required
@role_required('COMMISSION', 'SUPERADMIN')
def download_evaluation_pdf(dossier_id):
    """Télécharger le PDF d'évaluation d'un dossier"""
    user_id = session['user_id']
    user_role = session.get('role', '')

    cur = mysql.connection.cursor()
    # Vérifier l'accès
    if user_role == 'COMMISSION':
        cur.execute("""
            SELECT 1 FROM assignations_commission
            WHERE dossier_id = %s AND membre_user_id = %s
        """, (dossier_id, user_id))
        if not cur.fetchone():
            cur.close()
            return jsonify({'success': False, 'message': 'Accès non autorisé.'}), 403
    # SUPERADMIN peut tout voir

    cur.execute("SELECT pdf_evaluation FROM dossiers WHERE id = %s", (dossier_id,))
    dossier = cur.fetchone()
    cur.close()

    if not dossier or not dossier['pdf_evaluation']:
        return jsonify({'success': False, 'message': 'PDF non disponible.'}), 404

    pdf_rel_path = dossier['pdf_evaluation']
    pdf_abs_path = os.path.join(app.root_path, 'static', pdf_rel_path)

    if not os.path.isfile(pdf_abs_path):
        return jsonify({'success': False, 'message': 'Fichier PDF introuvable.'}), 404

    filename = os.path.basename(pdf_rel_path)
    return send_file(pdf_abs_path, mimetype='application/pdf', as_attachment=True, download_name=filename)


@app.route('/api/reassign-dossier/<int:dossier_id>', methods=['POST'])
@login_required
@role_required('COORDINATEUR')
def reassign_dossier(dossier_id):
    try:
        cur = mysql.connection.cursor()
        # Vérifier que le dossier existe et est évalué
        cur.execute("SELECT id, statut FROM dossiers WHERE id = %s", (dossier_id,))
        dossier = cur.fetchone()
        if not dossier or dossier['statut'] != 'évalué':
            cur.close()
            return jsonify({'success': False, 'message': 'Le dossier n\'est pas en état évalué.'}), 400

        # Réinitialiser l'évaluation
        cur.execute("""
            UPDATE dossiers
            SET statut = 'soumis', note = NULL, commentaire = NULL, date_evaluation = NULL,
                pdf_evaluation = NULL
            WHERE id = %s
        """, (dossier_id,))

        # Supprimer les détails d'évaluation
        cur.execute("DELETE FROM evaluations_details WHERE dossier_id = %s", (dossier_id,))

        # Récupérer le membre assigné pour le notifier
        cur.execute("""
            SELECT membre_user_id FROM assignations_commission WHERE dossier_id = %s
        """, (dossier_id,))
        assignation = cur.fetchone()

        mysql.connection.commit()
        cur.close()

        if assignation:
            add_notification(assignation['membre_user_id'],
            f"Le dossier (ID {dossier_id}) vous a été réassigné pour réévaluation.",
            url_for('membrecommission', evaluate=dossier_id))

        LoggerService.log_action(session.get('email'), 'COORDINATEUR', "DOSSIER_REASSIGN",
            f"Dossier {dossier_id} réassigné pour réévaluation.")

        return jsonify({'success': True, 'message': 'Dossier réassigné avec succès.'})
    except Exception as e:
        print(f"Erreur reassign : {e}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500


@app.route('/consulter-dossier/<int:dossier_id>')
@login_required
@role_required('COMMISSION', 'COORDINATEUR')
def consulter_dossier(dossier_id):
    # Rediriger les membres COMMISSION vers leur page d'évaluation
    if session.get('role') == 'COMMISSION':
        return redirect(url_for('membrecommission', evaluate=dossier_id))
    cur = mysql.connection.cursor()
    role = session.get('role')
    # La commission ne voit que ses dossiers, le coordinateur voit tout
    if role == 'COMMISSION':
        cur.execute("""
            SELECT d.*, e.* 
            FROM dossiers d
            JOIN enseignants e ON d.enseignant_id = e.id
            JOIN users u ON e.iduser = u.iduser
            JOIN assignations_commission ac ON d.id = ac.dossier_id
            WHERE d.id = %s AND ac.membre_user_id = %s AND u.statut = 'actif'
        """, (dossier_id, session['user_id']))
    else:
        cur.execute("""
            SELECT d.*, e.* 
            FROM dossiers d
            JOIN enseignants e ON d.enseignant_id = e.id
            JOIN users u ON e.iduser = u.iduser
            WHERE d.id = %s AND u.statut = 'actif'
        """, (dossier_id,))
    dossier = cur.fetchone()
    if not dossier:
        flash("Dossier non trouvé ou non assigné.", "danger")
        return redirect(url_for('dashboard'))
    
    # Charger les données associées
    cur.execute("SELECT * FROM enseignements_licence WHERE dossier_id = %s", (dossier_id,))
    enseignements_licence = cur.fetchall()
    cur.execute("SELECT * FROM encadrements_licence WHERE dossier_id = %s", (dossier_id,))
    encadrements_licence = cur.fetchall()
    cur.execute("SELECT * FROM enseignements_master WHERE dossier_id = %s", (dossier_id,))
    enseignements_master = cur.fetchall()
    cur.execute("SELECT * FROM encadrements_master WHERE dossier_id = %s", (dossier_id,))
    encadrements_master = cur.fetchall()
    cur.execute("SELECT * FROM responsabilites WHERE dossier_id = %s", (dossier_id,))
    responsabilites = cur.fetchall()

    # Tables AE individuelles
    ae_data = {}
    ae_tables = {
        'ae1_1': 'ae1_1_ouvrages', 'ae1_2': 'ae1_2_manuels', 'ae1_3': 'ae1_3_ntic',
        'ae2_1': 'ae2_1_encadrements', 'ae2_2': 'ae2_2_encadrements', 'ae2_3': 'ae2_3_encadrements',
    }
    for i in range(1, 8):
        ae_tables[f'ae3_{i}'] = f'ae3_{i}'
    for key, table in ae_tables.items():
        cur.execute(f"SELECT * FROM {table} WHERE dossier_id = %s", (dossier_id,))
        ae_data[key] = cur.fetchall()

    # Tables AR individuelles
    ar_data = {}
    ar_tables = {
        'ar1_1': 'ar1_1_articles', 'ar1_2': 'ar1_2_actes', 'ar1_3': 'ar1_3_ouvrages', 'ar1_4': 'ar1_4_revues',
        'ar2_1': 'ar2_1_theses', 'ar2_2': 'ar2_2_jurys',
        'ar3_1': 'ar3_1_structures', 'ar3_2': 'ar3_2_equipes', 'ar3_3': 'ar3_3_projets', 'ar3_4': 'ar3_4_expertises',
        'ar4_1': 'ar4_1_animations', 'ar4_2': 'ar4_2', 'ar4_3': 'ar4_3',
    }
    for key, table in ar_tables.items():
        cur.execute(f"SELECT * FROM {table} WHERE dossier_id = %s", (dossier_id,))
        ar_data[key] = cur.fetchall()

    # Évaluations détaillées
    cur.execute("SELECT * FROM evaluations_details WHERE dossier_id = %s", (dossier_id,))
    eval_rows = cur.fetchall()
    evaluations_by_key = {row['section_key']: row for row in eval_rows}

    cur.close()
    return render_template(
        'consulter_dossier.html',
        dossier=dossier,
        enseignements_licence=enseignements_licence,
        encadrements_licence=encadrements_licence,
        enseignements_master=enseignements_master,
        encadrements_master=encadrements_master,
        responsabilites=responsabilites,
        ae_data=ae_data,
        ar_data=ar_data,
        evaluations_by_key=evaluations_by_key,
        annee=datetime.now().year - 1
    )
# ========================
# ROUTES SUPERADMIN
# ========================
@app.route('/superadmin')
@login_required
@role_required('SUPERADMIN')
def superadmin_dashboard():
    """Dashboard principal du SuperAdmin"""
    cur = mysql.connection.cursor()
    # Statistiques
    cur.execute("SELECT COUNT(*) as total FROM users WHERE role_user = 'ENSEIGNANT'")
    nb_enseignants = cur.fetchone()['total']
    cur.execute("SELECT COUNT(*) as total FROM users WHERE role_user = 'COORDINATEUR'")
    nb_coordinateurs = cur.fetchone()['total']
    cur.execute("SELECT COUNT(*) as total FROM users WHERE role_user = 'COMMISSION'")
    nb_membres = cur.fetchone()['total']
    # Liste des utilisateurs (sauf le connecté)
    cur.execute("""
        SELECT
            u.iduser, u.email_user, u.role_user, u.statut, u.date_creation, u.nom, u.prenom, u.grade,
            d.statut AS statut_dossier,
            e.date_debut_avancement, e.date_fin_avancement,
            e.telephone, e.ppr, e.cin
        FROM users u
        LEFT JOIN enseignants e ON e.iduser = u.iduser
        LEFT JOIN (
            SELECT d1.* FROM dossiers d1
            INNER JOIN (
                SELECT enseignant_id, MAX(annee) AS max_annee
                FROM dossiers
                GROUP BY enseignant_id
            ) d2 ON d1.enseignant_id = d2.enseignant_id AND d1.annee = d2.max_annee
        ) d ON d.enseignant_id = e.id
        WHERE u.iduser != %s
        ORDER BY u.date_creation DESC
    """, (session['user_id'],))
    users = cur.fetchall()

    # Données des enseignants (pour pré-remplir le modal d'édition)
    cur.execute("SELECT iduser, nom, prenom, email, grade, date_debut_avancement, date_fin_avancement, telephone, ppr FROM enseignants")
    enseignants = [dict(r) for r in cur.fetchall()]

    cur.close()
    return render_template('superadmin.html', 
                         nb_enseignants=nb_enseignants,
                         nb_coordinateurs=nb_coordinateurs,
                         nb_membres=nb_membres,
                         users=users,
                         enseignants=enseignants)

@app.route('/api/create-user', methods=['POST'])
@login_required
@role_required('SUPERADMIN')
def create_user():
    """Créer un nouvel utilisateur avec nom et prénom, quel que soit le rôle."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        role = data.get('role', '').upper()
        password = data.get('password', '')
        nom = data.get('nom', '').strip()
        prenom = data.get('prenom', '').strip()
        grade = data.get('grade', '').strip() if data.get('grade') else None
        date_debut_avancement = data.get('date_debut_avancement') or None
        date_fin_avancement = data.get('date_fin_avancement') or None
        telephone = data.get('telephone', '').strip() or None
        ppr = data.get('ppr', '').strip() or None
        cin = data.get('cin', '').strip() or None

        #  Validation des champs obligatoires
        if not email or not role or not password or not nom or not prenom:
            return jsonify({'success': False, 'message': 'Tous les champs (email, rôle, mot de passe, nom, prénom) sont requis.'}), 400

        if role == 'ENSEIGNANT' and (not date_debut_avancement or not date_fin_avancement):
            return jsonify({'success': False, 'message': 'Les dates de début et fin de la période d\'avancement sont obligatoires pour un enseignant.'}), 400

        #  Grade obligatoire pour COMMISSION et ENSEIGNANT
        if role in ('COMMISSION', 'ENSEIGNANT') and not grade:
            label = 'un membre de commission' if role == 'COMMISSION' else 'un enseignant'
            return jsonify({'success': False, 'message': f'Le grade est obligatoire pour {label}.'}), 400

        if role in ('COMMISSION', 'ENSEIGNANT') and grade not in GRADE_HIERARCHY:
            return jsonify({'success': False, 'message': f'Grade "{grade}" non reconnu. Grades valides : {", ".join(GRADE_HIERARCHY.keys())}'}), 400

        if not is_valid_email(email):
            return jsonify({'success': False, 'message': 'Email invalide.'}), 400

        if role not in ['ENSEIGNANT', 'COORDINATEUR', 'COMMISSION', 'SUPERADMIN']:
            return jsonify({'success': False, 'message': 'Rôle invalide.'}), 400

        # Valider le mot de passe
        is_valid, error_message = is_valid_password(password)
        if not is_valid:
            return jsonify({'success': False, 'message': error_message}), 400

        cur = mysql.connection.cursor()

        # 🔍 Vérifier unicité de l'email
        cur.execute("SELECT iduser FROM users WHERE email_user = %s", (email,))
        if cur.fetchone():
            cur.close()
            return jsonify({'success': False, 'message': 'Cet email existe déjà.'}), 400

        # 🔒 Hacher le mot de passe
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # ➕ Insérer dans `users`
        cur.execute("""
            INSERT INTO users (email_user, mot_de_pass_user, role_user, nom, prenom, grade, statut, date_creation)
            VALUES (%s, %s, %s, %s, %s, %s, 'actif', NOW())
        """, (email, hashed_password, role, nom, prenom, grade))

        #  Récupérer l'ID généré AVANT tout autre traitement
        user_id = cur.lastrowid

        #  Si c’est un ENSEIGNANT, insérer aussi dans la table `enseignants`
        if role == 'ENSEIGNANT':
            cur.execute("""
                INSERT INTO enseignants (iduser, nom, prenom, email, mot_de_passe, grade, date_debut_avancement, date_fin_avancement, telephone, ppr, cin)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, nom, prenom, email, hashed_password, grade, date_debut_avancement, date_fin_avancement, telephone, ppr, cin))

        mysql.connection.commit()
        cur.close()

        return jsonify({'success': True, 'message': f'Utilisateur {role.lower()} créé avec succès.'})

    except Exception as e:
        mysql.connection.rollback()
        print(f"❌ Erreur create_user : {str(e)}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500

@app.route('/api/reset-password/<int:user_id>', methods=['POST'])
@login_required
@role_required('SUPERADMIN')
def reset_password(user_id):
    """Réinitialiser le mot de passe d'un utilisateur (sans re-vérification, l'utilisateur est déjà authentifié)."""
    try:
        data = request.get_json()
        new_password = data.get('new_password', '')

        if not new_password:
            return jsonify({'success': False, 'message': 'Nouveau mot de passe requis.'}), 400

        is_valid, error_message = is_valid_password(new_password)
        if not is_valid:
            return jsonify({'success': False, 'message': error_message}), 400

        cur = mysql.connection.cursor()
        cur.execute("SELECT iduser FROM users WHERE iduser = %s", (user_id,))
        target = cur.fetchone()
        if not target:
            cur.close()
            return jsonify({'success': False, 'message': 'Utilisateur introuvable.'}), 404

        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("UPDATE users SET mot_de_pass_user = %s WHERE iduser = %s", (hashed_password, user_id))
        mysql.connection.commit()
        cur.close()

        flash('Mot de passe réinitialisé avec succès.', 'success')
        return jsonify({'success': True})

    except Exception as e:
        print(f"❌ Erreur reset_password : {str(e)}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500

@app.route('/api/update-user/<int:user_id>', methods=['POST'])
@login_required
@role_required('SUPERADMIN')
def update_user(user_id):
    """Modifier un utilisateur existant (login, nom, prénom, email, mot de passe optionnel, rôle, grade/direction)."""
    try:
        data = request.get_json()
        new_nom = data.get('nom', '').strip()
        new_prenom = data.get('prenom', '').strip()
        new_email = data.get('email', '').strip()
        new_role = data.get('role', '').upper()
        new_password = data.get('password', '').strip()
        new_grade = data.get('grade', '').strip() if data.get('grade') else None
        new_date_debut = data.get('date_debut') or None
        new_date_fin = data.get('date_fin') or None
        new_telephone = data.get('telephone', '').strip() or None
        new_ppr = data.get('ppr', '').strip() or None
        new_cin = data.get('cin', '').strip() or None

        if not new_nom or not new_prenom or not new_email or not new_role:
            return jsonify({'success': False, 'message': 'Nom, prénom, email et rôle sont requis.'}), 400

        if new_role not in ('ENSEIGNANT', 'COORDINATEUR', 'COMMISSION', 'SUPERADMIN'):
            return jsonify({'success': False, 'message': 'Rôle invalide.'}), 400

        if new_role in ('ENSEIGNANT', 'COMMISSION') and not new_grade:
            return jsonify({'success': False, 'message': 'Le grade est obligatoire pour ce rôle.'}), 400

        if new_role in ('ENSEIGNANT', 'COMMISSION') and new_grade not in GRADE_HIERARCHY:
            return jsonify({'success': False, 'message': f'Grade "{new_grade}" non reconnu.'}), 400

        if not is_valid_email(new_email):
            return jsonify({'success': False, 'message': 'Email invalide.'}), 400

        cur = mysql.connection.cursor()

        # Vérifier l'existence
        cur.execute("SELECT iduser, role_user FROM users WHERE iduser = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            cur.close()
            return jsonify({'success': False, 'message': 'Utilisateur introuvable.'}), 404
        if user['role_user'] == 'SUPERADMIN':
            cur.close()
            return jsonify({'success': False, 'message': 'Modification du SuperAdmin interdite.'}), 403

        # Vérifier unicité email (exclure l'utilisateur lui-même)
        cur.execute("SELECT iduser FROM users WHERE email_user = %s AND iduser != %s", (new_email, user_id))
        if cur.fetchone():
            cur.close()
            return jsonify({'success': False, 'message': 'Cet email est déjà utilisé par un autre compte.'}), 400

        old_role = user['role_user']

        # Mise à jour users
        if new_password:
            hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cur.execute("UPDATE users SET nom=%s, prenom=%s, email_user=%s, role_user=%s, grade=%s, mot_de_pass_user=%s WHERE iduser=%s",
                        (new_nom, new_prenom, new_email, new_role, new_grade, hashed, user_id))
        else:
            cur.execute("UPDATE users SET nom=%s, prenom=%s, email_user=%s, role_user=%s, grade=%s WHERE iduser=%s",
                        (new_nom, new_prenom, new_email, new_role, new_grade, user_id))

        # Synchroniser la table enseignants si le rôle est ENSEIGNANT
        if old_role == 'ENSEIGNANT':
            cur.execute("UPDATE enseignants SET nom=%s, prenom=%s, email=%s, grade=%s, date_debut_avancement=%s, date_fin_avancement=%s, telephone=%s, ppr=%s, cin=%s WHERE iduser=%s",
                        (new_nom, new_prenom, new_email, new_grade, new_date_debut, new_date_fin, new_telephone, new_ppr, new_cin, user_id))

        # Si le rôle a changé vers ENSEIGNANT, créer l'entrée dans enseignants
        if new_role == 'ENSEIGNANT' and old_role != 'ENSEIGNANT':
            cur.execute("SELECT id FROM enseignants WHERE iduser=%s", (user_id,))
            if not cur.fetchone():
                cur.execute("INSERT INTO enseignants (iduser, nom, prenom, email, grade, date_debut_avancement, date_fin_avancement, telephone, ppr, cin) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                            (user_id, new_nom, new_prenom, new_email, new_grade, new_date_debut, new_date_fin, new_telephone, new_ppr, new_cin))

        mysql.connection.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'Utilisateur modifié avec succès.'})

    except Exception as e:
        mysql.connection.rollback()
        print(f"❌ Erreur update_user : {str(e)}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500

@app.route('/api/toggle-user-status/<int:user_id>', methods=['POST'])
@login_required
@role_required('SUPERADMIN')
def toggle_user_status(user_id):
    """Activer/Désactiver un utilisateur (sauf SuperAdmin)"""
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT statut, role_user FROM users WHERE iduser = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            cur.close()
            return jsonify({'success': False, 'message': 'Utilisateur introuvable.'}), 404
        # 🔒 Protection : ne pas modifier le SuperAdmin
        if user['role_user'] == 'SUPERADMIN':
            cur.close()
            return jsonify({'success': False, 'message': 'Action interdite sur le SuperAdmin.'}), 403
        new_status = 'inactif' if user['statut'] == 'actif' else 'actif'
        cur.execute("UPDATE users SET statut = %s WHERE iduser = %s", (new_status, user_id))
        mysql.connection.commit()
        cur.close()
        flash(f"Statut de l'utilisateur modifié en « {new_status} ».", 'success')
        return jsonify({'success': True, 'status': new_status})
    except Exception as e:
        print(f"Erreur toggle_user_status : {str(e)}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500

@app.route('/api/update-statut-dossier/<int:user_id>', methods=['POST'])
@login_required
@role_required('SUPERADMIN')
def update_statut_dossier(user_id):
    """Modifier le statut dossier d'un enseignant (Brouillon/Soumis)"""
    try:
        data = request.get_json()
        new_statut = data.get('statut_dossier')

        if new_statut not in ('brouillon', 'soumis'):
            return jsonify({'success': False, 'message': 'Statut invalide.'}), 400

        cur = mysql.connection.cursor()
        cur.execute("SELECT role_user FROM users WHERE iduser = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            cur.close()
            return jsonify({'success': False, 'message': 'Utilisateur introuvable.'}), 404
        if user['role_user'] != 'ENSEIGNANT':
            cur.close()
            return jsonify({'success': False, 'message': 'Seuls les enseignants ont un statut dossier.'}), 400

        cur.execute("SELECT id FROM enseignants WHERE iduser = %s", (user_id,))
        enseignant = cur.fetchone()
        if not enseignant:
            cur.close()
            return jsonify({'success': False, 'message': 'Enseignant introuvable.'}), 404

        enseignant_id = enseignant['id']

        cur.execute("SELECT id, statut FROM dossiers WHERE enseignant_id = %s ORDER BY annee DESC LIMIT 1", (enseignant_id,))
        dossier = cur.fetchone()

        if dossier:
            cur.execute("UPDATE dossiers SET statut = %s WHERE id = %s", (new_statut, dossier['id']))
        else:
            cur.execute(
                "INSERT INTO dossiers (enseignant_id, annee, statut) VALUES (%s, %s, %s)",
                (enseignant_id, datetime.now().year, new_statut)
            )

        mysql.connection.commit()
        cur.close()
        return jsonify({'success': True, 'statut_dossier': new_statut})
    except Exception as e:
        print(f"Erreur update_statut_dossier : {str(e)}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500


@app.route('/api/delete-user/<int:user_id>', methods=['DELETE'])
@login_required
@role_required('SUPERADMIN')
def delete_user(user_id):
    """Supprimer un utilisateur (sauf SuperAdmin)"""
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT role_user FROM users WHERE iduser = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            cur.close()
            return jsonify({'success': False, 'message': 'Utilisateur introuvable.'}), 404
        # Protection : ne pas supprimer le SuperAdmin
        if user['role_user'] == 'SUPERADMIN':
            cur.close()
            return jsonify({'success': False, 'message': 'Suppression du SuperAdmin interdite.'}), 403
        # Supprimer les données liées si enseignant
        if user['role_user'] == 'ENSEIGNANT':
            cur.execute("SELECT id FROM enseignants WHERE iduser = %s", (user_id,))
            enseignant = cur.fetchone()
            if enseignant:
                enseignant_id = enseignant['id']
                # Supprimer tous les dossiers et données liées
                cur.execute("SELECT id FROM dossiers WHERE enseignant_id = %s", (enseignant_id,))
                dossiers = cur.fetchall()
                for dossier in dossiers:
                    dossier_id = dossier['id']
                    tables = [
                        'enseignements_licence', 'encadrements_licence',
                        'enseignements_master', 'encadrements_master',
                        'responsabilites',
                        # AE tables
                        'ae1_1_ouvrages', 'ae1_2_manuels', 'ae1_3_ntic',
                        'ae2_1_encadrements', 'ae2_2_encadrements', 'ae2_3_encadrements',
                        'ae3_1', 'ae3_2', 'ae3_3', 'ae3_4', 'ae3_5', 'ae3_6', 'ae3_7',
                        # AR tables
                        'ar1_1_articles', 'ar1_2_actes', 'ar1_3_ouvrages', 'ar1_4_revues',
                        'ar2_1_theses', 'ar2_2_jurys',
                        'ar3_1_structures', 'ar3_2_equipes', 'ar3_3_projets', 'ar3_4_expertises',
                        'ar4_1_animations', 'ar4_2', 'ar4_3',
                        'assignations_commission'
                    ]
                    for table in tables:
                        cur.execute(f"DELETE FROM {table} WHERE dossier_id = %s", (dossier_id,))
                cur.execute("DELETE FROM dossiers WHERE enseignant_id = %s", (enseignant_id,))
                cur.execute("DELETE FROM enseignants WHERE iduser = %s", (user_id,))
        cur.execute("DELETE FROM users WHERE iduser = %s", (user_id,))
        mysql.connection.commit()
        cur.close()
        flash('Utilisateur supprimé avec succès.', 'success')
        return jsonify({'success': True})
    except Exception as e:
        mysql.connection.rollback()
        print(f"Erreur delete_user : {str(e)}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500

# ===========================================================================
# GÉNÉRATION DE PDFs POUR LE DOSSIER COMPLET (ENSEIGNANT + COMMISSION)
# ===========================================================================
@app.route('/api/generer-pdf-annexe/<int:annexe_num>/<int:dossier_id>')
@login_required
def generer_pdf_annexe(annexe_num, dossier_id):
    """Génère un PDF d'annexe spécifique (I ou II) — avec cache sur disque"""
    try:
        role = session.get('role')
        
        if role == 'ENSEIGNANT':
            enseignant_id = session.get('enseignant_id')
            cur = mysql.connection.cursor()
            cur.execute("""
                SELECT d.*, e.* 
                FROM dossiers d
                JOIN enseignants e ON d.enseignant_id = e.id
                WHERE d.id = %s AND d.enseignant_id = %s
            """, (dossier_id, enseignant_id))
            dossier = cur.fetchone()
            
            if not dossier:
                cur.close()
                return "Dossier non trouvé", 404
                
        elif role == 'COMMISSION':
            user_id = session.get('user_id')
            cur = mysql.connection.cursor()
            cur.execute("""
                SELECT d.*, e.* 
                FROM dossiers d
                JOIN enseignants e ON d.enseignant_id = e.id
                JOIN users u ON e.iduser = u.iduser
                JOIN assignations_commission ac ON d.id = ac.dossier_id
                WHERE d.id = %s AND ac.membre_user_id = %s AND u.statut = 'actif'
            """, (dossier_id, user_id))
            dossier = cur.fetchone()
            
            if not dossier:
                cur.close()
                return "Dossier non trouvé ou non autorisé", 403

        elif role == 'COORDINATEUR':
            cur = mysql.connection.cursor()
            cur.execute("""
                SELECT d.*, e.* 
                FROM dossiers d
                JOIN enseignants e ON d.enseignant_id = e.id
                WHERE d.id = %s
            """, (dossier_id,))
            dossier = cur.fetchone()
            if not dossier:
                cur.close()
                return "Dossier non trouvé", 404
        else:
            return "Accès refusé. Vous n'avez pas les permissions nécessaires.", 403
        
        # Générer le PDF selon le numéro d'annexe
        if annexe_num == 1:
            pdf = generer_annexe_i(dossier, dossier_id, cur)
        elif annexe_num == 2:
            pdf = generer_annexe_ii(dossier, dossier_id, cur)
        else:
            cur.close()
            return "Annexe invalide", 404
        
        cur.close()
        
        # Sauvegarder sur disque pour servir le fichier (comme evaluation PDF)
        annexes_folder = os.path.join(app.root_path, 'static', 'uploads', 'annexes_pdf')
        os.makedirs(annexes_folder, exist_ok=True)
        pdf_filename = f'annexe_{annexe_num}_{dossier_id}.pdf'
        pdf_path = os.path.join(annexes_folder, pdf_filename)
        with open(pdf_path, 'wb') as f:
            f.write(pdf)
        
        # Vérifier que le PDF est valide
        pdf_size = os.path.getsize(pdf_path)
        if pdf_size < 100:
            print(f"PDF Annexe {annexe_num} dossier {dossier_id} trop petit ({pdf_size} octets)")
            return "PDF généré vide ou corrompu", 500
        
        print(f"PDF Annexe {annexe_num} dossier {dossier_id} généré: {pdf_size} octets")
        return send_file(pdf_path, mimetype='application/pdf', as_attachment=True,
                       download_name=f'Annexe_{annexe_num}.pdf')
        
    except Exception as e:
        print(f"Erreur génération PDF Annexe {annexe_num}: {str(e)}")
        import traceback
        traceback.print_exc()
        return f"Erreur serveur: {str(e)}", 500


def link_callback(uri, rel):
    """
    Convert HTML URIs to absolute system paths so xhtml2pdf can access those
    resources
    """
    # Ensure we have the absolute path to the application root
    basedir = os.path.abspath(os.path.dirname(__file__))
    
    # Handle potential query strings or fragments
    if '?' in uri:
        uri = uri.split('?')[0]
    if '#' in uri:
        uri = uri.split('#')[0]

    # If it's an absolute path and exists, use it
    if os.path.isabs(uri) and os.path.isfile(uri):
        return uri

    # Handle paths starting with /static/
    if uri.startswith('/static/'):
        path = os.path.join(basedir, uri.lstrip('/'))
    elif uri.startswith('static/'):
        path = os.path.join(basedir, uri)
    else:
        # Assume relative to static folder if not specified
        path = os.path.join(basedir, 'static', uri)

    # Check if file exists
    if not os.path.isfile(path):
        print(f"PDF Generation Warning: File not found: {path} (URI: {uri})")
        # Fallback: try to find it relative to root if not found in static
        fallback_path = os.path.join(basedir, uri)
        if os.path.isfile(fallback_path):
            return fallback_path
        return uri # Return original URI if local file not found
        
    return path

# ===========================================================================
# IMPORT EN MASSE D'UTILISATEURS
# ===========================================================================
@app.route('/api/import-users/preview', methods=['POST'])
@login_required
@role_required('SUPERADMIN')
def import_users_preview():
    from utils.import_service import parse_csv, parse_xlsx, valider_ligne, charger_references_db
    import tempfile, os

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'Aucun fichier envoyé.'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Nom de fichier vide.'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    if ext not in ('csv', 'xlsx'):
        return jsonify({'success': False, 'message': 'Format accepté : .csv ou .xlsx'}), 400

    try:
        if ext == 'csv':
            content = file.read().decode('utf-8-sig')
            lignes = parse_csv(content)
        else:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
            file.save(tmp.name)
            lignes = parse_xlsx(tmp.name)
            os.unlink(tmp.name)

        if len(lignes) > Config.IMPORT_MAX_LINES:
            return jsonify({'success': False, 'message': f'Trop de lignes ({len(lignes)}). Maximum : {Config.IMPORT_MAX_LINES}.'}), 400

        db_emails, db_cins, db_pprs = charger_references_db()
        seen_cin, seen_ppr = {}, {}
        resultats = []

        for i, row in enumerate(lignes):
            res = valider_ligne(row, i + 1, seen_cin, seen_ppr, db_cins, db_pprs, db_emails)
            if res['cin']:
                seen_cin[res['cin']] = i + 1
            if res['ppr']:
                seen_ppr[res['ppr']] = i + 1
            resultats.append(res)

        valides = sum(1 for r in resultats if r['valide'])
        erreurs = len(resultats) - valides

        return jsonify({
            'success': True,
            'lignes': resultats,
            'resume': {'total': len(resultats), 'valides': valides, 'erreurs': erreurs}
        })

    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        LoggerService.log_error('ImportPreview', str(e))
        return jsonify({'success': False, 'message': 'Erreur lors du parsing du fichier.'}), 500


@app.route('/api/import-users/confirm', methods=['POST'])
@login_required
@role_required('SUPERADMIN')
def import_users_confirm():
    from utils.import_service import creer_comptes, enregistrer_log, exporter_rapport_csv

    data = request.get_json()
    lignes = data.get('lignes', [])
    fichier_nom = data.get('fichier_nom', 'import')

    if not lignes:
        return jsonify({'success': False, 'message': 'Aucune ligne à importer.'}), 400

    try:
        resultats = creer_comptes(lignes)
        crees = sum(1 for r in resultats if r['statut'] == 'cree')
        echoues = sum(1 for r in resultats if r['statut'] == 'echoue')

        admin_id = session['user_id']
        enregistrer_log(admin_id, fichier_nom, len(lignes), crees, echoues, resultats)
        rapport_csv = exporter_rapport_csv(resultats)

        LoggerService.log_action(
            session.get('email', 'admin'), 'SUPERADMIN', 'IMPORT_MASSE',
            f"{crees} comptes créés, {echoues} erreurs sur {len(lignes)} lignes (fichier: {fichier_nom})",
            'SUCCESS' if echoues == 0 else 'WARNING'
        )

        return jsonify({
            'success': True,
            'resultats': resultats,
            'resume': {'total': len(lignes), 'crees': crees, 'erreurs': echoues},
            'rapport_csv': rapport_csv
        })

    except Exception as e:
        LoggerService.log_error('ImportConfirm', str(e))
        return jsonify({'success': False, 'message': 'Erreur lors de la création des comptes.'}), 500


@app.route('/api/import-users/template')
@login_required
@role_required('SUPERADMIN')
def import_users_template():
    import csv, io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['nom', 'prenom', 'cin', 'ppr', 'tel', 'email', 'role', 'grade', 'date_debut_avancement', 'date_fin_avancement'])
    writer.writerow(['ExempleNom', 'ExemplePrenom', 'AB123456', '12345678', '0612345678', 'enseignant@univh2c.ma', 'ENSEIGNANT', 'MC A', '10/07/2020', '10/07/2025'])
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='modele_import_utilisateurs.csv'
    )


@app.route('/api/import-users/download-rapport', methods=['POST'])
@login_required
@role_required('SUPERADMIN')
def import_users_download_rapport():
    data = request.get_json()
    rapport_csv = data.get('rapport_csv', '')
    return send_file(
        io.BytesIO(rapport_csv.encode('utf-8-sig')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='rapport_import.csv'
    )


@app.route('/api/import-users/history')
@login_required
@role_required('SUPERADMIN')
def import_users_history():
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT l.*, u.email_user as admin_email
        FROM import_logs l
        JOIN users u ON l.admin_user_id = u.iduser
        ORDER BY l.date_import DESC
        LIMIT 50
    """)
    logs = cur.fetchall()
    cur.close()
    return jsonify({'success': True, 'logs': logs})

def generer_annexe_i(dossier, dossier_id, cur):
    """Génère le PDF de l'Annexe I (AE - Activités d'Enseignement)"""

    # Helper: supprime le préfixe des colonnes DB pour les templates
    def strip_prefix(rows, prefix):
        return [{k.replace(prefix, ''): v for k, v in row.items() if k != 'id' and k != 'dossier_id'} for row in rows]

    # AE1
    ae1_1_data = strip_prefix(ActiviteRepository.get_section_data('ae1_1_ouvrages', dossier_id), 'ae1_1_')
    ae1_2_data = strip_prefix(ActiviteRepository.get_section_data('ae1_2_manuels', dossier_id), 'ae1_2_')
    ae1_3_data = strip_prefix(ActiviteRepository.get_section_data('ae1_3_ntic', dossier_id), 'ae1_3_')
    
    # AE2
    ae2_1_data = strip_prefix(ActiviteRepository.get_section_data('ae2_1_encadrements', dossier_id), 'ae2_1_')
    ae2_2_data = strip_prefix(ActiviteRepository.get_section_data('ae2_2_encadrements', dossier_id), 'ae2_2_')
    ae2_3_data = strip_prefix(ActiviteRepository.get_section_data('ae2_3_encadrements', dossier_id), 'ae2_3_')

    # AE3
    ae3_1_data = strip_prefix(ActiviteRepository.get_section_data('ae3_1', dossier_id), 'ae3_1_')
    ae3_2_data = strip_prefix(ActiviteRepository.get_section_data('ae3_2', dossier_id), 'ae3_2_')
    ae3_3_data = strip_prefix(ActiviteRepository.get_section_data('ae3_3', dossier_id), 'ae3_3_')
    ae3_4_data = strip_prefix(ActiviteRepository.get_section_data('ae3_4', dossier_id), 'ae3_4_')
    ae3_5_data = strip_prefix(ActiviteRepository.get_section_data('ae3_5', dossier_id), 'ae3_5_')
    ae3_6_data = strip_prefix(ActiviteRepository.get_section_data('ae3_6', dossier_id), 'ae3_6_')
    ae3_7_data = strip_prefix(ActiviteRepository.get_section_data('ae3_7', dossier_id), 'ae3_7_')

    static_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'static')
    html_content = render_template(
        'pdf/annexe_i.html',
        enseignant=dossier,
        ae1_1_data=ae1_1_data,
        ae1_2_data=ae1_2_data,
        ae1_3_data=ae1_3_data,
        ae2_1_data=ae2_1_data,
        ae2_2_data=ae2_2_data,
        ae2_3_data=ae2_3_data,
        ae3_1_data=ae3_1_data,
        ae3_2_data=ae3_2_data,
        ae3_3_data=ae3_3_data,
        ae3_4_data=ae3_4_data,
        ae3_5_data=ae3_5_data,
        ae3_6_data=ae3_6_data,
        ae3_7_data=ae3_7_data,
        annee=datetime.now().year - 1,
        now=datetime.now(),
        static_path=static_path
    )
    # Convertir HTML en PDF avec xhtml2pdf
    pdf_buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(
        io.StringIO(html_content), 
        dest=pdf_buffer,
        link_callback=link_callback
    )
    
    if pisa_status.err:
        raise Exception(f"Erreur lors de la génération du PDF: {pisa_status.err}")
    
    pdf_buffer.seek(0)
    return pdf_buffer.read()


def generer_annexe_ii(dossier, dossier_id, cur):
    """Génère le PDF de l'Annexe II (AR - Activités de Recherche)"""

    # Helper: supprime le préfixe des colonnes DB pour les templates
    def strip_prefix(rows, prefix):
        return [{k.replace(prefix, ''): v for k, v in row.items() if k != 'id' and k != 'dossier_id'} for row in rows]

    # AR1
    ar1_1_data = strip_prefix(ActiviteRepository.get_section_data('ar1_1_articles', dossier_id), 'ar1_1_')
    ar1_2_data = strip_prefix(ActiviteRepository.get_section_data('ar1_2_actes', dossier_id), 'ar1_2_')
    ar1_3_data = strip_prefix(ActiviteRepository.get_section_data('ar1_3_ouvrages', dossier_id), 'ar1_3_')
    ar1_4_data = strip_prefix(ActiviteRepository.get_section_data('ar1_4_revues', dossier_id), 'ar1_4_')

    # AR2
    ar2_1_data = strip_prefix(ActiviteRepository.get_section_data('ar2_1_theses', dossier_id), 'ar2_1_')
    ar2_2_data = strip_prefix(ActiviteRepository.get_section_data('ar2_2_jurys', dossier_id), 'ar2_2_')

    # AR3
    ar3_1_data = strip_prefix(ActiviteRepository.get_section_data('ar3_1_structures', dossier_id), 'ar3_1_')
    ar3_2_data = strip_prefix(ActiviteRepository.get_section_data('ar3_2_equipes', dossier_id), 'ar3_2_')
    ar3_3_data = strip_prefix(ActiviteRepository.get_section_data('ar3_3_projets', dossier_id), 'ar3_3_')
    ar3_4_data = strip_prefix(ActiviteRepository.get_section_data('ar3_4_expertises', dossier_id), 'ar3_4_')

    # AR4
    ar4_1_data = strip_prefix(ActiviteRepository.get_section_data('ar4_1_animations', dossier_id), 'ar4_1_')
    ar4_2_data = strip_prefix(ActiviteRepository.get_section_data('ar4_2', dossier_id), 'ar4_2_')
    ar4_3_data = strip_prefix(ActiviteRepository.get_section_data('ar4_3', dossier_id), 'ar4_3_')
    
    static_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'static')
    html_content = render_template(
        'pdf/annexe_ii.html',
        enseignant=dossier,
        ar1_1_data=ar1_1_data,
        ar1_2_data=ar1_2_data,
        ar1_3_data=ar1_3_data,
        ar1_4_data=ar1_4_data,
        ar2_1_data=ar2_1_data,
        ar2_2_data=ar2_2_data,
        ar3_1_data=ar3_1_data,
        ar3_2_data=ar3_2_data,
        ar3_3_data=ar3_3_data,
        ar3_4_data=ar3_4_data,
        ar4_1_data=ar4_1_data,
        ar4_2_data=ar4_2_data,
        ar4_3_data=ar4_3_data,
        annee=datetime.now().year - 1,
        now=datetime.now(),
        static_path=static_path
    )
    # Convertir HTML en PDF avec xhtml2pdf
    pdf_buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(
        io.StringIO(html_content), 
        dest=pdf_buffer,
        link_callback=link_callback
    )
    
    if pisa_status.err:
        raise Exception(f"Erreur lors de la génération du PDF: {pisa_status.err}")
    
    pdf_buffer.seek(0)
    return pdf_buffer.read()


def generer_evaluation_pdf(dossier_id):
    """Génère le PDF d'évaluation pour un dossier évalué"""
    cur = mysql.connection.cursor()

    cur.execute("""
        SELECT e.*, d.statut, d.commentaire, d.date_evaluation,
               d.date_soumission, d.annee
        FROM enseignants e
        JOIN dossiers d ON d.enseignant_id = e.id
        WHERE d.id = %s
    """, (dossier_id,))
    enseignant = cur.fetchone()
    if not enseignant:
        cur.close()
        return None

    cur.execute("""
        SELECT section_key, note, commentaire
        FROM evaluations_details
        WHERE dossier_id = %s
    """, (dossier_id,))
    eval_rows = cur.fetchall()
    cur.close()

    evaluations = {row['section_key']: row for row in eval_rows}

    SECTION_LABELS = {
        'ae1': 'AE1 — Production Pédagogique',
        'ae2': 'AE2 — Encadrement Pédagogique',
        'ae3': 'AE3 — Responsabilités Pédagogiques',
        'ar1': 'AR1 — Production Scientifique',
        'ar2': 'AR2 — Encadrement Scientifique',
        'ar3': 'AR3 — Responsabilités Scientifiques',
        'ar4': 'AR4 — Ouverture et Valorisation',
    }

    AE_KEYS = ['ae1', 'ae2', 'ae3']
    AR_KEYS = ['ar1', 'ar2', 'ar3', 'ar4']

    ae_sections = []
    for key in AE_KEYS:
        if key in evaluations:
            ae_sections.append({
                'key': key,
                'label': SECTION_LABELS.get(key, key),
                'commentaire': evaluations[key].get('commentaire') or ''
            })

    ar_sections = []
    for key in AR_KEYS:
        if key in evaluations:
            ar_sections.append({
                'key': key,
                'label': SECTION_LABELS.get(key, key),
                'commentaire': evaluations[key].get('commentaire') or ''
            })

    static_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'static')
    html_content = render_template(
        'pdf/evaluation.html',
        enseignant=enseignant,
        ae_sections=ae_sections,
        ar_sections=ar_sections,
        static_path=static_path
    )

    pdf_buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(
        io.StringIO(html_content),
        dest=pdf_buffer,
        link_callback=link_callback
    )

    if pisa_status.err:
        raise Exception(f"Erreur lors de la génération du PDF d'évaluation: {pisa_status.err}")

    pdf_buffer.seek(0)
    return pdf_buffer.read()


# --- Swagger / OpenAPI : spec générée à la volée + explorateur (SUPERADMIN) ---
from swagger_doc import register_swagger
register_swagger(app, login_required, role_required)
