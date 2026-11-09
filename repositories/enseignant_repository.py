from repositories.base_repository import BaseRepository

class EnseignantRepository(BaseRepository):
    @staticmethod
    def get_by_user_id(user_id):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("SELECT * FROM enseignants WHERE iduser = %s", (user_id,))
            enseignant = cur.fetchone()
            return enseignant
        finally:
            cur.close()

    @staticmethod
    def get_by_id(enseignant_id):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("SELECT * FROM enseignants WHERE id = %s", (enseignant_id,))
            enseignant = cur.fetchone()
            return enseignant
        finally:
            cur.close()

    @staticmethod
    def create_enseignant(user_id, nom, prenom, email):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute(
                "INSERT INTO enseignants (iduser, nom, prenom, email) VALUES (%s, %s, %s, %s)",
                (user_id, nom, prenom, email)
            )
            return cur.lastrowid
        finally:
            cur.close()

    @staticmethod
    def update_profile(enseignant_id, data):
        """
        Updates the enseignant profile.
        data is a dictionary containing the fields to update.
        """
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("""
                UPDATE enseignants SET
                    photo = %s, nom = %s, prenom = %s, grade = %s, etablissement = %s,
                    departement = %s, periode_avancement = %s, date_naissance = %s,
                    lieu_naissance = %s, date_recrutement = %s, ppr = %s,
                    laboratoire = %s, equipe_recherche = %s, adresse_personnelle = %s, telephone = %s
                WHERE id = %s
            """, (
                data.get('photo_path'), data.get('nom'), data.get('prenom'), data.get('grade'), 
                data.get('etablissement'), data.get('departement'), data.get('periode_avancement'), 
                data.get('date_naissance'), data.get('lieu_naissance'), data.get('date_recrutement'),
                data.get('ppr'), data.get('laboratoire'), data.get('equipe_recherche'), 
                data.get('adresse_personnelle'), data.get('telephone'),
                enseignant_id
            ))
        finally:
            cur.close()
        
    @staticmethod
    def update_last_connection(enseignant_id):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("UPDATE enseignants SET derniere_connexion = NOW() WHERE id = %s", (enseignant_id,))
            BaseRepository.commit()
        finally:
            cur.close()
