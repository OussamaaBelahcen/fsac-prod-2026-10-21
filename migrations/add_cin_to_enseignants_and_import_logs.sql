-- Ajout de la colonne CIN à la table enseignants (nécessaire pour l'import en masse)
ALTER TABLE enseignants ADD COLUMN cin VARCHAR(20) DEFAULT NULL AFTER email;

-- Table de log d'audit pour les imports en masse
CREATE TABLE IF NOT EXISTS import_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT NOT NULL,
    date_import DATETIME DEFAULT CURRENT_TIMESTAMP,
    fichier_nom VARCHAR(255),
    total_lignes INT DEFAULT 0,
    lignes_creees INT DEFAULT 0,
    lignes_erreur INT DEFAULT 0,
    statut ENUM('succès', 'partiel', 'échec') DEFAULT 'succès',
    rapport LONGTEXT,
    FOREIGN KEY (admin_user_id) REFERENCES users(iduser) ON DELETE CASCADE
);
