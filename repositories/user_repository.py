from repositories.base_repository import BaseRepository
import bcrypt

class UserRepository(BaseRepository):
    @staticmethod
    def get_by_email(email):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("SELECT * FROM users WHERE email_user = %s", (email,))
            user = cur.fetchone()
            return user
        finally:
            cur.close()

    @staticmethod
    def get_by_id(user_id):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("SELECT * FROM users WHERE iduser = %s", (user_id,))
            user = cur.fetchone()
            return user
        finally:
            cur.close()

    @staticmethod
    def create_user(email, password, role):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute(
                "INSERT INTO users (email_user, mot_de_pass_user, role_user, statut, date_creation) VALUES (%s, %s, %s, 'actif', NOW())",
                (email, password, role)
            )
            user_id = cur.lastrowid
            return user_id
        finally:
            cur.close()

    @staticmethod
    def update_password(user_id, new_password_hash):
        cur = BaseRepository.get_cursor()
        try:
            cur.execute("UPDATE users SET mot_de_pass_user = %s WHERE iduser = %s", (new_password_hash, user_id))
            BaseRepository.commit()
        finally:
            cur.close()
