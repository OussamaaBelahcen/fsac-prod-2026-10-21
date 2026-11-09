-- Migration: Ajouter l'annee de publication a AR1-4 (si absente)
-- Contexte : cahier de modifications v1.0 — champ « Annee de publication ».
-- Pour les bases existantes creees avant son ajout au schema. Sans effet sur les
-- installations fraiches (shema.sql contient deja ar1_4_anneePublication).
ALTER TABLE ar1_4_revues
    ADD COLUMN ar1_4_anneePublication TEXT DEFAULT NULL AFTER ar1_4_referenceComplete;
