-- =============================================
-- Création de la base de données
-- =============================================
-- IMPORTANT : les instructions ci-dessous DOIVENT être exécutées avec un client utf8mb4.
-- Le client mysql officiel (image mysql:5.7) démarre par défaut en latin1 : sans
-- « SET NAMES », les accents des définitions ENUM (« évalué », « succès », …) sont
-- corrompus (mojibake) et l'application ne peut plus écrire ces statuts (Erreur 1265).
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS Fsac CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE Fsac;

-- Suppression sécurisée des tables (ordre inverse des dépendances)
DROP TABLE IF EXISTS import_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS evaluations_details;
DROP TABLE IF EXISTS assignations_commission;

-- Drops pour l'étape 5 (AR)
DROP TABLE IF EXISTS ar4_3;
DROP TABLE IF EXISTS ar4_2;
DROP TABLE IF EXISTS ar4_1_animations;
DROP TABLE IF EXISTS ar3_4_expertises;
DROP TABLE IF EXISTS ar3_3_projets;
DROP TABLE IF EXISTS ar3_2_equipes;
DROP TABLE IF EXISTS ar3_1_structures;
DROP TABLE IF EXISTS ar2_2_jurys;
DROP TABLE IF EXISTS ar2_1_theses;
DROP TABLE IF EXISTS ar1_4_revues;
DROP TABLE IF EXISTS ar1_3_ouvrages;
DROP TABLE IF EXISTS ar1_2_actes;
DROP TABLE IF EXISTS ar1_1_articles;

-- Drops pour l'étape 4 (AE)
DROP TABLE IF EXISTS ae3_7;
DROP TABLE IF EXISTS ae3_6;
DROP TABLE IF EXISTS ae3_5;
DROP TABLE IF EXISTS ae3_4;
DROP TABLE IF EXISTS ae3_3;
DROP TABLE IF EXISTS ae3_2;
DROP TABLE IF EXISTS ae3_1;
DROP TABLE IF EXISTS ae2_3_encadrements;
DROP TABLE IF EXISTS ae2_2_encadrements;
DROP TABLE IF EXISTS ae2_1_encadrements;
DROP TABLE IF EXISTS ae1_3_ntic;
DROP TABLE IF EXISTS ae1_2_manuels;
DROP TABLE IF EXISTS ae1_1_ouvrages;

-- Suppression des anciennes tables globales (si elles existent encore)
DROP TABLE IF EXISTS activites_recherche;
DROP TABLE IF EXISTS activites_enseignement;

DROP TABLE IF EXISTS responsabilites;
DROP TABLE IF EXISTS encadrements_master;
DROP TABLE IF EXISTS enseignements_master;
DROP TABLE IF EXISTS encadrements_licence;
DROP TABLE IF EXISTS enseignements_licence;
DROP TABLE IF EXISTS dossiers;
DROP TABLE IF EXISTS enseignants;
DROP TABLE IF EXISTS users;

-- Table principale des utilisateurs
CREATE TABLE users (
    iduser INT AUTO_INCREMENT PRIMARY KEY,
    email_user VARCHAR(100) NOT NULL UNIQUE,
    mot_de_pass_user VARCHAR(255) NOT NULL,
    role_user ENUM('ENSEIGNANT', 'COMMISSION', 'COORDINATEUR', 'SUPERADMIN') NOT NULL,
    nom VARCHAR(100),
    prenom VARCHAR(100),
    grade VARCHAR(100) DEFAULT NULL,
    statut ENUM('actif', 'inactif') DEFAULT 'actif',
    premiere_connexion TINYINT(1) DEFAULT 1,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des enseignants (1:1 avec users si rôle = ENSEIGNANT)
CREATE TABLE enseignants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iduser INT NOT NULL UNIQUE,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    cin VARCHAR(20) DEFAULT NULL,
    guide_accepte TINYINT(1) DEFAULT 0,
    grade VARCHAR(100),
    etablissement VARCHAR(150),
    departement VARCHAR(150),
    periode_avancement VARCHAR(100),
    date_debut_avancement DATE,
    date_fin_avancement DATE,
    date_naissance DATE,
    lieu_naissance VARCHAR(150),
    date_recrutement DATE,
    ppr VARCHAR(50),
    laboratoire VARCHAR(150),
    equipe_recherche VARCHAR(150),
    adresse_personnelle TEXT,
    telephone VARCHAR(20),
    photo VARCHAR(255),
    derniere_connexion DATETIME,
    mot_de_passe VARCHAR(255),
    FOREIGN KEY (iduser) REFERENCES users(iduser) ON DELETE CASCADE
);

-- Dossiers de promotion (1 enseignant → plusieurs dossiers, mais 1 brouillon actif max)
CREATE TABLE dossiers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enseignant_id INT NOT NULL,
    annee INT NOT NULL,
    statut ENUM('brouillon', 'soumis', 'évalué', 'validé', 'rejeté') DEFAULT 'brouillon',
    date_soumission DATETIME NULL,
    note DECIMAL(5,2),
    commentaire TEXT,
    date_evaluation DATETIME,
    pdf_evaluation VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (enseignant_id) REFERENCES enseignants(id) ON DELETE CASCADE
);

ALTER TABLE dossiers
    ADD COLUMN annexe_i_signe VARCHAR(255) DEFAULT NULL AFTER date_evaluation,
    ADD COLUMN annexe_ii_signe VARCHAR(255) DEFAULT NULL AFTER annexe_i_signe;

-- Enseignements Licence
CREATE TABLE enseignements_licence (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    annee_univ VARCHAR(20),
    filiere VARCHAR(100),
    semestre VARCHAR(50),
    cours VARCHAR(150),
    vh_cours DECIMAL(5,2),
    td VARCHAR(150),
    vh_td DECIMAL(5,2),
    tp VARCHAR(150),
    vh_tp DECIMAL(5,2),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

-- Encadrements Licence
CREATE TABLE encadrements_licence (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    annee_univ VARCHAR(20),
    type_licence VARCHAR(100),
    titre_pfe VARCHAR(255),
    etudiants VARCHAR(255),
    nom_encadrants VARCHAR(255),
    page_de_garde VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

-- Enseignements Master
CREATE TABLE enseignements_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    annee_univ VARCHAR(20),
    filiere VARCHAR(100),
    semestre VARCHAR(50),
    cours_td_tp VARCHAR(150),
    vh DECIMAL(5,2),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

-- Encadrements Master
CREATE TABLE encadrements_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    annee_univ VARCHAR(20),
    filiere VARCHAR(100),
    type_master VARCHAR(100),
    titre_memoire VARCHAR(255),
    nom_etudiants VARCHAR(255),
    nom_encadrants VARCHAR(255),
    page_de_garde VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

-- Responsabilités pédagogiques
CREATE TABLE responsabilites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    annees_univ VARCHAR(20),
    filiere VARCHAR(150),
    semestre VARCHAR(50),
    intitule_module VARCHAR(255),
    cycle ENUM('Licence', 'Master') NOT NULL,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

-- Activités d'enseignement (AE1, AE2, AE3) - Tables spécifiques
CREATE TABLE ae1_1_ouvrages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae1_1_titres TEXT,
    ae1_1_auteurs TEXT,
    ae1_1_niveaux TEXT,
    ae1_1_editeurs TEXT,
    ae1_1_annees TEXT,
    ae1_1_numero_depot TEXT,
    ae1_1_justificatifs VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae1_2_manuels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae1_2_titres TEXT,
    ae1_2_auteurs TEXT,
    ae1_2_departements TEXT,
    ae1_2_annees TEXT,
    ae1_2_filieres TEXT,
    ae1_2_semestres TEXT,
    ae1_2_types TEXT,
    ae1_2_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae1_3_ntic (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae1_3_objectifs TEXT,
    ae1_3_auteurs TEXT,
    ae1_3_filieres TEXT,
    ae1_3_niveaux TEXT,
    ae1_3_annees TEXT,
    ae1_3_liens TEXT,
    ae1_3_support_ntic TEXT,
    ae1_3_types TEXT,
    ae1_3_descriptions TEXT,
    ae1_3_contextes TEXT,
    ae1_3_cibles TEXT,
    ae1_3_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae2_1_encadrements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae2_1_annees_univ TEXT,
    ae2_1_types TEXT,
    ae2_1_filieres TEXT,
    ae2_1_nom_etudiants TEXT,
    ae2_1_intitules TEXT,
    ae2_1_intitule_module TEXT,
    ae2_1_details TEXT,
    ae2_1_departements TEXT,
    ae2_1_modules TEXT,
    ae2_1_coenseignants TEXT,
    ae2_1_fichiers VARCHAR(255),
    ae2_1_type_encadrement VARCHAR(20) DEFAULT 'cours_td_tp',
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae2_2_encadrements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae2_2_annees_univ TEXT,
    ae2_2_types TEXT,
    ae2_2_filieres TEXT,
    ae2_2_nom_etudiants TEXT,
    ae2_2_intitules TEXT,
    ae2_2_coordonnateurs TEXT,
    ae2_2_coenseignants TEXT,
    ae2_2_departements TEXT,
    ae2_2_fichiers VARCHAR(255),
    ae2_2_type_encadrement VARCHAR(20) DEFAULT 'cours',
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae2_3_encadrements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae2_3_annees_univ TEXT,
    ae2_3_types TEXT,
    ae2_3_nom_etudiants TEXT,
    ae2_3_intitules TEXT,
    ae2_3_dates TEXT,
    ae2_3_lieux TEXT,
    ae2_3_durees TEXT,
    ae2_3_fichiers TEXT,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae3_1 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae3_1_natures TEXT,
    ae3_1_periodes TEXT,
    ae3_1_mandats TEXT,
    ae3_1_institutions TEXT,
    ae3_1_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae3_2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae3_2_titres TEXT,
    ae3_2_accreditations TEXT,
    ae3_2_periodes TEXT,
    ae3_2_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae3_3 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae3_3_titres TEXT,
    ae3_3_filieres TEXT,
    ae3_3_periodes TEXT,
    ae3_3_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae3_4 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae3_4_etablissements TEXT,
    ae3_4_periodes TEXT,
    ae3_4_roles TEXT,
    ae3_4_mandats TEXT,
    ae3_4_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae3_5 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae3_5_universites TEXT,
    ae3_5_periodes TEXT,
    ae3_5_roles TEXT,
    ae3_5_mandats TEXT,
    ae3_5_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae3_6 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae3_6_commissions TEXT,
    ae3_6_institutions TEXT,
    ae3_6_periodes TEXT,
    ae3_6_roles TEXT,
    ae3_6_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ae3_7 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ae3_7_natures TEXT,
    ae3_7_types TEXT,
    ae3_7_dates TEXT,
    ae3_7_lieux TEXT,
    ae3_7_periodes TEXT,
    ae3_7_institutions TEXT,
    ae3_7_roles TEXT,
    ae3_7_objets TEXT,
    ae3_7_details TEXT,
    ae3_7_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

-- Activités de recherche (AR1 à AR4) - Tables spécifiques
CREATE TABLE ar1_1_articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar1_1_referenceComplete TEXT,
    ar1_1_anneePublication TEXT,
    ar1_1_lien TEXT,
    ar1_1_cedList VARCHAR(255),
    ar1_1_doctorantsCoAuteurs TEXT,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar1_2_actes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar1_2_reference TEXT,
    ar1_2_nomEvenement TEXT,
    ar1_2_lieu TEXT,
    ar1_2_dateEvenement TEXT,
    ar1_2_lienSite TEXT,
    ar1_2_natureTravail TEXT,
    ar1_2_attestation VARCHAR(255),
    ar1_2_premiere_page VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar1_3_ouvrages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar1_3_titreOuvrage TEXT,
    ar1_3_typeOuvrage TEXT,
    ar1_3_auteurs TEXT,
    ar1_3_maisonEditions TEXT,
    ar1_3_annee TEXT,
    ar1_3_issn TEXT,
    ar1_3_isbn TEXT,
    ar1_3_page_garde VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar1_4_revues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar1_4_referenceComplete TEXT,
    ar1_4_anneePublication TEXT,
    ar1_4_lien TEXT,
    ar1_4_doctorantsCoAuteurs TEXT,
    ar1_4_cedList VARCHAR(255) DEFAULT NULL,
    ar1_4_publication_url VARCHAR(500) DEFAULT NULL,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar2_1_theses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar2_1_nomAuteur TEXT,
    ar2_1_titreThese TEXT,
    ar2_1_institution TEXT,
    ar2_1_dateSoutenance TEXT,
    ar2_1_type TEXT,
    ar2_1_formation TEXT,
    ar2_1_ced TEXT,
    ar2_1_these VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar2_2_jurys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar2_2_nomAuteur TEXT,
    ar2_2_typeTravail TEXT,
    ar2_2_titre TEXT,
    ar2_2_institution TEXT,
    ar2_2_dateSoutenance TEXT,
    ar2_2_role TEXT,
    ar2_2_fichiers VARCHAR(255),
    ar2_2_page_garde VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar3_1_structures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar3_1_nomStructure TEXT,
    ar3_1_adresseStructure TEXT,
    ar3_1_periode TEXT,
    ar3_1_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar3_2_equipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar3_2_nomEquipe TEXT,
    ar3_2_adresseEquipe TEXT,
    ar3_2_structure_parente TEXT,
    ar3_2_periode TEXT,
    ar3_2_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar3_3_projets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar3_3_nomResponsable TEXT,
    ar3_3_role TEXT,
    ar3_3_nature TEXT,
    ar3_3_titre TEXT,
    ar3_3_montant TEXT,
    ar3_3_duree TEXT,
    ar3_3_partenaire TEXT,
    ar3_3_fichiers VARCHAR(255),
    ar3_3_attestation_responsable VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar3_4_expertises (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar3_4_typeActivite TEXT,
    ar3_4_objet TEXT,
    ar3_4_date TEXT,
    ar3_4_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar4_1_animations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar4_1_titre TEXT,
    ar4_1_lieu TEXT,
    ar4_1_date TEXT,
    ar4_1_role TEXT,
    ar4_1_portee TEXT,
    ar4_1_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar4_2 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar4_2_nature TEXT,
    ar4_2_organisme TEXT,
    ar4_2_lieu TEXT,
    ar4_2_date TEXT,
    ar4_2_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

CREATE TABLE ar4_3 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    ar4_3_type_activite TEXT,
    ar4_3_nature_activite TEXT,
    ar4_3_date TEXT,
    ar4_3_fichiers VARCHAR(255),
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

-- Assignations Commission (Coordinateur → Membre Commission → Dossier)
CREATE TABLE assignations_commission (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    membre_user_id INT NOT NULL,        -- iduser du membre COMMISSION
    coordinateur_user_id INT,           -- iduser du COORDINATEUR
    date_assignation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE,
    FOREIGN KEY (membre_user_id) REFERENCES users(iduser) ON DELETE CASCADE,
    FOREIGN KEY (coordinateur_user_id) REFERENCES users(iduser) ON DELETE SET NULL,
    UNIQUE KEY unique_dossier_assign (dossier_id)
);


-- Table des détails d'évaluation (Granularité par section)
CREATE TABLE evaluations_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dossier_id INT NOT NULL,
    section_key VARCHAR(50) NOT NULL, -- ex: 'ens_licence', 'recherche', etc.
    note DECIMAL(5,2),
    commentaire TEXT,
    FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_eval (dossier_id, section_key)
);

-- Notifications utilisateur
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    lien VARCHAR(500) DEFAULT NULL,
    lu TINYINT(1) DEFAULT 0,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(iduser) ON DELETE CASCADE
);

-- Table de log d'audit pour les imports en masse
CREATE TABLE import_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT NOT NULL,
    date_import DATETIME DEFAULT CURRENT_TIMESTAMP,
    fichier_nom VARCHAR(255),
    total_lignes INT DEFAULT 0,
    lignes_creees INT DEFAULT 0,
    lignes_erreur INT DEFAULT 0,
    statut ENUM('succès', 'partiel', 'échec') DEFAULT 'succès',
    rapport LONGTEXT,
    FOREIGN KEY (admin_user_id) REFERENCES users(iduser) ON DELETE CASCADE
);
