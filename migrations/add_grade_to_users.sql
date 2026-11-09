-- Migration: Ajouter la colonne grade à la table users
-- Pour les membres de commission afin de pouvoir valider la hiérarchie des grades

ALTER TABLE users ADD COLUMN grade VARCHAR(100) DEFAULT NULL AFTER prenom;
