// ============================================
// ÉTAPE 2 : ENSEIGNEMENTS
// ============================================

/**
 * Sauvegarde les données de l'étape 2 (Enseignements)
 * @returns {Promise<Object>} Résultat de la sauvegarde
 */
async function saveStep2() {
    const payload = JSON.stringify(getStep2FormData());

    const response = await fetch('/api/save-step2', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' }
    });

    return await response.json();
}

/**
 * Extrait les données des tableaux de l'étape 2
 * @returns {FormData} Données formatées avec fichiers
 */
function getStep2FormData() {
    const formData = new FormData();

    const licenceTable = document.querySelector('#table-licence tbody');
    const encadrementLicenceTable = document.querySelector('#table-encadrement-licence tbody');
    const masterTable = document.querySelector('#table-master tbody');
    const encadrementMasterTable = document.querySelector('#table-encadrement-master tbody');

    // 1. Enseignements Licence
    const enseignements_licence = Array.from(licenceTable.querySelectorAll('tr')).map(row => ({
        annee_univ: row.cells[0].querySelector('input').value,
        filiere: row.cells[1].querySelector('input').value,
        semestre: row.cells[2].querySelector('input').value,
        cours: row.cells[3].querySelector('input').value,
        vh_cours: parseInt(row.cells[4].querySelector('input').value) || 0,
        td: row.cells[5].querySelector('input').value,
        vh_td: parseInt(row.cells[6].querySelector('input').value) || 0,
        tp: row.cells[7].querySelector('input').value,
        vh_tp: parseInt(row.cells[8].querySelector('input').value) || 0
    }));
    formData.append('enseignements_licence', JSON.stringify(enseignements_licence));

    // 2. Encadrements Licence (Avec fichiers)
    const encadrements_licence_rows = [];
    Array.from(encadrementLicenceTable.querySelectorAll('tr')).forEach((row, idx) => {
        encadrements_licence_rows.push({
            annee_univ: row.cells[0].querySelector('input').value,
            type_licence: row.cells[1].querySelector('input').value,
            titre_pfe: row.cells[2].querySelector('input').value,
            etudiants: row.cells[3].querySelector('input').value,
            nom_encadrants: row.cells[4].querySelector('input').value,
            // On ne stocke plus le chemin ici pour le nouvel envoi, mais on peut garder l'info "old"
            // Le backend gérera la logique "si fichier envoyé -> nouveau chemin, sinon garder ancien"
        });

        const hiddenFileInput = row.querySelector('.step2-hidden-file');
        if (hiddenFileInput && hiddenFileInput.files[0]) {
            formData.append(`enc_licence_file_${idx}`, hiddenFileInput.files[0]);
        }
    });
    formData.append('encadrements_licence', JSON.stringify(encadrements_licence_rows));

    // 3. Enseignements Master
    const enseignements_master = Array.from(masterTable.querySelectorAll('tr')).map(row => ({
        annee_univ: row.cells[0].querySelector('input').value,
        filiere: row.cells[1].querySelector('input').value,
        semestre: row.cells[2].querySelector('input').value,
        cours_td_tp: row.cells[3].querySelector('input').value,
        vh: parseInt(row.cells[4].querySelector('input').value) || 0
    }));
    formData.append('enseignements_master', JSON.stringify(enseignements_master));

    // 4. Encadrements Master (Avec fichiers)
    const encadrements_master_rows = [];
    Array.from(encadrementMasterTable.querySelectorAll('tr')).forEach((row, idx) => {
        encadrements_master_rows.push({
            annee_univ: row.cells[0].querySelector('input').value,
            filiere: row.cells[1].querySelector('input').value,
            type_master: row.cells[2].querySelector('input').value,
            titre_memoire: row.cells[3].querySelector('input').value,
            nom_etudiants: row.cells[4].querySelector('input').value,
            nom_encadrants: row.cells[5].querySelector('input').value,
        });

        const hiddenFileInput = row.querySelector('.step2-hidden-file');
        if (hiddenFileInput && hiddenFileInput.files[0]) {
            formData.append(`enc_master_file_${idx}`, hiddenFileInput.files[0]);
        }
    });
    formData.append('encadrements_master', JSON.stringify(encadrements_master_rows));

    // Indicateur pour main.js
    formData._isFormData = true;
    return formData;
}

/**
 * Charge les données de l'étape 2
 * @param {Object} data - Données à charger
 */
function loadStep2Data(data) {
    if (!data) return;

    if (data.enseignements_licence) {
        loadTableData('table-licence', data.enseignements_licence);
    }
    if (data.encadrements_licence) {
        loadTableData('table-encadrement-licence', data.encadrements_licence);
    }
    if (data.enseignements_master) {
        loadTableData('table-master', data.enseignements_master);
    }
    if (data.encadrements_master) {
        loadTableData('table-encadrement-master', data.encadrements_master);
    }
}
