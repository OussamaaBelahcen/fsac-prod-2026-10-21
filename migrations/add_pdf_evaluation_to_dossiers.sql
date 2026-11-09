ALTER TABLE dossiers
    ADD COLUMN pdf_evaluation VARCHAR(255) DEFAULT NULL AFTER commentaire;
