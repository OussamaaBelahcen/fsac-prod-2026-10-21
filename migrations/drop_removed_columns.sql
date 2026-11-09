-- =============================================
-- Migration : Suppression des colonnes retirées
-- Date : 2026-07-22
-- =============================================
USE Fsac;

-- AE2-3 : Autres activités encadrées
ALTER TABLE ae2_3_encadrements DROP COLUMN ae2_3_details;
ALTER TABLE ae2_3_encadrements DROP COLUMN ae2_3_institutions;
ALTER TABLE ae2_3_encadrements DROP COLUMN ae2_3_roles;

-- AE3-1 : Chef de département / Membre collège
ALTER TABLE ae3_1 DROP COLUMN ae3_1_departements;
ALTER TABLE ae3_1 DROP COLUMN ae3_1_details;

-- AE3-2 : Coordinateur de filière
ALTER TABLE ae3_2 DROP COLUMN ae3_2_departements;
ALTER TABLE ae3_2 DROP COLUMN ae3_2_institutions;
ALTER TABLE ae3_2 DROP COLUMN ae3_2_details;

-- AE3-3 : Responsable de module
ALTER TABLE ae3_3 DROP COLUMN ae3_3_autorites;

-- Vérification finale
SELECT 'Migration terminée avec succès !' AS Statut;
SHOW COLUMNS FROM ae2_3_encadrements;
SHOW COLUMNS FROM ae3_1;
SHOW COLUMNS FROM ae3_2;
SHOW COLUMNS FROM ae3_3;
