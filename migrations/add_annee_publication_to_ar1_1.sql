-- Migration: Ajouter l'annee de publication a AR1-1 (si absente)
-- Contexte : cahier de modifications v1.0 — champ « Annee de publication ».
-- Pour les bases existantes creees avant son ajout au schema. Sans effet sur les
-- installations fraiches (shema.sql contient deja ar1_1_anneePublication).
ALTER TABLE ar1_1_articles
    ADD COLUMN ar1_1_anneePublication TEXT DEFAULT NULL AFTER ar1_1_referenceComplete;
