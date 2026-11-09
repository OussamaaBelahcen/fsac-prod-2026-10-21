// ============================================
// ÉTAPE 4 : ACTIVITÉS D'ENSEIGNEMENT
// ============================================

/**
 * Sauvegarde les données de l'étape 4 (Activités d'enseignement)
 * @returns {Promise<Object>} Résultat de la sauvegarde
 */
async function saveStep4() {
    if (!validateStep4Data()) {
        return { success: false, message: 'Validation échouée' };
    }
    const payload = getStep4FormData();

    const response = await fetch('/api/save-step4', {
        method: 'POST',
        body: payload
    });

    return await response.json();
}

function isHttpOrHttpsPrefixedUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
}

function validateUrlList(value) {
    const raw = String(value || '').trim();
    if (!raw) return { valid: true };
    const parts = raw.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    const invalid = parts.find(p => !isHttpOrHttpsPrefixedUrl(p));
    if (invalid) return { valid: false, invalid };
    return { valid: true };
}

function validateStep4Data() {
    const errors = [];

    // AE1-3 : Liens d'accès
    const ae13Table = document.querySelector('#table-ae1-3 tbody');
    if (ae13Table) {
        const rows = Array.from(ae13Table.querySelectorAll('tr'));
        rows.forEach((row, idx) => {
            const liensValue = row.querySelector('[name="liens"]')?.value || '';
            const res = validateUrlList(liensValue);
            if (!res.valid) {
                errors.push(`AE1-3 - Ligne ${idx + 1}: chaque lien doit commencer par http:// ou https://`);
            }
        });
    }

    if (errors.length > 0) {
        alert('Erreurs de validation des liens (Étape 4):\n\n' + errors.join('\n'));
        return false;
    }
    return true;
}

/**
 * Extrait les données de l'étape 4 pour envoi via FormData (avec fichiers justificatifs)
 * @returns {FormData} Objet FormData contenant toutes les lignes et tous les fichiers AE
 */
function getStep4FormData() {
    const formData = new FormData();

    // Sections standards à collecter
    const sections = ['ae1-1', 'ae1-2', 'ae1-3', 'ae2-1', 'ae2-2', 'ae2-3', 'ae3-1', 'ae3-2', 'ae3-3', 'ae3-4', 'ae3-5', 'ae3-6', 'ae3-7'];
    sections.forEach(section => {
        if (typeof getRequirementsRowData === 'function') {
            const rows = Array.from(document.querySelectorAll(`#table-${section} tbody tr`)).map(getRequirementsRowData);
            formData.append(`${section.replace(/-/g, '_')}_rows_json`, JSON.stringify(rows));
        }
    });

    // AE1-1 (tableau) → sérialiser en colonnes avec fichiers
    const ae11Table = document.querySelector('#table-ae1-1 tbody');
    if (ae11Table) {
        const rows = Array.from(ae11Table.querySelectorAll('tr'));
        const ae1_1_rows = [];
        rows.forEach((row, idx) => {
            ae1_1_rows.push({
                titres: row.querySelector('[name="titres"]')?.value || '',
                auteurs: row.querySelector('[name="auteurs"]')?.value || '',
                niveaux: row.querySelector('[name="niveaux"]')?.value || '',
                editeurs: row.querySelector('[name="editeurs"]')?.value || '',
                annees: row.querySelector('[name="annees"]')?.value || '',
                numero_depot: row.querySelector('[name="numero_depot"]')?.value || ''
            });
            const hiddenFileInput = row.querySelector('.ae11-hidden-file');
            if (hiddenFileInput && hiddenFileInput.files[0]) {
                formData.append(`ae11_file_${idx}`, hiddenFileInput.files[0]);
            }
        });
        formData.append('ae1_1_rows', JSON.stringify(ae1_1_rows));
    }

    // Champs libres (textareas) de l'étape 4 (AE2, AE3)
    document.querySelectorAll('#content-2 textarea[name]').forEach(ta => {
        formData.append(ta.name, ta.value || '');
    });

    // Gestion AE1-2
    const ae12Table = document.querySelector('#table-ae1-2 tbody');
    if (ae12Table) {
        const rows = Array.from(ae12Table.querySelectorAll('tr'));
        const ae1_2_rows = [];
        rows.forEach((row, idx) => {
            ae1_2_rows.push({
                auteurs: row.querySelector('[name="auteurs"]')?.value || '',
                departements: row.querySelector('[name="departements"]')?.value || '',
                annees: row.querySelector('[name="annees"]')?.value || '',
                filieres: row.querySelector('[name="filieres"]')?.value || '',
                semestres: row.querySelector('[name="semestres"]')?.value || '',
                types: row.querySelector('[name="types"]')?.value || ''
            });
            const hiddenFileInput = row.querySelector('.ae12-hidden-file');
            if (hiddenFileInput && hiddenFileInput.files[0]) {
                formData.append(`ae12_file_${idx}`, hiddenFileInput.files[0]);
            }
        });
        formData.append('ae1_2_rows', JSON.stringify(ae1_2_rows));
    }

    // Gestion AE1-3
    const ae13Table = document.querySelector('#table-ae1-3 tbody');
    if (ae13Table) {
        const rows = Array.from(ae13Table.querySelectorAll('tr'));
        const ae1_3_rows = [];
        rows.forEach((row, idx) => {
            ae1_3_rows.push({
                objectifs: row.querySelector('[name="objectifs"]')?.value || '',
                auteurs: row.querySelector('[name="auteurs"]')?.value || '',
                filieres: row.querySelector('[name="filieres"]')?.value || '',
                niveaux: row.querySelector('[name="niveaux"]')?.value || '',
                annees: row.querySelector('[name="annees"]')?.value || '',
                liens: row.querySelector('[name="liens"]')?.value || '',
                support_ntic: row.querySelector('[name="support_ntic"]')?.value || '',
                types: row.querySelector('[name="types"]')?.value || ''
            });
            const hiddenFileInput = row.querySelector('.ae13-hidden-file');
            if (hiddenFileInput && hiddenFileInput.files[0]) {
                formData.append(`ae13_file_${idx}`, hiddenFileInput.files[0]);
            }
        });
        formData.append('ae1_3_rows', JSON.stringify(ae1_3_rows));
    }

    // AE2-1 (tableau) → sérialiser en JSON
    const ae21Table = document.querySelector('#table-ae2-1 tbody');
    if (ae21Table) {
        const rows = Array.from(ae21Table.querySelectorAll('tr'));
        const ae2_1_rows = [];
        rows.forEach((row, idx) => {
            ae2_1_rows.push({
                annee_univ: row.querySelector('[name="annee_univ"]')?.value || '',
                type: row.querySelector('[name="type"]')?.value || '',
                intitule_licence: row.querySelector('[name="intitule_licence"]')?.value || '',
                cours_td_tp: row.querySelector('[name="cours_td_tp"]')?.value || '',
                intitule_module: row.querySelector('[name="intitule_module"]')?.value || '',
                intitule_pfe: row.querySelector('[name="intitule_pfe"]')?.value || '',
                modules: row.querySelector('[name="modules"]')?.value || '',
                departements: row.querySelector('[name="departements"]')?.value || '',
                coenseignants: row.querySelector('[name="coenseignants"]')?.value || '',
                type_encadrement: row.querySelector('[name="type_encadrement"]')?.value || ''
            });
            const hiddenFile = row.querySelector('.ae21-hidden-file');
            if (hiddenFile && hiddenFile.files[0]) {
                formData.append('ae21_file_' + idx, hiddenFile.files[0]);
            }
        });
        formData.append('ae2_1_rows', JSON.stringify(ae2_1_rows));
    }

    // AE2-2 (tableau) → sérialiser en JSON
    const ae22Table = document.querySelector('#table-ae2-2 tbody');
    if (ae22Table) {
        const rows = Array.from(ae22Table.querySelectorAll('tr'));
        const ae2_2_rows = [];
        rows.forEach((row, idx) => {
            ae2_2_rows.push({
                annee_univ: row.querySelector('[name="annee_univ"]')?.value || '',
                type: row.querySelector('[name="type"]')?.value || '',
                intitule_master: row.querySelector('[name="intitule_master"]')?.value || '',
                cours: row.querySelector('[name="cours"]')?.value || '',
                intitule_memoire: row.querySelector('[name="intitule_memoire"]')?.value || '',
                coordonnateurs: row.querySelector('[name="coordonnateurs"]')?.value || '',
                coenseignants: row.querySelector('[name="coenseignants"]')?.value || '',
                departements: row.querySelector('[name="departements"]')?.value || ''
            });
            const hiddenFile = row.querySelector('.ae22-hidden-file');
            if (hiddenFile && hiddenFile.files[0]) {
                formData.append('ae22_file_' + idx, hiddenFile.files[0]);
            }
        });
        formData.append('ae2_2_rows', JSON.stringify(ae2_2_rows));
    }

    // AE2-3 (tableau) → sérialiser en JSON
    const ae23Table = document.querySelector('#table-ae2-3 tbody');
    if (ae23Table) {
        const rows = Array.from(ae23Table.querySelectorAll('tr'));
        const ae2_3_rows = [];
        rows.forEach((row, idx) => {
            ae2_3_rows.push({
                type: row.querySelector('[name="type"]')?.value || '',
                etablissement: row.querySelector('[name="etablissement"]')?.value || '',
                dates: row.querySelector('[name="dates"]')?.value || '',
                lieux: row.querySelector('[name="lieux"]')?.value || '',
                periode: row.querySelector('[name="periode"]')?.value || ''
            });
            const hiddenFile = row.querySelector('.ae23-hidden-file');
            if (hiddenFile && hiddenFile.files[0]) {
                formData.append('ae23_file_' + idx, hiddenFile.files[0]);
            }
        });
        formData.append('ae2_3_rows', JSON.stringify(ae2_3_rows));
    }

    // Gestion AE3-1 à AE3-7 (fichiers multiples par sous-section)
    const ae3Fields = {
        1: ['natures', 'periodes', 'mandats'],
        2: ['titres', 'accreditations'],
        3: ['titres', 'filieres', 'periodes'],
        4: ['periodes'],
        5: ['periodes'],
        6: ['periodes'],
        7: ['natures', 'dates', 'lieux']
    };

    for (let ae3Num = 1; ae3Num <= 7; ae3Num++) {
        const ae3Table = document.querySelector(`#table-ae3-${ae3Num} tbody`);
        if (ae3Table) {
            const rows = Array.from(ae3Table.querySelectorAll('tr'));
            const ae3_rows = [];
            const fields = ae3Fields[ae3Num] || [];

            rows.forEach((row, idx) => {
                const rowData = {};
                fields.forEach(field => {
                    rowData[field] = row.querySelector(`[name="${field}"]`)?.value || '';
                });
                ae3_rows.push(rowData);

                const hiddenFileInput = row.querySelector(`.ae3${ae3Num}-hidden-file`);
                if (hiddenFileInput && hiddenFileInput.files[0]) {
                    formData.append(`ae3${ae3Num}_file_${idx}`, hiddenFileInput.files[0]);
                }
            });
            formData.append(`ae3_${ae3Num}_rows`, JSON.stringify(ae3_rows));
        }
    }

    formData._isFormData = true;
    return formData;
}

/**
 * Charge les données de l'étape 4 dans les tableaux de l'interface
 * @param {Object} data - Données contenant les clés ae1_1 à ae3_7
 */
function loadStep4Data(data) {
    if (!data) return;

    const sections = ['ae1_1', 'ae1_2', 'ae1_3', 'ae2_1', 'ae2_2', 'ae2_3', 'ae3_1', 'ae3_2', 'ae3_3', 'ae3_4', 'ae3_5', 'ae3_6', 'ae3_7'];
    sections.forEach(key => {
        if (data[key] && data[key].length > 0) {
            if (typeof loadTableData === 'function') {
                loadTableData(`table-${key.replace('_', '-')}`, data[key]);
            }
        }
    });
}
