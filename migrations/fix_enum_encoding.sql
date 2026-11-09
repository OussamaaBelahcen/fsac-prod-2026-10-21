-- Réparation : encodage des colonnes ENUM corrompues (« mojibake »)
-- Contexte : les bases créées avant l'ajout de « SET NAMES utf8mb4 » en tête de
-- shema.sql ont été importées via un client mysql en latin1. Les accents des
-- définitions ENUM ont été stockés double-encodés (« Ã©valuÃ© » au lieu de
-- « évalué »), ce qui provoque l'erreur MySQL 1265 « Data truncated for column
-- 'statut' » lors de l'évaluation d'un dossier via l'application.
--
-- Colonnes concernées : dossiers.statut, import_logs.statut.
--
-- MODE D'EMPLOI (obligatoire) : exécuter ce fichier avec un client utf8mb4, ex. :
--   docker exec -i <conteneur_mysql> mysql -u<user> -p<pass> <db> \
--     --default-character-set=utf8mb4 < migrations/fix_enum_encoding.sql
-- (ou via toute connexion applicative utf8mb4). SANS ce drapeau, les littéraux
-- accentués de ce fichier seraient à nouveau corrompus.

SET NAMES utf8mb4;

-- 1) dossiers.statut : enum -> varchar pour pouvoir corriger les valeurs
ALTER TABLE dossiers MODIFY statut VARCHAR(20) DEFAULT 'brouillon';

-- 2) réparer les lignes double-encodées (Ã... en premier caractère) :
--    latin1 -> binary -> utf8mb4 reconstruit le texte original
UPDATE dossiers
SET statut = CONVERT(CONVERT(CONVERT(statut USING latin1) USING binary) USING utf8mb4)
WHERE HEX(CONVERT(statut USING utf8mb4)) LIKE 'C383%';

-- 3) restaurer l'ENUM avec les libellés corrects
ALTER TABLE dossiers
    MODIFY statut ENUM('brouillon','soumis','évalué','validé','rejeté') DEFAULT 'brouillon';

-- Idem pour import_logs.statut
ALTER TABLE import_logs MODIFY statut VARCHAR(30) DEFAULT 'succès';

UPDATE import_logs
SET statut = CONVERT(CONVERT(CONVERT(statut USING latin1) USING binary) USING utf8mb4)
WHERE HEX(CONVERT(statut USING utf8mb4)) LIKE 'C383%';

ALTER TABLE import_logs
    MODIFY statut ENUM('succès','partiel','échec') DEFAULT 'succès';
