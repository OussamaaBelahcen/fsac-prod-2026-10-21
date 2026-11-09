# -*- coding: utf-8 -*-
"""
Documentation OpenAPI 3.0 + explorateur Swagger UI (accès SUPERADMIN uniquement).

Le spec est généré À LA VOLÉE par introspection de `app.url_map` : toute route
(définie dans routes.py) apparaît automatiquement, avec sa documentation issue
du dictionnaire `DOCS` ci-dessous. Ajouter/renomer une route suffit pour la
voir ; enrichir sa documentation = ajouter une entrée DOCS.

Authentification des tests : l'explorateur est « same-origin », le cookie de
session Flask (cookieAuth) est envoyé automatiquement par le navigateur avec
chaque « Try it out ». Un endpoint dont le rôle ne correspond pas à l'utilisateur
connecté renverra 403 — comportement normal, documenté par endpoint.
"""
from flask import jsonify, request, render_template
import re

TITLE = "FSAC — Plateforme de gestion des dossiers de promotion"
VERSION = "1.0.0"

# ---------------------------------------------------------------------------
# Documentation manuelle par route (clé = chemin Flask original)
# Toutes les entrées sont FR pour rester cohérent avec la plateforme.
# ---------------------------------------------------------------------------
DOCS = {
    '/health': {'GET': {
        'summary': 'Health check',
        'description': 'Ping applicatif simple (aucune authentification). Répond 200 en JSON.',
        'tags': ['Public'],
        'auth': False,
    }},
    '/api/check-auth': {'GET': {
        'summary': 'Vérifier la session',
        'description': "Retourne l'état de session courant (connecté ou non, rôle, badge première connexion).",
        'tags': ['Public'],
        'auth': False,
    }},
    '/login': {'GET': {
        'summary': 'Page de connexion',
        'description': "Formulaire HTML de connexion (rôle SUPERADMIN inutile pour GET).",
        'tags': ['Public'], 'auth': False,
    }, 'POST': {
        'summary': 'Connexion (formulaire)',
        'description': "Authentifie l'utilisateur. **Le mot de passe doit être fourni en clair — ne pas tester avec un vrai compte sensible.** En cas de `premiere_connexion`, l'utilisateur est redirigé vers `/force-change-password`.",
        'tags': ['Public'], 'auth': False,
        'body': {'application/x-www-form-urlencoded': {'email': 'admin@fsac.com', 'mot_de_passe': 'ADMIN_PASSWORD'}},
        'responses': {'200': 'Page (re)affichée avec message', '302': 'Redirection dashboard / force-change-password'},
    }},
    '/sign-in': {'GET': {
        'summary': 'Page inscription',
        'description': 'Formulaire HTML de création de compte (auto-inscription).',
        'tags': ['Public'], 'auth': False,
    }, 'POST': {
        'summary': 'Inscription (formulaire)',
        'description': "Crée un compte ENSEIGNANT puis connecte la session. `role` n'accepte que `ENSEIGNANT`.",
        'tags': ['Public'], 'auth': False,
        'body': {'application/x-www-form-urlencoded': {'nom': 'Nouveau', 'prenom': 'Prof', 'email': 'profil@fsac.ma', 'mot_de_passe': 'Str0ng!Pass', 'confirmation': 'Str0ng!Pass', 'role': 'ENSEIGNANT'}},
    }},
    '/logout': {'GET': {
        'summary': 'Déconnexion',
        'description': 'Termine la session courante et redirige vers /login.',
        'tags': ['Public'], 'auth': False,
    }},
    '/force-change-password': {'GET': {
        'summary': 'Page — changement de mot de passe forcé',
        'description': "Page HTML affichée lors de `premiere_connexion`.",
        'tags': ['Public'], 'auth': False,
    }},
    '/api/force-change-password': {'POST': {
        'summary': 'API — changement forcé du mot de passe',
        'description': "Change le mot de passe du compte en première connexion. Session requise (badge `premiere_connexion`).",
        'tags': ['Public'], 'auth': True,
        'body': {'application/json': {'old_password': 'ANCIEN-MDP-TEMPORAIRE', 'new_password': 'N0uveau!Pass'}},
    }},
    '/dashboard': {'GET': {
        'summary': 'Redirection par rôle',
        'description': "Redirige chaque utilisateur vers sa page : ENSEIGNANT → /enseignant-page, COORDINATEUR → /coordinateurpage, COMMISSION → /membrecommission, SUPERADMIN → /superadmin.",
        'tags': ['Public'], 'auth': True,
    }},
    '/profil': {'GET': {
        'summary': 'Page profil',
        'description': "Profil de l'utilisateur connecté (HTML).",
        'tags': ['Public'], 'auth': True,
    }},
    '/api/notifications/count': {'GET': {
        'summary': 'Nombre de notifications non lues',
        'description': "Compteur utilisé par le badge du header. Répond `{'count': n}`.",
        'tags': ['Notifications'], 'auth': True,
    }},
    '/api/notifications': {'GET': {
        'summary': 'Liste des notifications',
        'description': "Notifications de l'utilisateur connecté (les plus récentes d'abord).",
        'tags': ['Notifications'], 'auth': True,
    }},
    '/api/notifications/<int:notif_id>/read': {'POST': {
        'summary': "Marquer une notification comme lue",
        'description': "Marque la notification `notif_id` des utilisateur courant comme lue.",
        'tags': ['Notifications'], 'auth': True,
    }},
    '/api/notifications/read-all': {'POST': {
        'summary': 'Tout marquer comme lu',
        'description': "Marque toutes les notifications de l'utilisateur courant comme lues.",
        'tags': ['Notifications'], 'auth': True,
    }},
    '/api/change-password': {'POST': {
        'summary': 'Changer son mot de passe',
        'description': "Vérifie `old_password` puis met à jour le mot de passe de la session (contraintes : 8+ caractères, majuscule, chiffre, spécial).",
        'tags': ['Public'], 'auth': True,
        'body': {'application/json': {'old_password': 'Ancien123!', 'new_password': 'N0uveau!Pass'}},
    }},
    '/dossier-enseignant': {'GET': {
        'summary': 'Page — dossier de l\u2019enseignant',
        'description': 'Dernier dossier (statut, annexe II signée…).',
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
    }},
    '/annexes-signees': {'GET': {
        'summary': 'Page — annexes signées',
        'description': 'Consultation/téléchargement des annexes I et II signées.',
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
    }},
    '/guide-avancement': {'GET': {
        'summary': 'Page — guide d\u2019avancement',
        'description': 'Guide accessible tant que `guide_accepte` est faux.',
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
    }},
    '/api/accept-guide': {'POST': {
        'summary': "Accepter le guide",
        'description': "Pose `guide_accepte = 1` sur l'enseignant connecté ; débloque ensuite la page enseignant.",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {'application/json': {'enseignant_id': 2, 'accepted': True}},
    }},
    '/enseignant-page': {'GET': {
        'summary': 'Page — formulaire enseignant',
        'description': "Formulaire complet (étapes 1→5). En lecture seule si le dossier est soumis/évalué/validé/rejeté. Inclut commentaires d'évaluation + note lorsque le statut est `évalué`.",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
    }},
    '/api/upload-evidence': {'POST': {
        'summary': 'Upload — photo de profil / justificatif',
        'description': "Upload d'un fichier (photo de profil ou justificatif générique). Multipart: `file` obligatoire (PDF/jpg/png). **Mutant**.",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {'multipart/form-data': {'file': '(fichier binaire)', 'dossier_id': '1'}},
    }},
    '/api/upload-annexe-signe/<int:dossier_id>/<int:annexe_num>': {'POST': {
        'summary': 'Upload — annexe signée (PDF)',
        'description': "Enregistre l'annexe I (`annexe_num=1`) ou II (`annexe_num=2`) scannée/signée ; PDF uniquement. **Mutant**.",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {'multipart/form-data': {'file': '(fichier PDF binaire)'}},
    }},
    '/api/create-dossier': {'POST': {
        'summary': 'Créer un dossier (année courante)',
        'description': "Crée le brouillon de dossier pour l'enseignant connecté s'il n'en a pas déjà un. **Mutant.**",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {},
    }},
    '/api/save-step1': {'POST': {
        'summary': "Enregistrer l'étape 1 (identité/informations)",
        'description': "Informations personnelles et administratives (multipart + photo optionnelle). **Mutant.**",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {'multipart/form-data': {'nom': 'Sahl', 'prenom': 'Nizar', 'grade': 'MCH B', 'etablissement': 'FSAC', 'date_naissance': '1990-01-01', 'departement': 'physique', 'photo': '(optionnel, binaire)'}},
    }},
    '/api/save-step2': {'POST': {
        'summary': "Enregistrer l'étape 2 (enseignements/encadrements)",
        'description': "Multipart — tableaux d'enseignements encodés en JSON dans `enseignements_licence`, `encadrements_licence`, `enseignements_master`, `encadrements_master` + fichiers. **Mutant.**",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {'multipart/form-data': {'enseignements_licence': '[{"annee_univ":"2024-2025","id_cycle":1,"niveau":"S4","semestre":"S1","modules":"…","leçons":"…","filiere":"…"}]', 'file_el_1': '(optionnel, binaire)'}},
    }},
    '/api/save-step3': {'POST': {
        'summary': "Enregistrer l'étape 3 (responsabilités)",
        'description': 'JSON `{cycle, responsabilites:[…]}`. **Mutant.**',
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {'application/json': {'cycle': 'licence', 'responsabilites': [{'code':'AE3-1','attribue':True,'periode':'2023-09 → 2024-06'}]}},
    }},
    '/api/save-step4': {'POST': {
        'summary': "Enregistrer l'étape 4 (AE — activités d'enseignement)",
        'description': "Multipart — `ae1_1_rows`, `ae1_2_rows`, … (tableaux en JSON) + `aeX_*_fichiers` (fichiers). Champs annexes AE1-3 `support_ntic` et AE2-1 `intitule_module` persistés. **Mutant.**",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {'multipart/form-data': {'ae1_1_rows': '[]', 'ae1_3_rows': '[]', 'ae2_1_rows': '[]', 'ae3_1_rows': '[]'}},
    }},
    '/api/save-step5': {'POST': {
        'summary': "Enregistrer l'étape 5 (AR — activités de recherche)",
        'description': "Multipart — `ar1_1_rows` … `ar4_3_rows` (JSON) + fichiers. Champs : `ar1_4_publication_url` ( citation Auteur — Titre — Journal — DOI ), `ar1_4_anneePublication`, AR2-1 direction/codirection, AR3-3 `periode` + attestation optionnelle, AR4-1 `role`, AR4-2 nature (liste), AR4-3 `nature_activite`. **Mutant.**",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {'multipart/form-data': {'ar1_1_rows': '[{"titre":"…","revue":"…","anneePub":"2025","doc_type":"Article"}]', 'ar1_4_fichiers': '(fichiers)'}},
    }},
    '/api/submit-dossier': {'POST': {
        'summary': 'Soumettre le dossier',
        'description': "Passe le statut du dossier à `soumis` (lecture seule ensuite) et notifie le coordinateur. **Mutant.**",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {},
    }},
    '/api/check-dossier-status': {'GET': {
        'summary': 'Statut du dossier courant',
        'description': "Statut du dernier dossier de l'enseignant connecté (brouillon/soumis/évalué/…).",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
    }},
    '/api/load-form-data': {'GET': {
        'summary': 'Charger toutes les saisies du formulaire',
        'description': "Données complètes du formulaire pour l'enseignant connecté : étapes 1-3 + tableaux AE/AR (dont les nouveaux champs AE1-3 / AE2-1).",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
    }},
    '/api/delete-activity-row': {'POST': {
        'summary': 'Supprimer une ligne d\u2019activité',
        'description': "Supprime la ligne `row_id` de la table `table_id` (ex. `ae1_1`) du dossier courant. **Mutant — irréversible.**",
        'tags': ['Enseignant'], 'auth': True, 'roles': 'ENSEIGNANT',
        'body': {'application/json': {'table_id': 'ar1_1', 'row_id': 3}},
    }},
    '/coordinateurpage': {'GET': {
        'summary': 'Page — affectation des dossiers',
        'description': "Liste des dossiers (`soumis`/`évalué`) avec filtres `statut` (all/assigned/unassigned) et familles de grade `grade` (MC/MCH/PES) ; ligne cliquable, survol du bouton Réassigner = affectataire courant.",
        'tags': ['Coordinateur'], 'auth': True, 'roles': 'COORDINATEUR',
        'params': {'statut': {'in': 'query', 'type': 'string', 'desc': 'all | assigned | unassigned'},
                   'grade':  {'in': 'query', 'type': 'string', 'desc': 'MC | MCH | PES'}},
    }},
    '/api/assign-commission-member': {'POST': {
        'summary': 'Affecter un dossier à un membre',
        'description': "Affecte `dossier_id` au membre COMMISSION `member_email` (validation grade MC/MCH/PES ; **mutant**).",
        'tags': ['Coordinateur'], 'auth': True, 'roles': 'COORDINATEUR',
        'body': {'application/json': {'dossier_id': 1, 'member_email': 'membrecommission@fsac.ma'}},
    }},
    '/membrecommission': {'GET': {
        'summary': 'Page — dossiers affectés au membre',
        'description': 'Liste des dossiers affectés + accès à l\u2019évaluation via `?evaluate=<id>`.',
        'tags': ['Commission'], 'auth': True, 'roles': 'COMMISSION',
        'params': {'evaluate': {'in': 'query', 'type': 'integer', 'desc': 'id de dossier à évaluer'}},
    }},
    '/api/dossier-complet/<int:dossier_id>': {'GET': {
        'summary': 'Dossier complet (JSON, vue commission)',
        'description': "Toutes données du dossier : identité, étapes, AE/AR par table (dont les nouvelles colonnes), annexes signées + `evaluations_details` (commentaires par section).",
        'tags': ['Commission'], 'auth': True, 'roles': 'COMMISSION',
    }},
    '/api/evaluer-dossier/<int:dossier_id>': {'POST': {
        'summary': 'Déposer l\u2019évaluation du dossier',
        'description': "Uniquement sur un dossier `soumis` affecté au membre connecté (grade compatible). **Mutant :** statut → `évalué`, note 0–100 obligatoire + commentaires par section ; génère le PDF d'évaluation + notifications.",
        'tags': ['Commission'], 'auth': True, 'roles': 'COMMISSION',
        'body': {'application/json': {'commentaire': 'Avis global du membre', 'note': 75, 'details': {'ae1': {'commentaire': '…'}, 'ar4': {'commentaire': '…'}}}},
    }},
    '/api/download-evaluation-pdf/<int:dossier_id>': {'GET': {
        'summary': 'Télécharger le PDF d\u2019évaluation',
        'description': 'Renvoie le PDF généré (404 si inexistant).',
        'tags': ['Commission'], 'auth': True, 'roles': 'COMMISSION (ou SUPERADMIN)',
    }},
    '/api/reassign-dossier/<int:dossier_id>': {'POST': {
        'summary': 'Réassigner un dossier',
        'description': "Supprime l'affectation existante et réinitialise l'évaluation (note/commentaires effacés, PDF écrasé). Aucun corps requis. **Mutant — point de non-retour.**",
        'tags': ['Coordinateur'], 'auth': True, 'roles': 'COORDINATEUR',
        'body': {},
    }},
    '/consulter-dossier/<int:dossier_id>': {'GET': {
        'summary': 'Page — consultation du dossier',
        'description': "Vue détaillée (COMMISSION restreint à ses affectations / SUPERADMIN et COORDINATEUR en entier) avec aperçu au survol (pdf.js) + commentaires de commission par section.",
        'tags': ['Dossiers'], 'auth': True, 'roles': 'COMMISSION/COORDINATEUR (et SUPERADMIN)',
    }},
    '/superadmin': {'GET': {
        'summary': 'Dashboard SUPERADMIN',
        'description': 'Statistiques + gestion des comptes (HTML).',
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
    }},
    '/api/create-user': {'POST': {
        'summary': 'Créer un compte',
        'description': "Crée un utilisateur (n'importe quel rôle). Pour `ENSEIGNANT`, une fiche enseignant est créée (grade, dates d'avancement…). Le mot de passe doit respecter les règles : 8+ caractères, majuscule, chiffre, spécial. **Mutant.**",
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
        'body': {'application/json': {'nom': 'Hachimi', 'prenom': 'Karim', 'email': 'test@fsac.ma', 'password': 'Str0ng!Pass', 'role': 'ENSEIGNANT', 'grade': 'MC A', 'etablissement': 'FSAC', 'cin': 'AB123456', 'ppr': '123456', 'telephone': '06…', 'date_debut_avancement': '2024-01-01', 'date_fin_avancement': '2028-01-01'}},
    }},
    '/api/reset-password/<int:user_id>': {'POST': {
        'summary': 'Réinitialiser le mot de passe',
        'description': "Fixe `new_password` (règles identiques) pour `user_id`, marque `premiere_connexion`. **Mutant.**",
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
        'body': {'application/json': {'new_password': 'Temp1234!'}},
    }},
    '/api/update-user/<int:user_id>': {'POST': {
        'summary': 'Modifier un utilisateur',
        'description': "Met à jour nom/prénom/email, rôle ou fiche enseignant (grade, CIN, PPR, dates…). Champ `password` vide = conservé. **Mutant.**",
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
        'body': {'application/json': {'nom': 'X', 'prenom': 'Y', 'email': 'x@fsac.ma', 'role': 'ENSEIGNANT', 'grade': 'MC A', 'password': ''}},
    }},
    '/api/toggle-user-status/<int:user_id>': {'POST': {
        'summary': 'Activer / désactiver un compte',
        'description': 'Bascule `users.statut` actif ↔ inactif. **Mutant.**',
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
        'body': {},
    }},
    '/api/update-statut-dossier/<int:user_id>': {'POST': {
        'summary': 'Changer le statut d\u2019un dossier',
        'description': '`statut_dossier` ∈ validé / rejeté (pas d\u2019autre valeur autorisée via cette API). **Mutant.**',
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
        'body': {'application/json': {'statut_dossier': 'validé'}},
    }},
    '/api/delete-user/<int:user_id>': {'DELETE': {
        'summary': 'Supprimer un utilisateur',
        'description': "Supprime le compte et, pour ENSEIGNANT, fiche enseignant, dossiers (cascade), notifications ; s'interdit de se supprimer. **Mutant — irréversible.**",
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
    }},
    '/api/generer-pdf-annexe/<int:annexe_num>/<int:dossier_id>': {'GET': {
        'summary': 'Générer un PDF d\u2019annexe (I/II)',
        'description': "Rej dynamiquement l'annexe I (AE) ou II (AR) du dossier demandé ; met aussi le fichier dans `static/doc/pdf/` et l'associe au dossier.",
        'tags': ['Dossiers'], 'auth': True,
    }},
    '/api/import-users/preview': {'POST': {
        'summary': 'Prévisualiser un import CSV d\u2019utilisateurs',
        'description': "Multipart : fichier CSV des comptes ; réponse = lignes à créer / erreurs, sans créer. Non mutant.",
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
        'body': {'multipart/form-data': {'file': '(CSV binaire)'}},
    }},
    '/api/import-users/confirm': {'POST': {
        'summary': 'Confirmer l\u2019import CSV',
        'description': "Crée les utilisateurs listés par la prévisualisation (`fichier_nom`, `lignes`), journalise dans `import_logs`. **Mutant.**",
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
        'body': {'application/json': {'fichier_nom': 'users.csv', 'lignes': [{'nom': 'X', 'prenom': 'Y', 'email': 'x@fsac.ma', 'role': 'ENSEIGNANT'}]}},
    }},
    '/api/import-users/template': {'GET': {
        'summary': 'Modèle CSV d\u2019import',
        'description': 'Télécharge le modèle CSV (en-têtes attendus).',
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
    }},
    '/api/import-users/download-rapport': {'POST': {
        'summary': 'Télécharger un rapport d\u2019import',
        'description': 'Renvoie le contenu `rapport_csv` (stocké en session) en fichier .csv.',
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
        'body': {'application/json': {'rapport_csv': 'nom,prenom\\n…'}},
    }},
    '/api/import-users/history': {'GET': {
        'summary': 'Historique des imports',
        'description': 'Derniers `import_logs`. Non mutant.',
        'tags': ['Admin'], 'auth': True, 'roles': 'SUPERADMIN',
    }},
}

TAGS = ['Public', 'Enseignant', 'Commission', 'Coordinateur', 'Admin', 'Dossiers', 'Notifications']


def _tag_for(path):
    if path.startswith('/api/import-users'):
        return 'Admin'
    if path.startswith('/api/notifications') or path in ('/api/notifications',):
        return 'Notifications'
    if path in ('/api/force-change-password', '/api/change-password', '/dashboard', '/profil'):
        return 'Public'
    if any(path.startswith(p) for p in ('/api/save-step', '/api/upload', '/api/create-dossier', '/api/submit-dossier',
                                        '/api/check-dossier-status', '/api/load-form-data', '/api/delete-activity-row',
                                        '/api/accept-guide', '/enseignant-page', '/dossier-enseignant',
                                        '/annexes-signees', '/guide-avancement')):
        return 'Enseignant'
    if path in ('/api/evaluer-dossier/<int:dossier_id>', '/api/dossier-complet/<int:dossier_id>',
                '/api/download-evaluation-pdf/<int:dossier_id>', '/membrecommission'):
        return 'Commission'
    if path in ('/coordinateurpage', '/api/assign-commission-member', '/api/reassign-dossier/<int:dossier_id>'):
        return 'Coordinateur'
    if path in ('/superadmin',) or any(path.startswith(p) for p in ('/api/create-user', '/api/reset-password',
                                                                    '/api/update-user', '/api/toggle-user-status',
                                                                    '/api/update-statut-dossier', '/api/delete-user')):
        return 'Admin'
    if 'dossier' in path or 'annexe' in path or path.startswith('/consulter-dossier'):
        return 'Dossiers'
    return 'Public'


def _param_entry(name, kind):
    if kind == 'int':
        return {'name': name, 'in': 'path', 'required': True,
                'schema': {'type': 'integer'},
                'description': f'identifiant {name} (entier)'}
    if kind == 'path':
        return {'name': name, 'in': 'path', 'required': True,
                'schema': {'type': 'string'},
                'description': f'{name} (chemin de fichier)'}
    return {'name': name, 'in': 'path', 'required': True,
            'schema': {'type': 'string'}, 'description': name}


def _convert_path(rule):
    rule = re.sub(r'<(?:int|string|path|uuid):([a-zA-Z_0-9]+)>', r'{\1}', rule)
    rule = re.sub(r'<([a-zA-Z_0-9]+)>', r'{\1}', rule)
    return rule

def _view_name(fn):
    return getattr(fn, '__name__', str(fn))


def register_swagger(app, login_required, role_required):
    """Deux routes protégées SUPERADMIN : la spécification OpenAPI + l'UI Swagger."""

    @app.route('/api/openapi.json')
    @login_required
    @role_required('SUPERADMIN')
    def openapi_spec():
        return jsonify(_build_spec(app))

    @app.route('/api-explorer')
    @login_required
    @role_required('SUPERADMIN')
    def api_explorer():
        return render_template('swagger_ui.html')


def _build_spec(app):
    spec = {
        'openapi': '3.0.3',
        'info': {
            'title': TITLE,
            'version': VERSION,
            'description': (
                "Documentation générée automatiquement depuis `app.url_map` + "
                "annotations manuelles (`swagger_doc.py`).<br/><br/>"
                "**Authentification :** cookie de session Flask (`session`). "
                "« Try it out » fonctionne directement pour l'utilisateur courant du navigateur ; "
                "un `403` on endpoint utilisable par un autre rôle est comportement attendu. "
                "En production (HTTPS) les cookies sont « Secure/HttpOnly »."
            ),
        },
        'servers': [{'url': request.url_root.rstrip('/') + '/', 'description': 'instance courante'}],
        'tags': [{'name': t} for t in TAGS],
        'paths': {},
        'components': {'securitySchemes': {'cookieAuth': {'type': 'apiKey', 'in': 'cookie', 'name': 'session'}}},
    }
    for rule in app.url_map.iter_rules():
        if rule.endpoint in ('static', 'openapi_spec', 'api_explorer'):
            continue
        template = _convert_path(str(rule))
        methods = sorted(m for m in rule.methods if m not in ('HEAD', 'OPTIONS'))
        view = app.view_functions.get(rule.endpoint)
        fn_name = _view_name(view)
        for method in methods:
            docs = DOCS.get(str(rule), {}).get(method, {})
            op = {
                'tags': [docs.get('tags')] if isinstance(docs.get('tags'), str) else (docs.get('tags') or [_tag_for(str(rule))]),
                'summary': docs.get('summary', fn_name),
                'operationId': f"{fn_name.lower()}_{method.lower()}" if fn_name else f"{method}_{len(template)}",
                'description': docs.get('description', 'Endpoint fonctionnel ; documentation détaillée à enrichir via `swagger_doc.py`.'),
                'responses': {},
            }
            if fn_name:
                op['description'] = f"`{fn_name}()` — " + op['description']
            auth = docs.get('auth', True)
            if auth:
                op['security'] = [['cookieAuth']]
            for pm in re.findall(r'<([a-zA-Z_]+)?:?([a-zA-Z_0-9]+)>', str(rule)):
                conv, name = pm if pm[0] else ('string', pm[1])
                kind = 'int' if conv == 'int' else ('path' if conv in ('path', 'string') else 'string')
                op.setdefault('parameters', []).append(_param_entry(name, kind))
            extra_params = docs.get('params', {})
            for pname, meta in extra_params.items():
                op.setdefault('parameters', []).append({'name': pname, 'in': 'query', 'required': False,
                                                        'schema': {'type': meta.get('type', 'string')},
                                                        'description': meta.get('desc', '')})
            body = docs.get('body')
            if body is not None and body != {}:
                content = {}
                for ctype, example in body.items():
                    content[ctype] = {'example': example} if ctype != 'multipart/form-data' else {
                        'schema': {'type': 'object', 'properties': {k: {'type': 'string', 'format': 'binary' if 'binaire' in str(v) else 'text'} for k, v in example.items()}}}
                op['requestBody'] = {'required': True, 'content': content}
            resp_desc = {k: {'description': v} for k, v in (docs.get('responses') or {'200': 'Succès'}).items()}
            if auth:
                if '200' in resp_desc:
                    resp_desc['200'].setdefault('description', 'Succès')
                resp_desc.setdefault('401', {'description': 'Session absente (login requis)'})
                resp_desc.setdefault('403', {'description': 'Rôle non autorisé'})
            op['responses'] = resp_desc
            spec['paths'].setdefault(template, {})[method.lower()] = op
    return spec
