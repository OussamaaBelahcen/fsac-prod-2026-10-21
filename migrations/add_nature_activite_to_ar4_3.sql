-- Migration: Ajouter la nature de l'activite a AR4-3 (si absente)
-- Contexte : cahier de modifications v1.0 — champ texte libre « Nature de l'activite ».
-- (Le point « Coordinateur / Grade » du cahier ne correspond a aucun champ existant :
-- erreur du cahier, ignore.)
-- Pour les bases existantes creees avant son ajout au schema. Sans effet sur les
-- installations fraiches (shema.sql contient deja ar4_3_nature_activite).
ALTER TABLE ar4_3
    ADD COLUMN ar4_3_nature_activite TEXT DEFAULT NULL AFTER ar4_3_type_activite;
