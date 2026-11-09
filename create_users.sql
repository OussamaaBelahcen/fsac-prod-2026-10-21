-- SQL pour créer les utilisateurs
-- Exécuter avec: mysql -u root -p Fsac < create_users.sql

USE Fsac;

-- ENSEIGNANT: enseignant@fsac.ma
INSERT INTO users (email_user, mot_de_pass_user, role_user, statut, date_creation) VALUES ('enseignant@fsac.ma', '$2b$12$0dkQzhCzCtK5EJZkyMWY7.voIkrHKX.aa0jalTMOLwy96Qh63.gxi', 'ENSEIGNANT', 'actif', NOW());
SET @user_id = LAST_INSERT_ID();
INSERT INTO enseignants (iduser, nom, prenom, email) VALUES (@user_id, 'enseignant', 'User', 'enseignant@fsac.ma');

-- COMMISSION: membrecommission@fsac.ma
INSERT INTO users (email_user, mot_de_pass_user, role_user, statut, date_creation) VALUES ('membrecommission@fsac.ma', '$2b$12$bxEArEEYnmkSWRi4Om8e9.hJ989W0.xWb.M28KqBzZEtsUZ08sOfG', 'COMMISSION', 'actif', NOW());

-- COORDINATEUR: coordinateur@fsac.ma
INSERT INTO users (email_user, mot_de_pass_user, role_user, statut, date_creation) VALUES ('coordinateur@fsac.ma', '$2b$12$u6DzbrwsZTjXfbl7uE4LAuX3wfOMpE1PwsbDldozUxNHGQko.ZuZW', 'COORDINATEUR', 'actif', NOW());

-- SUPERADMIN: superadmin@fsac.ma
INSERT INTO users (email_user, mot_de_pass_user, role_user, statut, date_creation) VALUES ('superadmin@fsac.ma', '$2b$12$hPHN6cfQipY4l6h7TrkX9eDhexyVbkS09VlvTse56HT7gYkHH4Ali', 'SUPERADMIN', 'actif', NOW());

-- Utilisateurs créés avec succès!
