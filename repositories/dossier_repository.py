from repositories.base_repository import BaseRepository
from datetime import datetime

class DossierRepository(BaseRepository):
    @staticmethod
    def get_by_enseignant_id(enseignant_id):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("""
                SELECT * FROM dossiers 
                WHERE enseignant_id = %s 
                ORDER BY date_soumission DESC 
                LIMIT 1
            """, (enseignant_id,))
            dossier = cur.fetchone()
            return dossier
        finally:
            cur.close()

    @staticmethod
    def get_brouillon_by_enseignant(enseignant_id):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("""
                SELECT id FROM dossiers 
                WHERE enseignant_id = %s AND statut = 'brouillon'
            """, (enseignant_id,))
            dossier = cur.fetchone()
            return dossier
        finally:
            cur.close()

    @staticmethod
    def create_brouillon(enseignant_id):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("""
                INSERT INTO dossiers (enseignant_id, annee, statut) 
                VALUES (%s, %s, 'brouillon')
            """, (enseignant_id, datetime.now().year))
            return cur.lastrowid
        finally:
            cur.close()

    @staticmethod
    def is_submitted(enseignant_id):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("""
                SELECT statut FROM dossiers 
                WHERE enseignant_id = %s 
                AND statut != 'brouillon'
                LIMIT 1
            """, (enseignant_id,))
            result = cur.fetchone()
            return result is not None
        finally:
            cur.close()

    # --- Methods for Step 2 (Enseignements & Encadrements) ---
    
    @staticmethod
    def clear_step2_data(dossier_id):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("DELETE FROM enseignements_licence WHERE dossier_id = %s", (dossier_id,))
            cur.execute("DELETE FROM encadrements_licence WHERE dossier_id = %s", (dossier_id,))
            cur.execute("DELETE FROM enseignements_master WHERE dossier_id = %s", (dossier_id,))
            cur.execute("DELETE FROM encadrements_master WHERE dossier_id = %s", (dossier_id,))
        finally:
            cur.close()
        # Note: Commit should be handled by the service
        
    @staticmethod
    def add_enseignement_licence(dossier_id, data):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("""
                INSERT INTO enseignements_licence 
                (dossier_id, annee_univ, filiere, semestre, cours, vh_cours, td, vh_td, tp, vh_tp)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                dossier_id, data.get('annee_univ'), data.get('filiere'), data.get('semestre'),
                data.get('cours'), data.get('vh_cours'), data.get('td'), data.get('vh_td'),
                data.get('tp'), data.get('vh_tp')
            ))
        finally:
            cur.close()

    @staticmethod
    def add_encadrement_licence(dossier_id, data):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("""
                INSERT INTO encadrements_licence 
                (dossier_id, annee_univ, type_licence, titre_pfe, etudiants, nom_encadrants, page_de_garde)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                dossier_id, data.get('annee_univ'), data.get('type_licence'), 
                data.get('titre_pfe'), data.get('etudiants'), data.get('nom_encadrants'),
                data.get('page_de_garde')
            ))
        finally:
            cur.close()

    @staticmethod
    def add_enseignement_master(dossier_id, data):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("""
                INSERT INTO enseignements_master 
                (dossier_id, annee_univ, filiere, semestre, cours_td_tp, vh)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                dossier_id, data.get('annee_univ'), data.get('filiere'), data.get('semestre'),
                data.get('cours_td_tp'), data.get('vh')
            ))
        finally:
            cur.close()

    @staticmethod
    def add_encadrement_master(dossier_id, data):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("""
                INSERT INTO encadrements_master 
                (dossier_id, annee_univ, filiere, type_master, titre_memoire, nom_etudiants, nom_encadrants, page_de_garde)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                dossier_id, data.get('annee_univ'), data.get('filiere'), data.get('type_master'),
                data.get('titre_memoire'), data.get('nom_etudiants'), data.get('nom_encadrants'),
                data.get('page_de_garde')
            ))
        finally:
            cur.close()

    # --- Methods for Step 3 (Responsabilités) ---

    @staticmethod
    def clear_responsabilites(dossier_id):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("DELETE FROM responsabilites WHERE dossier_id = %s", (dossier_id,))
        finally:
            cur.close()

    @staticmethod
    def add_responsabilite(dossier_id, data):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("""
                INSERT INTO responsabilites 
                (dossier_id, annees_univ, filiere, semestre, intitule_module, cycle)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                dossier_id, data.get('annees_univ'), data.get('filiere'), 
                data.get('semestre'), data.get('intitule_module'), data.get('cycle')
            ))
        finally:
            cur.close()
