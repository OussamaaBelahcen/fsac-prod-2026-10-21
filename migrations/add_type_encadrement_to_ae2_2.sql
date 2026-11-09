ALTER TABLE ae2_2_encadrements
ADD COLUMN ae2_2_type_encadrement VARCHAR(20) DEFAULT 'cours';

-- Pour les données existantes : deviner le type selon les champs remplis
-- Si le champ 'nom_etudiants' (intitule_memoire) est rempli → memoire, sinon → cours
UPDATE ae2_2_encadrements
SET ae2_2_type_encadrement = 'memoire'
WHERE ae2_2_nom_etudiants IS NOT NULL AND TRIM(ae2_2_nom_etudiants) != '';
