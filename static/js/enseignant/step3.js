// ============================================
// ÉTAPE 3 : RESPONSABILITÉS PÉDAGOGIQUES
// ============================================

/**
 * Sauvegarde les données de l'étape 3 (Responsabilités)
 * @returns {Promise<Object>} Résultat de la sauvegarde
 */
async function saveStep3() {
    const payload = JSON.stringify(getStep3FormData());

    const response = await fetch('/api/save-step3', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' }
    });

    return await response.json();
}

/**
 * Extrait les données du tableau de l'étape 3
 * @returns {Object} Données formatées pour l'API
 */
function getStep3FormData() {
    const data = {};
    const table = document.querySelector('#table-responsabilites tbody');

    data.responsabilites = Array.from(table.querySelectorAll('tr')).map(row => ({
        annees_univ: row.cells[0].querySelector('input').value,
        filiere: row.cells[1].querySelector('input').value,
        semestre: row.cells[2].querySelector('input').value,
        intitule_module: row.cells[3].querySelector('input').value,
        cycle: row.cells[4].querySelector('input').value
    }));

    return data;
}

/**
 * Charge les données de l'étape 3
 * @param {Object} data - Données à charger
 */
function loadStep3Data(data) {
    if (!data || !data.responsabilites) return;
    loadTableData('table-responsabilites', data.responsabilites);
}
