from repositories.base_repository import BaseRepository

class ActiviteRepository(BaseRepository):
    
    @staticmethod
    def get_section_data(table_name, dossier_id):
        """Récupère toutes les lignes d'une table spécifique pour un dossier."""
        cur = BaseRepository.get_cursor()
        try:
            cur.execute(f"SELECT * FROM {table_name} WHERE dossier_id = %s", (dossier_id,))
            rows = [dict(row) for row in cur.fetchall()]
            return rows
        finally:
            cur.close()

    @staticmethod
    def clear_section_data(table_name, dossier_id):
        """Supprime toutes les lignes d'une table spécifique pour un dossier."""
        cur = BaseRepository.get_cursor()
        try:
            cur.execute(f"DELETE FROM {table_name} WHERE dossier_id = %s", (dossier_id,))
        finally:
            cur.close()
        # Le commit est géré par l'appelant ou le service

    @staticmethod
    def add_section_data(table_name, dossier_id, data):
        """Insère une ligne dans une table spécifique."""
        cur = BaseRepository.get_cursor()
        try:
            columns = list(data.keys())
            if not columns:
                return
                
            placeholders = ', '.join(['%s'] * (len(columns) + 1))
            sql = f"INSERT INTO {table_name} (dossier_id, {', '.join(columns)}) VALUES ({placeholders})"
            
            values = [dossier_id] + [data.get(col) for col in columns]
            
            cur.execute(sql, values)
        finally:
            cur.close()

    @staticmethod
    def rollback():
        """Annule la transaction."""
        BaseRepository.rollback()

    @staticmethod
    def commit():
        """Valide la transaction."""
        BaseRepository.commit()
