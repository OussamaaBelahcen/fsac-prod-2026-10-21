ALTER TABLE ae2_1_encadrements
ADD COLUMN ae2_1_type_encadrement VARCHAR(20) DEFAULT 'cours_td_tp';

-- Pour les données existantes : deviner le type selon les champs remplis
-- Si le champ 'details' (intitule_pfe) est rempli → pfe, sinon → cours_td_tp
UPDATE ae2_1_encadrements
SET ae2_1_type_encadrement = 'pfe'
WHERE ae2_1_details IS NOT NULL AND TRIM(ae2_1_details) != '';
