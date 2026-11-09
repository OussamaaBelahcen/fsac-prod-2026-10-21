// ============================================
// UTILITAIRES GÉNÉRAUX
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// ÉTAPE 5 : ACTIVITÉS DE RECHERCHE
// ============================================

/**
 * Valide qu'une chaîne est une URL HTTP/HTTPS valide
 */
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

/**
 * Valide et formate une URL de publication
 */
function validateAndFormatUrl(url) {
    if (!url || url.trim() === '') {
        return { valid: false, message: 'Le lien de publication est obligatoire' };
    }

    const trimmedUrl = url.trim();

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        return { valid: false, message: 'L\'URL doit commencer par http:// ou https://' };
    }

    if (!isValidUrl(trimmedUrl)) {
        return { valid: false, message: 'Veuillez entrer une URL valide (ex: https://doi.org/10.1000/182)' };
    }

    const urlPattern = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;
    if (!urlPattern.test(trimmedUrl)) {
        return { valid: false, message: 'Format d\'URL invalide. Veuillez entrer une URL complète.' };
    }

    return { valid: true, url: trimmedUrl };
}

/**
 * Valide tous les liens dans les sections AR1-1 à AR1-4
 */
function validateAR1Links() {
    const errors = [];
    const sectionNames = {
        1: 'AR 1-1 Publications scientifiques dans des revues spécialisées indexées (Scopus, Webof Knowledge)',
        2: 'AR 1-2 Publications dans les actes de manifestations scientifiques avec comité de lecture',
        3: 'AR 1-3 Ouvrages de recherche édités (livres ou chapitres de livres)',
        4: 'AR 1-4 Publications scientifiques dans des revues spécialisées nationales ou internationales avec comité de lecture',
    };

    for (let ar1Num = 1; ar1Num <= 4; ar1Num++) {
        const ar1Table = document.querySelector(`#table-ar1-${ar1Num} tbody`);
        if (ar1Table) {
            const rows = Array.from(ar1Table.querySelectorAll('tr'));
            rows.forEach((row, index) => {
                const lienInput = row.querySelector('[name="lien"]');
                if (lienInput) {
                    const value = lienInput.value.trim();
                    if (value) {
                        const validation = validateAndFormatUrl(value);
                        if (!validation.valid) {
                            errors.push(`${sectionNames[ar1Num]} - Ligne ${index + 1}: ${validation.message}`);
                        }
                    }
                }
            });
        }
    }

    return errors;
}

/**
 * Valide les données de l'étape 5 (liens AR1)
 */
function validateStep5Data() {
    const validationErrors = validateAR1Links();
    if (validationErrors.length > 0) {
        alert('Erreurs de validation des liens de publication:\n\n' + validationErrors.join('\n\n'));
        return false;
    }
    return true;
}

/**
 * Sauvegarde l'étape 5 (Activités de recherche)
 * @param {string|null} dossierId - ID du dossier en cours (optionnel)
 * @returns {Promise<string|null>} - Retourne le dossierId mis à jour ou null en cas d'erreur
 */
async function saveStep5(dossierId = null) {
    if (!validateStep5Data()) {
        return dossierId; // validation échouée → pas de sauvegarde
    }

    const formData = new FormData();

    // === AR1 : Liens de publications ===
    for (let ar1Num = 1; ar1Num <= 4; ar1Num++) {
        const ar1Table = document.querySelector(`#table-ar1-${ar1Num} tbody`);
        if (ar1Table) {
            const rows = Array.from(ar1Table.querySelectorAll('tr'));
            const liens = [];
            rows.forEach(row => {
                const lienInput = row.querySelector('[name="lien"]');
                if (lienInput && lienInput.value.trim()) {
                    const validation = validateAndFormatUrl(lienInput.value.trim());
                    if (validation.valid) {
                        liens.push(validation.url);
                    }
                }
            });
            const lienKey = ar1Num === 1 ? 'ar1_1_publications' :
                ar1Num === 2 ? 'ar1_2_actes' :
                    ar1Num === 3 ? 'ar1_3_ouvrages' : 'ar1_4_revues';
            formData.append(lienKey, liens.join('\n'));
            formData.append(`${lienKey}_json`, JSON.stringify(liens));
        }
    }

    // === AR2 : Fichiers (2 sections) ===
    for (let ar2Num = 1; ar2Num <= 2; ar2Num++) {
        const ar2Table = document.querySelector(`#table-ar2-${ar2Num} tbody`);
        if (ar2Table) {
            const rows = Array.from(ar2Table.querySelectorAll('tr'));
            const ar2_rows = [];
            rows.forEach((row, idx) => {
                ar2_rows.push({});
                const hiddenFileInput = row.querySelector(`.ar2${ar2Num}-hidden-file`);
                if (hiddenFileInput && hiddenFileInput.files[0]) {
                    formData.append(`ar2${ar2Num}_file_${idx}`, hiddenFileInput.files[0]);
                }
            });
            formData.append(`ar2_${ar2Num}_rows`, JSON.stringify(ar2_rows));
        }
    }

    // === AR3 : Fichiers (4 sections) ===
    for (let ar3Num = 1; ar3Num <= 4; ar3Num++) {
        const ar3Table = document.querySelector(`#table-ar3-${ar3Num} tbody`);
        if (ar3Table) {
            const rows = Array.from(ar3Table.querySelectorAll('tr'));
            const ar3_rows = [];
            rows.forEach((row, idx) => {
                ar3_rows.push({});
                const hiddenFileInput = row.querySelector(`.ar3${ar3Num}-hidden-file`);
                if (hiddenFileInput && hiddenFileInput.files[0]) {
                    formData.append(`ar3${ar3Num}_file_${idx}`, hiddenFileInput.files[0]);
                }
            });
            formData.append(`ar3_${ar3Num}_rows`, JSON.stringify(ar3_rows));
        }
    }

    // === AR4 : Fichiers (3 sections) ===
    for (let ar4Num = 1; ar4Num <= 3; ar4Num++) {
        const ar4Table = document.querySelector(`#table-ar4-${ar4Num} tbody`);
        if (ar4Table) {
            const rows = Array.from(ar4Table.querySelectorAll('tr'));
            const ar4_rows = [];
            rows.forEach((row, idx) => {
                ar4_rows.push({});
                const hiddenFileInput = row.querySelector(`.ar4${ar4Num}-hidden-file`);
                if (hiddenFileInput && hiddenFileInput.files[0]) {
                    formData.append(`ar4${ar4Num}_file_${idx}`, hiddenFileInput.files[0]);
                }
            });
            formData.append(`ar4_${ar4Num}_rows`, JSON.stringify(ar4_rows));
        }
    }

    // === Envoi de la requête ===
    const response = await fetch('/api/save-step5', {
        method: 'POST',
        body: formData // FormData → pas besoin de définir Content-Type
    });
    const result = await response.json();

    if (result.success) {
        showSaveIndicator();
        if (result.dossier_id) dossierId = result.dossier_id;

        // === Mise à jour de l'interface : AR2, AR3, AR4 ===
        const arSections = [
            { prefix: 'ar2', count: 2 },
            { prefix: 'ar3', count: 4 },
            { prefix: 'ar4', count: 3 }
        ];

        arSections.forEach(section => {
            for (let arNum = 1; arNum <= section.count; arNum++) {
                const filenamesKey = `${section.prefix}_${arNum}_new_filenames`;
                if (result[filenamesKey]) {
                    const arTable = document.querySelector(`#table-${section.prefix}-${arNum} tbody`);
                    if (arTable) {
                        const rows = arTable.querySelectorAll('tr');
                        result[filenamesKey].forEach((newName, idx) => {
                            if (rows[idx]) {
                                const cell = rows[idx].cells[0];
                                const hiddenInputClass = `${section.prefix}${arNum}-hidden-file`;
                                if (newName && newName !== 'Aucun fichier') {
                                    const fileNameOnly = newName.split('/').pop();
                                    cell.innerHTML = `
                                        <a href="/static/${escapeHtml(newName)}" target="_blank" class="file-link">
                                            ${escapeHtml(fileNameOnly)}
                                        </a>
                                        <input type="file" class="${hiddenInputClass}" style="display:none;" accept=".pdf" />
                                    `;
                                } else {
                                    cell.innerHTML = `
                                        <span class="file-display">Aucun fichier</span>
                                        <input type="file" class="${hiddenInputClass}" style="display:none;" accept=".pdf" />
                                    `;
                                }
                            }
                        });
                    }
                }
            }
        });
    } else {
        alert('Erreur lors de la sauvegarde : ' + (result.message || 'Une erreur inconnue est survenue.'));
    }

    return dossierId;
}

// ============================================
// Exemple d’utilisation (dans un gestionnaire d'événement)
// ============================================

// let currentDossierId = null;
// document.getElementById('save-step5-btn').addEventListener('click', async () => {
//     currentDossierId = await saveStep5(currentDossierId);
// });