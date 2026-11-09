-- Migration: Ajouter le role a AR4-1 (si absent)
-- Contexte : cahier de modifications v1.0 — champ texte « Role ».
-- Le champ « Portee » n'est plus utilise par l'application mais la colonne est
-- conservee pour ne pas perdre les donnees existantes.
-- Pour les bases existantes creees avant son ajout au schema. Sans effet sur les
-- installations fraiches (shema.sql contient deja ar4_1_role).
ALTER TABLE ar4_1_animations
    ADD COLUMN ar4_1_role TEXT DEFAULT NULL AFTER ar4_1_date;
