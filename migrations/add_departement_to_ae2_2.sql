-- Migration: Ajouter le departement d'attache a AE2-2 (si absent)
-- Contexte : cahier de modifications v1.0 — champ texte « Departement d'attache »
-- dans la zone AE 2-2 (cycle Master).
-- Pour les bases existantes creees avant son ajout au schema. Sans effet sur les
-- installations fraiches (shema.sql contient deja ae2_2_departements).
ALTER TABLE ae2_2_encadrements
    ADD COLUMN ae2_2_departements TEXT DEFAULT NULL AFTER ae2_2_coenseignants;
