-- Migration: Ajouter la colonne type de polycopie a AE1-2 (si absente)
-- Contexte : cahier de modifications v1.0 — champ « Type de polycopie » (CM / TD / TP)
-- Pour les bases existantes creees avant son ajout au schema. Sans effet sur les
-- installations fraiches (shema.sql contient deja ae1_2_types).
ALTER TABLE ae1_2_manuels
    ADD COLUMN ae1_2_types TEXT DEFAULT NULL AFTER ae1_2_semestres;
