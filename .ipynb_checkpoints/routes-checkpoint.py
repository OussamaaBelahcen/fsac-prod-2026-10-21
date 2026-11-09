from flask import render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.utils import secure_filename
from datetime import datetime
from functools import wraps
import bcrypt
import re
import os
import time
import json
# Importer app et mysql depuis app.py
from app import app, mysql

# ========================
# UTILITAIRES
# ========================
def is_valid_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def allowed_file(filename):
    """Vérifie que le fichier a une extension autorisée."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg','doc','pdf','docx'}
# ========================
# DÉCORATEURS DE SÉCURITÉ
# ========================
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Veuillez vous connecter pour accéder à cette page.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def role_required(required_role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if session.get('role') != required_role:
                flash('Accès refusé. Vous n\'avez pas les permissions nécessaires.', 'danger')
                return redirect(url_for('dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# ========================
# ROUTES PUBLIQUES
# ========================
@app.route('/')
def index():
    #if 'user_id' in session:
    #   return redirect(url_for('dashboard'))
    return redirect(url_for('login'))
@app.route('/login', methods=['GET', 'POST'])
def login():
    #if 'user_id' in session:
    #    return redirect(url_for('dashboard'))
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
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
                session['user_id'] = user['iduser']
                session['email'] = user['email_user']
                session['role'] = user['role_user']
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
                flash(f'Bienvenue {session.get("enseignant_prenom", "")}!', 'success')
                return redirect(url_for('dashboard'))
            else:
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
        email = request.form.get('email', '').strip().lower()
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

        if len(mot_de_passe) < 6:
            flash('Le mot de passe doit contenir au moins 6 caractères.', 'danger')
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

            flash(f'Inscription réussie en tant que {role} ! Vous pouvez maintenant vous connecter.', 'success')
            return redirect(url_for('login'))

        except Exception as e:
            mysql.connection.rollback()
            flash(f'Erreur: {str(e)}', 'danger')
            print(f"❌ SQL Error: {e}")

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Déconnecté avec succès.', 'info')
    return redirect(url_for('login'))

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
    
    cur.execute("SELECT email_user FROM users WHERE iduser = %s", (session['user_id'],))
    user = cur.fetchone()
    cur.close()

    if not user:
        flash('Profil introuvable.', 'danger')
        return redirect(url_for('dashboard'))

    # Si c'est un enseignant, on peut aussi charger les données métier
    enseignant_data = None
    if role == 'ENSEIGNANT':
        cur = mysql.connection.cursor()
        cur.execute("SELECT grade, departement, ppr ,nom , prenom FROM enseignants WHERE iduser = %s", (session['user_id'],))
        enseignant_data = cur.fetchone()
        cur.close()

    return render_template('profil.html', user=user, enseignant_data=enseignant_data, role=role)

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

@app.route('/enseignant-page')
@login_required
@role_required('ENSEIGNANT')
def enseignant_page():
    return render_template('enseignant.html')

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

        # -------------------------------
        # Gestion de la photo
        # -------------------------------
        photo_path = None
        if 'photo' in request.files:
            file = request.files['photo']
            if file and file.filename != '' and allowed_file(file.filename):
                # Limiter la taille du fichier (ex: 5 Mo)
                file.seek(0, os.SEEK_END)
                size = file.tell()
                file.seek(0)
                if size > 5 * 1024 * 1024:
                    return jsonify({'success': False, 'message': 'La photo ne doit pas dépasser 5 Mo.'}), 400

                # Générer un nom de fichier sécurisé
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = secure_filename(
                    f"photo_{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.{ext}"
                )
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                photo_path = f"uploads/{filename}"

        # -------------------------------
        # Récupération et validation des champs
        # -------------------------------
        data = request.form
        nom = data.get('nom', '').strip()
        prenom = data.get('prenom', '').strip()
        grade = data.get('grade', '').strip()
        etablissement = data.get('etablissement', '').strip()
        departement = data.get('departement', '').strip()
        periode_avancement = data.get('periode_avancement', '').strip()
        date_naissance = data.get('date_naissance', '').strip()
        lieu_naissance = data.get('lieu_naissance', '').strip()
        date_recrutement = data.get('date_recrutement', '').strip()
        ppr = data.get('ppr', '').strip()
        laboratoire = data.get('laboratoire', '').strip()
        equipe_recherche = data.get('equipe_recherche', '').strip()
        adresse_personnelle = data.get('adresse_personnelle', '').strip()
        telephone = data.get('telephone', '').strip()

        # Validation des champs obligatoires
        required_fields = {
            'nom': nom, 'prenom': prenom, 'grade': grade,
            'etablissement': etablissement, 'departement': departement,
            'periode_avancement': periode_avancement,
            'date_naissance': date_naissance, 'lieu_naissance': lieu_naissance,
            'date_recrutement': date_recrutement, 'ppr': ppr
        }
        missing = [field for field, value in required_fields.items() if not value]
        if missing:
            return jsonify({'success': False, 'message': f'Champs manquants : {", ".join(missing)}'}), 400

        # Validation du format des dates
        try:
            if date_naissance:
                datetime.strptime(date_naissance, '%Y-%m-%d')
            if date_recrutement:
                datetime.strptime(date_recrutement, '%Y-%m-%d')
        except ValueError:
            return jsonify({'success': False, 'message': 'Format de date invalide (attendu : AAAA-MM-JJ).'}), 400

        # -------------------------------
        # Mise à jour de la base de données
        # -------------------------------
        cur = mysql.connection.cursor()

        cur.execute("""
            UPDATE enseignants SET
                photo = %s, nom = %s, prenom = %s, grade = %s, etablissement = %s,
                departement = %s, periode_avancement = %s, date_naissance = %s,
                lieu_naissance = %s, date_recrutement = %s, ppr = %s,
                laboratoire = %s, equipe_recherche = %s, adresse_personnelle = %s, telephone = %s
            WHERE id = %s
        """, (
            photo_path, nom, prenom, grade, etablissement, departement,
            periode_avancement, date_naissance, lieu_naissance, date_recrutement,
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

        return jsonify({'success': True, 'dossier_id': dossier_id})

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
    for attempt in range(3):
        try:
            if request.is_json:
                data = request.get_json()
            else:
                return jsonify({'success': False, 'message': 'Données invalides. JSON attendu.'}), 400
            enseignant_id = session['enseignant_id']
            cur = mysql.connection.cursor()
            cur.execute("SELECT id FROM dossiers WHERE enseignant_id = %s AND statut = 'brouillon'", (enseignant_id,))
            dossier = cur.fetchone()
            if not dossier:
                cur.close()
                return jsonify({'success': False, 'message': 'Dossier introuvable'}), 404
            dossier_id = dossier['id']
            # Supprimer les anciennes données
            cur.execute("DELETE FROM enseignements_licence WHERE dossier_id = %s", (dossier_id,))
            cur.execute("DELETE FROM encadrements_licence WHERE dossier_id = %s", (dossier_id,))
            cur.execute("DELETE FROM enseignements_master WHERE dossier_id = %s", (dossier_id,))
            cur.execute("DELETE FROM encadrements_master WHERE dossier_id = %s", (dossier_id,))
            # Insérer enseignements licence
            if 'enseignements_licence' in data:
                for ens in data['enseignements_licence']:
                    cur.execute("""
                        INSERT INTO enseignements_licence 
                        (dossier_id, annee_univ, filiere, semestre, cours, vh_cours, td, vh_td, tp, vh_tp)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        dossier_id,
                        ens.get('annee_univ', ''),
                        ens.get('filiere', ''),
                        ens.get('semestre', ''),
                        ens.get('cours', ''),
                        ens.get('vh_cours'),
                        ens.get('td', ''),
                        ens.get('vh_td'),
                        ens.get('tp', ''),
                        ens.get('vh_tp')
                    ))
            # Insérer encadrements licence
            if 'encadrements_licence' in data:
                for enc in data['encadrements_licence']:
                    cur.execute("""
                        INSERT INTO encadrements_licence 
                        (dossier_id, annee_univ, type_licence, titre_pfe, etudiants, nom_encadrants)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        dossier_id,
                        enc.get('annee_univ', ''),
                        enc.get('type_licence', ''),
                        enc.get('titre_pfe', ''),
                        enc.get('etudiants', ''),
                        enc.get('nom_encadrants', '')
                    ))
            # Insérer enseignements master
            if 'enseignements_master' in data:
                for ens in data['enseignements_master']:
                    cur.execute("""
                        INSERT INTO enseignements_master 
                        (dossier_id, annee_univ, filiere, semestre, cours_td_tp, vh)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        dossier_id,
                        ens.get('annee_univ', ''),
                        ens.get('filiere', ''),
                        ens.get('semestre', ''),
                        ens.get('cours_td_tp', ''),
                        ens.get('vh')
                    ))
            # Insérer encadrements master
            if 'encadrements_master' in data:
                for enc in data['encadrements_master']:
                    cur.execute("""
                        INSERT INTO encadrements_master 
                        (dossier_id, annee_univ, filiere, type_master, titre_memoire, nom_etudiants, nom_encadrants)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        dossier_id,
                        enc.get('annee_univ', ''),
                        enc.get('filiere', ''),
                        enc.get('type_master', ''),
                        enc.get('titre_memoire', ''),
                        enc.get('nom_etudiants', ''),
                        enc.get('nom_encadrants', '')
                    ))
            mysql.connection.commit()
            cur.close()
            return jsonify({'success': True, 'message': 'Enseignements enregistrés'})
        except Exception as e:
            mysql.connection.rollback()
            if "Deadlock" in str(e):
                time.sleep(0.5)
                continue
            else:
                print(f"Erreur dans save_step2 : {str(e)}")
                return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500
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
    for attempt in range(3):
        try:
            if request.is_json:
                data = request.get_json()
            else:
                return jsonify({'success': False, 'message': 'Données invalides. JSON attendu.'}), 400
            enseignant_id = session['enseignant_id']
            cur = mysql.connection.cursor()
            cur.execute("SELECT id FROM dossiers WHERE enseignant_id = %s AND statut = 'brouillon'", (enseignant_id,))
            dossier = cur.fetchone()
            if not dossier:
                cur.close()
                return jsonify({'success': False, 'message': 'Dossier introuvable'}), 404
            dossier_id = dossier['id']
            cur.execute("DELETE FROM responsabilites WHERE dossier_id = %s", (dossier_id,))
            if 'responsabilites' in data:
                for resp in data['responsabilites']:
                    cycle = resp.get('cycle', '')
                    if cycle not in ['Licence', 'Master']:
                        cur.close()
                        return jsonify({'success': False, 'message': 'Cycle invalide.'}), 400
                    cur.execute("""
                        INSERT INTO responsabilites 
                        (dossier_id, annees_univ, filiere, semestre, intitule_module, cycle)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        dossier_id,
                        resp.get('annees_univ', ''),
                        resp.get('filiere', ''),
                        resp.get('semestre', ''),
                        resp.get('intitule_module', ''),
                        cycle
                    ))
            mysql.connection.commit()
            cur.close()
            return jsonify({'success': True, 'message': 'Responsabilités enregistrées'})
        except Exception as e:
            mysql.connection.rollback()
            if "Deadlock" in str(e):
                time.sleep(0.5)
                continue
            else:
                print(f"Erreur dans save_step3 : {str(e)}")
                return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500
    return jsonify({'success': False, 'message': 'Échec après 3 tentatives.'}), 500
# ===========================================
# API : ÉTAPES ""04"" DU DOSSIER (ENSEIGNANT) 
# ===========================================
@app.route('/api/save-step4', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def save_step4():
    if 'enseignant_id' not in session:
        return jsonify({'success': False, 'message': 'Non authentifié'}), 401

    for attempt in range(3):
        try:
            enseignant_id = session['enseignant_id']
            user_id = session.get('user_id', enseignant_id)

            # Récupérer nom/prénom
            cur = mysql.connection.cursor()
            cur.execute("SELECT nom, prenom FROM enseignants WHERE id = %s", (enseignant_id,))
            enseignant = cur.fetchone()
            if not enseignant:
                cur.close()
                return jsonify({'success': False, 'message': 'Enseignant introuvable'}), 404
            nom = (enseignant['nom'] or '').replace(' ', '_')
            prenom = (enseignant['prenom'] or '').replace(' ', '_')
            cur.close()

            # Récupérer le dossier
            cur = mysql.connection.cursor()
            cur.execute("SELECT id FROM dossiers WHERE enseignant_id = %s AND statut = 'brouillon'", (enseignant_id,))
            dossier = cur.fetchone()
            if not dossier:
                cur.close()
                return jsonify({'success': False, 'message': 'Dossier introuvable'}), 404
            dossier_id = dossier['id']

            # 🔑 LIRE les anciens noms de fichiers depuis la BDD
            cur.execute("SELECT ae1_2_fichiers FROM activites_enseignement WHERE dossier_id = %s", (dossier_id,))
            old_record = cur.fetchone()
            old_filenames = []
            if old_record and old_record['ae1_2_fichiers']:
                old_filenames = old_record['ae1_2_fichiers'].split('\n')
            mysql.connection.commit()
            cur.close()

            # Supprimer les anciennes données
            cur = mysql.connection.cursor()
            cur.execute("DELETE FROM activites_enseignement WHERE dossier_id = %s", (dossier_id,))
            mysql.connection.commit()
            cur.close()

            # Fonction utilitaire
            def get_form_str(name): return request.form.get(name, '').strip() or ''

            # Champs texte simples
            ae1_1_titres = get_form_str('ae1_1_titres')
            ae1_1_auteurs = get_form_str('ae1_1_auteurs')
            ae1_1_niveaux = get_form_str('ae1_1_niveaux')
            ae1_1_editeurs = get_form_str('ae1_1_editeurs')
            ae1_1_annees = get_form_str('ae1_1_annees')
            ae1_1_justificatifs = get_form_str('ae1_1_justificatifs')
            ae1_3_fichiers = get_form_str('ae1_3_fichiers')
            ae1_3_objectifs = get_form_str('ae1_3_objectifs')
            ae1_3_auteurs = get_form_str('ae1_3_auteurs')
            ae1_3_filieres = get_form_str('ae1_3_filieres')
            ae1_3_niveaux = get_form_str('ae1_3_niveaux')
            ae1_3_annees = get_form_str('ae1_3_annees')
            ae1_3_liens = get_form_str('ae1_3_liens')
            ae2_1_details = get_form_str('ae2_1_details')
            ae2_2_details = get_form_str('ae2_2_details')
            ae2_3_details = get_form_str('ae2_3_details')
            ae3_1_fichiers = get_form_str('ae3_1_fichiers')
            ae3_2_fichiers = get_form_str('ae3_2_fichiers')
            ae3_3_fichiers = get_form_str('ae3_3_fichiers')
            ae3_4_fichiers = get_form_str('ae3_4_fichiers')
            ae3_5_fichiers = get_form_str('ae3_5_fichiers')
            ae3_6_fichiers = get_form_str('ae3_6_fichiers')
            ae3_7_fichiers = get_form_str('ae3_7_fichiers')

            # Gestion de AE1-2
            ae1_2_rows_json = request.form.get('ae1_2_rows', '[]')
            ae1_2_rows = json.loads(ae1_2_rows_json)

            ae1_2_fichiers_list = []
            ae1_2_auteurs_list = []
            ae1_2_departements_list = []
            ae1_2_annees_list = []
            ae1_2_filieres_list = []
            ae1_2_semestres_list = []

            for idx, row in enumerate(ae1_2_rows):
                auteurs = (row.get('auteurs', '') or '').strip()
                departements = (row.get('departements', '') or '').strip()
                annees = (row.get('annees', '') or '').strip()
                filieres = (row.get('filieres', '') or '').strip()
                semestres = (row.get('semestres', '') or '').strip()

                file_key = f'ae12_file_{idx}'
                file = request.files.get(file_key)

                # ✅ Déterminer le nom final du fichier
                final_filename = ''

                if file and file.filename != '' and file.filename.lower().endswith('.pdf'):
                    # 🔥 Supprimer l’ancien fichier s’il existe
                    if idx < len(old_filenames):
                        old_name = old_filenames[idx].strip()
                        if old_name and old_name != 'Aucun fichier':
                            old_path = os.path.join(app.config['UPLOAD_FOLDER'], old_name)
                            if os.path.exists(old_path):
                                os.remove(old_path)

                    # ✅ Sauvegarder le nouveau fichier
                    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                    new_filename = f"file_{user_id}_{nom}_{prenom}_{timestamp}_{idx}.pdf"
                    if len(new_filename) > 100:
                        new_filename = f"file_{user_id}_{timestamp}_{idx}.pdf"
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
                    file.save(filepath)
                    final_filename = new_filename
                else:
                    # ✅ Conserver l’ancien nom
                    if idx < len(old_filenames):
                        final_filename = old_filenames[idx]
                    else:
                        final_filename = ''

                ae1_2_fichiers_list.append(final_filename)
                ae1_2_auteurs_list.append(auteurs)
                ae1_2_departements_list.append(departements)
                ae1_2_annees_list.append(annees)
                ae1_2_filieres_list.append(filieres)
                ae1_2_semestres_list.append(semestres)

            ae1_2_fichiers_str = "\n".join(ae1_2_fichiers_list)
            ae1_2_auteurs_str = "\n".join(ae1_2_auteurs_list)
            ae1_2_departements_str = "\n".join(ae1_2_departements_list)
            ae1_2_annees_str = "\n".join(ae1_2_annees_list)
            ae1_2_filieres_str = "\n".join(ae1_2_filieres_list)
            ae1_2_semestres_str = "\n".join(ae1_2_semestres_list)

            # Insertion
            cur = mysql.connection.cursor()
            cur.execute("""
                INSERT INTO activites_enseignement 
                (dossier_id, ae1_1_titres, ae1_1_auteurs, ae1_1_niveaux, ae1_1_editeurs, ae1_1_annees, ae1_1_justificatifs,
                 ae1_2_fichiers, ae1_2_auteurs, ae1_2_departements, ae1_2_annees, ae1_2_filieres, ae1_2_semestres,
                 ae1_3_fichiers, ae1_3_objectifs, ae1_3_auteurs, ae1_3_filieres, ae1_3_niveaux, ae1_3_annees, ae1_3_liens,
                 ae2_1_details, ae2_2_details, ae2_3_details,
                 ae3_1_fichiers, ae3_2_fichiers, ae3_3_fichiers, ae3_4_fichiers, ae3_5_fichiers, ae3_6_fichiers, ae3_7_fichiers)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                dossier_id,
                ae1_1_titres, ae1_1_auteurs, ae1_1_niveaux,
                ae1_1_editeurs, ae1_1_annees, ae1_1_justificatifs,
                ae1_2_fichiers_str,
                ae1_2_auteurs_str, ae1_2_departements_str,
                ae1_2_annees_str, ae1_2_filieres_str, ae1_2_semestres_str,
                ae1_3_fichiers, ae1_3_objectifs, ae1_3_auteurs,
                ae1_3_filieres, ae1_3_niveaux, ae1_3_annees, ae1_3_liens,
                ae2_1_details, ae2_2_details, ae2_3_details,
                ae3_1_fichiers, ae3_2_fichiers, ae3_3_fichiers,
                ae3_4_fichiers, ae3_5_fichiers, ae3_6_fichiers, ae3_7_fichiers
            ))
            mysql.connection.commit()
            cur.close()

            return jsonify({
                'success': True,
                'message': 'Activités d\'enseignement enregistrées',
                'ae1_2_new_filenames': ae1_2_fichiers_list  # ✅ Envoyer les nouveaux noms au frontend
            })

        except Exception as e:
            mysql.connection.rollback()
            if "Deadlock" in str(e):
                time.sleep(0.5)
                continue
            else:
                print(f"❌ Erreur dans save_step4 : {str(e)}")
                import traceback
                traceback.print_exc()
                return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500

    return jsonify({'success': False, 'message': 'Échec après 3 tentatives.'}), 500






@app.route('/uploads/<filename>')
@login_required
@role_required('ENSEIGNANT')
def uploaded_file(filename):
    # Validation de sécurité
    if not re.match(r'^file_\d+_[\w_]+_\d+_\d+\.pdf$', filename):
        abort(403)
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ===========================================
# API : ÉTAPES ""05"" DU DOSSIER (ENSEIGNANT) 
# ===========================================
@app.route('/api/save-step5', methods=['POST'])
@login_required
@role_required('ENSEIGNANT')
def save_step5():
    if 'enseignant_id' not in session:
        return jsonify({'success': False, 'message': 'Non authentifié'}), 401
    for attempt in range(3):
        try:
            if request.is_json:
                data = request.get_json()
            else:
                return jsonify({'success': False, 'message': 'Données invalides. JSON attendu.'}), 400
            enseignant_id = session['enseignant_id']
            cur = mysql.connection.cursor()
            cur.execute("SELECT id FROM dossiers WHERE enseignant_id = %s AND statut = 'brouillon'", (enseignant_id,))
            dossier = cur.fetchone()
            if not dossier:
                cur.close()
                return jsonify({'success': False, 'message': 'Dossier introuvable'}), 404
            dossier_id = dossier['id']
            cur.execute("DELETE FROM activites_recherche WHERE dossier_id = %s", (dossier_id,))
            cur.execute("""
                INSERT INTO activites_recherche 
                (dossier_id, ar1_1_publications, ar1_2_actes, ar1_3_ouvrages, ar1_4_revues,
                 ar2_1_fichiers, ar2_2_fichiers,
                 ar3_1_fichiers, ar3_2_fichiers, ar3_3_fichiers, ar3_4_fichiers,
                 ar4_1_fichiers, ar4_2_fichiers, ar4_3_fichiers)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                dossier_id,
                data.get('ar1_1_publications'), data.get('ar1_2_actes'), data.get('ar1_3_ouvrages'), data.get('ar1_4_revues'),
                data.get('ar2_1_fichiers'), data.get('ar2_2_fichiers'),
                data.get('ar3_1_fichiers'), data.get('ar3_2_fichiers'), data.get('ar3_3_fichiers'), data.get('ar3_4_fichiers'),
                data.get('ar4_1_fichiers'), data.get('ar4_2_fichiers'), data.get('ar4_3_fichiers')
            ))
            mysql.connection.commit()
            cur.close()
            return jsonify({'success': True, 'message': 'Activités de recherche enregistrées'})
        except Exception as e:
            mysql.connection.rollback()
            if "Deadlock" in str(e):
                time.sleep(0.5)
                continue
            else:
                print(f"Erreur dans save_step5 : {str(e)}")
                return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500
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
        cur.execute("""
            UPDATE dossiers 
            SET statut = 'soumis', date_soumission = NOW()
            WHERE enseignant_id = %s AND statut = 'brouillon'
        """, (enseignant_id,))
        mysql.connection.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'Dossier soumis avec succès'})
    except Exception as e:
        print(f"Erreur dans submit_dossier : {str(e)}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500
# ===========================================================================
# API : ÉTAPES ""01-02-03-04-05"" DU DOSSIER (ENSEIGNANT) POUR LOAD-FORM-DATA
# ===========================================================================
@app.route('/api/load-form-data', methods=['GET'])
@login_required
@role_required('ENSEIGNANT')
def load_form_data():
    """Charge les données du formulaire depuis la base de données (brouillon uniquement)"""
    try:
        enseignant_id = session['enseignant_id']
        cur = mysql.connection.cursor()

        # 🔁 CORRIGÉ : Charger le dossier en statut 'brouillon' (pas 'soumis')
        cur.execute("SELECT * FROM dossiers WHERE enseignant_id = %s AND statut = 'brouillon'", (enseignant_id,))
        dossier = cur.fetchone()
        if not dossier:
            cur.close()
            #  Retourner une structure vide mais valide
            return jsonify({
                'success': True,
                'data': {
                    'dossier_id': None,
                    'step1': {},
                    'step2': {},
                    'step3': {},
                    'step4': {},
                    'step5': {}
                }
            }), 200

        dossier_id = dossier['id']

        # Étape 1 : Informations personnelles
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
            'periode_avancement': enseignant.get('periode_avancement') or '',
            'date_naissance': str(enseignant['date_naissance']) if enseignant.get('date_naissance') else '',
            'lieu_naissance': enseignant.get('lieu_naissance') or '',
            'date_recrutement': str(enseignant['date_recrutement']) if enseignant.get('date_recrutement') else '',
            'ppr': enseignant.get('ppr') or '',
            'laboratoire': enseignant.get('laboratoire') or '',
            'equipe_recherche': enseignant.get('equipe_recherche') or '',
            'adresse_personnelle': enseignant.get('adresse_personnelle') or '',
            'telephone': enseignant.get('telephone') or '',
            'email': enseignant.get('email') or ''
        }

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
        cur.execute("SELECT * FROM activites_enseignement WHERE dossier_id = %s", (dossier_id,))
        ae_row = cur.fetchone()
        step4_data = dict(ae_row) if ae_row else {}

        # Étape 5 : Activités de recherche
        cur.execute("SELECT * FROM activites_recherche WHERE dossier_id = %s", (dossier_id,))
        ar_row = cur.fetchone()
        step5_data = dict(ar_row) if ar_row else {}

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

# ========================
# ROUTES COORDINATEUR
# ========================
@app.route('/coordinateurpage')
@login_required
@role_required('COORDINATEUR')
def coordinateurpage():
    cur = mysql.connection.cursor()
    statut_filter = request.args.get('statut', 'all')
    # Récupérer les dossiers + info d'assignation
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
            CASE 
                WHEN ac.dossier_id IS NOT NULL THEN 1 
                ELSE 0 
            END AS assigned
        FROM dossiers d
        JOIN enseignants e ON d.enseignant_id = e.id
        LEFT JOIN assignations_commission ac ON d.id = ac.dossier_id
        WHERE d.statut = 'soumis'
    """
    if statut_filter == 'assigned':
        query += " AND ac.dossier_id IS NOT NULL"
    elif statut_filter == 'unassigned':
        query += " AND ac.dossier_id IS NULL"
    cur.execute(query)
    dossiers = cur.fetchall()
    cur.close()
    # Récupérer les membres de commission
    cur = mysql.connection.cursor()
    cur.execute("SELECT email_user FROM users WHERE role_user = 'COMMISSION'")
    membres_commission = [row['email_user'] for row in cur.fetchall()]
    cur.close()
    return render_template('coordinateur.html', dossiers=dossiers, membres_commission=membres_commission)

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
        SELECT d.id, e.nom, e.prenom, d.date_soumission, d.statut, e.departement
        FROM dossiers d
        JOIN enseignants e ON d.enseignant_id = e.id
        JOIN assignations_commission ac ON d.id = ac.dossier_id
        WHERE ac.membre_user_id = %s
    """
    cur.execute(query, (session['user_id'],))
    dossiers = cur.fetchall()
    cur.close()
    return render_template('membrecommission.html', dossiers=dossiers)

@app.route('/evaluer-dossier/<int:dossier_id>')
@login_required
@role_required('COMMISSION')
def evaluer_dossier(dossier_id):
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT d.*, e.* 
        FROM dossiers d
        JOIN enseignants e ON d.enseignant_id = e.id
        JOIN assignations_commission ac ON d.id = ac.dossier_id
        WHERE d.id = %s AND ac.membre_user_id = %s
    """, (dossier_id, session['user_id']))
    dossier = cur.fetchone()
    cur.close()
    if not dossier:
        flash('Dossier non trouvé ou non assigné.', 'danger')
        return redirect(url_for('membrecommission'))
    return render_template('evaluer_dossier.html', dossier=dossier)

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
    # Liste des utilisateurs (exclure SUPERADMIN)
    cur.execute("""
        SELECT iduser, email_user, role_user, statut, date_creation, nom, prenom
        FROM users
        WHERE role_user != 'SUPERADMIN'
        ORDER BY date_creation DESC
    """)
    users = cur.fetchall()
    cur.close()
    return render_template('superadmin.html', 
                         nb_enseignants=nb_enseignants,
                         nb_coordinateurs=nb_coordinateurs,
                         nb_membres=nb_membres,
                         users=users)

@app.route('/api/create-user', methods=['POST'])
@login_required
@role_required('SUPERADMIN')
def create_user():
    """Créer un nouvel utilisateur avec nom et prénom, quel que soit le rôle."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        role = data.get('role', '').upper()
        password = data.get('password', '')
        nom = data.get('nom', '').strip()
        prenom = data.get('prenom', '').strip()

        # ✅ Validation des champs obligatoires
        if not email or not role or not password or not nom or not prenom:
            return jsonify({'success': False, 'message': 'Tous les champs (email, rôle, mot de passe, nom, prénom) sont requis.'}), 400

        if not is_valid_email(email):
            return jsonify({'success': False, 'message': 'Email invalide.'}), 400

        if role not in ['ENSEIGNANT', 'COORDINATEUR', 'COMMISSION']:
            return jsonify({'success': False, 'message': 'Rôle invalide.'}), 400

        if len(password) < 8:
            return jsonify({'success': False, 'message': 'Le mot de passe doit contenir au moins 8 caractères.'}), 400

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
            INSERT INTO users (email_user, mot_de_pass_user, role_user, nom, prenom, statut, date_creation)
            VALUES (%s, %s, %s, %s, %s, 'actif', NOW())
        """, (email, hashed_password, role, nom, prenom))

        # ✅ Récupérer l'ID généré AVANT tout autre traitement
        user_id = cur.lastrowid

        # 🧑‍🏫 Si c’est un ENSEIGNANT, insérer aussi dans la table `enseignants`
        if role == 'ENSEIGNANT':
            cur.execute("""
                INSERT INTO enseignants (iduser, nom, prenom, email, mot_de_passe)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, nom, prenom, email, hashed_password))

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
    """Réinitialiser le mot de passe d'un utilisateur"""
    try:
        data = request.get_json()
        new_password = data.get('new_password', '')
        if not new_password or len(new_password) < 8:
            return jsonify({'success': False, 'message': 'Le mot de passe doit contenir au moins 8 caractères.'}), 400

        cur = mysql.connection.cursor()
        cur.execute("SELECT iduser FROM users WHERE iduser = %s", (user_id,))
        if not cur.fetchone():
            cur.close()
            return jsonify({'success': False, 'message': 'Utilisateur introuvable.'}), 404

        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("UPDATE users SET mot_de_pass_user = %s WHERE iduser = %s", (hashed_password, user_id))
        mysql.connection.commit()
        cur.close()

        return jsonify({'success': True, 'message': 'Mot de passe réinitialisé avec succès.'})

    except Exception as e:
        print(f"❌ Erreur reset_password : {str(e)}")
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
        return jsonify({'success': True, 'status': new_status})
    except Exception as e:
        print(f"❌ Erreur toggle_user_status : {str(e)}")
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
        # 🔒 Protection : ne pas supprimer le SuperAdmin
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
                        'responsabilites', 'activites_enseignement',
                        'activites_recherche', 'assignations_commission'
                    ]
                    for table in tables:
                        cur.execute(f"DELETE FROM {table} WHERE dossier_id = %s", (dossier_id,))
                cur.execute("DELETE FROM dossiers WHERE enseignant_id = %s", (enseignant_id,))
                cur.execute("DELETE FROM enseignants WHERE iduser = %s", (user_id,))
        cur.execute("DELETE FROM users WHERE iduser = %s", (user_id,))
        mysql.connection.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'Utilisateur supprimé avec succès.'})
    except Exception as e:
        mysql.connection.rollback()
        print(f"❌ Erreur delete_user : {str(e)}")
        return jsonify({'success': False, 'message': 'Erreur serveur.'}), 500
    