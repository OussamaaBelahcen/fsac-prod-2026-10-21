import os
import csv
import io
import re
import bcrypt
import unicodedata
from datetime import datetime
from collections import Counter

from config import Config, GRADE_ROLE_MAP, ROLE_PASSWORD_SUFFIX, ROLES_VALIDES, CIN_REGEX, PPR_REGEX, TEL_REGEX
from app import mysql
from services.logger_service import LoggerService

# =========== UTILITAIRES ===========

def slug(text):
    """Supprime accents, met en minuscules, supprime espaces/apostrophes/tirets."""
    text = unicodedata.normalize('NFD', text).encode('ascii', 'ignore').decode('utf-8')
    text = re.sub(r"[''`-]", '', text)
    text = re.sub(r'\s+', '', text)
    return text.lower()


def generate_email(nom, prenom, existing_emails=None):
    base = f"{slug(prenom)}.{slug(nom)}@univh2c.ma"
    if existing_emails is None:
        return base

    if base not in existing_emails:
        return base

    suffix = 2
    while f"{slug(prenom)}.{slug(nom)}{suffix}@univh2c.ma" in existing_emails:
        suffix += 1
    return f"{slug(prenom)}.{slug(nom)}{suffix}@univh2c.ma"


def generate_password(email, role):
    suffix = ROLE_PASSWORD_SUFFIX.get(role, 'USER')
    return f"{email}{suffix}123@"


# =========== VALIDATION ===========

VALID_GRADES = set(GRADE_ROLE_MAP.keys())


def parse_date(val):
    """
    Convertit une date depuis différents formats vers un objet datetime.date.
    Accepte: datetime.date, datetime.datetime, 'DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YY' (Excel).
    Retourne None si vide ou invalide.
    """
    if val is None:
        return None, None
    # Déjà un objet date/datetime (openpyxl peut retourner un datetime)
    if hasattr(val, 'date'):
        return val.date(), None
    if hasattr(val, 'year') and hasattr(val, 'month') and hasattr(val, 'day'):
        return val, None
    s = str(val).strip()
    if not s or s.lower() in ('none', 'nat', ''):
        return None, None
    # Formats courants (y compris avec heure, ex: '2020-07-10 00:00:00' depuis Excel)
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y', '%d/%m/%y', '%Y/%m/%d',
                '%d/%m/%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%d-%m-%Y %H:%M:%S'):
        try:
            return datetime.strptime(s, fmt).date(), None
        except ValueError:
            pass
    return None, f'Format de date invalide "{s}" (attendu jj/mm/aaaa)'


def valider_ligne(row, idx, seen_cin, seen_ppr, db_cins, db_pprs, db_emails):
    """
    Valide une ligne du fichier d'import.
    Retourne { 'valide': bool, 'erreurs': [str], 'email': str, 'suffixe': bool }.
    """
    erreurs = []
    nom = (row.get('nom') or '').strip()
    prenom = (row.get('prenom') or '').strip()
    cin = (row.get('cin') or '').strip()
    ppr = (row.get('ppr') or '').strip()
    tel = (row.get('tel') or '').strip()
    if tel and len(tel) == 9 and tel.startswith(('5', '6', '7')):
        tel = '0' + tel
        row['tel'] = tel  # Mettre à jour la valeur dans la ligne pour qu'elle s'affiche correctement
    
    role = (row.get('role') or '').strip().upper()
    grade = (row.get('grade') or '').strip()

    # Dates d'avancement (optionnelles mais validées si présentes)
    date_debut_raw = row.get('date_debut_avancement') or row.get('date_debut') or ''
    date_fin_raw = row.get('date_fin_avancement') or row.get('date_fin') or ''
    date_debut, err_debut = parse_date(date_debut_raw)
    date_fin, err_fin = parse_date(date_fin_raw)
    if err_debut:
        erreurs.append(f'date_debut_avancement : {err_debut}')
    if err_fin:
        erreurs.append(f'date_fin_avancement : {err_fin}')
    if date_debut and date_fin and date_fin < date_debut:
        erreurs.append('date_fin_avancement doit être après date_debut_avancement')

    # Champs obligatoires
    if not nom:
        erreurs.append('Nom manquant')
    if not prenom:
        erreurs.append('Prénom manquant')
    if not cin:
        erreurs.append('CIN manquant')
    if not ppr:
        erreurs.append('PPR manquant')
    if not tel:
        erreurs.append('Téléphone manquant')
    if not role:
        erreurs.append('Rôle manquant')
    if not grade:
        erreurs.append('Grade manquant')

    # CIN
    if cin and not re.match(CIN_REGEX, cin):
        erreurs.append('Format CIN invalide (ex: AB123456)')

    # PPR
    if ppr and not re.match(PPR_REGEX, ppr):
        erreurs.append('Le PPR doit être numérique')

    # Téléphone
    if tel and not re.match(TEL_REGEX, tel):
        erreurs.append('Téléphone invalide (10 chiffres, commence par 06 ou 07)')

    # Rôle
    if role and role not in ROLES_VALIDES:
        erreurs.append(f'Rôle "{role}" non reconnu. Valeurs: {", ".join(sorted(ROLES_VALIDES))}')

    # Grade
    if grade and grade not in VALID_GRADES:
        erreurs.append(f'Grade "{grade}" non reconnu')

    # Doublons intra-fichier
    if cin and cin in seen_cin:
        erreurs.append(f'CIN "{cin}" en double dans le fichier (ligne {seen_cin[cin]})')
    if ppr and ppr in seen_ppr:
        erreurs.append(f'PPR "{ppr}" en double dans le fichier (ligne {seen_ppr[ppr]})')

    # Doublons base de données
    if cin and cin in db_cins:
        erreurs.append(f'CIN "{cin}" existe déjà en base')
    if ppr and ppr in db_pprs:
        erreurs.append(f'PPR "{ppr}" existe déjà en base')

    # Email : utiliser celui du fichier s'il est fourni, sinon générer
    email_fourni = (row.get('email') or '').strip()
    if email_fourni:
        email = email_fourni
        suffixe = False
        if email_fourni.lower() in db_emails:
            erreurs.append(f'Email "{email_fourni}" existe déjà en base')
    else:
        email = generate_email(nom, prenom, db_emails)
        suffixe = email != f"{slug(prenom)}.{slug(nom)}@univh2c.ma"

    return {
        'idx': idx,
        'nom': nom,
        'prenom': prenom,
        'cin': cin,
        'ppr': ppr,
        'tel': tel,
        'role': role,
        'grade': grade,
        'email': email,
        'suffixe': suffixe,
        'date_debut_avancement': date_debut.strftime('%Y-%m-%d') if date_debut else '',
        'date_fin_avancement': date_fin.strftime('%Y-%m-%d') if date_fin else '',
        'valide': len(erreurs) == 0,
        'erreurs': erreurs,
    }


def charger_references_db():
    cur = mysql.connection.cursor()
    cur.execute("SELECT LOWER(email_user) as email_user FROM users")
    db_emails = {r['email_user'] for r in cur.fetchall()}

    cur.execute("SELECT cin FROM enseignants WHERE cin IS NOT NULL")
    db_cins = {r['cin'] for r in cur.fetchall()}

    cur.execute("SELECT ppr FROM enseignants WHERE ppr IS NOT NULL")
    db_pprs = {r['ppr'] for r in cur.fetchall()}
    cur.close()
    return db_emails, db_cins, db_pprs


# =========== PARSING ===========

COLONNES_ATTENDUES = ['nom', 'prenom', 'cin', 'ppr', 'tel', 'role', 'grade']
COLONNES_OPTIONNELLES = ['date_debut_avancement', 'date_fin_avancement', 'email']


def parse_csv(content):
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise ValueError('Fichier CSV vide ou mal formaté')
    cols = [c.strip().lower() for c in reader.fieldnames]
    for c in COLONNES_ATTENDUES:
        if c not in cols:
            raise ValueError(f'Colonne "{c}" manquante')
    lignes = []
    for i, row in enumerate(reader, start=1):
        lignes.append({k.strip().lower(): (v or '').strip() for k, v in row.items()})
    return lignes


def parse_xlsx(filepath):
    from openpyxl import load_workbook
    wb = load_workbook(filepath, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError('Fichier XLSX vide')
    header = [str(c).strip().lower() if c else '' for c in rows[0]]
    for c in COLONNES_ATTENDUES:
        if c not in header:
            raise ValueError(f'Colonne "{c}" manquante')
    lignes = []
    for values in rows[1:]:
        if all(v is None or str(v).strip() == '' for v in values):
            continue
        row = {}
        for idx, col in enumerate(header):
            val = values[idx] if idx < len(values) else ''
            # Garder les objets date/datetime intacts (sinon str() ajoute '00:00:00')
            if hasattr(val, 'date') or hasattr(val, 'year'):
                row[col] = val
            else:
                row[col] = str(val).strip() if val is not None else ''
        lignes.append(row)
    wb.close()
    return lignes


# =========== CRÉATION EN BASE ===========

def creer_comptes(lignes_validees):
    """Crée les comptes en base pour les lignes validées.
    Retourne la liste des résultats (email, statut, raison)."""
    cur = mysql.connection.cursor()
    resultats = []
    for row in lignes_validees:
        nom = row['nom']
        prenom = row['prenom']
        cin = row['cin']
        ppr = row['ppr']
        tel = row['tel']
        role = row['role']
        grade = row['grade']

        try:
            # Re-vérifier doublons (au cas où)
            cur.execute("SELECT email_user FROM users WHERE LOWER(email_user) = %s", (row['email'].lower(),))
            existant = cur.fetchone()
            if existant:
                resultats.append({**row, 'email': row['email'], 'statut': 'echoue', 'raison': 'Email déjà existant'})
                continue

            email_final = row['email']
            password_plain = generate_password(email_final, role)
            hashed = bcrypt.hashpw(password_plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            cur.execute("""
                INSERT INTO users (email_user, mot_de_pass_user, role_user, nom, prenom, grade, statut, premiere_connexion, date_creation)
                VALUES (%s, %s, %s, %s, %s, %s, 'actif', 1, NOW())
            """, (email_final, hashed, role, nom, prenom, grade))
            user_id = cur.lastrowid

            if role == 'ENSEIGNANT':
                date_debut = row.get('date_debut_avancement') or None
                date_fin = row.get('date_fin_avancement') or None
                # Convertir les chaînes vides en None
                date_debut = date_debut if date_debut else None
                date_fin = date_fin if date_fin else None
                cur.execute("""
                    INSERT INTO enseignants (iduser, nom, prenom, email, grade, ppr, telephone, cin, date_debut_avancement, date_fin_avancement)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (user_id, nom, prenom, email_final, grade, ppr, tel, cin, date_debut, date_fin))

            mysql.connection.commit()

            resultats.append({**row, 'email': email_final, 'statut': 'cree', 'raison': ''})

        except Exception as e:
            mysql.connection.rollback()
            LoggerService.log_error('ImportService', f"Erreur création {row['email']}: {str(e)}")
            resultats.append({**row, 'email': row['email'], 'statut': 'echoue', 'raison': str(e)})

    cur.close()
    return resultats


def enregistrer_log(admin_user_id, fichier_nom, total, crees, erreurs, rapport_json):
    cur = mysql.connection.cursor()
    try:
        cur.execute("""
            INSERT INTO import_logs (admin_user_id, date_import, fichier_nom, total_lignes, lignes_creees, lignes_erreur, statut, rapport)
            VALUES (%s, NOW(), %s, %s, %s, %s, %s, %s)
        """, (
            admin_user_id, fichier_nom, total, crees, erreurs,
            'succes' if erreurs == 0 else ('partiel' if crees > 0 else 'echec'),
            json.dumps(rapport_json, ensure_ascii=False)
        ))
        mysql.connection.commit()
    except Exception as e:
        mysql.connection.rollback()
        LoggerService.log_error('ImportService', f"Erreur enregistrement log: {str(e)}")
    finally:
        cur.close()


def exporter_rapport_csv(resultats):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['nom', 'prenom', 'email', 'statut', 'raison'])
    for r in resultats:
        writer.writerow([r.get('nom', ''), r.get('prenom', ''), r.get('email', ''), r.get('statut', ''), r.get('raison', '')])
    return output.getvalue()


# Needed for json.dumps in enregistrer_log
import json
