// ============================================
// ORCHESTRATION PRINCIPALE
// ============================================

/**
 * Helper function to build correct file URL
 * Handles paths that already start with 'uploads/' to avoid double prefix
 */
function buildFileUrl(filePath) {
    if (!filePath || filePath === 'Aucun fichier') return '';
    const normalized = String(filePath).trim();
    if (normalized.startsWith('uploads/')) {
        return '/static/' + normalized;
    }
    if (normalized.startsWith('/static/uploads/')) {
        return normalized;
    }
    return '';
}

function getRequirementsRowData(row) {
    try {
        return JSON.parse(row.getAttribute('data-requirements-json') || '{}');
    } catch (error) {
        return {};
    }
}

function applyRequirementsRowsJson(stepData, section) {
    if (!stepData) return;
    const key = `${section.replace(/-/g, '_')}_rows_json`;
    if (!stepData[key]) return;
    let rowsData = [];
    try {
        rowsData = JSON.parse(stepData[key]);
    } catch (error) {
        rowsData = [];
    }
    const rows = document.querySelectorAll(`#table-${section} tbody tr`);
    rows.forEach((row, index) => {
        if (rowsData[index]) {
            row.setAttribute('data-requirements-json', JSON.stringify(rowsData[index]));
        }
    });
}


/**
 * Charge les données du formulaire depuis le serveur
 */
async function loadFormData() {
    try {
        const response = await fetch('/api/load-form-data');
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            return;
        }
        const result = await response.json();
        if (!result.success) return;
        const data = result.data;
        dossierId = data.dossier_id;

        if (data.step1) {
            var savedEquipe = data.step1.equipe_recherche || '';
            Object.keys(data.step1).forEach(key => {
                if (key === 'equipe_recherche') return;
                const field = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
                if (key === 'photo' && data.step1[key]) {
                    const photoPath = data.step1[key];
                    const displayPath = photoPath.startsWith('uploads/') ? '/static/' + photoPath : photoPath;

                    const link = document.getElementById('currentPhotoLink');
                    const container = document.getElementById('currentPhotoContainer');
                    const fileNameSpan = document.getElementById('photoFileName');

                    if (link && container) {
                        link.href = displayPath;
                        link.textContent = "Voir la photo actuelle (" + photoPath.split('/').pop() + ")";
                        container.style.display = 'block';
                        container.setAttribute('data-has-photo', 'true');
                    }
                    if (fileNameSpan) {
                        fileNameSpan.textContent = "Fichier actuel : " + photoPath.split('/').pop();
                    }
                } else if (field && data.step1[key]) {
                    if (field.type === 'date') {
                        field.value = data.step1[key].split(' ')[0] || '';
                    } else {
                        field.value = data.step1[key];
                    }
                }
            });
            // Cascade laboratoire → équipe : d'abord le laboratoire a été défini dans la boucle,
            // on déclenche manuellement le change pour remplir l'équipe, puis on restaure sa valeur
            if (savedEquipe) {
                var labField = document.getElementById('laboratoire');
                var eqField = document.getElementById('equipe_recherche');
                if (labField && eqField) {
                    labField.dispatchEvent(new Event('change'));
                    eqField.value = savedEquipe;
                }
            }
        }
        if (data.step4) {
            if (typeof loadStep4Data === 'function') {
                loadStep4Data(data.step4);
            } else {
                ['ae1_1', 'ae1_2', 'ae1_3', 'ae2_1', 'ae2_2', 'ae2_3', 'ae3_1', 'ae3_2', 'ae3_3', 'ae3_4', 'ae3_5', 'ae3_6', 'ae3_7'].forEach(key => {
                    if (data.step4[key] && data.step4[key].length > 0) {
                        loadTableData(`table-${key.replace('_', '-')}`, data.step4[key]);
                    }
                });
            }
        }
        // Charger les données AR depuis la DB
        if (data.step5) {
            // Charger les données détaillées AR si disponibles
            ['ar1-1', 'ar1-2', 'ar1-3', 'ar1-4', 'ar2-1', 'ar2-2', 'ar3-1', 'ar3-2', 'ar3-3', 'ar3-4', 'ar4-1', 'ar4-2', 'ar4-3'].forEach(section => {
                const key = section.replace(/-/g, '_');
                if (Array.isArray(data.step5[key]) && data.step5[key].length > 0) {
                    loadTableData(`table-${section}`, data.step5[key]);
                }
            });

            // Compatibilité avec les anciennes données AR1 (liens séparés par \n)
            for (let ar1Num = 1; ar1Num <= 4; ar1Num++) {
                let lienKey;
                if (ar1Num === 1) lienKey = 'ar1_1_publications';
                else if (ar1Num === 2) lienKey = 'ar1_2_actes';
                else if (ar1Num === 3) lienKey = 'ar1_3_ouvrages';
                else lienKey = 'ar1_4_revues';
                const sectionKey = `ar1_${ar1Num}`;
                if ((!Array.isArray(data.step5[sectionKey]) || data.step5[sectionKey].length === 0) && data.step5[lienKey]) {
                    const liens = (data.step5[lienKey] || '').split('\n').filter(l => l.trim());
                    const ar1_data = liens.map((lien) => ({
                        lien: lien
                    }));
                    loadTableData(`table-ar1-${ar1Num}`, ar1_data);
                }
            }
            // Compatibilité avec les anciennes données AR2, AR3, AR4 (fichiers séparés par \n)
            for (let ar2Num = 1; ar2Num <= 2; ar2Num++) {
                const fichierKey = `ar2_${ar2Num}_fichiers`;
                const sectionKey = `ar2_${ar2Num}`;
                if ((!Array.isArray(data.step5[sectionKey]) || data.step5[sectionKey].length === 0) && data.step5[fichierKey]) {
                    const fichiers = (data.step5[fichierKey] || '').split('\n').filter(f => f.trim());
                    const ar2_data = fichiers.map((fichier) => ({
                        PDF: fichier
                    }));
                    loadTableData(`table-ar2-${ar2Num}`, ar2_data);
                }
            }
            for (let ar3Num = 1; ar3Num <= 4; ar3Num++) {
                const fichierKey = `ar3_${ar3Num}_fichiers`;
                const sectionKey = `ar3_${ar3Num}`;
                if ((!Array.isArray(data.step5[sectionKey]) || data.step5[sectionKey].length === 0) && data.step5[fichierKey]) {
                    const fichiers = (data.step5[fichierKey] || '').split('\n').filter(f => f.trim());
                    const ar3_data = fichiers.map((fichier) => ({
                        PDF: fichier
                    }));
                    loadTableData(`table-ar3-${ar3Num}`, ar3_data);
                }
            }
            for (let ar4Num = 1; ar4Num <= 3; ar4Num++) {
                const fichierKey = `ar4_${ar4Num}_fichiers`;
                const sectionKey = `ar4_${ar4Num}`;
                if ((!Array.isArray(data.step5[sectionKey]) || data.step5[sectionKey].length === 0) && data.step5[fichierKey]) {
                    const fichiers = (data.step5[fichierKey] || '').split('\n').filter(f => f.trim());
                    const ar4_data = fichiers.map((fichier) => ({
                        PDF: fichier
                    }));
                    loadTableData(`table-ar4-${ar4Num}`, ar4_data);
                }
            }
        }

        ['ae1-1', 'ae1-2', 'ae1-3', 'ae2-1', 'ae2-2', 'ae2-3', 'ae3-1', 'ae3-2', 'ae3-3', 'ae3-4', 'ae3-5', 'ae3-6', 'ae3-7'].forEach(section => {
            applyRequirementsRowsJson(data.step4, section);
        });
        ['ar1-1', 'ar1-2', 'ar1-3', 'ar1-4', 'ar2-1', 'ar2-2', 'ar3-1', 'ar3-2', 'ar3-3', 'ar3-4', 'ar4-1', 'ar4-2', 'ar4-3'].forEach(section => {
            applyRequirementsRowsJson(data.step5, section);
        });

        // Appliquer les contraintes de période d'avancement
        if (data.step1 && typeof setDateConstraints === 'function') {
            const debut = data.step1.date_debut_avancement || '';
            const fin = data.step1.date_fin_avancement || '';
            if (debut && fin) {
                setDateConstraints(debut, fin);
            } else {
                // Période non renseignée → afficher un message d'alerte
                const msg = document.createElement('div');
                msg.id = 'period-warning';
                msg.style.cssText = 'background:#fff3cd;color:#856404;border:1px solid #ffeeba;padding:12px 16px;margin-bottom:16px;border-radius:6px;font-size:0.95rem;';
                msg.textContent = '⚠ Période d\'avancement non définie. Veuillez contacter l\'administration pour renseigner votre date de début et de fin d\'avancement avant de saisir vos activités.';
                const container = document.getElementById('step-content') || document.querySelector('.step-content') || document.body;
                container.insertBefore(msg, container.firstChild);
            }
        }

        // Appliquer le mode lecture seule après le chargement des données
        setReadOnlyMode();

        // Marquer les étapes sauvegardées (utilisé lors de la navigation entre étapes)
        savedSteps = {};
        if (data.step1 && data.step1.nom) savedSteps[1] = true;
        if (data.step4) savedSteps[2] = true;
        if (data.step5) savedSteps[3] = true;

        // Activer le bouton Suivant si l'étape courante est déjà sauvegardée
        if (savedSteps[currentStep]) {
            enableNextButton(currentStep);
        } else {
            disableNextButton(currentStep);
        }
        // Surveiller les modifications de champs → griser le bouton jusqu'au prochain Enregistrer
        if (typeof watchStepForChanges === 'function') {
            watchStepForChanges(currentStep);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
    }
}

function enableNextButton(step) {
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
    }
}

function disableNextButton(step) {
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.setAttribute('disabled', 'disabled');
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
    }
}

// Grise le bouton Suivant dès que l'utilisateur modifie un champ de l'étape active
function watchStepForChanges(step) {
    const container = document.getElementById('content-' + step);
    if (!container) return;
    const handler = () => { disableNextButton(step); };
    container.querySelectorAll('input, select, textarea').forEach(el => {
        el.removeEventListener('input', handler);
        el.removeEventListener('change', handler);
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    });
}

function loadTableData(tableId, data) {
    if (!data || data.length === 0) return;
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    data.forEach(rowData => {
        const newRow = document.createElement('tr');
        newRow.setAttribute('data-row-id', nextRowId++);
        newRow.setAttribute('data-requirements-json', JSON.stringify(rowData));
        const dbRowId = rowData.row_id || rowData.id;
        if (dbRowId) {
            newRow.setAttribute('data-db-id', dbRowId);
        }
        let innerHTML = '';

        if (tableId === 'table-licence') {
            innerHTML = `
                <td><input type="text" name="annee_univ" value="${escapeHtml(rowData.annee_univ)}" readonly></td>
                <td><input type="text" name="filiere" value="${escapeHtml(rowData.filiere)}" readonly></td>
                <td><input type="text" name="semestre" value="${escapeHtml(rowData.semestre)}" readonly></td>
                <td><input type="text" name="cours" value="${escapeHtml(rowData.cours)}" readonly></td>
                <td><input type="number" name="vh_cours" value="${rowData.vh_cours}" readonly></td>
                <td><input type="text" name="td" value="${escapeHtml(rowData.td)}" readonly></td>
                <td><input type="number" name="vh_td" value="${rowData.vh_td}" readonly></td>
                <td><input type="text" name="tp" value="${escapeHtml(rowData.tp)}" readonly></td>
                <td><input type="number" name="vh_tp" value="${rowData.vh_tp}" readonly></td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
        } else if (tableId === 'table-encadrement-licence') {
            innerHTML = `
                <td><input type="text" name="annee_univ" value="${escapeHtml(rowData.annee_univ)}" readonly></td>
                <td><input type="text" name="type_licence" value="${escapeHtml(rowData.type_licence)}" readonly></td>
                <td><input type="text" name="titre_pfe" value="${escapeHtml(rowData.titre_pfe)}" readonly></td>
                <td><input type="text" name="etudiants" value="${escapeHtml(rowData.etudiants)}" readonly></td>
                <td><input type="text" name="nom_encadrants" value="${escapeHtml(rowData.nom_encadrants)}" readonly></td>
                <td>
                    ${rowData.page_de_garde ? `<a href="/static/${rowData.page_de_garde}" target="_blank" class="file-link">Voir fichier</a>` : '<span class="file-display">Aucun fichier</span>'}
                </td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
            if (rowData.page_de_garde) {
                newRow.setAttribute('data-page-de-garde', rowData.page_de_garde);
            }
        } else if (tableId === 'table-master') {
            innerHTML = `
                <td><input type="text" name="annee_univ" value="${escapeHtml(rowData.annee_univ)}" readonly></td>
                <td><input type="text" name="filiere" value="${escapeHtml(rowData.filiere)}" readonly></td>
                <td><input type="text" name="semestre" value="${escapeHtml(rowData.semestre)}" readonly></td>
                <td><input type="text" name="cours_td_tp" value="${escapeHtml(rowData.cours_td_tp)}" readonly></td>
                <td><input type="number" name="vh" value="${rowData.vh}" readonly></td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
        } else if (tableId === 'table-encadrement-master') {
            innerHTML = `
                <td><input type="text" name="annee_univ" value="${escapeHtml(rowData.annee_univ)}" readonly></td>
                <td><input type="text" name="filiere" value="${escapeHtml(rowData.filiere)}" readonly></td>
                <td><input type="text" name="type_master" value="${escapeHtml(rowData.type_master)}" readonly></td>
                <td><input type="text" name="titre_memoire" value="${escapeHtml(rowData.titre_memoire)}" readonly></td>
                <td><input type="text" name="nom_etudiants" value="${escapeHtml(rowData.nom_etudiants)}" readonly></td>
                <td><input type="text" name="nom_encadrants" value="${escapeHtml(rowData.nom_encadrants)}" readonly></td>
                <td>
                    ${rowData.page_de_garde ? `<a href="/static/${rowData.page_de_garde}" target="_blank" class="file-link">Voir fichier</a>` : '<span class="file-display">Aucun fichier</span>'}
                </td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
            if (rowData.page_de_garde) {
                newRow.setAttribute('data-page-de-garde', rowData.page_de_garde);
            }
        } else if (tableId === 'table-responsabilites') {
            innerHTML = `
                <td><input type="text" name="annees_univ" value="${escapeHtml(rowData.annees_univ)}" readonly></td>
                <td><input type="text" name="filiere" value="${escapeHtml(rowData.filiere)}" readonly></td>
                <td><input type="text" name="semestre" value="${escapeHtml(rowData.semestre)}" readonly></td>
                <td><input type="text" name="intitule_module" value="${escapeHtml(rowData.intitule_module)}" readonly></td>
                <td><input type="text" name="cycle" value="${escapeHtml(rowData.cycle)}" readonly></td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
        } else if (tableId === 'table-ae1-1') {
            const pdfName = rowData.PDF || '';
            const fileUrl = buildFileUrl(pdfName);
            const fileNameOnly = pdfName.split('/').pop();
            const fileCell = fileUrl
                ? `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a>`
                : '<span class="file-display">Aucun fichier</span>';
            innerHTML = `
                <td><input type="text" name="titres" value="${escapeHtml(rowData.titres)}" readonly></td>
                <td><input type="text" name="auteurs" value="${escapeHtml(rowData.auteurs)}" readonly></td>
                <td><input type="text" name="niveaux" value="${escapeHtml(rowData.niveaux)}" readonly></td>
                <td><input type="text" name="editeurs" value="${escapeHtml(rowData.editeurs)}" readonly></td>
                <td><input type="text" name="annees" value="${escapeHtml(rowData.annees)}" readonly></td>
                <td><input type="text" name="numero_depot" value="${escapeHtml(rowData.numero_depot)}" readonly></td>
                <td>${fileCell}</td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
        } else if (tableId === 'table-ae1-2') {
            const pdfName = rowData.PDF || '';
            const fileUrl = buildFileUrl(pdfName);
            const fileNameOnly = pdfName.split('/').pop();
            const fileCell = fileUrl
                ? `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a>`
                : '<span class="file-display">Aucun fichier</span>';
            innerHTML = `
                <td><input type="text" name="auteurs" value="${escapeHtml(rowData.auteurs)}" readonly></td>
                <td><input type="text" name="departements" value="${escapeHtml(rowData.departements)}" readonly></td>
                <td><input type="text" name="annees" value="${escapeHtml(rowData.annees)}" readonly></td>
                <td><input type="text" name="filieres" value="${escapeHtml(rowData.filieres)}" readonly></td>
                <td><input type="text" name="semestres" value="${escapeHtml(rowData.semestres)}" readonly></td>
                <td><input type="text" name="types" value="${escapeHtml(rowData.types || '')}" readonly></td>
                <td>${fileCell}</td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
        } else if (tableId === 'table-ae1-3') {
            const pdfName = rowData.PDF || '';
            const fileUrl = buildFileUrl(pdfName);
            const fileNameOnly = pdfName.split('/').pop();
            const fileCell = fileUrl
                ? `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a>`
                : '<span class="file-display">Aucun fichier</span>';
            innerHTML = `
                <td><input type="text" name="objectifs" value="${escapeHtml(rowData.objectifs)}" readonly></td>
                <td><input type="text" name="auteurs" value="${escapeHtml(rowData.auteurs)}" readonly></td>
                <td><input type="text" name="filieres" value="${escapeHtml(rowData.filieres)}" readonly></td>
                <td><input type="text" name="niveaux" value="${escapeHtml(rowData.niveaux)}" readonly></td>
                <td><input type="text" name="annees" value="${escapeHtml(rowData.annees)}" readonly></td>
                <td><input type="text" name="liens" value="${escapeHtml(rowData.liens)}" readonly></td>
                <td><input type="text" name="support_ntic" value="${escapeHtml(rowData.support_ntic || '')}" readonly></td>
                <td><input type="text" name="types" value="${escapeHtml(rowData.types || '')}" readonly></td>
                <td>${fileCell}</td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
        } else if (tableId === 'table-ae2-1') {
            innerHTML = `
                <td><input type="text" name="annee_univ" value="${escapeHtml(rowData.annee_univ)}" readonly></td>
                <td><input type="text" name="type" value="${escapeHtml(rowData.type)}" readonly></td>
                <td><input type="text" name="intitule_licence" value="${escapeHtml(rowData.intitule_licence || '')}" readonly></td>
                <td><input type="text" name="cours_td_tp" value="${escapeHtml(rowData.cours_td_tp || '')}" readonly></td>
                <td><input type="text" name="intitule_module" value="${escapeHtml(rowData.intitule_module || '')}" readonly></td>
                <td><input type="text" name="intitule_pfe" value="${escapeHtml(rowData.intitule_pfe || '')}" readonly></td>
                <td><input type="text" name="modules" value="${escapeHtml(rowData.modules || '')}" readonly></td>
                <td><input type="text" name="departements" value="${escapeHtml(rowData.departements || '')}" readonly></td>
                <td><input type="text" name="coenseignants" value="${escapeHtml(rowData.coenseignants || '')}" readonly></td>
                <td><input type="hidden" name="type_encadrement" value="${escapeHtml(rowData.type_encadrement || (rowData.intitule_pfe ? 'pfe' : 'cours_td_tp'))}"><span>${escapeHtml((rowData.type_encadrement || (rowData.intitule_pfe ? 'pfe' : 'cours_td_tp')) === 'pfe' ? 'Encadrement de PFE' : 'Cours, TD et/ou TP')}</span></td>
                <td>${rowData.PDF ? '<a href="' + buildFileUrl(rowData.PDF) + '" target="_blank" class="file-link">Voir fichier</a>' : '<span class="file-display">Aucun fichier</span>'}</td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
        } else if (tableId === 'table-ae2-2') {
            innerHTML = `
                <td><input type="text" name="annee_univ" value="${escapeHtml(rowData.annee_univ)}" readonly></td>
                <td><input type="text" name="type" value="${escapeHtml(rowData.type)}" readonly></td>
                <td><input type="text" name="intitule_master" value="${escapeHtml(rowData.intitule_master || '')}" readonly></td>
                <td><input type="text" name="cours" value="${escapeHtml(rowData.cours || '')}" readonly></td>
                <td><input type="text" name="intitule_memoire" value="${escapeHtml(rowData.intitule_memoire || '')}" readonly></td>
                <td><input type="text" name="coordonnateurs" value="${escapeHtml(rowData.coordonnateurs || '')}" readonly></td>
                <td><input type="text" name="coenseignants" value="${escapeHtml(rowData.coenseignants || '')}" readonly></td>
                <td><input type="text" name="departements" value="${escapeHtml(rowData.departements || '')}" readonly></td>
                <td><input type="hidden" name="type_encadrement" value="${escapeHtml(rowData.type_encadrement || (rowData.intitule_memoire ? 'memoire' : 'cours'))}"><span>${escapeHtml((rowData.type_encadrement || (rowData.intitule_memoire ? 'memoire' : 'cours')) === 'memoire' ? 'Encadrement de mémoire' : 'Cours')}</span></td>
                <td>${rowData.PDF ? '<a href="' + buildFileUrl(rowData.PDF) + '" target="_blank" class="file-link">Voir fichier</a>' : '<span class="file-display">Aucun fichier</span>'}</td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
        } else if (tableId === 'table-ae2-3') {
            innerHTML = `
                <td><input type="text" name="type" value="${escapeHtml(rowData.type)}" readonly></td>
                <td><input type="text" name="etablissement" value="${escapeHtml(rowData.etablissement || '')}" readonly></td>
                <td><input type="text" name="dates" value="${escapeHtml(rowData.dates || '')}" readonly></td>
                <td><input type="text" name="lieux" value="${escapeHtml(rowData.lieux || '')}" readonly></td>
                <td><input type="text" name="periode" value="${escapeHtml(rowData.periode || '')}" readonly></td>
                <td>${rowData.PDF ? '<a href="' + buildFileUrl(rowData.PDF) + '" target="_blank" class="file-link">Voir fichier</a>' : '<span class="file-display">Aucun fichier</span>'}</td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
        } else if (tableId.startsWith('table-ae3-')) {
            // AE3-1 à AE3-7 : affichage du fichier (style AE1-2) + champs de données
            const pdfName = rowData.PDF || '';
            const fileUrl = buildFileUrl(pdfName);
            const fileNameOnly = pdfName.split('/').pop();
            const fileCell = fileUrl
                ? `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a>`
                : '<span class="file-display">Aucun fichier</span>';
            const ae3Num = tableId.replace('table-ae3-', '');
            const hiddenInputClass = `ae3${ae3Num}-hidden-file`;
            
            const ae3FieldsMapping = {
                1: ['natures', 'periodes', 'mandats'],
                2: ['titres', 'accreditations', 'periodes'],
                3: ['titres', 'filieres', 'periodes'],
                4: ['periodes'],
                5: ['periodes'],
                6: ['periodes'],
                7: ['natures', 'dates', 'lieux']
            };
            
            const fields = ae3FieldsMapping[parseInt(ae3Num)] || [];
            let fieldsHTML = '';
            fields.forEach(field => {
                fieldsHTML += `<td><input type="text" name="${field}" value="${escapeHtml(rowData[field] || '')}" readonly></td>`;
            });
            
            innerHTML = `
                ${fieldsHTML}
                <td>
                    ${fileCell}
                    <input type="file" class="${hiddenInputClass}" style="display:none;" accept=".pdf" />
                </td>
                <td class="table-actions">
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
        } else if (tableId.startsWith('table-ar')) {
            const arType = tableId.replace('table-', '');
            const arFieldsMapping = {
                'ar1-1': ['reference_complete', 'doctorants', 'lien', 'ced_list'],
                'ar1-2': ['reference', 'nature_activite', 'manifestation', 'lieu', 'date', 'lien', 'attestation', 'premiere_page'],
                'ar1-3': ['type_ouvrage', 'titre', 'auteurs', 'annee', 'issn_isbn', 'page_garde'],
                'ar1-4': ['reference_complete', 'doctorants', 'lien_publication', 'publication_file', 'ced_list'],
                'ar2-1': ['auteur_these', 'titre_these', 'institution', 'date_soutenance', 'type_encadrement'],
                'ar2-2': ['auteur', 'type_travail', 'titre', 'institution', 'date_soutenance', 'role', 'invitation_file', 'page_garde'],
                'ar3-1': ['structure', 'adresse', 'periode'],
                'ar3-2': ['equipe', 'adresse', 'structure_parente', 'periode'],
                'ar3-3': ['role', 'responsable', 'nature', 'titre', 'montant', 'duree', 'partenaire', 'contrat', 'attestation_responsable'],
                'ar3-4': ['type_activite', 'objet', 'date'],
                'ar4-1': ['titre', 'lieu', 'date', 'portee'],
                'ar4-2': ['nature', 'organisme', 'lieu', 'date'],
                'ar4-3': ['type_activite', 'date']
            };
            const fields = arFieldsMapping[arType] || [];
            const arFileFieldClasses = {
                'ar1-1': { ced_list: 'ar11-ced_list-hidden-file' },
                'ar1-2': {
                    attestation: 'ar12-attestation-hidden-file',
                    premiere_page: 'ar12-premiere_page-hidden-file'
                },
                'ar1-3': { page_garde: 'ar13-page_garde-hidden-file' },
                'ar1-4': {
                    publication_file: 'ar14-publication_file-hidden-file',
                    ced_list: 'ar14-ced_list-hidden-file'
                },
                'ar2-2': {
                    invitation_file: 'ar22-invitation-hidden-file',
                    page_garde: 'ar22-page_garde-hidden-file'
                },
                'ar3-3': {
                    contrat: 'ar33-contrat-hidden-file',
                    attestation_responsable: 'ar33-attestation_responsable-hidden-file'
                }
            };
            
            let fileCell = '';
            let hiddenFileInputHTML = '';
            const hasSpecificFileClasses = arFileFieldClasses[arType] && Object.keys(arFileFieldClasses[arType]).length > 0;
            const isArWithFile = (arType.startsWith('ar2-') || arType.startsWith('ar3-') || arType.startsWith('ar4-')) && !hasSpecificFileClasses;
            if (isArWithFile) {
                const pdfName = rowData.PDF || '';
                const fileUrl = buildFileUrl(pdfName);
                const fileDisplay = fileUrl
                    ? `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a>`
                    : '<span class="file-display">Aucun fichier</span>';
                
                const match = arType.match(/^ar(\d)-(\d)$/);
                const arPrefix = match ? `ar${match[1]}` : 'ar';
                const arNum = match ? match[2] : '';
                const hiddenInputClass = `${arPrefix}${arNum}-hidden-file`;
                
                fileCell = `<td>${fileDisplay}</td>`;
                hiddenFileInputHTML = `<input type="file" class="${hiddenInputClass}" style="display:none;" accept=".pdf" />`;
            }
            
            let fieldsHTML = '';
            fields.forEach(field => {
                const hiddenInputClass = arFileFieldClasses[arType]?.[field];
                if (hiddenInputClass) {
                    const filePath = rowData[field] || '';
                    const fileUrl = buildFileUrl(filePath);
                    const fileDisplay = fileUrl
                        ? `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a>`
                        : (String(filePath).match(/^https?:\/\//i)
                            ? `<a href="${escapeHtml(filePath)}" target="_blank" class="file-link">Lien</a>`
                            : '<span class="file-display">Aucun fichier</span>');
                    fieldsHTML += `<td>${fileDisplay}<input type="file" class="${hiddenInputClass}" style="display:none;" accept=".pdf" /></td>`;
                } else {
                    fieldsHTML += `<td><input type="text" name="${field}" value="${escapeHtml(rowData[field] || '')}" readonly></td>`;
                }
            });
            
            if (isArWithFile) {
                innerHTML = `
                    ${fieldsHTML}
                    ${fileCell}
                    <td class="table-actions">
                        ${hiddenFileInputHTML}
                    <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                    <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                </td>
            `;
            } else {
                innerHTML = `
                    ${fieldsHTML}
                    <td class="table-actions">
                        <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                        <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
                    </td>
                `;
            }
        }

        newRow.innerHTML = innerHTML;
        tbody.appendChild(newRow);
    });
}

// ============================================
// SAUVEGARDE ET SOUMISSION DU FORMULAIRE
// ============================================

/**
 * Sauvegarde les données du formulaire de l'étape actuelle
 */
async function saveForm() {
    // Bloquer la sauvegarde en mode lecture seule
    if (typeof isReadOnly !== 'undefined' && isReadOnly) {
        alert('Vous ne pouvez pas modifier un dossier soumis.');
        return false;
    }
    if (typeof validateCurrentStepBeforeSave === 'function' && !validateCurrentStepBeforeSave()) {
        return false;
    }

    // Validation côté client pour l'étape 1 (uniquement sur clic explicite "Enregistrer")
    if (currentStep === 1 && !window.__autoSave) {
        if (typeof resetErrors === 'function') {
            resetErrors();
        }
        let stepValid = true;
        if (typeof validateForm === 'function' && !validateForm()) {
            stepValid = false;
        }
        const allRequiredFields = [
            'nom', 'prenom', 'email', 'grade', 'etablissement',
            'departement', 'lieu_naissance',
            'date_naissance', 'date_recrutement', 'ppr', 'laboratoire',
            'equipe_recherche', 'adresse_personnelle', 'telephone'
        ];
        allRequiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field) return;
            if (field.tagName === 'SELECT') {
                if (!field.value) {
                    showFieldError(fieldId, 'Merci de remplir ce champ');
                    stepValid = false;
                }
            } else if (field.value.trim() === '') {
                showFieldError(fieldId, 'Merci de remplir ce champ');
                stepValid = false;
            }
        });
        // Validation photo
        const photoField = document.getElementById('photo');
        const photoContainer = document.getElementById('currentPhotoContainer');
        const hasExistingPhoto = photoContainer && photoContainer.getAttribute('data-has-photo') === 'true';
        const hasNewPhoto = photoField && photoField.files.length > 0;
        if (!hasExistingPhoto && !hasNewPhoto) {
            showFieldError('photo', 'Merci de remplir ce champ');
            stepValid = false;
        }
        if (!stepValid) {
            disableNextButton(1);
            return false;
        }
    }

    const step = currentStep;
    let url, payload, useFormData = false;

    if (step === 1) {
        payload = new FormData();
        const step1Container = document.getElementById('content-1');
        const inputs = step1Container.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'file' && input.files.length > 0) {
                    payload.append(input.name, input.files[0]);
                } else {
                    payload.append(input.name, input.value);
                }
            }
        });
        url = '/api/save-step1';
        useFormData = true;
    } else if (step === 2) {
        if (typeof getStep4FormData === 'function') {
            payload = getStep4FormData();
            useFormData = true;
        } else {
            const formData = new FormData();
            ['ae1-1', 'ae1-2', 'ae1-3', 'ae2-1', 'ae2-2', 'ae2-3', 'ae3-1', 'ae3-2', 'ae3-3', 'ae3-4', 'ae3-5', 'ae3-6', 'ae3-7'].forEach(section => {
                const rows = Array.from(document.querySelectorAll(`#table-${section} tbody tr`)).map(getRequirementsRowData);
                formData.append(`${section.replace(/-/g, '_')}_rows_json`, JSON.stringify(rows));
            });

            // AE1-1 (tableau) → sérialiser en colonnes séparées par \n
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

            //  Champs libres de l'étape 4 (AE2, AE3)
            document.querySelectorAll('#content-2 textarea[name]').forEach(ta => {
                formData.append(ta.name, ta.value || '');
            });
            //  Gestion AE1-2
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
                        departements: row.querySelector('[name="departements"]')?.value || '',
                        type_encadrement: row.querySelector('[name="type_encadrement"]')?.value || ''
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
                2: ['titres', 'accreditations', 'periodes'],
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
            payload = formData;
        }
        url = '/api/save-step4';
        useFormData = true;
    } else if (step === 3 || step === 5) {
        if (typeof validateStep5Data === 'function' && !validateStep5Data()) {
            return false;
        }

        const formData = new FormData();
        const ar1FileFields = {
            1: ['ced_list'],
            2: ['attestation', 'premiere_page'],
            3: ['page_garde'],
            4: ['publication_file', 'ced_list']
        };
        ['ar1-1', 'ar1-2', 'ar1-3', 'ar1-4', 'ar2-1', 'ar2-2', 'ar3-1', 'ar3-2', 'ar3-3', 'ar3-4', 'ar4-1', 'ar4-2', 'ar4-3'].forEach(section => {
            const rows = Array.from(document.querySelectorAll(`#table-${section} tbody tr`)).map(getRequirementsRowData);
            formData.append(`${section.replace(/-/g, '_')}_rows_json`, JSON.stringify(rows));
        });

        // AR1-1 à AR1-4 : sérialiser les liens (séparés par \n)
        for (let ar1Num = 1; ar1Num <= 4; ar1Num++) {
            const ar1Table = document.querySelector(`#table-ar1-${ar1Num} tbody`);
            if (ar1Table) {
                const rows = Array.from(ar1Table.querySelectorAll('tr'));
                const liens = [];
                rows.forEach((row, idx) => {
                    const lienInput = row.querySelector('[name="lien"]');
                    if (lienInput && lienInput.value.trim()) {
                        liens.push(lienInput.value.trim());
                    }
                    (ar1FileFields[ar1Num] || []).forEach(fieldName => {
                        let file = null;
                        const hiddenInput = row.querySelector(`.ar1${ar1Num}-${fieldName}-hidden-file`);
                        if (hiddenInput?.files?.[0]) file = hiddenInput.files[0];
                        if (!file) file = row._arFiles?.[fieldName];
                        if (!file) {
                            const rid = row.getAttribute('data-row-id');
                            file = window.__arFiles?.[rid]?.[fieldName];
                        }
                        if (file) {
                            formData.append(`ar1_${ar1Num}_${fieldName}_file_${idx}`, file);
                        }
                    });
                });
                const lienKey = ar1Num === 1 ? 'ar1_1_publications' :
                    ar1Num === 2 ? 'ar1_2_actes' :
                        ar1Num === 3 ? 'ar1_3_ouvrages' : 'ar1_4_revues';
                formData.append(lienKey, liens.join('\n'));
                formData.append(`${lienKey}_json`, JSON.stringify(liens));
            }
        }

        // AR2-1 à AR2-2 : sérialiser les fichiers (comme AE3)
        for (let ar2Num = 1; ar2Num <= 2; ar2Num++) {
            const ar2Table = document.querySelector(`#table-ar2-${ar2Num} tbody`);
            if (ar2Table) {
                const rows = Array.from(ar2Table.querySelectorAll('tr'));
                const ar2_rows = [];
                rows.forEach((row, idx) => {
                    ar2_rows.push(getRequirementsRowData(row));
                    const hiddenFileInput = row.querySelector(`.ar2${ar2Num}-hidden-file`);
                    if (hiddenFileInput && hiddenFileInput.files[0]) {
                        formData.append(`ar2_${ar2Num}_file_${idx}`, hiddenFileInput.files[0]);
                    }
                });
                if (ar2Num === 2) {
                    rows.forEach((row, idx) => {
                        const rowId = row.getAttribute('data-row-id');
                        const fileFields = { invitation_file: 'ar22-invitation-hidden-file', page_garde: 'ar22-page_garde-hidden-file' };
                        Object.entries(fileFields).forEach(([field, cls]) => {
                            const hiddenInput = row.querySelector(`.${cls}`);
                            const fromRowFiles = row._arFiles?.[field];
                            const fromRegistry = window.__arFiles?.[rowId]?.[field];
                            const file = hiddenInput?.files?.[0] || fromRowFiles || fromRegistry || null;
                            if (file) formData.append(`ar2_2_${field}_file_${idx}`, file);
                        });
                    });
                }
                formData.append(`ar2_${ar2Num}_rows`, JSON.stringify(ar2_rows));
            }
        }

        // AR3-1 à AR3-4 : sérialiser les fichiers (comme AE3)
        for (let ar3Num = 1; ar3Num <= 4; ar3Num++) {
            const ar3Table = document.querySelector(`#table-ar3-${ar3Num} tbody`);
            if (ar3Table) {
                const rows = Array.from(ar3Table.querySelectorAll('tr'));
                const ar3_rows = [];
                rows.forEach((row, idx) => {
                    ar3_rows.push(getRequirementsRowData(row));
                    const hiddenFileInput = row.querySelector(`.ar3${ar3Num}-hidden-file`);
                    if (hiddenFileInput && hiddenFileInput.files[0]) {
                        formData.append(`ar3_${ar3Num}_file_${idx}`, hiddenFileInput.files[0]);
                    }
                });
                formData.append(`ar3_${ar3Num}_rows`, JSON.stringify(ar3_rows));
            }
        }
        // AR3-3 : 2 fichiers spécifiques
        const ar33Table = document.querySelector('#table-ar3-3 tbody');
        if (ar33Table) {
            const rows = Array.from(ar33Table.querySelectorAll('tr'));
            rows.forEach((row, idx) => {
                const rowId = row.getAttribute('data-row-id');
                const fileFields = { contrat: 'ar33-contrat-hidden-file', attestation_responsable: 'ar33-attestation_responsable-hidden-file' };
                Object.entries(fileFields).forEach(([field, cls]) => {
                    const hiddenInput = row.querySelector(`.${cls}`);
                    const fromRowFiles = row._arFiles?.[field];
                    const fromRegistry = window.__arFiles?.[rowId]?.[field];
                    const file = hiddenInput?.files?.[0] || fromRowFiles || fromRegistry || null;
                    if (file) formData.append(`ar3_3_${field}_file_${idx}`, file);
                });
            });
        }

        // AR4-1 à AR4-3 : sérialiser les fichiers (comme AE3)
        for (let ar4Num = 1; ar4Num <= 3; ar4Num++) {
            const ar4Table = document.querySelector(`#table-ar4-${ar4Num} tbody`);
            if (ar4Table) {
                const rows = Array.from(ar4Table.querySelectorAll('tr'));
                const ar4_rows = [];
                rows.forEach((row, idx) => {
                    ar4_rows.push(getRequirementsRowData(row));
                    const hiddenFileInput = row.querySelector(`.ar4${ar4Num}-hidden-file`);
                    if (hiddenFileInput && hiddenFileInput.files[0]) {
                        formData.append(`ar4_${ar4Num}_file_${idx}`, hiddenFileInput.files[0]);
                    }
                });
                formData.append(`ar4_${ar4Num}_rows`, JSON.stringify(ar4_rows));
            }
        }

        payload = formData;
        url = '/api/save-step5';
        useFormData = true;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: payload,
            headers: useFormData ? {} : { 'Content-Type': 'application/json' }
        });
        const result = await response.json();

        if (result.success) {
            if (!window.__autoSave) {
                showSaveIndicator();
            }
            if (result.dossier_id) dossierId = result.dossier_id;

            // Marquer l'étape comme sauvegardée et activer le bouton Suivant
            savedSteps[step] = true;
            enableNextButton(step);

            window.__dirty = false;

            // Mise à jour immédiate de la photo (Step 1) — sauf en auto-save
            if (step === 1 && result.photo_path && !window.__autoSave) {
                const photoPath = result.photo_path;
                const displayPath = photoPath.startsWith('uploads/') ? '/static/' + photoPath : photoPath;

                const link = document.getElementById('currentPhotoLink');
                const container = document.getElementById('currentPhotoContainer');
                const fileNameSpan = document.getElementById('photoFileName');

                if (link && container) {
                    link.href = displayPath;
                    link.textContent = "Voir la photo actuelle (" + photoPath.split('/').pop() + ")";
                    container.style.display = 'block';
                }
                if (fileNameSpan) {
                    fileNameSpan.textContent = "Fichier actuel : " + photoPath.split('/').pop();
                }

                // Réinitialiser le champ file pour éviter de le re-uploader
                const fileInput = document.getElementById('photo');
                if (fileInput) fileInput.value = '';
            }

            // 👉 Mise à jour des fichiers dans l'interface après sauvegarde
            if (step === 2) {
                const aeFileSections = [
                    { key: 'ae1_1', type: 'ae1-1', hiddenClass: 'ae11-hidden-file' },
                    { key: 'ae1_2', type: 'ae1-2', hiddenClass: 'ae12-hidden-file' },
                    { key: 'ae1_3', type: 'ae1-3', hiddenClass: 'ae13-hidden-file' },
                    { key: 'ae2_1', type: 'ae2-1', hiddenClass: 'ae21-hidden-file' },
                    { key: 'ae2_2', type: 'ae2-2', hiddenClass: 'ae22-hidden-file' },
                    { key: 'ae2_3', type: 'ae2-3', hiddenClass: 'ae23-hidden-file' },
                ];
                aeFileSections.forEach(({ key, type, hiddenClass }) => {
                    const filenames = result[`${key}_new_filenames`];
                    if (!filenames) return;
                    const table = document.querySelector(`#table-${type} tbody`);
                    const rows = table ? table.querySelectorAll('tr') : [];
                    const schema = typeof schemaFor === 'function' && schemaFor(type);
                    const fileIndex = schema ? schema.fields.findIndex(f => f.type === 'file') : -1;
                    if (fileIndex < 0) return;
                    filenames.forEach((newName, idx) => {
                        if (!rows[idx] || !newName) return;
                        const cell = rows[idx].cells[fileIndex];
                        const fileUrl = buildFileUrl(newName);
                        cell.innerHTML = fileUrl
                            ? `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a><input type="file" class="${hiddenClass}" style="display:none;" accept=".pdf" />`
                            : `<span class="file-display">Aucun fichier</span><input type="file" class="${hiddenClass}" style="display:none;" accept=".pdf" />`;
                    });
                });
                // Mise à jour des fichiers AE3 après sauvegarde
                for (let ae3Num = 1; ae3Num <= 7; ae3Num++) {
                    const filenamesKey = `ae3_${ae3Num}_new_filenames`;
                    if (!result[filenamesKey]) continue;
                    const table = document.querySelector(`#table-ae3-${ae3Num} tbody`);
                    const rows = table ? table.querySelectorAll('tr') : [];
                    const type = `ae3-${ae3Num}`;
                    const schema = typeof schemaFor === 'function' && schemaFor(type);
                    const fileIndex = schema ? schema.fields.findIndex(f => f.type === 'file') : -1;
                    if (fileIndex < 0) continue;
                    result[filenamesKey].forEach((newName, idx) => {
                        if (!rows[idx] || !newName) return;
                        const cell = rows[idx].cells[fileIndex];
                        const fileUrl = buildFileUrl(newName);
                        cell.innerHTML = fileUrl
                            ? `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a><input type="file" class="ae3${ae3Num}-hidden-file" style="display:none;" accept=".pdf" />`
                            : `<span class="file-display">Aucun fichier</span><input type="file" class="ae3${ae3Num}-hidden-file" style="display:none;" accept=".pdf" />`;
                    });
                }
            } else if (step === 3) {
                const ar1FileCells = [
                    { section: 'ar1_1', table: 'table-ar1-1', field: 'ced_list', className: 'ar11-ced_list-hidden-file' },
                    { section: 'ar1_2', table: 'table-ar1-2', field: 'attestation', className: 'ar12-attestation-hidden-file' },
                    { section: 'ar1_2', table: 'table-ar1-2', field: 'premiere_page', className: 'ar12-premiere_page-hidden-file' },
                    { section: 'ar1_3', table: 'table-ar1-3', field: 'page_garde', className: 'ar13-page_garde-hidden-file' },
                    { section: 'ar1_4', table: 'table-ar1-4', field: 'publication_file', className: 'ar14-publication_file-hidden-file' },
                    { section: 'ar1_4', table: 'table-ar1-4', field: 'ced_list', className: 'ar14-ced_list-hidden-file' }
                ];
                ar1FileCells.forEach(item => {
                    const filenamesKey = `${item.section}_${item.field}_new_filenames`;
                    if (!result[filenamesKey]) return;
                    const table = document.querySelector(`#${item.table} tbody`);
                    const rows = table ? table.querySelectorAll('tr') : [];
                    result[filenamesKey].forEach((newName, idx) => {
                        const row = rows[idx];
                        if (!row) return;
                        const cell = row.querySelector(`.${item.className}`)?.closest('td');
                        if (!cell) return;
                        const fileUrl = buildFileUrl(newName);
                        if (fileUrl) {
                            cell.innerHTML = `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a><input type="file" class="${item.className}" style="display:none;" accept=".pdf" />`;
                        } else {
                            cell.innerHTML = `<span class="file-display">Aucun fichier</span><input type="file" class="${item.className}" style="display:none;" accept=".pdf" />`;
                        }
                    });
                });

                // Mise à jour des fichiers AR2, AR3, AR4 après sauvegarde
                const arSimpleSections = [
                    { type: 'ar2-1', key: 'ar2_1_new_filenames', hiddenClass: 'ar21-hidden-file' },
                    { type: 'ar3-1', key: 'ar3_1_new_filenames', hiddenClass: 'ar31-hidden-file' },
                    { type: 'ar3-2', key: 'ar3_2_new_filenames', hiddenClass: 'ar32-hidden-file' },
                    { type: 'ar3-4', key: 'ar3_4_new_filenames', hiddenClass: 'ar34-hidden-file' },
                    { type: 'ar4-1', key: 'ar4_1_new_filenames', hiddenClass: 'ar41-hidden-file' },
                    { type: 'ar4-2', key: 'ar4_2_new_filenames', hiddenClass: 'ar42-hidden-file' },
                    { type: 'ar4-3', key: 'ar4_3_new_filenames', hiddenClass: 'ar43-hidden-file' },
                ];
                arSimpleSections.forEach(({ type, key, hiddenClass }) => {
                    const filenames = result[key];
                    if (!filenames) return;
                    const table = document.querySelector(`#table-${type} tbody`);
                    const rows = table ? table.querySelectorAll('tr') : [];
                    const schema = typeof schemaFor === 'function' && schemaFor(type);
                    const fileIndex = schema ? schema.fields.findIndex(f => f.type === 'file') : -1;
                    if (fileIndex < 0) return;
                    filenames.forEach((newName, idx) => {
                        if (!rows[idx] || !newName) return;
                        const cell = rows[idx].cells[fileIndex];
                        const fileUrl = buildFileUrl(newName);
                        cell.innerHTML = fileUrl
                            ? `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a><input type="file" class="${hiddenClass}" style="display:none;" accept=".pdf" />`
                            : `<span class="file-display">Aucun fichier</span><input type="file" class="${hiddenClass}" style="display:none;" accept=".pdf" />`;
                    });
                });

                // Mise à jour des cellules fichier pour les sections avec 2 fichiers (AR2-2, AR3-3)
                const arMultiFileSections = [
                    {
                        type: 'ar2-2', table: 'table-ar2-2',
                        fields: [
                            { key: 'ar2_2_invitation_file_new_filenames', fieldName: 'invitation_file', cls: 'ar22-invitation-hidden-file' },
                            { key: 'ar2_2_page_garde_new_filenames', fieldName: 'page_garde', cls: 'ar22-page_garde-hidden-file' }
                        ]
                    },
                    {
                        type: 'ar3-3', table: 'table-ar3-3',
                        fields: [
                            { key: 'ar3_3_contrat_new_filenames', fieldName: 'contrat', cls: 'ar33-contrat-hidden-file' },
                            { key: 'ar3_3_attestation_responsable_new_filenames', fieldName: 'attestation_responsable', cls: 'ar33-attestation_responsable-hidden-file' }
                        ]
                    }
                ];
                arMultiFileSections.forEach(item => {
                    const table = document.querySelector(`#${item.table} tbody`);
                    if (!table) return;
                    const rows = table.querySelectorAll('tr');
                    const schema = typeof schemaFor === 'function' && schemaFor(item.type);
                    item.fields.forEach(fileField => {
                        const paths = result[fileField.key];
                        if (!paths) return;
                        const cellIndex = schema ? schema.fields.findIndex(f => f.name === fileField.fieldName) : -1;
                        if (cellIndex < 0) return;
                        paths.forEach((newName, idx) => {
                            if (!rows[idx] || !newName) return;
                            const cell = rows[idx].cells[cellIndex];
                            if (!cell) return;
                            const fileUrl = buildFileUrl(newName);
                            cell.innerHTML = fileUrl
                                ? `<a href="${fileUrl}" target="_blank" class="file-link">Voir fichier</a><input type="file" class="${fileField.cls}" style="display:none;" accept=".pdf" />`
                                : `<span class="file-display">Aucun fichier</span><input type="file" class="${fileField.cls}" style="display:none;" accept=".pdf" />`;
                        });
                    });
                });
            }
            return true;
        } else {
            if (window.__autoSave) {
                console.warn('Auto-save error:', result.message);
            } else {
                alert('Erreur : ' + result.message);
            }
            return false;
        }
    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        if (!window.__autoSave) {
            alert('Une erreur est survenue lors de la sauvegarde.');
        }
        return false;
    }
}

let __autoSaveTimer = null;

function startAutoSave() {
    if (__autoSaveTimer) clearInterval(__autoSaveTimer);
    __autoSaveTimer = setInterval(async () => {
        if (!window.__dirty || !dossierId) return;
        window.__autoSave = true;
        await saveForm();
        window.__autoSave = false;
    }, 30000);
}

function stopAutoSave() {
    if (__autoSaveTimer) {
        clearInterval(__autoSaveTimer);
        __autoSaveTimer = null;
    }
}

/**
 * Extrait les données des tableaux pour les étapes 2 et 3
 * @param {number} step - Numéro de l'étape
 * @returns {Object} Données formatées
 */
function getFormDataForStep(step) {
    const data = {};

    if (step === 2) {
        const licenceTable = document.querySelector('#table-licence tbody');
        const encadrementLicenceTable = document.querySelector('#table-encadrement-licence tbody');
        const masterTable = document.querySelector('#table-master tbody');
        const encadrementMasterTable = document.querySelector('#table-encadrement-master tbody');
        data.enseignements_licence = Array.from(licenceTable.querySelectorAll('tr')).map(row => ({
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
        data.encadrements_licence = Array.from(encadrementLicenceTable.querySelectorAll('tr')).map(row => ({
            annee_univ: row.cells[0].querySelector('input').value,
            type_licence: row.cells[1].querySelector('input').value,
            titre_pfe: row.cells[2].querySelector('input').value,
            etudiants: row.cells[3].querySelector('input').value,
            nom_encadrants: row.cells[4].querySelector('input').value
        }));
        data.enseignements_master = Array.from(masterTable.querySelectorAll('tr')).map(row => ({
            annee_univ: row.cells[0].querySelector('input').value,
            filiere: row.cells[1].querySelector('input').value,
            semestre: row.cells[2].querySelector('input').value,
            cours_td_tp: row.cells[3].querySelector('input').value,
            vh: parseInt(row.cells[4].querySelector('input').value) || 0
        }));
        data.encadrements_master = Array.from(encadrementMasterTable.querySelectorAll('tr')).map(row => ({
            annee_univ: row.cells[0].querySelector('input').value,
            filiere: row.cells[1].querySelector('input').value,
            type_master: row.cells[2].querySelector('input').value,
            titre_memoire: row.cells[3].querySelector('input').value,
            nom_etudiants: row.cells[4].querySelector('input').value,
            nom_encadrants: row.cells[5].querySelector('input').value
        }));
    }
    if (step === 3) {
        const table = document.querySelector('#table-responsabilites tbody');
        data.responsabilites = Array.from(table.querySelectorAll('tr')).map(row => ({
            annees_univ: row.cells[0].querySelector('input').value,
            filiere: row.cells[1].querySelector('input').value,
            semestre: row.cells[2].querySelector('input').value,
            intitule_module: row.cells[3].querySelector('input').value,
            cycle: row.cells[4].querySelector('input').value
        }));
    }
    return data;
}

/**
 * Soumet le dossier complet
 */
async function submitForm() {
    // Bloquer la soumission en mode lecture seule
    if (typeof isReadOnly !== 'undefined' && isReadOnly) {
        alert('Vous ne pouvez pas soumettre un dossier déjà soumis.');
        return;
    }
    const confirmed = await showConfirmModal('Êtes-vous sûr de vouloir soumettre votre dossier ? Vous ne pourrez plus le modifier après.');
    if (!confirmed) return;
    try {
        const saved = await saveForm();
        if (saved === false) return;
        const response = await fetch('/api/submit-dossier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
            if (typeof showSuccessModal === 'function') {
                await showSuccessModal('Votre dossier a été soumis avec succès.', 'Dossier soumis !');
                window.location.href = '/dossier-enseignant';
            } else {
                alert('Dossier soumis avec succès !');
                window.location.href = '/dossier-enseignant';
            }
        } else {
            alert('Erreur : ' + data.message);
        }
    } catch (error) {
        alert('Erreur réseau.');
    }
}

// ============================================
// INITIALISATION AU CHARGEMENT DE LA PAGE
// ============================================

window.addEventListener('DOMContentLoaded', function () {
    window.__dirty = false;

    // Détection de modifications sur tous les champs
    document.addEventListener('input', function () { window.__dirty = true; });
    document.addEventListener('change', function () { window.__dirty = true; });

    // Initial setup - disable button first (will be enabled after data loads or validation)
    disableNextButton(1);
    loadFormData();
    updateButtons();
    startAutoSave();

    // Initialisation de la validation des champs (Step 1)
    setupInputValidation('nom', 'text', 'Ce champ ne doit contenir que des lettres.');
    setupInputValidation('prenom', 'text', 'Ce champ ne doit contenir que des lettres.');
    setupInputValidation('lieu_naissance', 'text', 'Ce champ ne doit contenir que des lettres.');
    setupInputValidation('ppr', 'number', 'Ce champ ne doit contenir que des chiffres.');
    setupInputValidation('telephone', 'tel', 'Format invalide (ex: 0612345678).');
    
    // Limiter les dates
    var today = new Date().toISOString().split('T')[0];
    var minNaissance = '1930-01-01';
    var dn = document.getElementById('date_naissance');
    var dr = document.getElementById('date_recrutement');
    if (dn) dn.setAttribute('max', today);
    if (dr) dr.setAttribute('max', today);

    function validateDates() {
        if (!dn || !dr) return;
        var valid = true;

        // Condition 1 : date_naissance >= 1930
        if (dn.value && dn.value < minNaissance) {
            showFieldError('date_naissance', 'La date de naissance doit être ≥ 1930');
            valid = false;
        } else if (dn.value) {
            hideFieldError('date_naissance');
        }

        // Condition 2 : écart >= 25 ans entre naissance et recrutement
        if (dn.value && dr.value && dn.value >= minNaissance) {
            var birth = new Date(dn.value);
            var recruit = new Date(dr.value);
            var diffYears = (recruit - birth) / (365.25 * 24 * 60 * 60 * 1000);
            if (diffYears < 25) {
                showFieldError('date_naissance', valid ? 'L\'écart Naissance/Recrutement doit être ≥ 25 ans' : '');
                showFieldError('date_recrutement', 'L\'écart Naissance/Recrutement doit être ≥ 25 ans');
                valid = false;
            } else {
                hideFieldError('date_recrutement');
            }
        }

        if (typeof validateForm === 'function') validateForm();
    }
    if (dn) dn.addEventListener('change', validateDates);
    if (dr) dr.addEventListener('change', validateDates);

    // Setup real-time validation for Step 1
    if (typeof setupStep1RealTimeValidation === 'function') {
        setTimeout(function() {
            if (typeof resetErrors === 'function') resetErrors();
            setupStep1RealTimeValidation();
        }, 500);
    }

    // Sections repliables dans l'étape 4
    document.querySelectorAll('#content-2 .eval-section').forEach(function (section) {
        var header = section.querySelector('h5');
        var wrapper = section.querySelector('.data-table-wrapper');
        if (!header || !wrapper) return;

        var icon = document.createElement('i');
        icon.className = 'fas fa-chevron-up toggle-icon';
        header.appendChild(icon);

        header.addEventListener('click', function () {
            section.classList.toggle('collapsed');
            icon.classList.toggle('fa-chevron-up');
            icon.classList.toggle('fa-chevron-down');
        });
    });
});
