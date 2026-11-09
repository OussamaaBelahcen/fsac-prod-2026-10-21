import os
from werkzeug.utils import secure_filename
from repositories.dossier_repository import DossierRepository
from repositories.enseignant_repository import EnseignantRepository
from app import app

class DossierService:
    @staticmethod
    def create_dossier(enseignant_id):
        # 1. Check if dossier already exists (brouillon)
        existing_dossier = DossierRepository.get_brouillon_by_enseignant(enseignant_id)
        if existing_dossier:
            return existing_dossier['id']

        # 2. Create dossier in DB
        dossier_id = DossierRepository.create_brouillon(enseignant_id)
        DossierRepository.commit()

        # 3. Create physical directory
        enseignant = EnseignantRepository.get_by_id(enseignant_id)
        if enseignant:
            nom = secure_filename(enseignant['nom'] or 'nom')
            prenom = secure_filename(enseignant['prenom'] or 'prenom')
            folder_name = f"{nom}_{prenom}_{dossier_id}"
            folder_path = os.path.join(app.config['UPLOAD_FOLDER'], folder_name)
            
            if not os.path.exists(folder_path):
                os.makedirs(folder_path)
                print(f"✅ Dossier créé : {folder_path}")
            
            # Optional: Update dossier with folder path if needed in DB
            # For now, we just follow the convention
            
        return dossier_id
