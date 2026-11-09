-- Migration: Ajouter la maison d'editions a AR1-3 (si absente)
-- Contexte : cahier de modifications v1.0 — champ texte « Maison d'editions ».
-- Pour les bases existantes creees avant son ajout au schema. Sans effet sur les
-- installations fraiches (shema.sql contient deja ar1_3_maisonEditions).
ALTER TABLE ar1_3_ouvrages
    ADD COLUMN ar1_3_maisonEditions TEXT DEFAULT NULL AFTER ar1_3_auteurs;
