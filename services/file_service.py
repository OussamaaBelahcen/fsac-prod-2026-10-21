import os
from werkzeug.utils import secure_filename
from datetime import datetime
from app import app

class FileService:
    @staticmethod
    def delete_file(filepath):
        """
        Supprime un fichier s'il existe.
        :param filepath: Chemin relatif (depuis static/) ou absolu du fichier.
        """
        if not filepath or filepath == 'Aucun fichier':
            return

        full_path = None
        if filepath.startswith('uploads/'):
            # Chemin relatif stocké en BDD (ex: uploads/dossier/fichier.pdf)
            # On suppose qu'il est dans static/
            full_path = os.path.join(app.root_path, 'static', filepath)
        elif os.path.isabs(filepath):
            full_path = filepath
        else:
            # Cas fallback, peut-être juste le nom du fichier dans UPLOAD_FOLDER
            full_path = os.path.join(app.config['UPLOAD_FOLDER'], filepath)

        if full_path and os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception as e:
                print(f"⚠️ Erreur lors de la suppression du fichier {full_path}: {e}")

    @staticmethod
    def handle_upload(file, folder_path, old_filename, prefix, user_id, nom, prenom, index):
        """
        Gère l'upload d'un fichier : suppression de l'ancien, sauvegarde du nouveau.
        :return: Le chemin relatif du nouveau fichier (pour la BDD) ou l'ancien nom si pas de changement.
        """
        # 1. Si aucun nouveau fichier n'est envoyé
        if not file or file.filename == '' or not file.filename.lower().endswith('.pdf'):
            return old_filename if old_filename else ''

        # 2. Supprimer l'ancien fichier s'il existe
        if old_filename:
            FileService.delete_file(old_filename)

        # 3. Préparer le nouveau nom
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        # Nettoyage basique des noms pour éviter les caractères spéciaux dans le fichier
        nom_safe = secure_filename(nom)
        prenom_safe = secure_filename(prenom)
        
        new_filename = f"{prefix}_{user_id}_{nom_safe}_{prenom_safe}_{timestamp}_{index}.pdf"
        
        # Raccourcir si trop long
        if len(new_filename) > 100:
            new_filename = f"{prefix}_{user_id}_{timestamp}_{index}.pdf"

        # 4. Sauvegarder
        try:
            if not os.path.exists(folder_path):
                os.makedirs(folder_path)
            
            filepath = os.path.join(folder_path, new_filename)
            file.save(filepath)
            
            # Retourner le chemin relatif à stocker en BDD
            # On suppose que folder_path est dans static/uploads/
            # On veut stocker "uploads/nom_dossier/fichier.pdf"
            folder_name = os.path.basename(folder_path)
            return f"uploads/{folder_name}/{new_filename}"
        except Exception as e:
            print(f"❌ Erreur lors de l'upload du fichier {new_filename}: {e}")
            raise e
