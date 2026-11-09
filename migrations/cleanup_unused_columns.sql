-- =============================================
-- Migration : Nettoyage des colonnes non utilisées
-- Date : 2026-07-28
-- Compatible MySQL 5.x / MariaDB (sans IF EXISTS)
-- =============================================
USE Fsac;

DROP PROCEDURE IF EXISTS drop_col_if_exists;
DELIMITER //
CREATE PROCEDURE drop_col_if_exists(IN tbl VARCHAR(64), IN col VARCHAR(64))
BEGIN
    IF EXISTS(
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'Fsac' AND TABLE_NAME = tbl AND COLUMN_NAME = col
    ) THEN
        SET @sql = CONCAT('ALTER TABLE ', tbl, ' DROP COLUMN ', col);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//
DELIMITER ;

-- AE3-3
CALL drop_col_if_exists('ae3_3', 'ae3_3_annees');
CALL drop_col_if_exists('ae3_3', 'ae3_3_departements');
CALL drop_col_if_exists('ae3_3', 'ae3_3_cycles');

-- AR1-1
CALL drop_col_if_exists('ar1_1_articles', 'ar1_1_titreArticle');
CALL drop_col_if_exists('ar1_1_articles', 'ar1_1_auteurs');
CALL drop_col_if_exists('ar1_1_articles', 'ar1_1_nomRevue');
CALL drop_col_if_exists('ar1_1_articles', 'ar1_1_anneePub');
CALL drop_col_if_exists('ar1_1_articles', 'ar1_1_datePub');
CALL drop_col_if_exists('ar1_1_articles', 'ar1_1_doi');
CALL drop_col_if_exists('ar1_1_articles', 'ar1_1_baseIndexation');

-- AR1-2
CALL drop_col_if_exists('ar1_2_actes', 'ar1_2_typeActivite');
CALL drop_col_if_exists('ar1_2_actes', 'ar1_2_titre');
CALL drop_col_if_exists('ar1_2_actes', 'ar1_2_auteurs');
CALL drop_col_if_exists('ar1_2_actes', 'ar1_2_institution');
CALL drop_col_if_exists('ar1_2_actes', 'ar1_2_comiteLecture');

-- AR1-3
CALL drop_col_if_exists('ar1_3_ouvrages', 'ar1_3_editeur');
CALL drop_col_if_exists('ar1_3_ouvrages', 'ar1_3_reference');
CALL drop_col_if_exists('ar1_3_ouvrages', 'ar1_3_lien');

-- AR1-4
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_titreArticle');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_auteurs');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_nomRevue');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_portee');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_annee');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_date');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_volume');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_issue');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_pages');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_comiteLecture');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_confirmationNonIndexe');
CALL drop_col_if_exists('ar1_4_revues', 'ar1_4_confirmationNonPayant');

DROP PROCEDURE IF EXISTS drop_col_if_exists;

SELECT 'Nettoyage terminé avec succès !' AS Statut;
