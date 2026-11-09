// ============================================
// Configuration globale
// ============================================
const APP_CONFIG = {
    maxTextLength: 3000,
    maxFileSizeMB: 1,
    maxVH: 100
};

// ============================================
// Helper functions
// ============================================
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function updateFileName(input, displayId) {
    const display = document.getElementById(displayId);
    if (input && input.files && input.files.length > 0) {
        display.textContent = input.files[0].name;
    }
}

function validateModalFile(input, errorId) {
    if (!input || !input.files || input.files.length === 0) {
        return true; // Optional file
    }
    const file = input.files[0];
    const maxSize = APP_CONFIG.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
        showModalError(errorId, 'Le fichier dépasse la taille maximale de ' + APP_CONFIG.maxFileSizeMB + ' Mo');
        return false;
    }
    if (file.type !== 'application/pdf') {
        showModalError(errorId, 'Seuls les fichiers PDF sont acceptés');
        return false;
    }
    hideModalError(errorId);
    return true;
}

// ============================================
// Validations pour les modals
// ============================================
function showModalError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Global: enforce 3000-char limit on all modal text fields and update counters
(function enforceModalTextLengthGlobally() {
  if (window.__modalTextLengthEnforced) return;
  window.__modalTextLengthEnforced = true;
  const MAX = APP_CONFIG && APP_CONFIG.maxTextLength ? APP_CONFIG.maxTextLength : 3000;
  document.addEventListener('input', function(ev) {
    const el = ev.target;
    if (!el || !el.id || !el.id.startsWith('modal_')) return;
    const isTextLike = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text','search','url','tel','email'].includes(el.type));
    if (!isTextLike) return;
    if (typeof el.value === 'string' && el.value.length > MAX) {
      el.value = el.value.substring(0, MAX);
    }
    const counter = document.getElementById(el.id + 'Counter');
    if (counter) {
      const remaining = MAX - (el.value ? el.value.length : 0);
      counter.textContent = '';
      counter.style.color = remaining < 100 ? 'red' : (remaining < 500 ? 'orange' : 'green');
    }
    if (typeof validateModalField === 'function') {
      validateModalField(el.id);
    }
  }, { passive: true });
})();

function hideModalError(fieldId) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

function resetModalErrors() {
    document.querySelectorAll('#modalContent .error-message').forEach(el => {
        el.style.display = 'none';
    });
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

function validateModalField(fieldId, isRequired = true, customMessage = '') {
    const field = document.getElementById(fieldId);
    if (!field) return true;

    let isEmpty = false;
    if (field.tagName === 'SELECT') {
        isEmpty = !field.value;
    } else {
        isEmpty = field.value.trim() === '';
    }

    if (isRequired && isEmpty) {
        showModalError(fieldId, customMessage);
        return false;
    }

    // Étapes 4 & 5 : champs de liens doivent commencer par http:// ou https://
    if (!isEmpty && fieldId === 'modal_lien' || fieldId === 'modal_lienSite') {
        if (!isHttpOrHttpsPrefixedUrl(field.value)) {
            showModalError(fieldId, 'Le lien doit commencer par http:// ou https://');
            return false;
        }
    }
    if (!isEmpty && fieldId === 'modal_liens') {
        const res = validateUrlList(field.value);
        if (!res.valid) {
            showModalError(fieldId, 'Chaque lien doit commencer par http:// ou https:// (ex: https://...)');
            return false;
        }
    }
    // Validation format date pour les champs texte date (JJ/MM/AAAA)
    if (!isEmpty && field.tagName === 'INPUT' && field.type === 'text' && /^modal_date/.test(fieldId)) {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(field.value.trim())) {
            showModalError(fieldId, 'Format de date invalide. Utilisez le format JJ/MM/AAAA');
            return false;
        }
    }
    hideModalError(fieldId);
    return true;
}

function validateModalNumericField(fieldId, fieldName) {
    const field = document.getElementById(fieldId);
    if (!field) return true;

    const value = field.value.trim();
    if (value === '') return true;

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        showModalError(fieldId, fieldName + ' doit être un nombre');
        return false;
    }
    if (numValue < 0) {
        showModalError(fieldId, fieldName + ' ne peut pas être négatif');
        return false;
    }
    if (numValue > APP_CONFIG.maxVH) {
        showModalError(fieldId, fieldName + ' ne peut pas dépasser ' + APP_CONFIG.maxVH);
        return false;
    }
    hideModalError(fieldId);
    return true;
}

function validateTextLength(fieldId, fieldName) {
    const field = document.getElementById(fieldId);
    if (!field) return true;

    const length = field.value.length;
    if (length > APP_CONFIG.maxTextLength) {
        showModalError(fieldId, '');
        return false;
    }
    if (length > 0) {
        hideModalError(fieldId);
    }
    return true;
}

function updateCharCounter(fieldId, counterId) {
    const field = document.getElementById(fieldId);
    const counter = document.getElementById(counterId);
    if (!field || !counter) return;

    const remaining = APP_CONFIG.maxTextLength - field.value.length;
    counter.textContent = '';
    counter.style.color = remaining < 100 ? 'red' : (remaining < 500 ? 'orange' : 'green');
}

function openModal(type, rowData = null) {
    // Bloquer l'ouverture de modales en mode lecture seule
    if (typeof isReadOnly !== 'undefined' && isReadOnly) {
        alert('Vous ne pouvez pas modifier un dossier soumis.');
        return;
    }
    currentModalType = type;
    rowToEdit = rowData ? rowData.row : null;
    const modal = document.getElementById('modalOverlay');
    const modalContent = document.getElementById('modalContent');
let html = '';
    const val = (key) => rowData && rowData.data[key] ? rowData.data[key] : '';

    if (type === 'licence') {
        html = `
            <div class="modal-header">
                <h3>Enseignements assurée en Licence</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Année Univ. <span style="color: #000;">*</span></label>
                    <div id="modal_annee_univError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_annee_univ" onchange="validateModalField('modal_annee_univ')">
                        <option value="2013-2014" ${val('annee_univ') === '2013-2014' ? 'selected' : ''}>2013-2014</option>
                        <option value="2014-2015" ${val('annee_univ') === '2014-2015' ? 'selected' : ''}>2014-2015</option>
                        <option value="2015-2016" ${val('annee_univ') === '2015-2016' ? 'selected' : ''}>2015-2016</option>
                        <option value="2016-2017" ${val('annee_univ') === '2016-2017' ? 'selected' : ''}>2016-2017</option>
                        <option value="2017-2018" ${val('annee_univ') === '2017-2018' ? 'selected' : ''}>2017-2018</option>
                        <option value="2018-2019" ${val('annee_univ') === '2018-2019' ? 'selected' : ''}>2018-2019</option>
                        <option value="2019-2020" ${val('annee_univ') === '2019-2020' ? 'selected' : ''}>2019-2020</option>
                        <option value="2020-2021" ${val('annee_univ') === '2020-2021' ? 'selected' : ''}>2020-2021</option>
                        <option value="2021-2022" ${val('annee_univ') === '2021-2022' ? 'selected' : ''}>2021-2022</option>
                        <option value="2022-2023" ${val('annee_univ') === '2022-2023' ? 'selected' : ''}>2022-2023</option>
                        <option value="2023-2024" ${val('annee_univ') === '2023-2024' ? 'selected' : ''}>2023-2024</option>
                        <option value="2024-2025" ${val('annee_univ') === '2024-2025' ? 'selected' : ''}>2024-2025</option>
                        <option value="2025-2026" ${val('annee_univ') === '2025-2026' ? 'selected' : ''}>2025-2026</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Filière <span style="color: #000;">*</span></label>
                    <div id="modal_filiereError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_filiere" onchange="validateModalField('modal_filiere')">
                        <option value="" disabled ${!val('filiere') ? 'selected' : ''}>Choisir une filière</option>
                        <optgroup label="Licences Fondamentales">
                            <option value="Sciences de la matière Physique (SMP)" ${val('filiere') === 'Sciences de la matière Physique (SMP)' ? 'selected' : ''}>Sciences de la matière Physique (SMP)</option>
                            <option value="Sciences de la matière Chimie (SMC)" ${val('filiere') === 'Sciences de la matière Chimie (SMC)' ? 'selected' : ''}>Sciences de la matière Chimie (SMC)</option>
                            <option value="Sciences de la Vie (SV)" ${val('filiere') === 'Sciences de la Vie (SV)' ? 'selected' : ''}>Sciences de la Vie (SV)</option>
                            <option value="Sciences de la Terre et de l'Univers (STU)" ${val('filiere') === 'Sciences de la Terre et de l\'Univers (STU)' ? 'selected' : ''}>Sciences de la Terre et de l'Univers (STU)</option>
                            <option value="Sciences Mathématiques et Applications (SMA)" ${val('filiere') === 'Sciences Mathématiques et Applications (SMA)' ? 'selected' : ''}>Sciences Mathématiques et Applications (SMA)</option>
                            <option value="Sciences Mathématiques et Informatique (SMI)" ${val('filiere') === 'Sciences Mathématiques et Informatique (SMI)' ? 'selected' : ''}>Sciences Mathématiques et Informatique (SMI)</option>
                        </optgroup>
                        <optgroup label="Parcours d'excellence">
                            <option value="Conception et Simulation Numérique en Mécanique (CSNM)" ${val('filiere') === 'Conception et Simulation Numérique en Mécanique (CSNM)' ? 'selected' : ''}>Conception et Simulation Numérique en Mécanique (CSNM)</option>
                        </optgroup>
                        <optgroup label="Filières Chimie">
                            <option value="Chimie Analytique Contrôle Qualité" ${val('filiere') === 'Chimie Analytique Contrôle Qualité' ? 'selected' : ''}>Chimie Analytique Contrôle Qualité</option>
                            <option value="Formulation des Produits industriels" ${val('filiere') === 'Formulation des Produits industriels' ? 'selected' : ''}>Formulation des Produits industriels</option>
                            <option value="Gestion des Effluents liquides et solides" ${val('filiere') === 'Gestion des Effluents liquides et solides' ? 'selected' : ''}>Gestion des Effluents liquides et solides</option>
                            <option value="Matériaux Organique et inorganique" ${val('filiere') === 'Matériaux Organique et inorganique' ? 'selected' : ''}>Matériaux Organique et inorganique</option>
                        </optgroup>
                        <optgroup label="Filières Physique">
                            <option value="Energies Renouvelables (EREE)" ${val('filiere') === 'Energies Renouvelables (EREE)' ? 'selected' : ''}>Energies Renouvelables (EREE)</option>
                            <option value="Dosimétrie" ${val('filiere') === 'Dosimétrie' ? 'selected' : ''}>Dosimétrie</option>
                            <option value="Génie électrique (GE)" ${val('filiere') === 'Génie électrique (GE)' ? 'selected' : ''}>Génie électrique (GE)</option>
                            <option value="Ingénierie en mécanique et énergétique (IME)" ${val('filiere') === 'Ingénierie en mécanique et énergétique (IME)' ? 'selected' : ''}>Ingénierie en mécanique et énergétique (IME)</option>
                            <option value="Matériaux et Energie" ${val('filiere') === 'Matériaux et Energie' ? 'selected' : ''}>Matériaux et Energie</option>
                        </optgroup>
                        <optgroup label="Filières Mathématiques">
                            <option value="Analyse Mathématique" ${val('filiere') === 'Analyse Mathématique' ? 'selected' : ''}>Analyse Mathématique</option>
                            <option value="Calcul Scientifique et Optimisation" ${val('filiere') === 'Calcul Scientifique et Optimisation' ? 'selected' : ''}>Calcul Scientifique et Optimisation</option>
                            <option value="Codage et Cryptographie" ${val('filiere') === 'Codage et Cryptographie' ? 'selected' : ''}>Codage et Cryptographie</option>
                            <option value="Statistiques et Aide à la Décision" ${val('filiere') === 'Statistiques et Aide à la Décision' ? 'selected' : ''}>Statistiques et Aide à la Décision</option>
                        </optgroup>
                        <optgroup label="Filières Biologie">
                            <option value="Pharmacologie et Développement Molécules (PDM)" ${val('filiere') === 'Pharmacologie et Développement Molécules (PDM)' ? 'selected' : ''}>Pharmacologie et Développement Molécules (PDM)</option>
                            <option value="Biotechnologie et Environnement" ${val('filiere') === 'Biotechnologie et Environnement' ? 'selected' : ''}>Biotechnologie et Environnement</option>
                            <option value="Biologie et Technologie" ${val('filiere') === 'Biologie et Technologie' ? 'selected' : ''}>Biologie et Technologie</option>
                            <option value="Bio-Analyses Médicales" ${val('filiere') === 'Bio-Analyses Médicales' ? 'selected' : ''}>Bio-Analyses Médicales</option>
                        </optgroup>
                        <optgroup label="Filières Géologie">
                            <option value="Géosciences" ${val('filiere') === 'Géosciences' ? 'selected' : ''}>Géosciences</option>
                        </optgroup>
                        <optgroup label="Filières Informatique (IA)">
                            <option value="Ingénierie Logicielle" ${val('filiere') === 'Ingénierie Logicielle' ? 'selected' : ''}>Ingénierie Logicielle</option>
                            <option value="Cybersécurité" ${val('filiere') === 'Cybersécurité' ? 'selected' : ''}>Cybersécurité</option>
                        </optgroup>
                        <optgroup label="Filières Informatique (MI)">
                            <option value="Développement informatique" ${val('filiere') === 'Développement informatique' ? 'selected' : ''}>Développement informatique</option>
                            <option value="Administration des Systèmes" ${val('filiere') === 'Administration des Systèmes' ? 'selected' : ''}>Administration des Systèmes</option>
                        </optgroup>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Semestre <span style="color: #000;">*</span></label>
                    <div id="modal_semestreError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_semestre" onchange="validateModalField('modal_semestre')">
                        <option value="" disabled ${!val('semestre') ? 'selected' : ''}>Choisir un semestre</option>
                        <option value="S1" ${val('semestre') === 'S1' ? 'selected' : ''}>S1</option>
                        <option value="S2" ${val('semestre') === 'S2' ? 'selected' : ''}>S2</option>
                        <option value="S3" ${val('semestre') === 'S3' ? 'selected' : ''}>S3</option>
                        <option value="S4" ${val('semestre') === 'S4' ? 'selected' : ''}>S4</option>
                        <option value="S5" ${val('semestre') === 'S5' ? 'selected' : ''}>S5</option>
                        <option value="S6" ${val('semestre') === 'S6' ? 'selected' : ''}>S6</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Cours <span style="color: #000;">*</span></label>
                    <div id="modal_coursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_cours" oninput="validateModalField('modal_cours'); updateCharCounter('modal_cours', 'modal_coursCounter')">${escapeHtml(val('cours'))}</textarea>
                    <div id="modal_coursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>VH Cours <span style="color: #000;">*</span></label>
                    <div id="modal_vh_coursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="number" id="modal_vh_cours" min="0" max="100" value="${escapeHtml(val('vh_cours'))}" placeholder="0" oninput="validateModalNumericField('modal_vh_cours', 'VH Cours')"/>
                </div>
                <div class="modal-form-group">
                    <label>TD <span style="color: #000;">*</span></label>
                    <div id="modal_tdError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_td" oninput="validateModalField('modal_td'); updateCharCounter('modal_td', 'modal_tdCounter')">${escapeHtml(val('td'))}</textarea>
                    <div id="modal_tdCounter" class="char-counter"></div>
                    <div id="modal_tdCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>VH TD <span style="color: #000;">*</span></label>
                    <div id="modal_vh_tdError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="number" id="modal_vh_td" min="0" max="100" value="${escapeHtml(val('vh_td'))}" placeholder="0" oninput="validateModalNumericField('modal_vh_td', 'VH TD')"/>
                </div>
                <div class="modal-form-group">
                    <label>TP <span style="color: #000;">*</span></label>
                    <div id="modal_tpError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_tp" oninput="validateModalField('modal_tp'); updateCharCounter('modal_tp', 'modal_tpCounter')">${escapeHtml(val('tp'))}</textarea>
                    <div id="modal_tpCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>VH TP <span style="color: #000;">*</span></label>
                    <div id="modal_vh_tpError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="number" id="modal_vh_tp" min="0" max="100" value="${escapeHtml(val('vh_tp'))}" placeholder="0" oninput="validateModalNumericField('modal_vh_tp', 'VH TP')"/>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'encadrement-licence') {
        html = `
            <div class="modal-header">
                <h3>Encadrements assurés en Licence</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Année Univ. <span style="color: #000;">*</span></label>
                    <div id="modal_annee_univError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_annee_univ" onchange="validateModalField('modal_annee_univ')">
                        <option value="" disabled ${!val('annee_univ') ? 'selected' : ''}>Choisir une année universitaire</option>
                        <option value="2013-2014" ${val('annee_univ') === '2013-2014' ? 'selected' : ''}>2013-2014</option>
                        <option value="2014-2015" ${val('annee_univ') === '2014-2015' ? 'selected' : ''}>2014-2015</option>
                        <option value="2015-2016" ${val('annee_univ') === '2015-2016' ? 'selected' : ''}>2015-2016</option>
                        <option value="2016-2017" ${val('annee_univ') === '2016-2017' ? 'selected' : ''}>2016-2017</option>
                        <option value="2017-2018" ${val('annee_univ') === '2017-2018' ? 'selected' : ''}>2017-2018</option>
                        <option value="2018-2019" ${val('annee_univ') === '2018-2019' ? 'selected' : ''}>2018-2019</option>
                        <option value="2019-2020" ${val('annee_univ') === '2019-2020' ? 'selected' : ''}>2019-2020</option>
                        <option value="2020-2021" ${val('annee_univ') === '2020-2021' ? 'selected' : ''}>2020-2021</option>
                        <option value="2021-2022" ${val('annee_univ') === '2021-2022' ? 'selected' : ''}>2021-2022</option>
                        <option value="2022-2023" ${val('annee_univ') === '2022-2023' ? 'selected' : ''}>2022-2023</option>
                        <option value="2023-2024" ${val('annee_univ') === '2023-2024' ? 'selected' : ''}>2023-2024</option>
                        <option value="2024-2025" ${val('annee_univ') === '2024-2025' ? 'selected' : ''}>2024-2025</option>
                        <option value="2025-2026" ${val('annee_univ') === '2025-2026' ? 'selected' : ''}>2025-2026</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Type licence <span style="color: #000;">*</span></label>
                    <div id="modal_type_licenceError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_type_licence" onchange="validateModalField('modal_type_licence')">
                        <option value="" disabled ${!val('type_licence') ? 'selected' : ''}>Choisir un type de licence</option>
                        <option value="LF" ${val('type_licence') === 'LF' ? 'selected' : ''}>LF — Licence Fondamentale</option>
                        <option value="LE" ${val('type_licence') === 'LE' ? 'selected' : ''}>LE — Licence d'Excellence</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Titre Pfe <span style="color: #000;">*</span></label>
                    <div id="modal_titre_pfeError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_titre_pfe" oninput="validateModalField('modal_titre_pfe'); updateCharCounter('modal_titre_pfe', 'modal_titre_pfeCounter')">${escapeHtml(val('titre_pfe'))}</textarea>
                    <div id="modal_titre_pfeCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Étudiants <span style="color: #000;">*</span></label>
                    <div id="modal_etudiantsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_etudiants" oninput="validateModalField('modal_etudiants'); updateCharCounter('modal_etudiants', 'modal_etudiantsCounter')">${escapeHtml(val('etudiants'))}</textarea>
                    <div id="modal_etudiantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom(s) des encadrants <span style="color: #000;">*</span></label>
                    <div id="modal_nom_encadrantsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_nom_encadrants" oninput="validateModalField('modal_nom_encadrants'); updateCharCounter('modal_nom_encadrants', 'modal_nom_encadrantsCounter')">${escapeHtml(val('nom_encadrants'))}</textarea>
                    <div id="modal_nom_encadrantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Page de garde (PDF) <span style="color: #000;">*</span></label>
                    <div id="modal_enc_licence_coverError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_enc_licence_cover').click()">Sélectionner fichier</button>
                        <span class="file-upload-text" id="modal_enc_licence_cover_fileName">
                            ${val('page_de_garde') ? `<a href="/static/${val('page_de_garde')}" target="_blank" onclick="event.stopPropagation();">Voir fichier existant</a>` : 'Aucun fichier'}
                        </span>
                        <input type="file" style="display: none;" id="modal_enc_licence_cover" name="modal_enc_licence_cover" accept=".pdf" onchange="validateModalFile(this, 'modal_enc_licence_cover')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'master') {
        html = `
            <div class="modal-header">
                <h3>Enseignements assurés en Master</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Année Univ. <span style="color: #000;">*</span></label>
                    <div id="modal_annee_univError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_annee_univ" onchange="validateModalField('modal_annee_univ')">
                        <option value="" disabled ${!val('annee_univ') ? 'selected' : ''}>Choisir une année universitaire</option>
                        <option value="2013-2014" ${val('annee_univ') === '2013-2014' ? 'selected' : ''}>2013-2014</option>
                        <option value="2014-2015" ${val('annee_univ') === '2014-2015' ? 'selected' : ''}>2014-2015</option>
                        <option value="2015-2016" ${val('annee_univ') === '2015-2016' ? 'selected' : ''}>2015-2016</option>
                        <option value="2016-2017" ${val('annee_univ') === '2016-2017' ? 'selected' : ''}>2016-2017</option>
                        <option value="2017-2018" ${val('annee_univ') === '2017-2018' ? 'selected' : ''}>2017-2018</option>
                        <option value="2018-2019" ${val('annee_univ') === '2018-2019' ? 'selected' : ''}>2018-2019</option>
                        <option value="2019-2020" ${val('annee_univ') === '2019-2020' ? 'selected' : ''}>2019-2020</option>
                        <option value="2020-2021" ${val('annee_univ') === '2020-2021' ? 'selected' : ''}>2020-2021</option>
                        <option value="2021-2022" ${val('annee_univ') === '2021-2022' ? 'selected' : ''}>2021-2022</option>
                        <option value="2022-2023" ${val('annee_univ') === '2022-2023' ? 'selected' : ''}>2022-2023</option>
                        <option value="2023-2024" ${val('annee_univ') === '2023-2024' ? 'selected' : ''}>2023-2024</option>
                        <option value="2024-2025" ${val('annee_univ') === '2024-2025' ? 'selected' : ''}>2024-2025</option>
                        <option value="2025-2026" ${val('annee_univ') === '2025-2026' ? 'selected' : ''}>2025-2026</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Filière <span style="color: #000;">*</span></label>
                    <div id="modal_filiereError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_filiere" onchange="validateModalField('modal_filiere')">
                        <option value="" disabled ${!val('filiere') ? 'selected' : ''}>Choisir une filière</option>
                        <option value="Sciences Biomédicales et Qualité (SBQ)" ${val('filiere') === 'Sciences Biomédicales et Qualité (SBQ)' ? 'selected' : ''}>Sciences Biomédicales et Qualité (SBQ)</option>
                        <option value="Sciences de la Santé et BioTechnologies (SSB)" ${val('filiere') === 'Sciences de la Santé et BioTechnologies (SSB)' ? 'selected' : ''}>Sciences de la Santé et BioTechnologies (SSB)</option>
                        <option value="Chimie et Applications Industrielles et Environnementales (CAIE)" ${val('filiere') === 'Chimie et Applications Industrielles et Environnementales (CAIE)' ? 'selected' : ''}>Chimie et Applications Industrielles et Environnementales (CAIE)</option>
                        <option value="Analyse Chimique Chimiométrie et Qualité (ACCQ)" ${val('filiere') === 'Analyse Chimique Chimiométrie et Qualité (ACCQ)' ? 'selected' : ''}>Analyse Chimique Chimiométrie et Qualité (ACCQ)</option>
                        <option value="Environnement Marin et Gestion des Bio-Ressources (EMGBR)" ${val('filiere') === 'Environnement Marin et Gestion des Bio-Ressources (EMGBR)' ? 'selected' : ''}>Environnement Marin et Gestion des Bio-Ressources (EMGBR)</option>
                        <option value="Physique des Hautes Energies et Instrumentation (PHEI)" ${val('filiere') === 'Physique des Hautes Energies et Instrumentation (PHEI)' ? 'selected' : ''}>Physique des Hautes Energies et Instrumentation (PHEI)</option>
                        <option value="Matériaux & Energies (ME)" ${val('filiere') === 'Matériaux & Energies (ME)' ? 'selected' : ''}>Matériaux & Energies (ME)</option>
                        <option value="Mécanique et Ingénierie (MI)" ${val('filiere') === 'Mécanique et Ingénierie (MI)' ? 'selected' : ''}>Mécanique et Ingénierie (MI)</option>
                        <option value="Electronique, Electrotechnique, Automatique et Informatique Industrielle (EEAII)" ${val('filiere') === 'Electronique, Electrotechnique, Automatique et Informatique Industrielle (EEAII)' ? 'selected' : ''}>Electronique, Electrotechnique, Automatique et Informatique Industrielle (EEAII)</option>
                        <option value="Energies Renouvelables et Efficacité Energétique (EREE)" ${val('filiere') === 'Energies Renouvelables et Efficacité Energétique (EREE)' ? 'selected' : ''}>Energies Renouvelables et Efficacité Energétique (EREE)</option>
                        <option value="Génie Logistique (GL)" ${val('filiere') === 'Génie Logistique (GL)' ? 'selected' : ''}>Génie Logistique (GL)</option>
                        <option value="Conception et Simulation Numérique en Mécanique (CSNM)" ${val('filiere') === 'Conception et Simulation Numérique en Mécanique (CSNM)' ? 'selected' : ''}>Conception et Simulation Numérique en Mécanique (CSNM)</option>
                        <option value="Mathématiques et Applications (MA)" ${val('filiere') === 'Mathématiques et Applications (MA)' ? 'selected' : ''}>Mathématiques et Applications (MA)</option>
                        <option value="Méthodes Numériques et Statistiques Appliquées (MNSA)" ${val('filiere') === 'Méthodes Numériques et Statistiques Appliquées (MNSA)' ? 'selected' : ''}>Méthodes Numériques et Statistiques Appliquées (MNSA)</option>
                        <option value="Analyse Numérique Optimisation et Contrôle (ANOC)" ${val('filiere') === 'Analyse Numérique Optimisation et Contrôle (ANOC)' ? 'selected' : ''}>Analyse Numérique Optimisation et Contrôle (ANOC)</option>
                        <option value="Big Data Cloud Computing (BD2C)" ${val('filiere') === 'Big Data Cloud Computing (BD2C)' ? 'selected' : ''}>Big Data Cloud Computing (BD2C)</option>
                        <option value="Ingénierie des Systèmes Intelligents (ISI)" ${val('filiere') === 'Ingénierie des Systèmes Intelligents (ISI)' ? 'selected' : ''}>Ingénierie des Systèmes Intelligents (ISI)</option>
                        <option value="GEOressources GéoRISques et GéoEnvironnement (GEORISE)" ${val('filiere') === 'GEOressources GéoRISques et GéoEnvironnement (GEORISE)' ? 'selected' : ''}>GEOressources GéoRISques et GéoEnvironnement (GEORISE)</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Semestre <span style="color: #000;">*</span></label>
                    <div id="modal_semestreError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_semestre" onchange="validateModalField('modal_semestre')">
                        <option value="" disabled ${!val('semestre') ? 'selected' : ''}>Choisir un semestre</option>
                        <option value="S7" ${val('semestre') === 'S7' ? 'selected' : ''}>S7</option>
                        <option value="S8" ${val('semestre') === 'S8' ? 'selected' : ''}>S8</option>
                        <option value="S9" ${val('semestre') === 'S9' ? 'selected' : ''}>S9</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Cours / TD / TP <span style="color: #000;">*</span></label>
                    <div id="modal_cours_td_tpError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_cours_td_tp" onchange="validateModalField('modal_cours_td_tp')">
                        <option value="" disabled ${!val('cours_td_tp') ? 'selected' : ''}>Choisir un type</option>
                        <option value="Cours" ${val('cours_td_tp') === 'Cours' ? 'selected' : ''}>Cours</option>
                        <option value="TD" ${val('cours_td_tp') === 'TD' ? 'selected' : ''}>TD</option>
                        <option value="TP" ${val('cours_td_tp') === 'TP' ? 'selected' : ''}>TP</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>VH <span style="color: #000;">*</span></label>
                    <div id="modal_vhError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="number" id="modal_vh" min="0" max="100" value="${escapeHtml(val('vh'))}" placeholder="0" oninput="validateModalNumericField('modal_vh', 'VH')"/>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'encadrement-master') {
        html = `
            <div class="modal-header">
                <h3>Encadrements assurés en Master</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Année Univ. <span style="color: #000;">*</span></label>
                    <div id="modal_annee_univError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_annee_univ" onchange="validateModalField('modal_annee_univ')">
                        <option value="" disabled ${!val('annee_univ') ? 'selected' : ''}>Choisir une année universitaire</option>
                        <option value="2013-2014" ${val('annee_univ') === '2013-2014' ? 'selected' : ''}>2013-2014</option>
                        <option value="2014-2015" ${val('annee_univ') === '2014-2015' ? 'selected' : ''}>2014-2015</option>
                        <option value="2015-2016" ${val('annee_univ') === '2015-2016' ? 'selected' : ''}>2015-2016</option>
                        <option value="2016-2017" ${val('annee_univ') === '2016-2017' ? 'selected' : ''}>2016-2017</option>
                        <option value="2017-2018" ${val('annee_univ') === '2017-2018' ? 'selected' : ''}>2017-2018</option>
                        <option value="2018-2019" ${val('annee_univ') === '2018-2019' ? 'selected' : ''}>2018-2019</option>
                        <option value="2019-2020" ${val('annee_univ') === '2019-2020' ? 'selected' : ''}>2019-2020</option>
                        <option value="2020-2021" ${val('annee_univ') === '2020-2021' ? 'selected' : ''}>2020-2021</option>
                        <option value="2021-2022" ${val('annee_univ') === '2021-2022' ? 'selected' : ''}>2021-2022</option>
                        <option value="2022-2023" ${val('annee_univ') === '2022-2023' ? 'selected' : ''}>2022-2023</option>
                        <option value="2023-2024" ${val('annee_univ') === '2023-2024' ? 'selected' : ''}>2023-2024</option>
                        <option value="2024-2025" ${val('annee_univ') === '2024-2025' ? 'selected' : ''}>2024-2025</option>
                        <option value="2025-2026" ${val('annee_univ') === '2025-2026' ? 'selected' : ''}>2025-2026</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Filière <span style="color: #000;">*</span></label>
                    <div id="modal_filiereError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_filiere" onchange="validateModalField('modal_filiere')">
                        <option value="" disabled ${!val('filiere') ? 'selected' : ''}>Choisir une filière</option>
                        <option value="Sciences Biomédicales et Qualité (SBQ)" ${val('filiere') === 'Sciences Biomédicales et Qualité (SBQ)' ? 'selected' : ''}>Sciences Biomédicales et Qualité (SBQ)</option>
                        <option value="Sciences de la Santé et BioTechnologies (SSB)" ${val('filiere') === 'Sciences de la Santé et BioTechnologies (SSB)' ? 'selected' : ''}>Sciences de la Santé et BioTechnologies (SSB)</option>
                        <option value="Chimie et Applications Industrielles et Environnementales (CAIE)" ${val('filiere') === 'Chimie et Applications Industrielles et Environnementales (CAIE)' ? 'selected' : ''}>Chimie et Applications Industrielles et Environnementales (CAIE)</option>
                        <option value="Analyse Chimique Chimiométrie et Qualité (ACCQ)" ${val('filiere') === 'Analyse Chimique Chimiométrie et Qualité (ACCQ)' ? 'selected' : ''}>Analyse Chimique Chimiométrie et Qualité (ACCQ)</option>
                        <option value="Environnement Marin et Gestion des Bio-Ressources (EMGBR)" ${val('filiere') === 'Environnement Marin et Gestion des Bio-Ressources (EMGBR)' ? 'selected' : ''}>Environnement Marin et Gestion des Bio-Ressources (EMGBR)</option>
                        <option value="Physique des Hautes Energies et Instrumentation (PHEI)" ${val('filiere') === 'Physique des Hautes Energies et Instrumentation (PHEI)' ? 'selected' : ''}>Physique des Hautes Energies et Instrumentation (PHEI)</option>
                        <option value="Matériaux & Energies (ME)" ${val('filiere') === 'Matériaux & Energies (ME)' ? 'selected' : ''}>Matériaux & Energies (ME)</option>
                        <option value="Mécanique et Ingénierie (MI)" ${val('filiere') === 'Mécanique et Ingénierie (MI)' ? 'selected' : ''}>Mécanique et Ingénierie (MI)</option>
                        <option value="Electronique, Electrotechnique, Automatique et Informatique Industrielle (EEAII)" ${val('filiere') === 'Electronique, Electrotechnique, Automatique et Informatique Industrielle (EEAII)' ? 'selected' : ''}>Electronique, Electrotechnique, Automatique et Informatique Industrielle (EEAII)</option>
                        <option value="Energies Renouvelables et Efficacité Energétique (EREE)" ${val('filiere') === 'Energies Renouvelables et Efficacité Energétique (EREE)' ? 'selected' : ''}>Energies Renouvelables et Efficacité Energétique (EREE)</option>
                        <option value="Génie Logistique (GL)" ${val('filiere') === 'Génie Logistique (GL)' ? 'selected' : ''}>Génie Logistique (GL)</option>
                        <option value="Conception et Simulation Numérique en Mécanique (CSNM)" ${val('filiere') === 'Conception et Simulation Numérique en Mécanique (CSNM)' ? 'selected' : ''}>Conception et Simulation Numérique en Mécanique (CSNM)</option>
                        <option value="Mathématiques et Applications (MA)" ${val('filiere') === 'Mathématiques et Applications (MA)' ? 'selected' : ''}>Mathématiques et Applications (MA)</option>
                        <option value="Méthodes Numériques et Statistiques Appliquées (MNSA)" ${val('filiere') === 'Méthodes Numériques et Statistiques Appliquées (MNSA)' ? 'selected' : ''}>Méthodes Numériques et Statistiques Appliquées (MNSA)</option>
                        <option value="Analyse Numérique Optimisation et Contrôle (ANOC)" ${val('filiere') === 'Analyse Numérique Optimisation et Contrôle (ANOC)' ? 'selected' : ''}>Analyse Numérique Optimisation et Contrôle (ANOC)</option>
                        <option value="Big Data Cloud Computing (BD2C)" ${val('filiere') === 'Big Data Cloud Computing (BD2C)' ? 'selected' : ''}>Big Data Cloud Computing (BD2C)</option>
                        <option value="Ingénierie des Systèmes Intelligents (ISI)" ${val('filiere') === 'Ingénierie des Systèmes Intelligents (ISI)' ? 'selected' : ''}>Ingénierie des Systèmes Intelligents (ISI)</option>
                        <option value="GEOressources GéoRISques et GéoEnvironnement (GEORISE)" ${val('filiere') === 'GEOressources GéoRISques et GéoEnvironnement (GEORISE)' ? 'selected' : ''}>GEOressources GéoRISques et GéoEnvironnement (GEORISE)</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Type de Master (MF/MS) <span style="color: #000;">*</span></label>
                    <div id="modal_type_master_selectError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_type_master_select" onchange="validateModalField('modal_type_master_select')">
                        <option value="" disabled ${!val('type_master') ? 'selected' : ''}>Choisir un type de Master</option>
                        <option value="MF" ${val('type_master') === 'MF' ? 'selected' : ''}>MF</option>
                        <option value="MS" ${val('type_master') === 'MS' ? 'selected' : ''}>MS</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Titre du Mémoire <span style="color: #000;">*</span></label>
                    <div id="modal_titre_memoireError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_titre_memoire" oninput="validateModalField('modal_titre_memoire'); updateCharCounter('modal_titre_memoire', 'modal_titre_memoireCounter')">${escapeHtml(val('titre_memoire'))}</textarea>
                    <div id="modal_titre_memoireCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom(s) de(s) étudiant(e) <span style="color: #000;">*</span></label>
                    <div id="modal_nom_etudiantsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_nom_etudiants" oninput="validateModalField('modal_nom_etudiants'); updateCharCounter('modal_nom_etudiants', 'modal_nom_etudiantsCounter')">${escapeHtml(val('nom_etudiants'))}</textarea>
                    <div id="modal_nom_etudiantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom(s) des encadrants <span style="color: #000;">*</span></label>
                    <div id="modal_nom_encadrantsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_nom_encadrants" oninput="validateModalField('modal_nom_encadrants'); updateCharCounter('modal_nom_encadrants', 'modal_nom_encadrantsCounter')">${escapeHtml(val('nom_encadrants'))}</textarea>
                    <div id="modal_nom_encadrantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Page de garde (PDF) <span style="color: #000;">*</span></label>
                    <div id="modal_enc_master_coverError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_enc_master_cover').click()">Sélectionner fichier</button>
                        <span class="file-upload-text" id="modal_enc_master_cover_fileName">
                            ${val('page_de_garde') ? `<a href="/static/${val('page_de_garde')}" target="_blank" onclick="event.stopPropagation();">Voir fichier existant</a>` : 'Aucun fichier'}
                        </span>
                        <input type="file" style="display: none;" id="modal_enc_master_cover" name="modal_enc_master_cover" accept=".pdf" onchange="validateModalFile(this, 'modal_enc_master_cover')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'responsabilites') {
        html = `
            <div class="modal-header">
                <h3>Responsabilités (Licence / Master)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Années Univ. <span style="color: #000;">*</span></label>
                    <div id="modal_annee_univError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_annee_univ" onchange="validateModalField('modal_annee_univ')">
                        <option value="" disabled ${!val('annees_univ') ? 'selected' : ''}>Choisir une année universitaire</option>
                        <option value="2013-2014" ${val('annees_univ') === '2013-2014' ? 'selected' : ''}>2013-2014</option>
                        <option value="2014-2015" ${val('annees_univ') === '2014-2015' ? 'selected' : ''}>2014-2015</option>
                        <option value="2015-2016" ${val('annees_univ') === '2015-2016' ? 'selected' : ''}>2015-2016</option>
                        <option value="2016-2017" ${val('annees_univ') === '2016-2017' ? 'selected' : ''}>2016-2017</option>
                        <option value="2017-2018" ${val('annees_univ') === '2017-2018' ? 'selected' : ''}>2017-2018</option>
                        <option value="2018-2019" ${val('annees_univ') === '2018-2019' ? 'selected' : ''}>2018-2019</option>
                        <option value="2019-2020" ${val('annees_univ') === '2019-2020' ? 'selected' : ''}>2019-2020</option>
                        <option value="2020-2021" ${val('annees_univ') === '2020-2021' ? 'selected' : ''}>2020-2021</option>
                        <option value="2021-2022" ${val('annees_univ') === '2021-2022' ? 'selected' : ''}>2021-2022</option>
                        <option value="2022-2023" ${val('annees_univ') === '2022-2023' ? 'selected' : ''}>2022-2023</option>
                        <option value="2023-2024" ${val('annees_univ') === '2023-2024' ? 'selected' : ''}>2023-2024</option>
                        <option value="2024-2025" ${val('annees_univ') === '2024-2025' ? 'selected' : ''}>2024-2025</option>
                        <option value="2025-2026" ${val('annees_univ') === '2025-2026' ? 'selected' : ''}>2025-2026</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Cycle <span style="color: #000;">*</span></label>
                    <div id="modal_cycle_selectError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_cycle_select" onchange="validateModalField('modal_cycle_select')">
                        <option value="" disabled ${!val('cycle') ? 'selected' : ''}>Choisir un cycle</option>
                        <option value="Licence" ${val('cycle') === 'Licence' ? 'selected' : ''}>Licence</option>
                        <option value="Master" ${val('cycle') === 'Master' ? 'selected' : ''}>Master</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Filière <span style="color: #000;">*</span></label>
                    <div id="modal_filiereError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_filiere" onchange="validateModalField('modal_filiere')">
                        <option value="" disabled ${!val('filiere') ? 'selected' : ''}>Choisir une filière</option>
                        <optgroup label="Licences Fondamentales">
                            <option value="Sciences de la matière Physique (SMP)" ${val('filiere') === 'Sciences de la matière Physique (SMP)' ? 'selected' : ''}>Sciences de la matière Physique (SMP)</option>
                            <option value="Sciences de la matière Chimie (SMC)" ${val('filiere') === 'Sciences de la matière Chimie (SMC)' ? 'selected' : ''}>Sciences de la matière Chimie (SMC)</option>
                            <option value="Sciences de la Vie (SV)" ${val('filiere') === 'Sciences de la Vie (SV)' ? 'selected' : ''}>Sciences de la Vie (SV)</option>
                            <option value="Sciences de la Terre et de l'Univers (STU)" ${val('filiere') === 'Sciences de la Terre et de l\'Univers (STU)' ? 'selected' : ''}>Sciences de la Terre et de l'Univers (STU)</option>
                            <option value="Sciences Mathématiques et Applications (SMA)" ${val('filiere') === 'Sciences Mathématiques et Applications (SMA)' ? 'selected' : ''}>Sciences Mathématiques et Applications (SMA)</option>
                            <option value="Sciences Mathématiques et Informatique (SMI)" ${val('filiere') === 'Sciences Mathématiques et Informatique (SMI)' ? 'selected' : ''}>Sciences Mathématiques et Informatique (SMI)</option>
                        </optgroup>
                        <optgroup label="Parcours d'excellence">
                            <option value="Conception et Simulation Numérique en Mécanique (CSNM)" ${val('filiere') === 'Conception et Simulation Numérique en Mécanique (CSNM)' ? 'selected' : ''}>Conception et Simulation Numérique en Mécanique (CSNM)</option>
                        </optgroup>
                        <optgroup label="Filières Chimie">
                            <option value="Chimie Analytique Contrôle Qualité" ${val('filiere') === 'Chimie Analytique Contrôle Qualité' ? 'selected' : ''}>Chimie Analytique Contrôle Qualité</option>
                            <option value="Formulation des Produits industriels" ${val('filiere') === 'Formulation des Produits industriels' ? 'selected' : ''}>Formulation des Produits industriels</option>
                            <option value="Gestion des Effluents liquides et solides" ${val('filiere') === 'Gestion des Effluents liquides et solides' ? 'selected' : ''}>Gestion des Effluents liquides et solides</option>
                            <option value="Matériaux Organique et inorganique" ${val('filiere') === 'Matériaux Organique et inorganique' ? 'selected' : ''}>Matériaux Organique et inorganique</option>
                        </optgroup>
                        <optgroup label="Filières Physique">
                            <option value="Energies Renouvelables (EREE)" ${val('filiere') === 'Energies Renouvelables (EREE)' ? 'selected' : ''}>Energies Renouvelables (EREE)</option>
                            <option value="Dosimétrie" ${val('filiere') === 'Dosimétrie' ? 'selected' : ''}>Dosimétrie</option>
                            <option value="Génie électrique (GE)" ${val('filiere') === 'Génie électrique (GE)' ? 'selected' : ''}>Génie électrique (GE)</option>
                            <option value="Ingénierie en mécanique et énergétique (IME)" ${val('filiere') === 'Ingénierie en mécanique et énergétique (IME)' ? 'selected' : ''}>Ingénierie en mécanique et énergétique (IME)</option>
                            <option value="Matériaux et Energie" ${val('filiere') === 'Matériaux et Energie' ? 'selected' : ''}>Matériaux et Energie</option>
                        </optgroup>
                        <optgroup label="Filières Mathématiques">
                            <option value="Analyse Mathématique" ${val('filiere') === 'Analyse Mathématique' ? 'selected' : ''}>Analyse Mathématique</option>
                            <option value="Calcul Scientifique et Optimisation" ${val('filiere') === 'Calcul Scientifique et Optimisation' ? 'selected' : ''}>Calcul Scientifique et Optimisation</option>
                            <option value="Codage et Cryptographie" ${val('filiere') === 'Codage et Cryptographie' ? 'selected' : ''}>Codage et Cryptographie</option>
                            <option value="Statistiques et Aide à la Décision" ${val('filiere') === 'Statistiques et Aide à la Décision' ? 'selected' : ''}>Statistiques et Aide à la Décision</option>
                        </optgroup>
                        <optgroup label="Filières Biologie">
                            <option value="Pharmacologie et Développement Molécules (PDM)" ${val('filiere') === 'Pharmacologie et Développement Molécules (PDM)' ? 'selected' : ''}>Pharmacologie et Développement Molécules (PDM)</option>
                            <option value="Biotechnologie et Environnement" ${val('filiere') === 'Biotechnologie et Environnement' ? 'selected' : ''}>Biotechnologie et Environnement</option>
                            <option value="Biologie et Technologie" ${val('filiere') === 'Biologie et Technologie' ? 'selected' : ''}>Biologie et Technologie</option>
                            <option value="Bio-Analyses Médicales" ${val('filiere') === 'Bio-Analyses Médicales' ? 'selected' : ''}>Bio-Analyses Médicales</option>
                        </optgroup>
                        <optgroup label="Filières Géologie">
                            <option value="Géosciences" ${val('filiere') === 'Géosciences' ? 'selected' : ''}>Géosciences</option>
                        </optgroup>
                        <optgroup label="Filières Informatique (IA)">
                            <option value="Ingénierie Logicielle" ${val('filiere') === 'Ingénierie Logicielle' ? 'selected' : ''}>Ingénierie Logicielle</option>
                            <option value="Cybersécurité" ${val('filiere') === 'Cybersécurité' ? 'selected' : ''}>Cybersécurité</option>
                        </optgroup>
                        <optgroup label="Filières Informatique (MI)">
                            <option value="Développement informatique" ${val('filiere') === 'Développement informatique' ? 'selected' : ''}>Développement informatique</option>
                            <option value="Administration des Systèmes" ${val('filiere') === 'Administration des Systèmes' ? 'selected' : ''}>Administration des Systèmes</option>
                        </optgroup>
                        <optgroup label="Filières Master">
                            <option value="Sciences Biomédicales et Qualité (SBQ)" ${val('filiere') === 'Sciences Biomédicales et Qualité (SBQ)' ? 'selected' : ''}>Sciences Biomédicales et Qualité (SBQ)</option>
                            <option value="Sciences de la Santé et BioTechnologies (SSB)" ${val('filiere') === 'Sciences de la Santé et BioTechnologies (SSB)' ? 'selected' : ''}>Sciences de la Santé et BioTechnologies (SSB)</option>
                            <option value="Chimie et Applications Industrielles et Environnementales (CAIE)" ${val('filiere') === 'Chimie et Applications Industrielles et Environnementales (CAIE)' ? 'selected' : ''}>Chimie et Applications Industrielles et Environnementales (CAIE)</option>
                            <option value="Analyse Chimique Chimiométrie et Qualité (ACCQ)" ${val('filiere') === 'Analyse Chimique Chimiométrie et Qualité (ACCQ)' ? 'selected' : ''}>Analyse Chimique Chimiométrie et Qualité (ACCQ)</option>
                            <option value="Environnement Marin et Gestion des Bio-Ressources (EMGBR)" ${val('filiere') === 'Environnement Marin et Gestion des Bio-Ressources (EMGBR)' ? 'selected' : ''}>Environnement Marin et Gestion des Bio-Ressources (EMGBR)</option>
                            <option value="Physique des Hautes Energies et Instrumentation (PHEI)" ${val('filiere') === 'Physique des Hautes Energies et Instrumentation (PHEI)' ? 'selected' : ''}>Physique des Hautes Energies et Instrumentation (PHEI)</option>
                            <option value="Matériaux & Energies (ME)" ${val('filiere') === 'Matériaux & Energies (ME)' ? 'selected' : ''}>Matériaux & Energies (ME)</option>
                            <option value="Mécanique et Ingénierie (MI)" ${val('filiere') === 'Mécanique et Ingénierie (MI)' ? 'selected' : ''}>Mécanique et Ingénierie (MI)</option>
                            <option value="Electronique, Electrotechnique, Automatique et Informatique Industrielle (EEAII)" ${val('filiere') === 'Electronique, Electrotechnique, Automatique et Informatique Industrielle (EEAII)' ? 'selected' : ''}>Electronique, Electrotechnique, Automatique et Informatique Industrielle (EEAII)</option>
                            <option value="Energies Renouvelables et Efficacité Energétique (EREE)" ${val('filiere') === 'Energies Renouvelables et Efficacité Energétique (EREE)' ? 'selected' : ''}>Energies Renouvelables et Efficacité Energétique (EREE)</option>
                            <option value="Génie Logistique (GL)" ${val('filiere') === 'Génie Logistique (GL)' ? 'selected' : ''}>Génie Logistique (GL)</option>
                            <option value="Conception et Simulation Numérique en Mécanique (CSNM)" ${val('filiere') === 'Conception et Simulation Numérique en Mécanique (CSNM)' ? 'selected' : ''}>Conception et Simulation Numérique en Mécanique (CSNM)</option>
                            <option value="Mathématiques et Applications (MA)" ${val('filiere') === 'Mathématiques et Applications (MA)' ? 'selected' : ''}>Mathématiques et Applications (MA)</option>
                            <option value="Méthodes Numériques et Statistiques Appliquées (MNSA)" ${val('filiere') === 'Méthodes Numériques et Statistiques Appliquées (MNSA)' ? 'selected' : ''}>Méthodes Numériques et Statistiques Appliquées (MNSA)</option>
                            <option value="Analyse Numérique Optimisation et Contrôle (ANOC)" ${val('filiere') === 'Analyse Numérique Optimisation et Contrôle (ANOC)' ? 'selected' : ''}>Analyse Numérique Optimisation et Contrôle (ANOC)</option>
                            <option value="Big Data Cloud Computing (BD2C)" ${val('filiere') === 'Big Data Cloud Computing (BD2C)' ? 'selected' : ''}>Big Data Cloud Computing (BD2C)</option>
                            <option value="Ingénierie des Systèmes Intelligents (ISI)" ${val('filiere') === 'Ingénierie des Systèmes Intelligents (ISI)' ? 'selected' : ''}>Ingénierie des Systèmes Intelligents (ISI)</option>
                            <option value="GEOressources GéoRISques et GéoEnvironnement (GEORISE)" ${val('filiere') === 'GEOressources GéoRISques et GéoEnvironnement (GEORISE)' ? 'selected' : ''}>GEOressources GéoRISques et GéoEnvironnement (GEORISE)</option>
                        </optgroup>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Semestre <span style="color: #000;">*</span></label>
                    <div id="modal_semestreError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_semestre" onchange="validateModalField('modal_semestre')">
                        <option value="" disabled ${!val('semestre') ? 'selected' : ''}>Choisir un semestre</option>
                        <option value="S1" ${val('semestre') === 'S1' ? 'selected' : ''}>S1</option>
                        <option value="S2" ${val('semestre') === 'S2' ? 'selected' : ''}>S2</option>
                        <option value="S3" ${val('semestre') === 'S3' ? 'selected' : ''}>S3</option>
                        <option value="S4" ${val('semestre') === 'S4' ? 'selected' : ''}>S4</option>
                        <option value="S5" ${val('semestre') === 'S5' ? 'selected' : ''}>S5</option>
                        <option value="S6" ${val('semestre') === 'S6' ? 'selected' : ''}>S6</option>
                        <option value="S7" ${val('semestre') === 'S7' ? 'selected' : ''}>S7</option>
                        <option value="S8" ${val('semestre') === 'S8' ? 'selected' : ''}>S8</option>
                        <option value="S9" ${val('semestre') === 'S9' ? 'selected' : ''}>S9</option>
                        <option value="S10" ${val('semestre') === 'S10' ? 'selected' : ''}>S10</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Intitulé du module <span style="color: #000;">*</span></label>
                    <div id="modal_intitule_moduleError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_intitule_module" oninput="validateModalField('modal_intitule_module'); updateCharCounter('modal_intitule_module', 'modal_intitule_moduleCounter')">${escapeHtml(val('intitule_module'))}</textarea>
                    <div id="modal_intitule_moduleCounter" class="char-counter"></div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ae1-1') {
        html = `
            <div class="modal-header">
                <h3>Publications d'ouvrages d'enseignement (ISSN ou ISBN)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Titres <span style="color: #000;">*</span></label>
                    <div id="modal_titresError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_titres" oninput="validateModalField('modal_titres'); updateCharCounter('modal_titres', 'modal_titresCounter')">${escapeHtml(val('titres'))}</textarea>
                    <div id="modal_titresCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Auteurs <span style="color: #000;">*</span></label>
                    <div id="modal_auteursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_auteurs" oninput="validateModalField('modal_auteurs'); updateCharCounter('modal_auteurs', 'modal_auteursCounter')">${escapeHtml(val('auteurs'))}</textarea>
                    <div id="modal_auteursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Niveau <span style="color: #000;">*</span></label>
                    <div id="modal_niveauxError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_niveaux" onchange="validateModalField('modal_niveaux')">
                        <option value="" disabled ${!val('niveaux') ? 'selected' : ''}>Choisir un niveau</option>
                        <option value="Licence" ${val('niveaux') === 'Licence' ? 'selected' : ''}>Licence</option>
                        <option value="Master" ${val('niveaux') === 'Master' ? 'selected' : ''}>Master</option>
                        <option value="Doctorat" ${val('niveaux') === 'Doctorat' ? 'selected' : ''}>Doctorat</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Éditeurs <span style="color: #000;">*</span></label>
                    <div id="modal_editeursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_editeurs" oninput="validateModalField('modal_editeurs'); updateCharCounter('modal_editeurs', 'modal_editeursCounter')">${escapeHtml(val('editeurs'))}</textarea>
                    <div id="modal_editeursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Années d'édition <span style="color: #000;">*</span></label>
                    <div id="modal_anneesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_annees" onchange="validateModalField('modal_annees')">
                        <option value="" disabled ${!val('annees') ? 'selected' : ''}>Choisis une année</option>
                        <option value="2013" ${val('annees') === '2013' ? 'selected' : ''}>2013</option>
                        <option value="2014" ${val('annees') === '2014' ? 'selected' : ''}>2014</option>
                        <option value="2015" ${val('annees') === '2015' ? 'selected' : ''}>2015</option>
                        <option value="2016" ${val('annees') === '2016' ? 'selected' : ''}>2016</option>
                        <option value="2017" ${val('annees') === '2017' ? 'selected' : ''}>2017</option>
                        <option value="2018" ${val('annees') === '2018' ? 'selected' : ''}>2018</option>
                        <option value="2019" ${val('annees') === '2019' ? 'selected' : ''}>2019</option>
                        <option value="2020" ${val('annees') === '2020' ? 'selected' : ''}>2020</option>
                        <option value="2021" ${val('annees') === '2021' ? 'selected' : ''}>2021</option>
                        <option value="2022" ${val('annees') === '2022' ? 'selected' : ''}>2022</option>
                        <option value="2023" ${val('annees') === '2023' ? 'selected' : ''}>2023</option>
                        <option value="2024" ${val('annees') === '2024' ? 'selected' : ''}>2024</option>
                        <option value="2025" ${val('annees') === '2025' ? 'selected' : ''}>2025</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Fichiers justificatifs (PDF) <span style="color: #000;">*</span></label>
                    <div id="modal_ae1_1_fileError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ae1_1_file').click()">Sélect. fichiers</button>
                        <span class="file-upload-text" id="modal_ae1_1_fileName">${escapeHtml(val('PDF') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ae1_1_file" name="modal_ae1_1_file" accept=".pdf" onchange="updateFileName(this, 'modal_ae1_1_fileName'); validateModalFile(this, 'modal_ae1_1_file')">
                    </div>
                </div>
                <div class="modal-form-group">
                    <label>N° de dépôt légal / ISSN / ISBN <span style="color: #000;">*</span></label>
                    <div id="modal_numero_depotError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_numero_depot" value="${escapeHtml(val('numero_depot'))}"
                           oninput="validateModalField('modal_numero_depot'); updateCharCounter('modal_numero_depot', 'modal_numero_depotCounter')"
                           pattern="[0-9]+"
                           inputmode="numeric"
                           title="Le numéro doit contenir uniquement des chiffres"
                           placeholder="Ex: 123456789">
                    <div id="modal_numero_depotCounter" class="char-counter"></div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ae1-2') {
        html = `
            <div class="modal-header">
                <h3>Manuel / Polycopié</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Fichiers justificatifs (PDF) <span style="color: #000;">*</span></label>
                    <div id="modal_ae1_2_fileError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ae1_2_file').click()">Sélect. fichiers</button>
                        <span class="file-upload-text" id="modal_ae1_2_fileName">${escapeHtml(val('PDF') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ae1_2_file" name="modal_ae1_2_file" accept=".pdf" onchange="updateFileName(this, 'modal_ae1_2_fileName'); validateModalFile(this, 'modal_ae1_2_file')">
                    </div>
                </div>
                <div class="modal-form-group">
                    <label>Auteurs <span style="color: #000;">*</span></label>
                    <div id="modal_auteursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_auteurs" oninput="validateModalField('modal_auteurs'); updateCharCounter('modal_auteurs', 'modal_auteursCounter')">${escapeHtml(val('auteurs'))}</textarea>
                    <div id="modal_auteursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Départements d'attache <span style="color: #000;">*</span></label>
                    <div id="modal_departementsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_departements" oninput="validateModalField('modal_departements'); updateCharCounter('modal_departements', 'modal_departementsCounter')">${escapeHtml(val('departements'))}</textarea>
                    <div id="modal_departementsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Années d'élaboration <span style="color: #000;">*</span></label>
                    <div id="modal_anneesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_annees" onchange="validateModalField('modal_annees')">
                        <option value="" disabled ${!val('annees') ? 'selected' : ''}>Choisis une année</option>
                        <option value="2013" ${val('annees') === '2013' ? 'selected' : ''}>2013</option>
                        <option value="2014" ${val('annees') === '2014' ? 'selected' : ''}>2014</option>
                        <option value="2015" ${val('annees') === '2015' ? 'selected' : ''}>2015</option>
                        <option value="2016" ${val('annees') === '2016' ? 'selected' : ''}>2016</option>
                        <option value="2017" ${val('annees') === '2017' ? 'selected' : ''}>2017</option>
                        <option value="2018" ${val('annees') === '2018' ? 'selected' : ''}>2018</option>
                        <option value="2019" ${val('annees') === '2019' ? 'selected' : ''}>2019</option>
                        <option value="2020" ${val('annees') === '2020' ? 'selected' : ''}>2020</option>
                        <option value="2021" ${val('annees') === '2021' ? 'selected' : ''}>2021</option>
                        <option value="2022" ${val('annees') === '2022' ? 'selected' : ''}>2022</option>
                        <option value="2023" ${val('annees') === '2023' ? 'selected' : ''}>2023</option>
                        <option value="2024" ${val('annees') === '2024' ? 'selected' : ''}>2024</option>
                        <option value="2025" ${val('annees') === '2025' ? 'selected' : ''}>2025</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Filières <span style="color: #000;">*</span></label>
                    <div id="modal_filieresError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_filieres" oninput="validateModalField('modal_filieres'); updateCharCounter('modal_filieres', 'modal_filieresCounter')">${escapeHtml(val('filieres'))}</textarea>
                    <div id="modal_filieresCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Semestres <span style="color: #000;">*</span></label>
                </div>
                <div class="modal-form-group">
                    <div id="modal_semestresError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_semestres" onchange="validateModalField('modal_semestres')">
                        <option value="" disabled ${!val('semestres') ? 'selected' : ''}>Choisis un semestre</option>
                        <option value="S1" ${val('semestres') === 'S1' ? 'selected' : ''}>S1</option>
                        <option value="S2" ${val('semestres') === 'S2' ? 'selected' : ''}>S2</option>
                        <option value="S3" ${val('semestres') === 'S3' ? 'selected' : ''}>S3</option>
                        <option value="S4" ${val('semestres') === 'S4' ? 'selected' : ''}>S4</option>
                        <option value="S5" ${val('semestres') === 'S5' ? 'selected' : ''}>S5</option>
                        <option value="S6" ${val('semestres') === 'S6' ? 'selected' : ''}>S6</option>
                        <option value="S7" ${val('semestres') === 'S7' ? 'selected' : ''}>S7</option>
                        <option value="S8" ${val('semestres') === 'S8' ? 'selected' : ''}>S8</option>
                        <option value="S9" ${val('semestres') === 'S9' ? 'selected' : ''}>S9</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Type de polycopié <span style="color: #000;">*</span></label>
                    <div id="modal_typesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_types" onchange="validateModalField('modal_types')">
                        <option value="" disabled ${!val('types') ? 'selected' : ''}>Choisis un type</option>
                        <option value="Cours Magistral (CM)" ${val('types') === 'Cours Magistral (CM)' ? 'selected' : ''}>Cours Magistral (CM)</option>
                        <option value="TD" ${val('types') === 'TD' ? 'selected' : ''}>TD</option>
                        <option value="TP" ${val('types') === 'TP' ? 'selected' : ''}>TP</option>
                    </select>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ae1-3') {
        html = `
            <div class="modal-header">
                <h3>Supports NTIC et innovations pédagogiques</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Objectifs <span style="color: #000;">*</span></label>
                    <div id="modal_objectifsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_objectifs" oninput="validateModalField('modal_objectifs'); updateCharCounter('modal_objectifs', 'modal_objectifsCounter')">${escapeHtml(val('objectifs'))}</textarea>
                    <div id="modal_objectifsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Auteurs <span style="color: #000;">*</span></label>
                    <div id="modal_auteursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_auteurs" oninput="validateModalField('modal_auteurs'); updateCharCounter('modal_auteurs', 'modal_auteursCounter')">${escapeHtml(val('auteurs'))}</textarea>
                    <div id="modal_auteursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Filière <span style="color: #000;">*</span></label>
                    <div id="modal_filieresError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_filieres" value="${escapeHtml(val('filieres'))}" oninput="validateModalField('modal_filieres')">
                </div>
                <div class="modal-form-group">
                    <label>Niveau <span style="color: #000;">*</span></label>
                    <div id="modal_niveauxError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_niveaux" onchange="validateModalField('modal_niveaux')">
                        <option value="" disabled ${!val('niveaux') ? 'selected' : ''}>Choisis un niveau</option>
                        <option value="Licence" ${val('niveaux') === 'Licence' ? 'selected' : ''}>Licence</option>
                        <option value="Master" ${val('niveaux') === 'Master' ? 'selected' : ''}>Master</option>
                        <option value="Doctorat" ${val('niveaux') === 'Doctorat' ? 'selected' : ''}>Doctorat</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Année universitaire <span style="color: #000;">*</span></label>
                    <div id="modal_anneesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_annees" value="${escapeHtml(val('annees'))}" oninput="validateModalField('modal_annees')" placeholder="ex: 2024-2025">
                </div>
                <div class="modal-form-group">
                    <label>Lien du site web</label>
                    <div id="modal_liensError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_liens" value="${escapeHtml(val('liens'))}" oninput="validateModalField('modal_liens', false, '')" placeholder="http://...">
                </div>
                <div class="modal-form-group">
                    <label>Type de support <span style="color: #000;">*</span></label>
                    <div id="modal_typesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_types" onchange="validateModalField('modal_types')">
                        <option value="" disabled ${!val('types') ? 'selected' : ''}>Choisis un type</option>
                        <option value="Diaporama" ${val('types') === 'Diaporama' ? 'selected' : ''}>Diaporama</option>
                        <option value="Didacticiel" ${val('types') === 'Didacticiel' ? 'selected' : ''}>Didacticiel</option>
                        <option value="Nouveau TP" ${val('types') === 'Nouveau TP' ? 'selected' : ''}>Nouveau TP</option>
                        <option value="Page web ou homepage" ${val('types') === 'Page web ou homepage' ? 'selected' : ''}>Page web ou homepage</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Justificatif (PDF) <span style="color: #000;">*</span></label>
                    <div id="modal_ae1_3_fileError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ae1_3_file').click()">Sélect. fichiers</button>
                        <span class="file-upload-text" id="modal_ae1_3_fileName">${escapeHtml(val('PDF') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ae1_3_file" name="modal_ae1_3_file" accept=".pdf" onchange="updateFileName(this, 'modal_ae1_3_fileName'); validateModalFile(this, 'modal_ae1_3_file')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ae2-1') {
        html = `
            <div class="modal-header">
                <h3>Encadrement de cours, TD, et de PFE (cycle Licence)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Année Univ. <span style="color: #000;">*</span></label>
                    <div id="modal_annee_univError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_annee_univ" onchange="validateModalField('modal_annee_univ')">
                        <option value="" disabled ${!val('annee_univ') ? 'selected' : ''}>Choisir une année universitaire</option>
                        ${(() => { let o = ''; for (let y = 2000; y <= 2024; y++) { const v = y + '-' + (y + 1); o += '<option value="' + v + '" ' + (val('annee_univ') === v ? 'selected' : '') + '>' + v + '</option>'; } return o; })()}
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Type (Cours/TD/PFE) <span style="color: #000;">*</span></label>
                    <div id="modal_typeError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_type" onchange="validateModalField('modal_type')">
                        <option value="" disabled ${!val('type') ? 'selected' : ''}>Choisir un type</option>
                        <option value="Cours" ${val('type') === 'Cours' ? 'selected' : ''}>Cours</option>
                        <option value="TD" ${val('type') === 'TD' ? 'selected' : ''}>TD</option>
                        <option value="PFE" ${val('type') === 'PFE' ? 'selected' : ''}>PFE</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Filière <span style="color: #000;">*</span></label>
                    <div id="modal_filiereError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_filiere" oninput="validateModalField('modal_filiere'); updateCharCounter('modal_filiere', 'modal_filiereCounter')">${escapeHtml(val('filiere'))}</textarea>
                    <div id="modal_filiereCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom(s) des étudiant(e)s <span style="color: #000;">*</span></label>
                    <div id="modal_nom_etudiantsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_nom_etudiants" oninput="validateModalField('modal_nom_etudiants'); updateCharCounter('modal_nom_etudiants', 'modal_nom_etudiantsCounter')">${escapeHtml(val('nom_etudiants'))}</textarea>
                    <div id="modal_nom_etudiantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Intitulé du cours/TD/PFE <span style="color: #000;">*</span></label>
                    <div id="modal_intituleError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_intitule" oninput="validateModalField('modal_intitule'); updateCharCounter('modal_intitule', 'modal_intituleCounter')">${escapeHtml(val('intitule'))}</textarea>
                    <div id="modal_intituleCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Détails</label>
                </div>
                <div class="modal-form-group">
                    <label>Département d'attache <span style="color: #000;">*</span></label>
                    <div id="modal_departementsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_departements" oninput="validateModalField('modal_departements'); updateCharCounter('modal_departements', 'modal_departementsCounter')">${escapeHtml(val('departements'))}</textarea>
                    <div id="modal_departementsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Module ou élément de module <span style="color: #000;">*</span></label>
                    <div id="modal_modulesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_modules" oninput="validateModalField('modal_modules'); updateCharCounter('modal_modules', 'modal_modulesCounter')">${escapeHtml(val('modules'))}</textarea>
                    <div id="modal_modulesCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Co-enseignants ou co-encadrants <span style="color: #000;">*</span></label>
                    <div id="modal_coenseignantsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_coenseignants" oninput="validateModalField('modal_coenseignants'); updateCharCounter('modal_coenseignants', 'modal_coenseignantsCounter')">${escapeHtml(val('coenseignants'))}</textarea>
                    <div id="modal_coenseignantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom(s) du (des) co-enseignant(s) <span style="color: #000;">*</span></label>
                    <div id="modal_coenseignantsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_coenseignants" oninput="validateModalField('modal_coenseignants'); updateCharCounter('modal_coenseignants', 'modal_coenseignantsCounter')">${escapeHtml(val('coenseignants'))}</textarea>
                    <div id="modal_coenseignantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <textarea id="modal_details" oninput="updateCharCounter('modal_details', 'modal_detailsCounter')">${escapeHtml(val('details'))}</textarea>
                    <div id="modal_detailsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Fichier justificatif (PDF) <span style="color: #000;">*</span></label>
                    <div id="modal_${type}_fileError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_${type}_file').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_${type}_fileName">${escapeHtml(val('PDF') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_${type}_file" name="modal_${type}_file" accept=".pdf" onchange="updateFileName(this, 'modal_${type}_fileName'); validateModalFile(this, 'modal_${type}_file')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ae2-2') {
        html = `
            <div class="modal-header">
                <h3>Encadrement de cours et mémoires (cycle Master)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Année Univ. <span style="color: #000;">*</span></label>
                    <div id="modal_annee_univError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_annee_univ" onchange="validateModalField('modal_annee_univ')">
                        <option value="" disabled ${!val('annee_univ') ? 'selected' : ''}>Choisir une année universitaire</option>
                        <option value="2013-2014" ${val('annee_univ') === '2013-2014' ? 'selected' : ''}>2013-2014</option>
                        <option value="2014-2015" ${val('annee_univ') === '2014-2015' ? 'selected' : ''}>2014-2015</option>
                        <option value="2015-2016" ${val('annee_univ') === '2015-2016' ? 'selected' : ''}>2015-2016</option>
                        <option value="2016-2017" ${val('annee_univ') === '2016-2017' ? 'selected' : ''}>2016-2017</option>
                        <option value="2017-2018" ${val('annee_univ') === '2017-2018' ? 'selected' : ''}>2017-2018</option>
                        <option value="2018-2019" ${val('annee_univ') === '2018-2019' ? 'selected' : ''}>2018-2019</option>
                        <option value="2019-2020" ${val('annee_univ') === '2019-2020' ? 'selected' : ''}>2019-2020</option>
                        <option value="2020-2021" ${val('annee_univ') === '2020-2021' ? 'selected' : ''}>2020-2021</option>
                        <option value="2021-2022" ${val('annee_univ') === '2021-2022' ? 'selected' : ''}>2021-2022</option>
                        <option value="2022-2023" ${val('annee_univ') === '2022-2023' ? 'selected' : ''}>2022-2023</option>
                        <option value="2023-2024" ${val('annee_univ') === '2023-2024' ? 'selected' : ''}>2023-2024</option>
                        <option value="2024-2025" ${val('annee_univ') === '2024-2025' ? 'selected' : ''}>2024-2025</option>
                        <option value="2025-2026" ${val('annee_univ') === '2025-2026' ? 'selected' : ''}>2025-2026</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Type (Cours/Mémoire) <span style="color: #000;">*</span></label>
                    <div id="modal_typeError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_type" onchange="validateModalField('modal_type')">
                        <option value="" disabled ${!val('type') ? 'selected' : ''}>Choisir un type</option>
                        <option value="Cours" ${val('type') === 'Cours' ? 'selected' : ''}>Cours</option>
                        <option value="Mémoire" ${val('type') === 'Mémoire' ? 'selected' : ''}>Mémoire</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Filière <span style="color: #000;">*</span></label>
                    <div id="modal_filiereError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_filiere" oninput="validateModalField('modal_filiere'); updateCharCounter('modal_filiere', 'modal_filiereCounter')">${escapeHtml(val('filiere'))}</textarea>
                    <div id="modal_filiereCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom(s) des étudiant(e)s <span style="color: #000;">*</span></label>
                    <div id="modal_nom_etudiantsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_nom_etudiants" oninput="validateModalField('modal_nom_etudiants'); updateCharCounter('modal_nom_etudiants', 'modal_nom_etudiantsCounter')">${escapeHtml(val('nom_etudiants'))}</textarea>
                    <div id="modal_nom_etudiantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Intitulé du cours/Mémoire <span style="color: #000;">*</span></label>
                    <div id="modal_intituleError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_intitule" oninput="validateModalField('modal_intitule'); updateCharCounter('modal_intitule', 'modal_intituleCounter')">${escapeHtml(val('intitule'))}</textarea>
                    <div id="modal_intituleCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Détails</label>
                </div>
                <div class="modal-form-group">
                    <label>Département d'attache <span style="color: #000;">*</span></label>
                    <div id="modal_departementsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_departements" oninput="validateModalField('modal_departements'); updateCharCounter('modal_departements', 'modal_departementsCounter')">${escapeHtml(val('departements'))}</textarea>
                    <div id="modal_departementsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Coordonnateur du Master <span style="color: #000;">*</span></label>
                    <div id="modal_coordonnateursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_coordonnateurs" oninput="validateModalField('modal_coordonnateurs'); updateCharCounter('modal_coordonnateurs', 'modal_coordonnateursCounter')">${escapeHtml(val('coordonnateurs'))}</textarea>
                    <div id="modal_coordonnateursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Co-enseignants ou co-encadrants <span style="color: #000;">*</span></label>
                    <div id="modal_coenseignantsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_coenseignants" oninput="validateModalField('modal_coenseignants'); updateCharCounter('modal_coenseignants', 'modal_coenseignantsCounter')">${escapeHtml(val('coenseignants'))}</textarea>
                    <div id="modal_coenseignantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom du coordonnateur <span style="color: #000;">*</span></label>
                    <div id="modal_coordonnateursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_coordonnateurs" oninput="validateModalField('modal_coordonnateurs'); updateCharCounter('modal_coordonnateurs', 'modal_coordonnateursCounter')">${escapeHtml(val('coordonnateurs'))}</textarea>
                    <div id="modal_coordonnateursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom(s) du (des) co-enseignant(s) <span style="color: #000;">*</span></label>
                    <div id="modal_coenseignantsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_coenseignants" oninput="validateModalField('modal_coenseignants'); updateCharCounter('modal_coenseignants', 'modal_coenseignantsCounter')">${escapeHtml(val('coenseignants'))}</textarea>
                    <div id="modal_coenseignantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <textarea id="modal_details" oninput="updateCharCounter('modal_details', 'modal_detailsCounter')">${escapeHtml(val('details'))}</textarea>
                    <div id="modal_detailsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Copie de la page de garde cachetée <span style="color: #000;">*</span></label>
                    <div id="modal_${type}_fileError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_${type}_file').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_${type}_fileName">${escapeHtml(val('PDF') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_${type}_file" name="modal_${type}_file" accept=".pdf" onchange="updateFileName(this, 'modal_${type}_fileName'); validateModalFile(this, 'modal_${type}_file')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ae2-3') {
        html = `
            <div class="modal-header">
                <h3>Encadrement d'autres activités</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Année Univ. <span style="color: #000;">*</span></label>
                    <div id="modal_annee_univError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_annee_univ" onchange="validateModalField('modal_annee_univ')">
                        <option value="" disabled ${!val('annee_univ') ? 'selected' : ''}>Choisir une année universitaire</option>
                        <option value="2013-2014" ${val('annee_univ') === '2013-2014' ? 'selected' : ''}>2013-2014</option>
                        <option value="2014-2015" ${val('annee_univ') === '2014-2015' ? 'selected' : ''}>2014-2015</option>
                        <option value="2015-2016" ${val('annee_univ') === '2015-2016' ? 'selected' : ''}>2015-2016</option>
                        <option value="2016-2017" ${val('annee_univ') === '2016-2017' ? 'selected' : ''}>2016-2017</option>
                        <option value="2017-2018" ${val('annee_univ') === '2017-2018' ? 'selected' : ''}>2017-2018</option>
                        <option value="2018-2019" ${val('annee_univ') === '2018-2019' ? 'selected' : ''}>2018-2019</option>
                        <option value="2019-2020" ${val('annee_univ') === '2019-2020' ? 'selected' : ''}>2019-2020</option>
                        <option value="2020-2021" ${val('annee_univ') === '2020-2021' ? 'selected' : ''}>2020-2021</option>
                        <option value="2021-2022" ${val('annee_univ') === '2021-2022' ? 'selected' : ''}>2021-2022</option>
                        <option value="2022-2023" ${val('annee_univ') === '2022-2023' ? 'selected' : ''}>2022-2023</option>
                        <option value="2023-2024" ${val('annee_univ') === '2023-2024' ? 'selected' : ''}>2023-2024</option>
                        <option value="2024-2025" ${val('annee_univ') === '2024-2025' ? 'selected' : ''}>2024-2025</option>
                        <option value="2025-2026" ${val('annee_univ') === '2025-2026' ? 'selected' : ''}>2025-2026</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Type d'activité <span style="color: #000;">*</span></label>
                    <div id="modal_typeError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_type" oninput="validateModalField('modal_type'); updateCharCounter('modal_type', 'modal_typeCounter')">${escapeHtml(val('type'))}</textarea>
                    <div id="modal_typeCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Intitulé de l'activité <span style="color: #000;">*</span></label>
                    <div id="modal_intituleError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_intitule" oninput="validateModalField('modal_intitule'); updateCharCounter('modal_intitule', 'modal_intituleCounter')">${escapeHtml(val('intitule'))}</textarea>
                    <div id="modal_intituleCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom(s) des étudiant(e)s</label>
                    <textarea id="modal_nom_etudiants" oninput="updateCharCounter('modal_nom_etudiants', 'modal_nom_etudiantsCounter')">${escapeHtml(val('nom_etudiants'))}</textarea>
                    <div id="modal_nom_etudiantsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Date ou période <span style="color: #000;">*</span></label>
                    <div id="modal_datesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_dates" oninput="validateModalField('modal_dates'); updateCharCounter('modal_dates', 'modal_datesCounter')">${escapeHtml(val('dates'))}</textarea>
                    <div id="modal_datesCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Lieu <span style="color: #000;">*</span></label>
                    <div id="modal_lieuxError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_lieux" oninput="validateModalField('modal_lieux'); updateCharCounter('modal_lieux', 'modal_lieuxCounter')">${escapeHtml(val('lieux'))}</textarea>
                    <div id="modal_lieuxCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Durée <span style="color: #000;">*</span></label>
                    <div id="modal_dureesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_durees" oninput="validateModalField('modal_durees'); updateCharCounter('modal_durees', 'modal_dureesCounter')">${escapeHtml(val('durees'))}</textarea>
                    <div id="modal_dureesCounter" class="char-counter"></div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type.startsWith('ae3-')) {
        // AE3-1 à AE3-7 : modals with required fields per requirements.md
        const ae3Titles = {
            'ae3-1': 'Chef de département ou membre de collège (ou bureau) du département',
            'ae3-2': 'Coordonnateur de filière',
            'ae3-3': 'Responsable de module',
            'ae3-4': 'Membre du conseil d\'Établissement',
            'ae3-5': 'Membre du conseil d\'Université',
            'ae3-6': 'Membre de la commission scientifique',
            'ae3-7': 'Membre de commission d\'expertise ou d\'évaluation pédagogique à l\'échelle nationale ou internationale'
        };
        const title = ae3Titles[type] || 'Fichier justificatif';
        
        // Build dynamic fields based on AE3 type per requirements.md
        let specificFields = '';
        if (type === 'ae3-1') {
            specificFields = `
                <div class="modal-form-group">
                    <label>Nature de la responsabilité <span style="color: #000;">*</span></label>
                    <div id="modal_nature_responsabiliteError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_nature_responsabilite" onchange="validateModalField('modal_nature_responsabilite')">
                        <option value="" disabled ${!val('nature_responsabilite') ? 'selected' : ''}>Choisir une nature</option>
                        <option value="Chef de département" ${val('nature_responsabilite') === 'Chef de département' ? 'selected' : ''}>Chef de département</option>
                        <option value="Membre de collège" ${val('nature_responsabilite') === 'Membre de collège' ? 'selected' : ''}>Membre de collège</option>
                        <option value="Membre de bureau" ${val('nature_responsabilite') === 'Membre de bureau' ? 'selected' : ''}>Membre de bureau</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Période <span style="color: #000;">*</span></label>
                    <div id="modal_periodeError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_periode" oninput="validateModalField('modal_periode'); updateCharCounter('modal_periode', 'modal_periodeCounter')">${escapeHtml(val('periode'))}</textarea>
                    <div id="modal_periodeCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nombre de mandats <span style="color: #000;">*</span></label>
                    <div id="modal_nb_mandatsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="number" id="modal_nb_mandats" value="${escapeHtml(val('nb_mandats'))}" min="1" oninput="validateModalField('modal_nb_mandats')">
                </div>
            `;
        } else if (type === 'ae3-2') {
            specificFields = `
                <div class="modal-form-group">
                    <label>Intitulé de la filière <span style="color: #000;">*</span></label>
                    <div id="modal_titre_filiereError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_titre_filiere" oninput="validateModalField('modal_titre_filiere'); updateCharCounter('modal_titre_filiere', 'modal_titre_filiereCounter')">${escapeHtml(val('titre_filiere'))}</textarea>
                    <div id="modal_titre_filiereCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nombre d'accréditations <span style="color: #000;">*</span></label>
                    <div id="modal_nb_accreditationsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="number" id="modal_nb_accreditations" value="${escapeHtml(val('nb_accreditations'))}" min="1" oninput="validateModalField('modal_nb_accreditations')">
                </div>
                <div class="modal-form-group">
                    <label>Période <span style="color: #000;">*</span></label>
                    <div id="modal_periodesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_periodes" value="${escapeHtml(val('periodes'))}" oninput="validateModalField('modal_periodes')">
                </div>
            `;
        } else if (type === 'ae3-3') {
            specificFields = `
                <div class="modal-form-group">
                    <label>Intitulé du module <span style="color: #000;">*</span></label>
                    <div id="modal_titre_moduleError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_titre_module" oninput="validateModalField('modal_titre_module'); updateCharCounter('modal_titre_module', 'modal_titre_moduleCounter')">${escapeHtml(val('titre_module'))}</textarea>
                    <div id="modal_titre_moduleCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Filière <span style="color: #000;">*</span></label>
                    <div id="modal_filiere_ae3Error" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_filiere_ae3" oninput="validateModalField('modal_filiere_ae3'); updateCharCounter('modal_filiere_ae3', 'modal_filiere_ae3Counter')">${escapeHtml(val('filiere_ae3'))}</textarea>
                    <div id="modal_filiere_ae3Counter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Période <span style="color: #000;">*</span></label>
                    <div id="modal_periodeError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_periode" oninput="validateModalField('modal_periode'); updateCharCounter('modal_periode', 'modal_periodeCounter')">${escapeHtml(val('periode'))}</textarea>
                    <div id="modal_periodeCounter" class="char-counter"></div>
                </div>
            `;
        
        } else if (type === 'ae3-6') {
            specificFields = `
                <div class="modal-form-group">
                    <label>Période du mandat <span style="color: #000;">*</span></label>
                    <div id="modal_periodesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_periodes" oninput="validateModalField('modal_periodes'); updateCharCounter('modal_periodes', 'modal_periodesCounter')">${escapeHtml(val('periodes'))}</textarea>
                    <div id="modal_periodesCounter" class="char-counter"></div>
                </div>
            `;
        } else if (type === 'ae3-7') {
            specificFields = `
                <div class="modal-form-group">
                    <label>Nature de l'activité effectuée <span style="color: #000;">*</span></label>
                    <div id="modal_naturesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_natures" oninput="validateModalField('modal_natures'); updateCharCounter('modal_natures', 'modal_naturesCounter')">${escapeHtml(val('natures'))}</textarea>
                    <div id="modal_naturesCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Date <span style="color: #000;">*</span></label>
                    <div id="modal_datesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="date" id="modal_dates" value="${escapeHtml(val('dates'))}" oninput="validateModalField('modal_dates')">
                </div>
                <div class="modal-form-group">
                    <label>Lieu <span style="color: #000;">*</span></label>
                    <div id="modal_lieuxError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_lieux" oninput="validateModalField('modal_lieux'); updateCharCounter('modal_lieux', 'modal_lieuxCounter')">${escapeHtml(val('lieux'))}</textarea>
                    <div id="modal_lieuxCounter" class="char-counter"></div>
                </div>
            `;
        } else {
            specificFields = `
                <div class="modal-form-group">
                    <label>Période du mandat <span style="color: #000;">*</span></label>
                    <div id="modal_periode_mandatError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_periode_mandat" oninput="validateModalField('modal_periode_mandat'); updateCharCounter('modal_periode_mandat', 'modal_periode_mandatCounter')">${escapeHtml(val('periode_mandat'))}</textarea>
                    <div id="modal_periode_mandatCounter" class="char-counter"></div>
                </div>
            `;
        }
        
        html = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                ${specificFields}
                <div class="modal-form-group">
                    <label>Fichier justificatif (PDF) <span style="color: #000;">*</span></label>
                    <div id="modal_${type}_fileError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_${type}_file').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_${type}_fileName">${escapeHtml(val('PDF') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_${type}_file" name="modal_${type}_file" accept=".pdf" onchange="updateFileName(this, 'modal_${type}_fileName'); validateModalFile(this, 'modal_${type}_file')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar1-1') {
        // AR1-1: Indexed journal articles - Full reference, title, authors, journal, year, date, volume, issue, pages, DOI, indexing DB, link, doctoral co-authors
        html = `
            <div class="modal-header">
                <h3>AR 1-1 Publications scientifiques dans des revues spécialisées indexées (Scopus, Webof Knowledge)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Référence complète <span style="color: #000;">*</span></label>
                    <div id="modal_referenceCompleteError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_referenceComplete" oninput="validateModalField('modal_referenceComplete'); updateCharCounter('modal_referenceComplete', 'modal_referenceCompleteCounter')">${escapeHtml(val('referenceComplete') || '')}</textarea>
                    <div id="modal_referenceCompleteCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Titre de l'article <span style="color: #000;">*</span></label>
                    <div id="modal_titreArticleError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_titreArticle" oninput="validateModalField('modal_titreArticle'); updateCharCounter('modal_titreArticle', 'modal_titreArticleCounter')">${escapeHtml(val('titreArticle') || '')}</textarea>
                    <div id="modal_titreArticleCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Auteur(s) <span style="color: #000;">*</span></label>
                    <div id="modal_auteursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_auteurs" oninput="validateModalField('modal_auteurs'); updateCharCounter('modal_auteurs', 'modal_auteursCounter')">${escapeHtml(val('auteurs') || '')}</textarea>
                    <div id="modal_auteursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom de la revue <span style="color: #000;">*</span></label>
                    <div id="modal_nomRevueError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_nomRevue" oninput="validateModalField('modal_nomRevue'); updateCharCounter('modal_nomRevue', 'modal_nomRevueCounter')">${escapeHtml(val('nomRevue') || '')}</textarea>
                    <div id="modal_nomRevueCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Année de publication <span style="color: #000;">*</span></label>
                    <div id="modal_anneePubError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_anneePub" value="${escapeHtml(val('anneePub') || '')}" oninput="validateModalField('modal_anneePub')">
                </div>
                <div class="modal-form-group">
                    <label>Date de publication</label>
                    <input type="text" id="modal_datePub" value="${escapeHtml(val('datePub') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Volume</label>
                    <input type="text" id="modal_volume" value="${escapeHtml(val('volume') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Numéro / Issue</label>
                    <input type="text" id="modal_numero" value="${escapeHtml(val('numero') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Pages</label>
                    <input type="text" id="modal_pages" value="${escapeHtml(val('pages') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>DOI <span style="color: #000;">*</span></label>
                    <div id="modal_doiError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_doi" value="${escapeHtml(val('doi') || '')}" oninput="validateModalField('modal_doi')">
                </div>
                <div class="modal-form-group">
                    <label>Base d'indexation <span style="color: #000;">*</span></label>
                    <div id="modal_baseIndexationError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_baseIndexation" onchange="validateModalField('modal_baseIndexation')">
                        <option value="" disabled ${!val('baseIndexation') ? 'selected' : ''}>Choisir une base</option>
                        <option value="Scopus" ${val('baseIndexation') === 'Scopus' ? 'selected' : ''}>Scopus</option>
                        <option value="Web of Knowledge" ${val('baseIndexation') === 'Web of Knowledge' ? 'selected' : ''}>Web of Knowledge</option>
                        <option value="Web of Science" ${val('baseIndexation') === 'Web of Science' ? 'selected' : ''}>Web of Science</option>
                        <option value="Autre" ${val('baseIndexation') === 'Autre' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Lien de publication <span style="color: #000;">*</span></label>
                    <div id="modal_lienError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_lien" value="${escapeHtml(val('lien') || '')}" oninput="validateModalField('modal_lien')">
                </div>
                <div class="modal-form-group">
                    <label>Noms des doctorants co-auteurs</label>
                    <textarea id="modal_doctorantsCoAuteurs" oninput="updateCharCounter('modal_doctorantsCoAuteurs', 'modal_doctorantsCoAuteursCounter')">${escapeHtml(val('doctorantsCoAuteurs') || '')}</textarea>
                    <div id="modal_doctorantsCoAuteursCounter" class="char-counter"></div>
                    <small style="color: #666; font-size: 0.8em;">Si aucun, indiquer "Aucun"</small>
                </div>
                <div class="modal-form-group">
                    <label>Liste CED des doctorants co-auteurs</label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar1_1_ced_list').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar1_1_ced_listName">${escapeHtml(val('cedList') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar1_1_ced_list" name="modal_ar1_1_ced_list" accept=".pdf" onchange="updateFileName(this, 'modal_ar1_1_ced_listName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar1-2') {
        // AR1-2: Conference proceedings - Type, Title, Authors, Reference, Event name, Location, Date, Website, Institution, Review committee, Nature
        html = `
            <div class="modal-header">
                <h3>AR 1-2 Publications dans les actes de manifestations scientifiques avec comité de lecture</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Type d'activité <span style="color: #000;">*</span></label>
                    <div id="modal_typeActiviteError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_typeActivite" onchange="validateModalField('modal_typeActivite')">
                        <option value="" disabled ${!val('typeActivite') ? 'selected' : ''}>Choisir un type</option>
                        <option value="Article complet" ${val('typeActivite') === 'Article complet' ? 'selected' : ''}>Article complet dans les actes</option>
                        <option value="Résumé" ${val('typeActivite') === 'Résumé' ? 'selected' : ''}>Résumé</option>
                        <option value="Communication orale" ${val('typeActivite') === 'Communication orale' ? 'selected' : ''}>Communication orale</option>
                        <option value="Poster" ${val('typeActivite') === 'Poster' ? 'selected' : ''}>Poster</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Titre de la publication/communication <span style="color: #000;">*</span></label>
                    <div id="modal_titreError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_titre" oninput="validateModalField('modal_titre'); updateCharCounter('modal_titre', 'modal_titreCounter')">${escapeHtml(val('titre') || '')}</textarea>
                    <div id="modal_titreCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Auteur(s) <span style="color: #000;">*</span></label>
                    <div id="modal_auteursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_auteurs" oninput="validateModalField('modal_auteurs'); updateCharCounter('modal_auteurs', 'modal_auteursCounter')">${escapeHtml(val('auteurs') || '')}</textarea>
                    <div id="modal_auteursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Référence du proceeding ou titre de la communication <span style="color: #000;">*</span></label>
                    <div id="modal_referenceError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_reference" oninput="validateModalField('modal_reference'); updateCharCounter('modal_reference', 'modal_referenceCounter')">${escapeHtml(val('reference') || '')}</textarea>
                    <div id="modal_referenceCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom de l'événement <span style="color: #000;">*</span></label>
                    <div id="modal_nomEvenementError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_nomEvenement" oninput="validateModalField('modal_nomEvenement'); updateCharCounter('modal_nomEvenement', 'modal_nomEvenementCounter')">${escapeHtml(val('nomEvenement') || '')}</textarea>
                    <div id="modal_nomEvenementCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Lieu <span style="color: #000;">*</span></label>
                    <div id="modal_lieuError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_lieu" value="${escapeHtml(val('lieu') || '')}" oninput="validateModalField('modal_lieu')">
                </div>
                <div class="modal-form-group">
                    <label>Date de l'événement <span style="color: #000;">*</span></label>
                    <div id="modal_dateEvenementError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_dateEvenement" value="${escapeHtml(val('dateEvenement') || '')}" oninput="validateModalField('modal_dateEvenement')">
                </div>
                <div class="modal-form-group">
                    <label>Lien du site web <span style="color: #000;">*</span></label>
                    <div id="modal_lienSiteError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_lienSite" value="${escapeHtml(val('lienSite') || '')}" oninput="validateModalField('modal_lienSite')">
                </div>
                <div class="modal-form-group">
                    <label>Institution organisatrice</label>
                    <input type="text" id="modal_institution" value="${escapeHtml(val('institution') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Confirmation comité de lecture <span style="color: #000;">*</span></label>
                    <div id="modal_comiteLectureError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_comiteLecture" onchange="validateModalField('modal_comiteLecture')">
                        <option value="" disabled ${!val('comiteLecture') ? 'selected' : ''}>Choisir</option>
                        <option value="Oui" ${val('comiteLecture') === 'Oui' ? 'selected' : ''}>Oui, l'événement a un comité de lecture</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Nature du travail <span style="color: #000;">*</span></label>
                    <div id="modal_natureTravailError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_natureTravail" onchange="validateModalField('modal_natureTravail')">
                        <option value="" disabled ${!val('natureTravail') ? 'selected' : ''}>Choisir</option>
                        <option value="Article complet" ${val('natureTravail') === 'Article complet' ? 'selected' : ''}>Article complet</option>
                        <option value="Résumé" ${val('natureTravail') === 'Résumé' ? 'selected' : ''}>Résumé</option>
                        <option value="Communication orale" ${val('natureTravail') === 'Communication orale' ? 'selected' : ''}>Communication orale</option>
                        <option value="Poster" ${val('natureTravail') === 'Poster' ? 'selected' : ''}>Poster</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Attestation de participation <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar1_2_attestation').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar1_2_attestationName">${escapeHtml(val('attestation') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar1_2_attestation" name="modal_ar1_2_attestation" accept=".pdf" onchange="updateFileName(this, 'modal_ar1_2_attestationName')">
                    </div>
                </div>
                <div class="modal-form-group">
                    <label>Première page <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar1_2_premiere_page').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar1_2_premiere_pageName">${escapeHtml(val('premierePage') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar1_2_premiere_page" name="modal_ar1_2_premiere_page" accept=".pdf" onchange="updateFileName(this, 'modal_ar1_2_premiere_pageName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar1-3') {
        // AR1-3: Research books/chapters - Title, Type, Authors, Editor, Year, ISSN, ISBN, Reference, Cover page
        html = `
            <div class="modal-header">
                <h3>AR 1-3 Ouvrages de recherche édités (livres ou chapitres de livres)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Titre de l'ouvrage ou chapitre <span style="color: #000;">*</span></label>
                    <div id="modal_titreOuvrageError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_titreOuvrage" oninput="validateModalField('modal_titreOuvrage'); updateCharCounter('modal_titreOuvrage', 'modal_titreOuvrageCounter')">${escapeHtml(val('titreOuvrage') || '')}</textarea>
                    <div id="modal_titreOuvrageCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Type d'ouvrage <span style="color: #000;">*</span></label>
                    <div id="modal_typeOuvrageError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_typeOuvrage" onchange="validateModalField('modal_typeOuvrage')">
                        <option value="" disabled ${!val('typeOuvrage') ? 'selected' : ''}>Choisir un type</option>
                        <option value="Livre" ${val('typeOuvrage') === 'Livre' ? 'selected' : ''}>Livre</option>
                        <option value="Chapitre de livre" ${val('typeOuvrage') === 'Chapitre de livre' ? 'selected' : ''}>Chapitre de livre</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Auteur(s) <span style="color: #000;">*</span></label>
                    <div id="modal_auteursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_auteurs" oninput="validateModalField('modal_auteurs'); updateCharCounter('modal_auteurs', 'modal_auteursCounter')">${escapeHtml(val('auteurs') || '')}</textarea>
                    <div id="modal_auteursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Éditeur <span style="color: #000;">*</span></label>
                    <div id="modal_editeurError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_editeur" oninput="validateModalField('modal_editeur'); updateCharCounter('modal_editeur', 'modal_editeurCounter')">${escapeHtml(val('editeur') || '')}</textarea>
                    <div id="modal_editeurCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Année de publication <span style="color: #000;">*</span></label>
                    <div id="modal_anneePubError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_anneePub" value="${escapeHtml(val('anneePub') || '')}" oninput="validateModalField('modal_anneePub')">
                </div>
                <div class="modal-form-group">
                    <label>ISSN ou ISBN <span style="color: #000;">*</span></label>
                    <div id="modal_issnError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_issn" value="${escapeHtml(val('issn_isbn') || val('issn') || '')}" oninput="validateModalField('modal_issn')">
                </div>
                <div class="modal-form-group">
                    <label>Référence bibliographique complète <span style="color: #000;">*</span></label>
                    <div id="modal_referenceBiblioError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_referenceBiblio" oninput="validateModalField('modal_referenceBiblio'); updateCharCounter('modal_referenceBiblio', 'modal_referenceBiblioCounter')">${escapeHtml(val('referenceBiblio') || '')}</textarea>
                    <div id="modal_referenceBiblioCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Copie de l'ouvrage (page de garde) <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar1_3_ouvrage').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar1_3_ouvrageName">${escapeHtml(val('ouvrageFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar1_3_ouvrage" name="modal_ar1_3_ouvrage" accept=".pdf" onchange="updateFileName(this, 'modal_ar1_3_ouvrageName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar1-4') {
        // AR1-4: Non-indexed articles - Reference, Title, Authors, Journal, Scope, Year, Date, Volume, Issue, Pages, Link, Review committee, Non-indexed confirmation, Non-paying confirmation, Doctoral co-authors
        html = `
            <div class="modal-header">
                <h3>AR 1-4 Publications scientifiques dans des revues spécialisées nationales ou internationales avec comité de lecture</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Référence complète <span style="color: #000;">*</span></label>
                    <div id="modal_referenceCompleteError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_referenceComplete" oninput="validateModalField('modal_referenceComplete'); updateCharCounter('modal_referenceComplete', 'modal_referenceCompleteCounter')">${escapeHtml(val('referenceComplete') || '')}</textarea>
                    <div id="modal_referenceCompleteCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Titre de l'article <span style="color: #000;">*</span></label>
                    <div id="modal_titreArticleError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_titreArticle" oninput="validateModalField('modal_titreArticle'); updateCharCounter('modal_titreArticle', 'modal_titreArticleCounter')">${escapeHtml(val('titreArticle') || '')}</textarea>
                    <div id="modal_titreArticleCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Auteur(s) <span style="color: #000;">*</span></label>
                    <div id="modal_auteursError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_auteurs" oninput="validateModalField('modal_auteurs'); updateCharCounter('modal_auteurs', 'modal_auteursCounter')">${escapeHtml(val('auteurs') || '')}</textarea>
                    <div id="modal_auteursCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom de la revue <span style="color: #000;">*</span></label>
                    <div id="modal_nomRevueError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_nomRevue" oninput="validateModalField('modal_nomRevue'); updateCharCounter('modal_nomRevue', 'modal_nomRevueCounter')">${escapeHtml(val('nomRevue') || '')}</textarea>
                    <div id="modal_nomRevueCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Portée nationale ou internationale <span style="color: #000;">*</span></label>
                    <div id="modal_porteeError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_portee" onchange="validateModalField('modal_portee')">
                        <option value="" disabled ${!val('portee') ? 'selected' : ''}>Choisir</option>
                        <option value="Nationale" ${val('portee') === 'Nationale' ? 'selected' : ''}>Nationale</option>
                        <option value="Internationale" ${val('portee') === 'Internationale' ? 'selected' : ''}>Internationale</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Année de publication <span style="color: #000;">*</span></label>
                    <div id="modal_anneePubError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_anneePub" value="${escapeHtml(val('anneePub') || '')}" oninput="validateModalField('modal_anneePub')">
                </div>
                <div class="modal-form-group">
                    <label>Date de publication</label>
                    <input type="text" id="modal_datePub" value="${escapeHtml(val('datePub') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Volume</label>
                    <input type="text" id="modal_volume" value="${escapeHtml(val('volume') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Numéro / Issue</label>
                    <input type="text" id="modal_numero" value="${escapeHtml(val('numero') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Pages</label>
                    <input type="text" id="modal_pages" value="${escapeHtml(val('pages') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Lien web <span style="color: #000;">*</span></label>
                    <div id="modal_lienError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_lien" value="${escapeHtml(val('lien') || '')}" oninput="validateModalField('modal_lien')">
                </div>
                <div class="modal-form-group">
                    <label>Confirmation comité de lecture <span style="color: #000;">*</span></label>
                    <div id="modal_comiteLectureError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_comiteLecture" onchange="validateModalField('modal_comiteLecture')">
                        <option value="" disabled ${!val('comiteLecture') ? 'selected' : ''}>Choisir</option>
                        <option value="Oui" ${val('comiteLecture') === 'Oui' ? 'selected' : ''}>Oui, la revue a un comité de lecture</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Confirmation non-indexée <span style="color: #000;">*</span></label>
                    <div id="modal_nonIndexeeError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_nonIndexee" onchange="validateModalField('modal_nonIndexee')">
                        <option value="" disabled ${!val('nonIndexee') ? 'selected' : ''}>Choisir</option>
                        <option value="Oui" ${val('nonIndexee') === 'Oui' ? 'selected' : ''}>Oui, la revue n'est pas indexée</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Confirmation non-payante <span style="color: #000;">*</span></label>
                    <div id="modal_nonPayanteError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_nonPayante" onchange="validateModalField('modal_nonPayante')">
                        <option value="" disabled ${!val('nonPayante') ? 'selected' : ''}>Choisir</option>
                        <option value="Oui" ${val('nonPayante') === 'Oui' ? 'selected' : ''}>Oui, la revue n'est pas payante</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Noms des doctorants co-auteurs</label>
                    <textarea id="modal_doctorantsCoAuteurs" oninput="updateCharCounter('modal_doctorantsCoAuteurs', 'modal_doctorantsCoAuteursCounter')">${escapeHtml(val('doctorantsCoAuteurs') || '')}</textarea>
                    <div id="modal_doctorantsCoAuteursCounter" class="char-counter"></div>
                    <small style="color: #666; font-size: 0.8em;">Si aucun, indiquer "Aucun"</small>
                </div>
                <div class="modal-form-group">
                    <label>Première page de l'article <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar1_4_premiere_page').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar1_4_premiere_pageName">${escapeHtml(val('premierePage') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar1_4_premiere_page" name="modal_ar1_4_premiere_page" accept=".pdf" onchange="updateFileName(this, 'modal_ar1_4_premiere_pageName')">
                    </div>
                </div>
                <div class="modal-form-group">
                    <label>Liste CED des doctorants co-auteurs</label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar1_4_ced_list').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar1_4_ced_listName">${escapeHtml(val('cedList') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar1_4_ced_list" name="modal_ar1_4_ced_list" accept=".pdf" onchange="updateFileName(this, 'modal_ar1_4_ced_listName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar2-1') {
        // AR2-1: Doctoral thesis supervision - Author, Title, Institution, Defense date, Type, Program, CED
        html = `
            <div class="modal-header">
                <h3>Direction ou codirection de thèses de doctorat soutenues</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Nom de l'auteur de la thèse <span style="color: #000;">*</span></label>
                    <div id="modal_nomAuteurError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_nomAuteur" oninput="validateModalField('modal_nomAuteur'); updateCharCounter('modal_nomAuteur', 'modal_nomAuteurCounter')">${escapeHtml(val('nomAuteur') || '')}</textarea>
                    <div id="modal_nomAuteurCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Titre de la thèse <span style="color: #000;">*</span></label>
                    <div id="modal_titreTheseError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_titreThese" oninput="validateModalField('modal_titreThese'); updateCharCounter('modal_titreThese', 'modal_titreTheseCounter')">${escapeHtml(val('titreThese') || '')}</textarea>
                    <div id="modal_titreTheseCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom de l'institution <span style="color: #000;">*</span></label>
                    <div id="modal_institutionError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_institution" oninput="validateModalField('modal_institution'); updateCharCounter('modal_institution', 'modal_institutionCounter')">${escapeHtml(val('institution') || '')}</textarea>
                    <div id="modal_institutionCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Date de soutenance <span style="color: #000;">*</span></label>
                    <div id="modal_dateSoutenanceError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <input type="text" id="modal_dateSoutenance" value="${escapeHtml(val('dateSoutenance') || '')}" oninput="validateModalField('modal_dateSoutenance')">
                </div>
                <div class="modal-form-group">
                    <label>Type de direction <span style="color: #000;">*</span></label>
                    <div id="modal_typeDirectionError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <select id="modal_typeDirection" onchange="validateModalField('modal_typeDirection')">
                        <option value="" disabled ${!val('typeDirection') ? 'selected' : ''}>Choisir</option>
                        <option value="Direction avec codirection" ${val('typeDirection') === 'Direction avec codirection' ? 'selected' : ''}>Direction avec codirection</option>
                        <option value="Direction" ${val('typeDirection') === 'Direction' ? 'selected' : ''}>Direction</option>
                        <option value="Co-directeur" ${val('typeDirection') === 'Co-directeur' ? 'selected' : ''}>Co-directeur</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Programme ou discipline</label>
                    <input type="text" id="modal_programme" value="${escapeHtml(val('programme') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Affiliation CED</label>
                    <input type="text" id="modal_ced" value="${escapeHtml(val('ced') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Page de garde (tamponnée CED) <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar2_1_these').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar2_1_theseName">${escapeHtml(val('theseFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar2_1_these" name="modal_ar2_1_these" accept=".pdf" onchange="updateFileName(this, 'modal_ar2_1_theseName'); validateModalFile(this, 'modal_ar2_1_these')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    modalContent.innerHTML = html;
    setupDateFields();
    modal.classList.add('active');
}

function setupDateFields() {
    document.querySelectorAll('#modalContent input[type="text"][id^="modal_date"]').forEach(function(el) {
        if (!el.hasAttribute('placeholder')) {
            el.setAttribute('placeholder', 'JJ/MM/AAAA');
        }
        if (!el.hasAttribute('pattern')) {
            el.setAttribute('pattern', '\\d{2}/\\d{2}/\\d{4}');
        }
        if (!el.hasAttribute('title')) {
            el.setAttribute('title', 'Format: JJ/MM/AAAA');
        }
    });
}


function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    rowToEdit = null;
}

async function addOrEditModalRow() {
    console.log('addOrEditModalRow called, type:', currentModalType);
    const type = currentModalType;
    if (!type) {
        closeModal();
        return;
    }

    // Initialize data object
    let data = {};

    // Validation des champs du modal
    resetModalErrors();
    let isValid = true;

    if (type === 'licence') {
        isValid = validateModalField('modal_annee_univ') && isValid;
        isValid = validateModalField('modal_filiere') && isValid;
        isValid = validateModalField('modal_semestre') && isValid;
        isValid = validateModalField('modal_cours') && isValid;
        isValid = validateTextLength('modal_cours', 'Cours') && isValid;
        isValid = validateModalField('modal_td') && isValid;
        isValid = validateTextLength('modal_td', 'TD') && isValid;
        isValid = validateModalField('modal_tp') && isValid;
        isValid = validateTextLength('modal_tp', 'TP') && isValid;
        isValid = validateModalNumericField('modal_vh_cours', 'VH Cours') && isValid;
        isValid = validateModalNumericField('modal_vh_td', 'VH TD') && isValid;
        isValid = validateModalNumericField('modal_vh_tp', 'VH TP') && isValid;
    }
    if (type === 'encadrement-licence') {
        isValid = validateModalField('modal_annee_univ') && isValid;
        isValid = validateModalField('modal_type_licence') && isValid;
        isValid = validateModalField('modal_titre_pfe') && isValid;
        isValid = validateTextLength('modal_titre_pfe', 'Titre Pfe') && isValid;
        isValid = validateModalField('modal_etudiants') && isValid;
        isValid = validateTextLength('modal_etudiants', 'Étudiants') && isValid;
        isValid = validateModalField('modal_nom_encadrants') && isValid;
        isValid = validateTextLength('modal_nom_encadrants', 'Nom encadrants') && isValid;
        const encLicenceFileValid = validateModalFile(document.getElementById('modal_enc_licence_cover'), 'modal_enc_licence_cover');
        console.log('encadrement-licence file validation:', encLicenceFileValid);
        isValid = encLicenceFileValid && isValid;
    }
    if (type === 'master') {
        isValid = validateModalField('modal_annee_univ') && isValid;
        isValid = validateModalField('modal_filiere') && isValid;
        isValid = validateModalField('modal_semestre') && isValid;
        isValid = validateModalField('modal_cours_td_tp') && isValid;
        isValid = validateModalNumericField('modal_vh', 'VH') && isValid;
    }
    // AE1-1 validation: required fields per requirements.md
    if (type === 'ae1-1') {
        isValid = validateModalField('modal_titres', true, 'Le titre est requis') && isValid;
        isValid = validateTextLength('modal_titres', 'Titre') && isValid;
        isValid = validateModalField('modal_auteurs', true, 'Les auteurs sont requis') && isValid;
        isValid = validateTextLength('modal_auteurs', 'Auteurs') && isValid;
        isValid = validateModalField('modal_niveaux', true, 'Le niveau est requis') && isValid;
        isValid = validateTextLength('modal_niveaux', 'Niveaux') && isValid;
        isValid = validateModalField('modal_editeurs', true, 'L\'éditeur est requis') && isValid;
        isValid = validateTextLength('modal_editeurs', 'Éditeurs') && isValid;
        isValid = validateModalField('modal_annees', true, 'L\'année d\'édition est requise') && isValid;
        // File validation for PDF
        const ae11FileValid = validateModalFile(document.getElementById('modal_ae1_1_file'), 'modal_ae1_1_file');
        console.log('ae1-1 file validation:', ae11FileValid);
        isValid = ae11FileValid && isValid;
        // At least one publication identifier required
        isValid = validateModalField('modal_numero_depot', true, 'Au moins un numéro (dépôt légal/ISSN/ISBN) est requis') && isValid;
        isValid = validateTextLength('modal_numero_depot', 'N° dépôt') && isValid;
    }
    // AE1-2 validation
    if (type === 'ae1-2') {
        const ae12FileValid = validateModalFile(document.getElementById('modal_ae1_2_file'), 'modal_ae1_2_file');
        console.log('ae1-2 file validation:', ae12FileValid);
        isValid = ae12FileValid && isValid;
        isValid = validateModalField('modal_auteurs', true, 'Les auteurs sont requis') && isValid;
        isValid = validateTextLength('modal_auteurs', 'Auteurs') && isValid;
        isValid = validateModalField('modal_departements', true, 'Le département est requis') && isValid;
        isValid = validateTextLength('modal_departements', 'Départements') && isValid;
        isValid = validateModalField('modal_annees', true, 'L\'année d\'élaboration est requise') && isValid;
        isValid = validateModalField('modal_filieres', true, 'La filière est requise') && isValid;
        isValid = validateTextLength('modal_filieres', 'Filières') && isValid;
        isValid = validateModalField('modal_semestres', true, 'Le semestre est requis') && isValid;
        isValid = validateModalField('modal_types', true, 'Le type de polycopié est requis') && isValid;
    }
    // AE1-3 validation
    if (type === 'ae1-3') {
        const ae13FileValid = validateModalFile(document.getElementById('modal_ae1_3_file'), 'modal_ae1_3_file');
        console.log('ae1-3 file validation:', ae13FileValid);
        isValid = ae13FileValid && isValid;
        isValid = validateModalField('modal_objectifs', true, 'Les objectifs sont requis') && isValid;
        isValid = validateTextLength('modal_objectifs', 'Objectifs') && isValid;
        isValid = validateModalField('modal_auteurs', true, 'Les auteurs sont requis') && isValid;
        isValid = validateTextLength('modal_auteurs', 'Auteurs') && isValid;
        isValid = validateModalField('modal_filieres', true, 'La filière est requise') && isValid;
        isValid = validateTextLength('modal_filieres', 'Filières') && isValid;
        isValid = validateModalField('modal_niveaux', true, 'Le niveau est requis') && isValid;
        isValid = validateTextLength('modal_niveaux', 'Niveaux') && isValid;
        isValid = validateModalField('modal_annees', true, 'L\'année universitaire est requise') && isValid;
        isValid = validateModalField('modal_liens', false, '') && isValid; // Not required in same way
        isValid = validateTextLength('modal_liens', 'Lien') && isValid;
        isValid = validateModalField('modal_types', true, 'Le type est requis') && isValid;
    }
    // AE2-1 validation
    if (type === 'ae2-1') {
        isValid = validateModalField('modal_annee_univ', true, 'L\'année universitaire est requise') && isValid;
        isValid = validateModalField('modal_type', true, 'Le type est requis') && isValid;
        isValid = validateTextLength('modal_intitule', 'Intitulé') && isValid;
        isValid = validateModalField('modal_departements', true, 'Le département est requis') && isValid;
        isValid = validateTextLength('modal_departements', 'Départements') && isValid;
        isValid = validateModalField('modal_coenseignants', true, 'Le co-encadrant est requis') && isValid;
        const ae21File = document.getElementById('modal_ae2-1_file');
        if (ae21File && (!ae21File.files || ae21File.files.length === 0) && (!rowToEdit || !rowToEdit.data.PDF)) {
            showModalError('modal_ae2-1_file', 'Le fichier justificatif est requis');
            isValid = false;
        }
    }
    // AE2-2 validation
    // AE2-2 validation
    if (type === 'ae2-2') {
        isValid = validateModalField('modal_annee_univ', true, 'L\'année universitaire est requise') && isValid;
        isValid = validateModalField('modal_type', true, 'Le type est requis') && isValid;
        isValid = validateModalField('modal_filiere', true, 'La filière est requise') && isValid;
        isValid = validateTextLength('modal_filiere', 'Filière') && isValid;
        isValid = validateModalField('modal_nom_etudiants', true, 'Le nom des étudiants est requis') && isValid;
        isValid = validateTextLength('modal_nom_etudiants', 'Nom étudiants') && isValid;
        isValid = validateModalField('modal_intitule', true, 'L\'intitulé est requis') && isValid;
        isValid = validateTextLength('modal_intitule', 'Intitulé') && isValid;
        isValid = validateModalField('modal_details', false, '') && isValid;
        isValid = validateTextLength('modal_details', 'Détails') && isValid;
        isValid = validateModalField('modal_departements', true, 'Le département est requis') && isValid;
        isValid = validateTextLength('modal_departements', 'Départements') && isValid;
        isValid = validateModalField('modal_coordonnateurs', true, 'Le coordonnateur est requis') && isValid;
        isValid = validateTextLength('modal_coordonnateurs', 'Coordonnateurs') && isValid;
        isValid = validateModalField('modal_coenseignants', true, 'Le co-enseignant est requis') && isValid;
        isValid = validateTextLength('modal_coenseignants', 'Co-enseignants') && isValid;
        const ae22File = document.getElementById('modal_ae2-2_file');
        if (ae22File && (!ae22File.files || ae22File.files.length === 0) && (!rowToEdit || !rowToEdit.data.PDF)) {
            showModalError('modal_ae2-2_file', 'Le fichier justificatif est requis');
            isValid = false;
        }
    }
    // AE2-3 validation
    if (type === 'ae2-3') {
        isValid = validateModalField('modal_type', true, 'Le type de formation est requis') && isValid;
        isValid = validateModalField('modal_etablissement', true, 'L\'établissement est requis') && isValid;
        isValid = validateTextLength('modal_etablissement', 'Établissement') && isValid;
        isValid = validateModalField('modal_dates', true, 'La date est requise') && isValid;
        isValid = validateTextLength('modal_dates', 'Date') && isValid;
        isValid = validateModalField('modal_lieux', true, 'Le lieu est requis') && isValid;
        isValid = validateTextLength('modal_lieux', 'Lieu') && isValid;
        isValid = validateModalField('modal_periode', true, 'La période de l\'ordre de mission est requise') && isValid;
        isValid = validateTextLength('modal_periode', 'Période') && isValid;
        const ae23File = document.getElementById('modal_ae2-3_file');
        if (ae23File && (!ae23File.files || ae23File.files.length === 0) && (!rowToEdit || !rowToEdit.data.PDF)) {
            showModalError('modal_ae2-3_file', 'Le fichier justificatif (Attestation du Décanat) est requis');
            isValid = false;
        }
    }
    // AE3 validation: required fields per requirements.md
    if (type === 'ae3-1') {
        isValid = validateModalField('modal_nature_responsabilite', true, 'La nature de la responsabilité est requise') && isValid;
        isValid = validateModalField('modal_periode', true, 'La période est requise') && isValid;
        isValid = validateTextLength('modal_periode', 'Période') && isValid;
        isValid = validateModalField('modal_nb_mandats', true, 'Le nombre de mandats est requis') && isValid;
        const ae31FileValid = validateModalFile(document.getElementById('modal_ae3-1_file'), 'modal_ae3-1_file');
        isValid = ae31FileValid && isValid;
    }
    if (type === 'ae3-2') {
        isValid = validateModalField('modal_titre_filiere', true, 'L\'intitulé de la filière est requis') && isValid;
        isValid = validateTextLength('modal_titre_filiere', 'Intitulé filière') && isValid;
        isValid = validateModalField('modal_nb_accreditations', true, 'Le nombre d\'accréditations est requis') && isValid;
        isValid = validateModalField('modal_periodes', true, 'La période est requise') && isValid;
        const ae32FileValid = validateModalFile(document.getElementById('modal_ae3-2_file'), 'modal_ae3-2_file');
        isValid = ae32FileValid && isValid;
    }
    if (type === 'ae3-3') {
        isValid = validateModalField('modal_titre_module', true, 'L\'intitulé du module est requis') && isValid;
        isValid = validateTextLength('modal_titre_module', 'Intitulé module') && isValid;
        isValid = validateModalField('modal_filiere_ae3', true, 'La filière est requise') && isValid;
        isValid = validateTextLength('modal_filiere_ae3', 'Filière') && isValid;
        isValid = validateModalField('modal_periode', true, 'La période est requise') && isValid;
        isValid = validateTextLength('modal_periode', 'Période') && isValid;
        const ae33FileValid = validateModalFile(document.getElementById('modal_ae3-3_file'), 'modal_ae3-3_file');
        isValid = ae33FileValid && isValid;
    }
    if (type === 'ae3-4' || type === 'ae3-5' || type === 'ae3-6') {
        isValid = validateModalField('modal_periode_mandat', true, 'La période du mandat est requise') && isValid;
        isValid = validateTextLength('modal_periode_mandat', 'Période mandat') && isValid;
        const ae3FileValid = validateModalFile(document.getElementById('modal_' + type + '_file'), 'modal_' + type + '_file');
        isValid = ae3FileValid && isValid;
    }
    if (type === 'ae3-7') {
        isValid = validateModalField('modal_natures', true, 'La nature de l\'activité est requise') && isValid;
        isValid = validateTextLength('modal_natures', 'Nature') && isValid;
        isValid = validateModalField('modal_dates', true, 'La date est requise') && isValid;
        isValid = validateModalField('modal_lieux', true, 'Le lieu est requis') && isValid;
        isValid = validateTextLength('modal_lieux', 'Lieu') && isValid;
        const ae3FileValid = validateModalFile(document.getElementById('modal_ae3-7_file'), 'modal_ae3-7_file');
        isValid = ae3FileValid && isValid;
    }
    // AR1-1: Indexed journal articles
    if (type === 'ar1-1') {
        isValid = validateModalField('modal_referenceComplete', true, 'La référence complète est requise') && isValid;
        isValid = validateTextLength('modal_referenceComplete', 'Référence') && isValid;
        isValid = validateModalField('modal_titreArticle', true, 'Le titre de l\'article est requis') && isValid;
        isValid = validateTextLength('modal_titreArticle', 'Titre') && isValid;
        isValid = validateModalField('modal_auteurs', true, 'Les auteurs sont requis') && isValid;
        isValid = validateTextLength('modal_auteurs', 'Auteurs') && isValid;
        isValid = validateModalField('modal_nomRevue', true, 'Le nom de la revue est requis') && isValid;
        isValid = validateTextLength('modal_nomRevue', 'Nom revue') && isValid;
        isValid = validateModalField('modal_anneePub', true, 'L\'année de publication est requise') && isValid;
        isValid = validateModalField('modal_doi', true, 'Le DOI est requis') && isValid;
        isValid = validateModalField('modal_baseIndexation', true, 'La base d\'indexation est requise') && isValid;
        isValid = validateModalField('modal_lien', true, 'Le lien de publication est requis') && isValid;
    }
    // AR1-2: Conference proceedings
    if (type === 'ar1-2') {
        isValid = validateModalField('modal_typeActivite', true, 'Le type d\'activité est requis') && isValid;
        isValid = validateModalField('modal_titre', true, 'Le titre est requis') && isValid;
        isValid = validateTextLength('modal_titre', 'Titre') && isValid;
        isValid = validateModalField('modal_auteurs', true, 'Les auteurs sont requis') && isValid;
        isValid = validateTextLength('modal_auteurs', 'Auteurs') && isValid;
        isValid = validateModalField('modal_reference', true, 'La référence est requise') && isValid;
        isValid = validateTextLength('modal_reference', 'Référence') && isValid;
        isValid = validateModalField('modal_nomEvenement', true, 'Le nom de l\'événement est requis') && isValid;
        isValid = validateTextLength('modal_nomEvenement', 'Nom événement') && isValid;
        isValid = validateModalField('modal_lieu', true, 'Le lieu est requis') && isValid;
        isValid = validateModalField('modal_dateEvenement', true, 'La date de l\'événement est requise') && isValid;
        isValid = validateModalField('modal_lienSite', true, 'Le lien du site est requis') && isValid;
        isValid = validateModalField('modal_comiteLecture', true, 'La confirmation du comité de lecture est requise') && isValid;
        isValid = validateModalField('modal_natureTravail', true, 'La nature du travail est requise') && isValid;
        const ar12AttestationValid = validateModalFile(document.getElementById('modal_ar1_2_attestation'), 'modal_ar1_2_attestation');
        console.log('ar1-2 attestation validation:', ar12AttestationValid);
        isValid = ar12AttestationValid && isValid;
        const ar12PageValid = validateModalFile(document.getElementById('modal_ar1_2_premiere_page'), 'modal_ar1_2_premiere_page');
        console.log('ar1-2 première page validation:', ar12PageValid);
        isValid = ar12PageValid && isValid;
    }
    // AR1-3: Research books
    if (type === 'ar1-3') {
        isValid = validateModalField('modal_titreOuvrage', true, 'Le titre est requis') && isValid;
        isValid = validateTextLength('modal_titreOuvrage', 'Titre') && isValid;
        isValid = validateModalField('modal_typeOuvrage', true, 'Le type d\'ouvrage est requis') && isValid;
        isValid = validateModalField('modal_auteurs', true, 'Les auteurs sont requis') && isValid;
        isValid = validateTextLength('modal_auteurs', 'Auteurs') && isValid;
        isValid = validateModalField('modal_editeur', true, 'L\'éditeur est requis') && isValid;
        isValid = validateTextLength('modal_editeur', 'Éditeur') && isValid;
        isValid = validateModalField('modal_anneePub', true, 'L\'année de publication est requise') && isValid;
        isValid = validateModalField('modal_issn', true, 'L\'ISSN ou ISBN est requis') && isValid;
        isValid = validateModalField('modal_referenceBiblio', true, 'La référence bibliographique est requise') && isValid;
        isValid = validateTextLength('modal_referenceBiblio', 'Référence') && isValid;
        const ar13OuvrageValid = validateModalFile(document.getElementById('modal_ar1_3_ouvrage'), 'modal_ar1_3_ouvrage');
        console.log('ar1-3 ouvrage validation:', ar13OuvrageValid);
        isValid = ar13OuvrageValid && isValid;
    }
    // AR1-4: Non-indexed articles
    if (type === 'ar1-4') {
        isValid = validateModalField('modal_referenceComplete', true, 'La référence complète est requise') && isValid;
        isValid = validateTextLength('modal_referenceComplete', 'Référence') && isValid;
        isValid = validateModalField('modal_titreArticle', true, 'Le titre de l\'article est requis') && isValid;
        isValid = validateTextLength('modal_titreArticle', 'Titre') && isValid;
        isValid = validateModalField('modal_auteurs', true, 'Les auteurs sont requis') && isValid;
        isValid = validateTextLength('modal_auteurs', 'Auteurs') && isValid;
        isValid = validateModalField('modal_nomRevue', true, 'Le nom de la revue est requis') && isValid;
        isValid = validateTextLength('modal_nomRevue', 'Nom revue') && isValid;
        isValid = validateModalField('modal_portee', true, 'La portée est requise') && isValid;
        isValid = validateModalField('modal_anneePub', true, 'L\'année de publication est requise') && isValid;
        isValid = validateModalField('modal_lien', true, 'Le lien web est requis') && isValid;
        isValid = validateModalField('modal_comiteLecture', true, 'La confirmation du comité de lecture est requise') && isValid;
        isValid = validateModalField('modal_nonIndexee', true, 'La confirmation non-indexée est requise') && isValid;
        isValid = validateModalField('modal_nonPayante', true, 'La confirmation non-payante est requise') && isValid;
        const ar14PageValid = validateModalFile(document.getElementById('modal_ar1_4_premiere_page'), 'modal_ar1_4_premiere_page');
        console.log('ar1-4 première page validation:', ar14PageValid);
        isValid = ar14PageValid && isValid;
    }
    // AR2-1: Doctoral thesis supervision
    if (type === 'ar2-1') {
        isValid = validateModalField('modal_nomAuteur', true, 'Le nom de l\'auteur est requis') && isValid;
        isValid = validateTextLength('modal_nomAuteur', 'Nom auteur') && isValid;
        isValid = validateModalField('modal_titreThese', true, 'Le titre de la thèse est requis') && isValid;
        isValid = validateTextLength('modal_titreThese', 'Titre thèse') && isValid;
        isValid = validateModalField('modal_institution', true, 'L\'institution est requise') && isValid;
        isValid = validateTextLength('modal_institution', 'Institution') && isValid;
        isValid = validateModalField('modal_dateSoutenance', true, 'La date de soutenance est requise') && isValid;
        isValid = validateModalField('modal_typeDirection', true, 'Le type de direction est requis') && isValid;
        const ar21FileValid = validateModalFile(document.getElementById('modal_ar2_1_these'), 'modal_ar2_1_these');
        console.log('ar2-1 these validation:', ar21FileValid);
        isValid = ar21FileValid && isValid;
    }
    // AR2-2: Thesis jury
    if (type === 'ar2-2') {
        isValid = validateModalField('modal_nomAuteur', true, 'Le nom de l\'auteur est requis') && isValid;
        isValid = validateTextLength('modal_nomAuteur', 'Nom auteur') && isValid;
        isValid = validateModalField('modal_typeTravail', true, 'Le type de travail est requis') && isValid;
        isValid = validateModalField('modal_titre', true, 'Le titre est requis') && isValid;
        isValid = validateTextLength('modal_titre', 'Titre') && isValid;
        isValid = validateModalField('modal_institution', true, 'L\'institution est requise') && isValid;
        isValid = validateTextLength('modal_institution', 'Institution') && isValid;
        isValid = validateModalField('modal_dateSoutenance', true, 'La date de soutenance est requise') && isValid;
        isValid = validateModalField('modal_role', true, 'Le rôle est requis') && isValid;
        isValid = validateModalField('modal_nonDoubleComptage', true, 'La confirmation de non double comptage est requise') && isValid;
        const ar22InvitationValid = validateModalFile(document.getElementById('modal_ar2_2_invitation'), 'modal_ar2_2_invitation');
        console.log('ar2-2 invitation validation:', ar22InvitationValid);
        isValid = ar22InvitationValid && isValid;
        const ar22TheseValid = validateModalFile(document.getElementById('modal_ar2_2_these'), 'modal_ar2_2_these');
        console.log('ar2-2 these validation:', ar22TheseValid);
        isValid = ar22TheseValid && isValid;
    }
    // AR3-1: Research structure director
    if (type === 'ar3-1') {
        isValid = validateModalField('modal_nomStructure', true, 'Le nom de la structure est requis') && isValid;
        isValid = validateTextLength('modal_nomStructure', 'Nom structure') && isValid;
        isValid = validateModalField('modal_typeStructure', true, 'Le type de structure est requis') && isValid;
        isValid = validateModalField('modal_adresseStructure', true, 'L\'adresse est requise') && isValid;
        isValid = validateTextLength('modal_adresseStructure', 'Adresse') && isValid;
        isValid = validateModalField('modal_periodeMandat', true, 'La période est requise') && isValid;
        isValid = validateTextLength('modal_periodeMandat', 'Période') && isValid;
        isValid = validateModalField('modal_etablissement', true, 'L\'établissement est requis') && isValid;
        isValid = validateTextLength('modal_etablissement', 'Établissement') && isValid;
        isValid = validateModalField('modal_role', true, 'Le rôle est requis') && isValid;
        const ar31AttestationValid = validateModalFile(document.getElementById('modal_ar3_1_attestation'), 'modal_ar3_1_attestation');
        console.log('ar3-1 attestation validation:', ar31AttestationValid);
        isValid = ar31AttestationValid && isValid;
    }
    // AR3-2: Research team head
    if (type === 'ar3-2') {
        isValid = validateModalField('modal_nomEquipe', true, 'Le nom de l\'équipe est requis') && isValid;
        isValid = validateTextLength('modal_nomEquipe', 'Nom équipe') && isValid;
        isValid = validateModalField('modal_adresseEquipe', true, 'L\'adresse est requise') && isValid;
        isValid = validateTextLength('modal_adresseEquipe', 'Adresse') && isValid;
        isValid = validateModalField('modal_periodeMandat', true, 'La période est requise') && isValid;
        isValid = validateTextLength('modal_periodeMandat', 'Période') && isValid;
        isValid = validateModalField('modal_etablissement', true, 'L\'établissement est requis') && isValid;
        isValid = validateTextLength('modal_etablissement', 'Établissement') && isValid;
        isValid = validateModalField('modal_role', true, 'Le rôle est requis') && isValid;
        const ar32AttestationValid = validateModalFile(document.getElementById('modal_ar3_2_attestation'), 'modal_ar3_2_attestation');
        console.log('ar3-2 attestation validation:', ar32AttestationValid);
        isValid = ar32AttestationValid && isValid;
    }
    // AR3-3: Research projects
    if (type === 'ar3-3') {
        isValid = validateModalField('modal_nomResponsable', true, 'Le nom du responsable est requis') && isValid;
        isValid = validateTextLength('modal_nomResponsable', 'Nom responsable') && isValid;
        isValid = validateModalField('modal_role', true, 'Le rôle est requis') && isValid;
        isValid = validateModalField('modal_natureProjet', true, 'La nature du projet est requise') && isValid;
        isValid = validateTextLength('modal_natureProjet', 'Nature') && isValid;
        isValid = validateModalField('modal_titreProjet', true, 'Le titre du projet est requis') && isValid;
        isValid = validateTextLength('modal_titreProjet', 'Titre projet') && isValid;
        isValid = validateModalField('modal_montant', true, 'Le montant est requis') && isValid;
        isValid = validateModalField('modal_duree', true, 'La durée est requise') && isValid;
        isValid = validateTextLength('modal_duree', 'Durée') && isValid;
        isValid = validateModalField('modal_partenaire', true, 'L\'organisme partenaire est requis') && isValid;
        isValid = validateTextLength('modal_partenaire', 'Partenaire') && isValid;
        isValid = validateModalField('modal_financeur', true, 'L\'organisme financeur est requis') && isValid;
        isValid = validateTextLength('modal_financeur', 'Financeur') && isValid;
        isValid = validateModalField('modal_typeFinancement', true, 'Le type de financement est requis') && isValid;
        const ar33ContratValid = validateModalFile(document.getElementById('modal_ar3_3_contrat'), 'modal_ar3_3_contrat');
        console.log('ar3-3 contrat validation:', ar33ContratValid);
        isValid = ar33ContratValid && isValid;
        // Attestation du responsable : optionnelle (cahier v1.0) — pas de validation requise
    }
    // AR3-4: Scientific expertise
    if (type === 'ar3-4') {
        isValid = validateModalField('modal_typeActivite', true, 'Le type d\'activité est requis') && isValid;
        isValid = validateModalField('modal_portee', true, 'La portée est requise') && isValid;
        isValid = validateModalField('modal_objet', true, 'L\'objet est requis') && isValid;
        isValid = validateTextLength('modal_objet', 'Objet') && isValid;
        isValid = validateModalField('modal_dateRealisation', true, 'La date est requise') && isValid;
        isValid = validateModalField('modal_institution', true, 'L\'institution est requise') && isValid;
        isValid = validateTextLength('modal_institution', 'Institution') && isValid;
        isValid = validateModalField('modal_role', true, 'Le rôle est requis') && isValid;
        const ar34AttestationValid = validateModalFile(document.getElementById('modal_ar3_4_attestation'), 'modal_ar3_4_attestation');
        console.log('ar3-4 attestation validation:', ar34AttestationValid);
        isValid = ar34AttestationValid && isValid;
    }
    // AR4-1: Interaction structures/events
    if (type === 'ar4-1') {
        isValid = validateModalField('modal_typeActivite', true, 'Le type d\'activité est requis') && isValid;
        isValid = validateModalField('modal_titre', true, 'Le titre est requis') && isValid;
        isValid = validateTextLength('modal_titre', 'Titre') && isValid;
        isValid = validateModalField('modal_lieu', true, 'Le lieu est requis') && isValid;
        isValid = validateModalField('modal_date', true, 'La date est requise') && isValid;
        isValid = validateModalField('modal_nomStructureEvent', true, 'Le nom est requis') && isValid;
        isValid = validateTextLength('modal_nomStructureEvent', 'Nom') && isValid;
        isValid = validateModalField('modal_role', true, 'Le rôle est requis') && isValid;
        const ar41DocumentValid = validateModalFile(document.getElementById('modal_ar4_1_document'), 'modal_ar4_1_document');
        console.log('ar4-1 document validation:', ar41DocumentValid);
        isValid = ar41DocumentValid && isValid;
    }
    // AR4-2: Expertise/valorization
    if (type === 'ar4-2') {
        isValid = validateModalField('modal_nature', true, 'La nature est requise') && isValid;
        isValid = validateTextLength('modal_nature', 'Nature') && isValid;
        isValid = validateModalField('modal_organisme', true, 'L\'organisme est requis') && isValid;
        isValid = validateTextLength('modal_organisme', 'Organisme') && isValid;
        isValid = validateModalField('modal_lieu', true, 'Le lieu est requis') && isValid;
        isValid = validateModalField('modal_date', true, 'La date est requise') && isValid;
        isValid = validateModalField('modal_role', true, 'Le rôle est requis') && isValid;
        isValid = validateModalField('modal_typeOrganisme', true, 'Le type d\'organisme est requis') && isValid;
        isValid = validateModalField('modal_description', true, 'La description est requise') && isValid;
        isValid = validateTextLength('modal_description', 'Description') && isValid;
        const ar42DocumentValid = validateModalFile(document.getElementById('modal_ar4_2_document'), 'modal_ar4_2_document');
        console.log('ar4-2 document validation:', ar42DocumentValid);
        isValid = ar42DocumentValid && isValid;
    }
    // AR4-3: Research/innovation outputs
    if (type === 'ar4-3') {
        isValid = validateModalField('modal_typeActivite', true, 'Le type d\'activité est requis') && isValid;
        isValid = validateModalField('modal_titre', true, 'Le titre est requis') && isValid;
        isValid = validateTextLength('modal_titre', 'Titre') && isValid;
        isValid = validateModalField('modal_description', true, 'La description est requise') && isValid;
        isValid = validateTextLength('modal_description', 'Description') && isValid;
        isValid = validateModalField('modal_date', true, 'La date est requise') && isValid;
        isValid = validateModalField('modal_institution', true, 'L\'institution est requise') && isValid;
        isValid = validateTextLength('modal_institution', 'Institution') && isValid;
        isValid = validateModalField('modal_lieu', true, 'Le lieu est requis') && isValid;
        isValid = validateModalField('modal_organismePrix', true, 'L\'organisme est requis') && isValid;
        isValid = validateTextLength('modal_organismePrix', 'Organisme') && isValid;
        isValid = validateModalField('modal_role', true, 'Le rôle est requis') && isValid;
        const ar43DocumentValid = validateModalFile(document.getElementById('modal_ar4_3_document'), 'modal_ar4_3_document');
        console.log('ar4-3 document validation:', ar43DocumentValid);
        isValid = ar43DocumentValid && isValid;
    }
    if (type === 'encadrement-master') {
        isValid = validateModalField('modal_annee_univ') && isValid;
        isValid = validateModalField('modal_filiere') && isValid;
        isValid = validateModalField('modal_type_master_select') && isValid;
        isValid = validateModalField('modal_titre_memoire') && isValid;
        isValid = validateTextLength('modal_titre_memoire', 'Titre Mémoire') && isValid;
        isValid = validateModalField('modal_nom_etudiants') && isValid;
        isValid = validateTextLength('modal_nom_etudiants', 'Nom Étudiants') && isValid;
        isValid = validateModalField('modal_nom_encadrants') && isValid;
        isValid = validateTextLength('modal_nom_encadrants', 'Nom Encadrants') && isValid;
        const encMasterFileValid = validateModalFile(document.getElementById('modal_enc_master_cover'), 'modal_enc_master_cover');
        console.log('encadrement-master file validation:', encMasterFileValid);
        isValid = encMasterFileValid && isValid;
    }
    if (type === 'responsabilites') {
        isValid = validateModalField('modal_annee_univ') && isValid;
        isValid = validateModalField('modal_cycle_select') && isValid;
        isValid = validateModalField('modal_filiere') && isValid;
        isValid = validateModalField('modal_semestre') && isValid;
        isValid = validateModalField('modal_intitule_module') && isValid;
        isValid = validateTextLength('modal_intitule_module', 'Intitulé du module') && isValid;
    }

    if (!isValid) {
        return;
    }

    const tableId = `table-${type}`;
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector('tbody');

    // Récupération des données du formulaire
    const inputs = document.querySelectorAll('#modalContent input, #modalContent select, #modalContent textarea');
    inputs.forEach(input => {
        if (input.type === 'file') return;
        if (input.type === 'checkbox') {
            data[input.id.replace('modal_', '')] = input.checked;
        } else {
            data[input.id.replace('modal_', '')] = input.value;
        }
    });

    // --- Logique Sync (Mémoire) pour Step 2 ---
    if (type === 'encadrement-licence' || type === 'encadrement-master') {
        let fileInputId = type === 'encadrement-licence' ? 'modal_enc_licence_cover' : 'modal_enc_master_cover';
        let fileInput = document.getElementById(fileInputId);

        if (fileInput && fileInput.files.length > 0) {
            data.file = fileInput.files[0];
            data.page_de_garde = null;
        }
    } else if (type === 'ae2-1' || type === 'ae2-2') {
        let fileInput = document.getElementById('modal_' + type + '_file');
        if (fileInput && fileInput.files.length > 0) {
            data.file = fileInput.files[0];
            data.PDF = null;
        }
    } else if (type === 'ae1-3') {
        let fileInput = document.getElementById('modal_ae1_3_file');
        if (fileInput && fileInput.files.length > 0) {
            data.file = fileInput.files[0];
            data.PDF = null;
        }
    } else if (type === 'ar2-2') {
        // AR2-2: Thesis/habilitation jury
        html = `
            <div class="modal-header">
                <h3>Rapporteur et membre de jury de thèses ou d'habilitations</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Nom de l'auteur <span style="color: #000;">*</span></label>
                    <div id="modal_nomAuteurError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_nomAuteur" oninput="validateModalField('modal_nomAuteur'); updateCharCounter('modal_nomAuteur', 'modal_nomAuteurCounter')">${escapeHtml(val('nomAuteur') || '')}</textarea>
                    <div id="modal_nomAuteurCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Type de thèse ou travail <span style="color: #000;">*</span></label>
                    <div id="modal_typeTravailError" class="error-message" style="display: none;"></div>
                    <select id="modal_typeTravail" onchange="validateModalField('modal_typeTravail')">
                        <option value="" disabled ${!val('typeTravail') ? 'selected' : ''}>Choisir</option>
                        <option value="Doctorat" ${val('typeTravail') === 'Doctorat' ? 'selected' : ''}>Doctorat</option>
                        <option value="Habilitation" ${val('typeTravail') === 'Habilitation' ? 'selected' : ''}>Habilitation</option>
                        <option value="Autre" ${val('typeTravail') === 'Autre' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Titre de la thèse ou habilitation <span style="color: #000;">*</span></label>
                    <div id="modal_titreError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_titre" oninput="validateModalField('modal_titre'); updateCharCounter('modal_titre', 'modal_titreCounter')">${escapeHtml(val('titre') || '')}</textarea>
                    <div id="modal_titreCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Nom de l'institution <span style="color: #000;">*</span></label>
                    <div id="modal_institutionError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_institution" oninput="validateModalField('modal_institution'); updateCharCounter('modal_institution', 'modal_institutionCounter')">${escapeHtml(val('institution') || '')}</textarea>
                    <div id="modal_institutionCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Date de soutenance <span style="color: #000;">*</span></label>
                    <div id="modal_dateSoutenanceError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_dateSoutenance" value="${escapeHtml(val('dateSoutenance') || '')}" oninput="validateModalField('modal_dateSoutenance')">
                </div>
                <div class="modal-form-group">
                    <label>Rôle de l'utilisateur <span style="color: #000;">*</span></label>
                    <div id="modal_roleError" class="error-message" style="display: none;"></div>
                    <select id="modal_role" onchange="validateModalField('modal_role')">
                        <option value="" disabled ${!val('role') ? 'selected' : ''}>Choisir</option>
                        <option value="Rapporteur" ${val('role') === 'Rapporteur' ? 'selected' : ''}>Rapporteur</option>
                        <option value="Membre de jury" ${val('role') === 'Membre de jury' ? 'selected' : ''}>Membre de jury</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Confirmation non double comptage <span style="color: #000;">*</span></label>
                    <div id="modal_nonDoubleComptageError" class="error-message" style="display: none;"></div>
                    <select id="modal_nonDoubleComptage" onchange="validateModalField('modal_nonDoubleComptage')">
                        <option value="" disabled ${!val('nonDoubleComptage') ? 'selected' : ''}>Choisir</option>
                        <option value="Oui" ${val('nonDoubleComptage') === 'Oui' ? 'selected' : ''}>Oui, pas compté dans AR 2-1</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Affiliation CED</label>
                    <input type="text" id="modal_ced" value="${escapeHtml(val('ced') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Invitation officielle ou lettre de nomination <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar2_2_invitation').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar2_2_invitationName">${escapeHtml(val('invitationFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar2_2_invitation" name="modal_ar2_2_invitation" accept=".pdf" onchange="updateFileName(this, 'modal_ar2_2_invitationName')">
                    </div>
                </div>
                <div class="modal-form-group">
                    <label>Page de garde (tamponnée CED) <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar2_2_these').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar2_2_theseName">${escapeHtml(val('theseFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar2_2_these" name="modal_ar2_2_these" accept=".pdf" onchange="updateFileName(this, 'modal_ar2_2_theseName'); validateModalFile(this, 'modal_ar2_2_these')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar3-1') {
        // AR3-1: Director of research structure
        html = `
            <div class="modal-header">
                <h3>AR 3-1 Directeur de structure de recherche (laboratoire, pôle de compétence, centre thématique de recherche,…)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Nom de la structure <span style="color: #000;">*</span></label>
                    <div id="modal_nomStructureError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_nomStructure" oninput="validateModalField('modal_nomStructure'); updateCharCounter('modal_nomStructure', 'modal_nomStructureCounter')">${escapeHtml(val('nomStructure') || '')}</textarea>
                    <div id="modal_nomStructureCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Type de structure <span style="color: #000;">*</span></label>
                    <div id="modal_typeStructureError" class="error-message" style="display: none;"></div>
                    <select id="modal_typeStructure" onchange="validateModalField('modal_typeStructure')">
                        <option value="" disabled ${!val('typeStructure') ? 'selected' : ''}>Choisir</option>
                        <option value="Laboratoire" ${val('typeStructure') === 'Laboratoire' ? 'selected' : ''}>Laboratoire</option>
                        <option value="Centre de compétence accrédité" ${val('typeStructure') === 'Centre de compétence accrédité' ? 'selected' : ''}>Centre de compétence accrédité</option>
                        <option value="Centre thématique de recherche" ${val('typeStructure') === 'Centre thématique de recherche' ? 'selected' : ''}>Centre thématique de recherche</option>
                        <option value="Autre" ${val('typeStructure') === 'Autre' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Adresse de la structure <span style="color: #000;">*</span></label>
                    <div id="modal_adresseStructureError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_adresseStructure" oninput="validateModalField('modal_adresseStructure'); updateCharCounter('modal_adresseStructure', 'modal_adresseStructureCounter')">${escapeHtml(val('adresseStructure') || '')}</textarea>
                    <div id="modal_adresseStructureCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Période de mandat <span style="color: #000;">*</span></label>
                    <div id="modal_periodeMandatError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_periodeMandat" oninput="validateModalField('modal_periodeMandat'); updateCharCounter('modal_periodeMandat', 'modal_periodeMandatCounter')">${escapeHtml(val('periodeMandat') || '')}</textarea>
                    <div id="modal_periodeMandatCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Établissement ou université <span style="color: #000;">*</span></label>
                    <div id="modal_etablissementError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_etablissement" oninput="validateModalField('modal_etablissement'); updateCharCounter('modal_etablissement', 'modal_etablissementCounter')">${escapeHtml(val('etablissement') || '')}</textarea>
                    <div id="modal_etablissementCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Rôle <span style="color: #000;">*</span></label>
                    <div id="modal_roleError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_role" value="${escapeHtml(val('role') || '')}" oninput="validateModalField('modal_role')">
                </div>
                <div class="modal-form-group">
                    <label>Attestation officielle <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar3_1_attestation').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar3_1_attestationName">${escapeHtml(val('attestationFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar3_1_attestation" name="modal_ar3_1_attestation" accept=".pdf" onchange="updateFileName(this, 'modal_ar3_1_attestationName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar3-2') {
        // AR3-2: Head of research team
        html = `
            <div class="modal-header">
                <h3>Responsable d'équipe de recherche</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Nom de l'équipe <span style="color: #000;">*</span></label>
                    <div id="modal_nomEquipeError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_nomEquipe" oninput="validateModalField('modal_nomEquipe'); updateCharCounter('modal_nomEquipe', 'modal_nomEquipeCounter')">${escapeHtml(val('nomEquipe') || '')}</textarea>
                    <div id="modal_nomEquipeCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Adresse de l'équipe <span style="color: #000;">*</span></label>
                    <div id="modal_adresseEquipeError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_adresseEquipe" oninput="validateModalField('modal_adresseEquipe'); updateCharCounter('modal_adresseEquipe', 'modal_adresseEquipeCounter')">${escapeHtml(val('adresseEquipe') || '')}</textarea>
                    <div id="modal_adresseEquipeCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Structure de recherche parente</label>
                    <textarea id="modal_structureParente" oninput="updateCharCounter('modal_structureParente', 'modal_structureParenteCounter')">${escapeHtml(val('structureParente') || '')}</textarea>
                    <div id="modal_structureParenteCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Période de mandat <span style="color: #000;">*</span></label>
                    <div id="modal_periodeMandatError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_periodeMandat" oninput="validateModalField('modal_periodeMandat'); updateCharCounter('modal_periodeMandat', 'modal_periodeMandatCounter')">${escapeHtml(val('periodeMandat') || '')}</textarea>
                    <div id="modal_periodeMandatCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Établissement ou université <span style="color: #000;">*</span></label>
                    <div id="modal_etablissementError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_etablissement" oninput="validateModalField('modal_etablissement'); updateCharCounter('modal_etablissement', 'modal_etablissementCounter')">${escapeHtml(val('etablissement') || '')}</textarea>
                    <div id="modal_etablissementCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Rôle <span style="color: #000;">*</span></label>
                    <div id="modal_roleError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_role" value="${escapeHtml(val('role') || '')}" oninput="validateModalField('modal_role')">
                </div>
                <div class="modal-form-group">
                    <label>Attestation du Directeur de la structure <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar3_2_attestation').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar3_2_attestationName">${escapeHtml(val('attestationFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar3_2_attestation" name="modal_ar3_2_attestation" accept=".pdf" onchange="updateFileName(this, 'modal_ar3_2_attestationName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar3-3') {
        // AR3-3: Research projects
        html = `
            <div class="modal-header">
                <h3>AR 3-3 Responsable ou participant dans des projets ou contrats de recherche financés</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Nom du responsable du projet <span style="color: #000;">*</span></label>
                    <div id="modal_nomResponsableError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_nomResponsable" oninput="validateModalField('modal_nomResponsable'); updateCharCounter('modal_nomResponsable', 'modal_nomResponsableCounter')">${escapeHtml(val('nomResponsable') || '')}</textarea>
                    <div id="modal_nomResponsableCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Rôle de l'utilisateur <span style="color: #000;">*</span></label>
                    <div id="modal_roleError" class="error-message" style="display: none;"></div>
                    <select id="modal_role" onchange="validateModalField('modal_role')">
                        <option value="" disabled ${!val('role') ? 'selected' : ''}>Choisir</option>
                        <option value="Responsable" ${val('role') === 'Responsable' ? 'selected' : ''}>Responsable</option>
                        <option value="Participant" ${val('role') === 'Participant' ? 'selected' : ''}>Participant</option>
                        <option value="Membre" ${val('role') === 'Membre' ? 'selected' : ''}>Membre</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Nature du projet <span style="color: #000;">*</span></label>
                    <div id="modal_natureProjetError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_natureProjet" oninput="validateModalField('modal_natureProjet'); updateCharCounter('modal_natureProjet', 'modal_natureProjetCounter')">${escapeHtml(val('natureProjet') || '')}</textarea>
                    <div id="modal_natureProjetCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Titre du projet <span style="color: #000;">*</span></label>
                    <div id="modal_titreProjetError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_titreProjet" oninput="validateModalField('modal_titreProjet'); updateCharCounter('modal_titreProjet', 'modal_titreProjetCounter')">${escapeHtml(val('titreProjet') || '')}</textarea>
                    <div id="modal_titreProjetCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Montant total alloué <span style="color: #000;">*</span></label>
                    <div id="modal_montantError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_montant" value="${escapeHtml(val('montant') || '')}" oninput="validateModalField('modal_montant')">
                </div>
                <div class="modal-form-group">
                    <label>Période <span style="color: #000;">*</span></label>
                    <div id="modal_dureeError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_duree" oninput="validateModalField('modal_duree'); updateCharCounter('modal_duree', 'modal_dureeCounter')">${escapeHtml(val('duree') || '')}</textarea>
                    <div id="modal_dureeCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Organisme partenaire <span style="color: #000;">*</span></label>
                    <div id="modal_partenaireError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_partenaire" oninput="validateModalField('modal_partenaire'); updateCharCounter('modal_partenaire', 'modal_partenaireCounter')">${escapeHtml(val('partenaire') || '')}</textarea>
                    <div id="modal_partenaireCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Organisme financeur <span style="color: #000;">*</span></label>
                    <div id="modal_financeurError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_financeur" oninput="validateModalField('modal_financeur'); updateCharCounter('modal_financeur', 'modal_financeurCounter')">${escapeHtml(val('financeur') || '')}</textarea>
                    <div id="modal_financeurCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Type de financement <span style="color: #000;">*</span></label>
                    <div id="modal_typeFinancementError" class="error-message" style="display: none;"></div>
                    <select id="modal_typeFinancement" onchange="validateModalField('modal_typeFinancement')">
                        <option value="" disabled ${!val('typeFinancement') ? 'selected' : ''}>Choisir</option>
                        <option value="Appel à projets" ${val('typeFinancement') === 'Appel à projets' ? 'selected' : ''}>Appel à projets</option>
                        <option value="Accord direct" ${val('typeFinancement') === 'Accord direct' ? 'selected' : ''}>Accord direct</option>
                        <option value="Organisation publique" ${val('typeFinancement') === 'Organisation publique' ? 'selected' : ''}>Organisation publique</option>
                        <option value="Organisation privée" ${val('typeFinancement') === 'Organisation privée' ? 'selected' : ''}>Organisation privée</option>
                        <option value="Organisation nationale" ${val('typeFinancement') === 'Organisation nationale' ? 'selected' : ''}>Organisation nationale</option>
                        <option value="Organisation internationale" ${val('typeFinancement') === 'Organisation internationale' ? 'selected' : ''}>Organisation internationale</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Établissement ou cadre de financement</label>
                    <input type="text" id="modal_cadreFinancement" value="${escapeHtml(val('cadreFinancement') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Description de la contribution</label>
                    <textarea id="modal_contribution" oninput="updateCharCounter('modal_contribution', 'modal_contributionCounter')">${escapeHtml(val('contribution') || '')}</textarea>
                    <div id="modal_contributionCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Contrat/convention <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar3_3_contrat').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar3_3_contratName">${escapeHtml(val('contratFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar3_3_contrat" name="modal_ar3_3_contrat" accept=".pdf" onchange="updateFileName(this, 'modal_ar3_3_contratName')">
                    </div>
                </div>
                <div class="modal-form-group">
                    <label>Attestation du responsable (pour participants)</label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar3_3_attestation').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar3_3_attestationName">${escapeHtml(val('attestationFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar3_3_attestation" name="modal_ar3_3_attestation" accept=".pdf" onchange="updateFileName(this, 'modal_ar3_3_attestationName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar3-4') {
        // AR3-4: Scientific expertise/evaluation
        html = `
            <div class="modal-header">
                <h3>AR 3-4 Activités d'expertise et d'évaluation scientifique à l'échelle nationale ou internationale (CNACES, CNRST, reviewer, editorial board, editor-in-chief,…)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Type d'activité <span style="color: #000;">*</span></label>
                    <div id="modal_typeActiviteError" class="error-message" style="display: none;"></div>
                    <select id="modal_typeActivite" onchange="validateModalField('modal_typeActivite')">
                        <option value="" disabled ${!val('typeActivite') ? 'selected' : ''}>Choisir</option>
                        <option value="Expertise accréditation" ${val('typeActivite') === 'Expertise accréditation' ? 'selected' : ''}>Expertise accréditation</option>
                        <option value="Évaluation projets recherche" ${val('typeActivite') === 'Évaluation projets recherche' ? 'selected' : ''}>Évaluation projets recherche</option>
                        <option value="Évaluation structures recherche" ${val('typeActivite') === 'Évaluation structures recherche' ? 'selected' : ''}>Évaluation structures recherche</option>
                        <option value="Évaluation thèses doctorat équivalence" ${val('typeActivite') === 'Évaluation thèses doctorat équivalence' ? 'selected' : ''}>Évaluation thèses doctorat équivalence</option>
                        <option value="Revue publication scientifique" ${val('typeActivite') === 'Revue publication scientifique' ? 'selected' : ''}>Revue publication scientifique</option>
                        <option value="Rédacteur en chef" ${val('typeActivite') === 'Rédacteur en chef' ? 'selected' : ''}>Rédacteur en chef</option>
                        <option value="Comité éditorial" ${val('typeActivite') === 'Comité éditorial' ? 'selected' : ''}>Comité éditorial</option>
                        <option value="Autre" ${val('typeActivite') === 'Autre' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Portée nationale ou internationale <span style="color: #000;">*</span></label>
                    <div id="modal_porteeError" class="error-message" style="display: none;"></div>
                    <select id="modal_portee" onchange="validateModalField('modal_portee')">
                        <option value="" disabled ${!val('portee') ? 'selected' : ''}>Choisir</option>
                        <option value="Nationale" ${val('portee') === 'Nationale' ? 'selected' : ''}>Nationale</option>
                        <option value="Internationale" ${val('portee') === 'Internationale' ? 'selected' : ''}>Internationale</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Objet de l'activité <span style="color: #000;">*</span></label>
                    <div id="modal_objetError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_objet" oninput="validateModalField('modal_objet'); updateCharCounter('modal_objet', 'modal_objetCounter')">${escapeHtml(val('objet') || '')}</textarea>
                    <div id="modal_objetCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Date de réalisation <span style="color: #000;">*</span></label>
                    <div id="modal_dateRealisationError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_dateRealisation" value="${escapeHtml(val('dateRealisation') || '')}" oninput="validateModalField('modal_dateRealisation')">
                </div>
                <div class="modal-form-group">
                    <label>Institution/organisme concerné <span style="color: #000;">*</span></label>
                    <div id="modal_institutionError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_institution" oninput="validateModalField('modal_institution'); updateCharCounter('modal_institution', 'modal_institutionCounter')">${escapeHtml(val('institution') || '')}</textarea>
                    <div id="modal_institutionCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Rôle de l'utilisateur <span style="color: #000;">*</span></label>
                    <div id="modal_roleError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_role" value="${escapeHtml(val('role') || '')}" oninput="validateModalField('modal_role')">
                </div>
                <div class="modal-form-group">
                    <label>Titre ou sujet de l'élément évalué</label>
                    <textarea id="modal_titreSujet" oninput="updateCharCounter('modal_titreSujet', 'modal_titreSujetCounter')">${escapeHtml(val('titreSujet') || '')}</textarea>
                    <div id="modal_titreSujetCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Référence officielle</label>
                    <input type="text" id="modal_reference" value="${escapeHtml(val('reference') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Attestation officielle (objet et date) <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar3_4_attestation').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar3_4_attestationName">${escapeHtml(val('attestationFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar3_4_attestation" name="modal_ar3_4_attestation" accept=".pdf" onchange="updateFileName(this, 'modal_ar3_4_attestationName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar4-1') {
        // AR4-1: Interaction structures/events
        html = `
            <div class="modal-header">
                <h3>AR 4-1 Animation de structures d'interaction avec le milieu socio-économique et organisation de manifestations scientifiques (séminaires, colloques, congrès, forums,…)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Type d'activité <span style="color: #000;">*</span></label>
                    <div id="modal_typeActiviteError" class="error-message" style="display: none;"></div>
                    <select id="modal_typeActivite" onchange="validateModalField('modal_typeActivite')">
                        <option value="" disabled ${!val('typeActivite') ? 'selected' : ''}>Choisir</option>
                        <option value="Animation structure" ${val('typeActivite') === 'Animation structure' ? 'selected' : ''}>Animation structure</option>
                        <option value="Organisation événement" ${val('typeActivite') === 'Organisation événement' ? 'selected' : ''}>Organisation événement</option>
                        <option value="Séminaire" ${val('typeActivite') === 'Séminaire' ? 'selected' : ''}>Séminaire</option>
                        <option value="Colloque" ${val('typeActivite') === 'Colloque' ? 'selected' : ''}>Colloque</option>
                        <option value="Congrès" ${val('typeActivite') === 'Congrès' ? 'selected' : ''}>Congrès</option>
                        <option value="Forum" ${val('typeActivite') === 'Forum' ? 'selected' : ''}>Forum</option>
                        <option value="Symposium" ${val('typeActivite') === 'Symposium' ? 'selected' : ''}>Symposium</option>
                        <option value="Journée scientifique" ${val('typeActivite') === 'Journée scientifique' ? 'selected' : ''}>Journée scientifique</option>
                        <option value="Autre" ${val('typeActivite') === 'Autre' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Titre de l'activité <span style="color: #000;">*</span></label>
                    <div id="modal_titreError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_titre" oninput="validateModalField('modal_titre'); updateCharCounter('modal_titre', 'modal_titreCounter')">${escapeHtml(val('titre') || '')}</textarea>
                    <div id="modal_titreCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Lieu <span style="color: #000;">*</span></label>
                    <div id="modal_lieuError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_lieu" value="${escapeHtml(val('lieu') || '')}" oninput="validateModalField('modal_lieu')">
                </div>
                <div class="modal-form-group">
                    <label>Date <span style="color: #000;">*</span></label>
                    <div id="modal_dateError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_date" value="${escapeHtml(val('date') || '')}" oninput="validateModalField('modal_date')">
                </div>
                <div class="modal-form-group">
                    <label>Nom de la structure ou de l'événement <span style="color: #000;">*</span></label>
                    <div id="modal_nomStructureEventError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_nomStructureEvent" oninput="validateModalField('modal_nomStructureEvent'); updateCharCounter('modal_nomStructureEvent', 'modal_nomStructureEventCounter')">${escapeHtml(val('nomStructureEvent') || '')}</textarea>
                    <div id="modal_nomStructureEventCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Rôle de l'utilisateur <span style="color: #000;">*</span></label>
                    <div id="modal_roleError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_role" value="${escapeHtml(val('role') || '')}" oninput="validateModalField('modal_role')">
                </div>
                <div class="modal-form-group">
                    <label>Institution organisatrice</label>
                    <input type="text" id="modal_institution" value="${escapeHtml(val('institution') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Reconnaissance ou mission officielle</label>
                    <textarea id="modal_reconnaissance" oninput="updateCharCounter('modal_reconnaissance', 'modal_reconnaissanceCounter')">${escapeHtml(val('reconnaissance') || '')}</textarea>
                    <div id="modal_reconnaissanceCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Document officiel <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar4_1_document').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar4_1_documentName">${escapeHtml(val('documentFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar4_1_document" name="modal_ar4_1_document" accept=".pdf" onchange="updateFileName(this, 'modal_ar4_1_documentName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar4-2') {
        // AR4-2: Expertise/valorization
        html = `
            <div class="modal-header">
                <h3>AR 4-2 Expertise et valorisation d'actions et de travaux au profit du milieu socio-économique (organisations non gouvernementales, secteur privé, organismes internationaux, secteur public)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Nature de l'activité <span style="color: #000;">*</span></label>
                    <div id="modal_natureError" class="error-message" style="display: none;"></div>
                    <select id="modal_nature" onchange="validateModalField('modal_nature')">
                        <option value="" disabled ${!val('nature') ? 'selected' : ''}>Choisir</option>
                        <option value="Expertise socio-culturelle" ${val('nature') === 'Expertise socio-culturelle' ? 'selected' : ''}>Expertise socio-culturelle</option>
                        <option value="Contrat extra-universitaire" ${val('nature') === 'Contrat extra-universitaire' ? 'selected' : ''}>Contrat extra-universitaire</option>
                        <option value="Responsable d’association scientifique ou culturelle" ${val('nature') === 'Responsable d’association scientifique ou culturelle' ? 'selected' : ''}>Responsable d’association scientifique ou culturelle</option>
                        <option value="Responsable de club scientifique" ${val('nature') === 'Responsable de club scientifique' ? 'selected' : ''}>Responsable de club scientifique</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Organisme concerné <span style="color: #000;">*</span></label>
                    <div id="modal_organismeError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_organisme" oninput="validateModalField('modal_organisme'); updateCharCounter('modal_organisme', 'modal_organismeCounter')">${escapeHtml(val('organisme') || '')}</textarea>
                    <div id="modal_organismeCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Lieu <span style="color: #000;">*</span></label>
                    <div id="modal_lieuError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_lieu" value="${escapeHtml(val('lieu') || '')}" oninput="validateModalField('modal_lieu')">
                </div>
                <div class="modal-form-group">
                    <label>Date <span style="color: #000;">*</span></label>
                    <div id="modal_dateError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_date" value="${escapeHtml(val('date') || '')}" oninput="validateModalField('modal_date')">
                </div>
                <div class="modal-form-group">
                    <label>Rôle ou responsabilité <span style="color: #000;">*</span></label>
                    <div id="modal_roleError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_role" value="${escapeHtml(val('role') || '')}" oninput="validateModalField('modal_role')">
                </div>
                <div class="modal-form-group">
                    <label>Type d'organisme <span style="color: #000;">*</span></label>
                    <div id="modal_typeOrganismeError" class="error-message" style="display: none;"></div>
                    <select id="modal_typeOrganisme" onchange="validateModalField('modal_typeOrganisme')">
                        <option value="" disabled ${!val('typeOrganisme') ? 'selected' : ''}>Choisir</option>
                        <option value="ONG" ${val('typeOrganisme') === 'ONG' ? 'selected' : ''}>ONG</option>
                        <option value="Secteur privé" ${val('typeOrganisme') === 'Secteur privé' ? 'selected' : ''}>Secteur privé</option>
                        <option value="Organisation internationale" ${val('typeOrganisme') === 'Organisation internationale' ? 'selected' : ''}>Organisation internationale</option>
                        <option value="Secteur public" ${val('typeOrganisme') === 'Secteur public' ? 'selected' : ''}>Secteur public</option>
                        <option value="Association scientifique" ${val('typeOrganisme') === 'Association scientifique' ? 'selected' : ''}>Association scientifique</option>
                        <option value="Association socio-culturelle universitaire" ${val('typeOrganisme') === 'Association socio-culturelle universitaire' ? 'selected' : ''}>Association socio-culturelle universitaire</option>
                        <option value="Autre" ${val('typeOrganisme') === 'Autre' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Description de l'expertise ou valorisation <span style="color: #000;">*</span></label>
                    <div id="modal_descriptionError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_description" oninput="validateModalField('modal_description'); updateCharCounter('modal_description', 'modal_descriptionCounter')">${escapeHtml(val('description') || '')}</textarea>
                    <div id="modal_descriptionCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Bénéficiaire de l'action</label>
                    <input type="text" id="modal_beneficiaire" value="${escapeHtml(val('beneficiaire') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Détails contrat ou responsabilité</label>
                    <textarea id="modal_details" oninput="updateCharCounter('modal_details', 'modal_detailsCounter')">${escapeHtml(val('details') || '')}</textarea>
                    <div id="modal_detailsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Institution concernée <span style="color: #000;">*</span></label>
                    <div id="modal_institutionsError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_institutions" oninput="validateModalField('modal_institutions'); updateCharCounter('modal_institutions', 'modal_institutionsCounter')">${escapeHtml(val('institutions'))}</textarea>
                    <div id="modal_institutionsCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Date ou période <span style="color: #000;">*</span></label>
                    <div id="modal_datesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_dates" oninput="validateModalField('modal_dates'); updateCharCounter('modal_dates', 'modal_datesCounter')">${escapeHtml(val('dates'))}</textarea>
                    <div id="modal_datesCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Lieu <span style="color: #000;">*</span></label>
                    <div id="modal_lieuxError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_lieux" oninput="validateModalField('modal_lieux'); updateCharCounter('modal_lieux', 'modal_lieuxCounter')">${escapeHtml(val('lieux'))}</textarea>
                    <div id="modal_lieuxCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Rôle de l'utilisateur <span style="color: #000;">*</span></label>
                    <div id="modal_rolesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_roles" oninput="validateModalField('modal_roles'); updateCharCounter('modal_roles', 'modal_rolesCounter')">${escapeHtml(val('roles'))}</textarea>
                    <div id="modal_rolesCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Durée <span style="color: #000;">*</span></label>
                    <div id="modal_dureesError" class="error-message" style="display: none; color: red; font-size: 0.85rem; margin-top: 4px;"></div>
                    <textarea id="modal_durees" oninput="validateModalField('modal_durees'); updateCharCounter('modal_durees', 'modal_dureesCounter')">${escapeHtml(val('durees'))}</textarea>
                    <div id="modal_dureesCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Document officiel prouvant l'activité <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar4_2_document').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar4_2_documentName">${escapeHtml(val('documentFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar4_2_document" name="modal_ar4_2_document" accept=".pdf" onchange="updateFileName(this, 'modal_ar4_2_documentName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    } else if (type === 'ar4-3') {
        // AR4-3: Research/innovation outputs
        html = `
            <div class="modal-header">
                <h3>AR 4-3 Travaux de recherche et innovations (Dépôt de brevets au profit de l'établissement, conception de prototypes, incubation de projets de recherche et de développement, prix,…)</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label>Type d'activité <span style="color: #000;">*</span></label>
                    <div id="modal_typeActiviteError" class="error-message" style="display: none;"></div>
                    <select id="modal_typeActivite" onchange="validateModalField('modal_typeActivite')">
                        <option value="" disabled ${!val('typeActivite') ? 'selected' : ''}>Choisir</option>
                        <option value="Projet R&D" ${val('typeActivite') === 'Projet R&D' ? 'selected' : ''}>Projet R&D</option>
                        <option value="Brevet" ${val('typeActivite') === 'Brevet' ? 'selected' : ''}>Brevet</option>
                        <option value="Prototype" ${val('typeActivite') === 'Prototype' ? 'selected' : ''}>Prototype</option>
                        <option value="Projet incubé" ${val('typeActivite') === 'Projet incubé' ? 'selected' : ''}>Projet incubé</option>
                        <option value="Invitation à l'étranger" ${val('typeActivite') === 'Invitation à l\u0027étranger' ? 'selected' : ''}>Invitation à l'étranger</option>
                        <option value="Prix scientifique" ${val('typeActivite') === 'Prix scientifique' ? 'selected' : ''}>Prix scientifique</option>
                        <option value="Distinction scientifique" ${val('typeActivite') === 'Distinction scientifique' ? 'selected' : ''}>Distinction scientifique</option>
                        <option value="Autre" ${val('typeActivite') === 'Autre' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label>Titre ou nom de l'activité <span style="color: #000;">*</span></label>
                    <div id="modal_titreError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_titre" oninput="validateModalField('modal_titre'); updateCharCounter('modal_titre', 'modal_titreCounter')">${escapeHtml(val('titre') || '')}</textarea>
                    <div id="modal_titreCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Description de l'activité <span style="color: #000;">*</span></label>
                    <div id="modal_descriptionError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_description" oninput="validateModalField('modal_description'); updateCharCounter('modal_description', 'modal_descriptionCounter')">${escapeHtml(val('description') || '')}</textarea>
                    <div id="modal_descriptionCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Date <span style="color: #000;">*</span></label>
                    <div id="modal_dateError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_date" value="${escapeHtml(val('date') || '')}" oninput="validateModalField('modal_date')">
                </div>
                <div class="modal-form-group">
                    <label>Institution ou organisation concernée <span style="color: #000;">*</span></label>
                    <div id="modal_institutionError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_institution" oninput="validateModalField('modal_institution'); updateCharCounter('modal_institution', 'modal_institutionCounter')">${escapeHtml(val('institution') || '')}</textarea>
                    <div id="modal_institutionCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Lieu <span style="color: #000;">*</span></label>
                    <div id="modal_lieuError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_lieu" value="${escapeHtml(val('lieu') || '')}" oninput="validateModalField('modal_lieu')">
                </div>
                <div class="modal-form-group">
                    <label>Partenaire socio-économique</label>
                    <input type="text" id="modal_partenaire" value="${escapeHtml(val('partenaire') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Cadre de financement</label>
                    <input type="text" id="modal_cadreFinancement" value="${escapeHtml(val('cadreFinancement') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Information sur le dépôt de brevet</label>
                    <textarea id="modal_infoBrevet" oninput="updateCharCounter('modal_infoBrevet', 'modal_infoBrevetCounter')">${escapeHtml(val('infoBrevet') || '')}</textarea>
                    <div id="modal_infoBrevetCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Description du prototype</label>
                    <textarea id="modal_descPrototype" oninput="updateCharCounter('modal_descPrototype', 'modal_descPrototypeCounter')">${escapeHtml(val('descPrototype') || '')}</textarea>
                    <div id="modal_descPrototypeCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Structure ou programme d'incubation</label>
                    <input type="text" id="modal_structureIncubation" value="${escapeHtml(val('structureIncubation') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Université ou institution étrangère</label>
                    <input type="text" id="modal_institutionEtrangere" value="${escapeHtml(val('institutionEtrangere') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Organisme attribuant le prix <span style="color: #000;">*</span></label>
                    <div id="modal_organismePrixError" class="error-message" style="display: none;"></div>
                    <textarea id="modal_organismePrix" oninput="validateModalField('modal_organismePrix'); updateCharCounter('modal_organismePrix', 'modal_organismePrixCounter')">${escapeHtml(val('organismePrix') || '')}</textarea>
                    <div id="modal_organismePrixCounter" class="char-counter"></div>
                </div>
                <div class="modal-form-group">
                    <label>Rôle de l'utilisateur <span style="color: #000;">*</span></label>
                    <div id="modal_roleError" class="error-message" style="display: none;"></div>
                    <input type="text" id="modal_role" value="${escapeHtml(val('role') || '')}" oninput="validateModalField('modal_role')">
                </div>
                <div class="modal-form-group">
                    <label>Institution bénéficiaire</label>
                    <input type="text" id="modal_institutionBeneficiaire" value="${escapeHtml(val('institutionBeneficiaire') || '')}">
                </div>
                <div class="modal-form-group">
                    <label>Document officiel <span style="color: #000;">*</span></label>
                    <div class="file-upload-group">
                        <button class="file-upload-btn" onclick="document.getElementById('modal_ar4_3_document').click()">Sélect. fichier</button>
                        <span class="file-upload-text" id="modal_ar4_3_documentName">${escapeHtml(val('documentFile') || 'Aucun fichier')}</span>
                        <input type="file" style="display: none;" id="modal_ar4_3_document" name="modal_ar4_3_document" accept=".pdf" onchange="updateFileName(this, 'modal_ar4_3_documentName')">
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
    }

    // Show the modal
    if (!html) {
        modalContent.innerHTML = `
            <div class="modal-header">
                <h3>Modal</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid"><p>Type not handled: ${type}</p></div>
        `;
        setupDateFields();
        modal.classList.add('active');
        return;
    }

    modalContent.innerHTML = html;
    setupDateFields();
    modal.classList.add('active');
}
}

function editRow(button) {
    const row = button.closest('tr');
    const table = row.closest('table');
    const inputs = row.querySelectorAll('input[type="text"], input[type="number"], textarea');
    const data = {};

    inputs.forEach(input => {
        if (input.name) {
            data[input.name] = input.value;
        }
    });

    // Récupérer la page de garde pour les encadrements
    if (row.dataset.pageDeGarde) {
        data.page_de_garde = row.dataset.pageDeGarde;
    }

    // Récupérer le fichier pour AE1-2, AE1-3
    if (table && (table.id === 'table-ae1-2' || table.id === 'table-ae1-3')) {
        const fileDisplay = row.querySelector('span.file-display');
        const fileLink = row.querySelector('a.file-link');
        if (fileLink) {
            data.PDF = fileLink.textContent.trim();
        } else if (fileDisplay) {
            data.PDF = fileDisplay.textContent.trim();
        }
    }
    // Récupérer le fichier pour AE3
    if (table && table.id.startsWith('table-ae3-')) {
        const fileDisplay = row.querySelector('span.file-display');
        const fileLink = row.querySelector('a.file-link');
        if (fileLink) {
            data.PDF = fileLink.textContent.trim();
        } else if (fileDisplay) {
            data.PDF = fileDisplay.textContent.trim();
        }
    }
    // Récupérer le lien pour AR1
    if (table && table.id.startsWith('table-ar1-')) {
        const lienInput = row.querySelector('input[name="lien"]');
        if (lienInput) {
            data.lien = lienInput.value.trim();
        }
    }
    // Récupérer le fichier pour AR2, AR3, AR4
    if (table && (table.id.startsWith('table-ar2-') || table.id.startsWith('table-ar3-') || table.id.startsWith('table-ar4-'))) {
        const fileDisplay = row.querySelector('span.file-display');
        const fileLink = row.querySelector('a.file-link');
        if (fileLink) {
            data.PDF = fileLink.textContent.trim();
        } else if (fileDisplay) {
            data.PDF = fileDisplay.textContent.trim();
        }
    }
    openModal(currentModalTypeFromRow(row), { row, data });
}

// Expose functions globally for inline onclick handlers
window.openModal = openModal;
window.editRow = editRow;
window.deleteRow = deleteRow;

// ==========================================
// Helper functions
// ==========================================

function getVal(id) {
    return document.getElementById(id)?.value || '';
}

function currentModalTypeFromRow(row) {
    const table = row.closest('table');
    if (table.id === 'table-licence') return 'licence';
    if (table.id === 'table-encadrement-licence') return 'encadrement-licence';
    if (table.id === 'table-master') return 'master';
    if (table.id === 'table-encadrement-master') return 'encadrement-master';
    if (table.id === 'table-responsabilites') return 'responsabilites';
    if (table.id === 'table-ae1-1') return 'ae1-1';
    if (table.id === 'table-ae1-2') return 'ae1-2';
    if (table.id === 'table-ae1-3') return 'ae1-3';
    if (table.id === 'table-ae2-1') return 'ae2-1';
    if (table.id === 'table-ae2-2') return 'ae2-2';
    if (table.id === 'table-ae2-3') return 'ae2-3';
    if (table.id === 'table-ae3-1') return 'ae3-1';
    if (table.id === 'table-ae3-2') return 'ae3-2';
    if (table.id === 'table-ae3-3') return 'ae3-3';
    if (table.id === 'table-ae3-4') return 'ae3-4';
    if (table.id === 'table-ae3-5') return 'ae3-5';
    if (table.id === 'table-ae3-6') return 'ae3-6';
    if (table.id === 'table-ae3-7') return 'ae3-7';
    if (table.id === 'table-ar1-1') return 'ar1-1';
    if (table.id === 'table-ar1-2') return 'ar1-2';
    if (table.id === 'table-ar1-3') return 'ar1-3';
    if (table.id === 'table-ar1-4') return 'ar1-4';
    if (table.id === 'table-ar2-1') return 'ar2-1';
    if (table.id === 'table-ar2-2') return 'ar2-2';
    if (table.id === 'table-ar3-1') return 'ar3-1';
    if (table.id === 'table-ar3-2') return 'ar3-2';
    if (table.id === 'table-ar3-3') return 'ar3-3';
    if (table.id === 'table-ar3-4') return 'ar3-4';
    if (table.id === 'table-ar4-1') return 'ar4-1';
    if (table.id === 'table-ar4-2') return 'ar4-2';
    if (table.id === 'table-ar4-3') return 'ar4-3';
}

function updateTableRow(row, data) {
    const table = row.closest('table');
    const inputs = row.querySelectorAll('input[type="text"], input[type="number"], textarea');

    inputs.forEach(input => {
        if (data[input.name] !== undefined) {
            input.value = data[input.name];
        }
    });

    // Gestion des fichiers pour Encadrement Licence et Master
    // Gestion des fichiers pour Encadrement Licence et Master (SYNC / FormData pattern)
    if (table && (table.id === 'table-encadrement-licence' || table.id === 'table-encadrement-master')) {
        // 1. Mise à jour de l'affichage
        const actionCell = row.querySelector('.table-actions');
        const fileCell = actionCell ? actionCell.previousElementSibling : null;

        if (fileCell) {
            if (data.file && data.file instanceof File) {
                // Cas : Nouveau fichier sélectionné (non encore uploadé)
                fileCell.innerHTML = `<span class="file-display">Fichier prêt: ${escapeHtml(data.file.name)}</span>`;
            } else if (data.page_de_garde) {
                // Cas : Fichier existant (déjà uploadé/persistant)
                fileCell.innerHTML = `<a href="/static/${data.page_de_garde}" target="_blank" class="file-link">Voir fichier</a>`;
                row.setAttribute('data-page-de-garde', data.page_de_garde);
            } else {
                fileCell.innerHTML = '<span class="file-display">Aucun fichier</span>';
            }
        }

        // 2. Mise à jour de l'input caché (Pour FormData)
        // On cherche ou crée l'input caché dans la cell 'fileCell'
        if (fileCell && data.file instanceof File) {
            let hiddenInput = row.querySelector('.step2-hidden-file');
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'file';
                hiddenInput.className = 'step2-hidden-file';
                hiddenInput.style.display = 'none'; // Caché
                hiddenInput.accept = '.pdf,.png,.jpg,.jpeg'; // Optionnel
                fileCell.appendChild(hiddenInput);
            }
            // Hydrater l'input avec le fichier en mémoire
            const dt = new DataTransfer();
            dt.items.add(data.file);
            hiddenInput.files = dt.files;
        }
    }

    // Gestion des fichiers pour AE1-1
    if (table && table.id === 'table-ae1-1') {
        const fileCell = row.querySelector('.ae11-file-cell') || row.cells[5];
        if (data.file && data.file instanceof File) {
            fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.file.name)}</span>`;
            let hiddenInput = row.querySelector('.ae11-hidden-file');
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'file';
                hiddenInput.className = 'ae11-hidden-file';
                hiddenInput.style.display = 'none';
                hiddenInput.accept = '.pdf';
                fileCell.appendChild(hiddenInput);
            }
            const dt = new DataTransfer();
            dt.items.add(data.file);
            hiddenInput.files = dt.files;
        } else if (data.PDF && data.PDF !== 'Aucun fichier') {
            const currentLink = fileCell.querySelector('a.file-link');
            if (currentLink) {
                currentLink.textContent = data.PDF;
            } else {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.PDF)}</span>`;
            }
        }
    }

    // Gestion des fichiers pour AE1-2
    if (table && table.id === 'table-ae1-2') {
        const fileCell = row.cells[0];
        if (data.file && data.file instanceof File) {
            fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.file.name)}</span>`;
            let hiddenInput = row.querySelector('.ae12-hidden-file');
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'file';
                hiddenInput.className = 'ae12-hidden-file';
                hiddenInput.style.display = 'none';
                hiddenInput.accept = '.pdf';
                fileCell.appendChild(hiddenInput);
            }
            const dt = new DataTransfer();
            dt.items.add(data.file);
            hiddenInput.files = dt.files;
        } else if (data.PDF && data.PDF !== 'Aucun fichier') {
            const currentLink = fileCell.querySelector('a.file-link');
            if (currentLink) {
                currentLink.textContent = data.PDF;
            } else {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.PDF)}</span>`;
            }
        }
    }
    //  Gestion des fichiers pour AE1-3 (copie de la logique AE1-2)
    else if (table && table.id === 'table-ae1-3') {
        const fileCell = row.cells[7];
        if (data.file && data.file instanceof File) {
            fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.file.name)}</span>`;
            let hiddenInput = row.querySelector('.ae13-hidden-file');
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'file';
                hiddenInput.className = 'ae13-hidden-file';
                hiddenInput.style.display = 'none';
                hiddenInput.accept = '.pdf';
                fileCell.appendChild(hiddenInput);
            }
            const dt = new DataTransfer();
            dt.items.add(data.file);
            hiddenInput.files = dt.files;
        } else if (data.PDF && data.PDF !== 'Aucun fichier') {
            const currentLink = fileCell.querySelector('a.file-link');
            if (currentLink) {
                currentLink.textContent = data.PDF;
            } else {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.PDF)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AE2-1 et AE2-2
    else if (table && (table.id === 'table-ae2-1' || table.id === 'table-ae2-2')) {
        const fileCell = row.cells[9];
        if (!fileCell) return;
        const hiddenInputClass = table.id === 'table-ae2-1' ? 'ae21-hidden-file' : 'ae22-hidden-file';
        if (data.file && data.file instanceof File) {
            fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.file.name)}</span>`;
            let hiddenInput = row.querySelector(`.${hiddenInputClass}`);
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'file';
                hiddenInput.className = hiddenInputClass;
                hiddenInput.style.display = 'none';
                hiddenInput.accept = '.pdf';
                fileCell.appendChild(hiddenInput);
            }
            const dt = new DataTransfer();
            dt.items.add(data.file);
            hiddenInput.files = dt.files;
        } else if (data.PDF && data.PDF !== 'Aucun fichier') {
            const currentLink = fileCell.querySelector('a.file-link');
            if (currentLink) {
                currentLink.textContent = data.PDF;
            } else {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.PDF)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AE3-1 à AE3-7 (même logique que AE1-2 et AE1-3)
    else if (table && table.id.startsWith('table-ae3-')) {
        // Déterminer la cellule fichier selon le type AE3
        let fileCell = null;
        const ae3Type = table.id.replace('table-', ''); // 'ae3-1', 'ae3-2', etc.

        if (ae3Type === 'ae3-1') {
            fileCell = row.cells[5]; // 6ème cellule (index 5)
        } else if (ae3Type === 'ae3-2') {
            fileCell = row.cells[5]; // 6ème cellule (index 5)
        } else if (ae3Type === 'ae3-3') {
            fileCell = row.cells[6]; // 7ème cellule (index 6)
        } else if (['ae3-4', 'ae3-5', 'ae3-6', 'ae3-7'].includes(ae3Type)) {
            fileCell = row.cells[4]; // 5ème cellule (index 4)
        }

        if (!fileCell) {
            console.error('AE3 file cell not found for', ae3Type);
            return;
        }

        const ae3Num = ae3Type.replace('ae3-', '');
        const hiddenInputClass = `ae3${ae3Num}-hidden-file`;

        if (data.file && data.file instanceof File) {
            fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.file.name)}</span>`;
            let hiddenInput = row.querySelector(`.${hiddenInputClass}`);
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'file';
                hiddenInput.className = hiddenInputClass;
                hiddenInput.style.display = 'none';
                hiddenInput.accept = '.pdf';
                fileCell.appendChild(hiddenInput);
            }
            const dt = new DataTransfer();
            dt.items.add(data.file);
            hiddenInput.files = dt.files;
        } else if (data.PDF && data.PDF !== 'Aucun fichier') {
            const currentLink = fileCell.querySelector('a.file-link');
            if (currentLink) {
                currentLink.textContent = data.PDF;
            } else {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.PDF)}</span>`;
            }
        }
    }
    // Gestion des liens pour AR1-1 à AR1-4
    else if (table && table.id.startsWith('table-ar1-')) {
        const lienCell = row.cells[0];
        const lienInput = lienCell.querySelector('input[name="lien"]');
        if (lienInput && data.lien !== undefined) {
            lienInput.value = data.lien;
        }
    }
    // Gestion des fichiers pour AR1-2 (attestation, première page)
    else if (table && table.id === 'table-ar1-2') {
        // Attestation file
        let fileCell = row.cells[9]; // 10ème cellule (index 9)
        if (fileCell) {
            if (data.attestationFile && data.attestationFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.attestationFile.name)}</span>`;
            } else if (data.attestationFile && data.attestationFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.attestationFile)}</span>`;
            }
        }
        // Première page file
        fileCell = row.cells[10]; // 11ème cellule (index 10)
        if (fileCell) {
            if (data.premierePageFile && data.premierePageFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.premierePageFile.name)}</span>`;
            } else if (data.premierePageFile && data.premierePageFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.premierePageFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR1-3 (ouvrage)
    else if (table && table.id === 'table-ar1-3') {
        let fileCell = row.cells[7]; // 8ème cellule (index 7)
        if (fileCell) {
            if (data.ouvrageFile && data.ouvrageFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.ouvrageFile.name)}</span>`;
            } else if (data.ouvrageFile && data.ouvrageFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.ouvrageFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR1-4 (première page, CED list)
    else if (table && table.id === 'table-ar1-4') {
        // Première page file
        let fileCell = row.cells[9]; // 10ème cellule (index 9)
        if (fileCell) {
            if (data.premierePageFile && data.premierePageFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.premierePageFile.name)}</span>`;
            } else if (data.premierePageFile && data.premierePageFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.premierePageFile)}</span>`;
            }
        }
        // CED list file
        fileCell = row.cells[10]; // 11ème cellule (index 10)
        if (fileCell) {
            if (data.cedListFile && data.cedListFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.cedListFile.name)}</span>`;
            } else if (data.cedListFile && data.cedListFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.cedListFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR2-1 (these)
    else if (table && table.id === 'table-ar2-1') {
        let fileCell = row.cells[6]; // 7ème cellule (index 6)
        if (fileCell) {
            if (data.theseFile && data.theseFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.theseFile.name)}</span>`;
            } else if (data.theseFile && data.theseFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.theseFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR2-2 (invitation, these)
    else if (table && table.id === 'table-ar2-2') {
        // Invitation file
        let fileCell = row.cells[7]; // 8ème cellule (index 7)
        if (fileCell) {
            if (data.invitationFile && data.invitationFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.invitationFile.name)}</span>`;
            } else if (data.invitationFile && data.invitationFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.invitationFile)}</span>`;
            }
        }
        // These file
        fileCell = row.cells[8]; // 9ème cellule (index 8)
        if (fileCell) {
            if (data.theseFile && data.theseFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.theseFile.name)}</span>`;
            } else if (data.theseFile && data.theseFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.theseFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR3-1 (attestation)
    else if (table && table.id === 'table-ar3-1') {
        let fileCell = row.cells[6]; // 7ème cellule (index 6)
        if (fileCell) {
            if (data.attestationFile && data.attestationFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.attestationFile.name)}</span>`;
            } else if (data.attestationFile && data.attestationFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.attestationFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR3-2 (attestation)
    else if (table && table.id === 'table-ar3-2') {
        let fileCell = row.cells[6]; // 7ème cellule (index 6)
        if (fileCell) {
            if (data.attestationFile && data.attestationFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.attestationFile.name)}</span>`;
            } else if (data.attestationFile && data.attestationFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.attestationFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR3-3 (contrat, attestation)
    else if (table && table.id === 'table-ar3-3') {
        // Contrat file
        let fileCell = row.cells[9]; // 10ème cellule (index 9)
        if (fileCell) {
            if (data.contratFile && data.contratFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.contratFile.name)}</span>`;
            } else if (data.contratFile && data.contratFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.contratFile)}</span>`;
            }
        }
        // Attestation file
        fileCell = row.cells[10]; // 11ème cellule (index 10)
        if (fileCell) {
            if (data.attestationFile && data.attestationFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.attestationFile.name)}</span>`;
            } else if (data.attestationFile && data.attestationFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.attestationFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR3-4 (attestation)
    else if (table && table.id === 'table-ar3-4') {
        let fileCell = row.cells[7]; // 8ème cellule (index 7)
        if (fileCell) {
            if (data.attestationFile && data.attestationFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.attestationFile.name)}</span>`;
            } else if (data.attestationFile && data.attestationFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.attestationFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR4-1 (document)
    else if (table && table.id === 'table-ar4-1') {
        let fileCell = row.cells[7]; // 8ème cellule (index 7)
        if (fileCell) {
            if (data.documentFile && data.documentFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.documentFile.name)}</span>`;
            } else if (data.documentFile && data.documentFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.documentFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR4-2 (document)
    else if (table && table.id === 'table-ar4-2') {
        let fileCell = row.cells[7]; // 8ème cellule (index 7)
        if (fileCell) {
            if (data.documentFile && data.documentFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.documentFile.name)}</span>`;
            } else if (data.documentFile && data.documentFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.documentFile)}</span>`;
            }
        }
    }
    // Gestion des fichiers pour AR4-3 (document)
    else if (table && table.id === 'table-ar4-3') {
        let fileCell = row.cells[9]; // 10ème cellule (index 9)
        if (fileCell) {
            if (data.documentFile && data.documentFile instanceof File) {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.documentFile.name)}</span>`;
            } else if (data.documentFile && data.documentFile !== 'Aucun fichier') {
                fileCell.innerHTML = `<span class="file-display">${escapeHtml(data.documentFile)}</span>`;
            }
        }
    }
}

function openDeleteConfirmModal(message, onConfirm) {
    const overlay = document.getElementById('deleteConfirmOverlay');
    if (!overlay) return false;
    const msgEl = document.getElementById('deleteConfirmMessage');
    if (msgEl) msgEl.textContent = message || 'Êtes-vous sûr de vouloir supprimer cette ligne ? Cette action est irréversible.';
    const okBtn = document.getElementById('deleteConfirmOkBtn');
    if (okBtn) {
        okBtn.onclick = () => {
            closeDeleteConfirmModal();
            if (typeof onConfirm === 'function') onConfirm();
        };
    }
    overlay.classList.add('active');
    return true;
}

function closeDeleteConfirmModal() {
    const overlay = document.getElementById('deleteConfirmOverlay');
    if (overlay) overlay.classList.remove('active');
}

window.openDeleteConfirmModal = openDeleteConfirmModal;
window.closeDeleteConfirmModal = closeDeleteConfirmModal;

function deleteRow(button) {
    if (typeof isReadOnly !== 'undefined' && isReadOnly) {
        alert('Vous ne pouvez pas modifier un dossier soumis.');
        return;
    }

    const el = button && button.target ? button.target : button;
    const row = el && el.closest ? el.closest('tr') : null;
    if (!row) return;

    const tableEl = row.closest('table');
    const tableId = tableEl ? tableEl.id : '';
    const dbId = row.getAttribute('data-db-id');

    const doRemove = () => {
        const rid = row.getAttribute('data-row-id');
        if (rid && window.__arFiles) delete window.__arFiles[rid];
        row.remove();
    };

    const confirmed = openDeleteConfirmModal('Êtes-vous sûr de vouloir supprimer cette ligne ? Cette action est irréversible.', async () => {
        if (dbId && tableId) {
            try {
                const res = await fetch('/api/delete-activity-row', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ table_id: tableId, row_id: dbId })
                });
                const result = await res.json();
                if (!result.success) {
                    alert(result.message || 'Erreur lors de la suppression.');
                    return;
                }
            } catch (err) {
                console.error('Erreur suppression BDD:', err);
                alert('Erreur de connexion lors de la suppression.');
                return;
            }
        }
        doRemove();
    });
    if (!confirmed) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette ligne ?')) return;
        doRemove();
    }
}


// end of file

// Shared ACADEMIC_YEARS — defined outside IIFEs so both stable and enhanced handlers can use it
const ACADEMIC_YEARS = (() => {
    const years = [];
    for (let y = 2000; y <= 2025; y++) {
        years.push(y + '-' + (y + 1));
    }
    return years;
})();

// Shared SINGLE_YEARS — for Année de publication / Année d'élaboration (ae1-1, ae1-2)
const SINGLE_YEARS = (() => {
    const years = [];
    for (let y = 2000; y <= 2025; y++) {
        years.push(String(y));
    }
    return years;
})();

// Date/year constraints — populated dynamically from the teacher's période d'avancement
const DATE_CONSTRAINTS = { min: '', max: '', yearMin: 2000, yearMax: 2025 };

function setDateConstraints(debutStr, finStr) {
    const debut = debutStr ? new Date(debutStr) : null;
    const fin = finStr ? new Date(finStr) : null;
    if (!debut || !fin || isNaN(debut.getTime()) || isNaN(fin.getTime())) {
        DATE_CONSTRAINTS.min = '';
        DATE_CONSTRAINTS.max = '';
        DATE_CONSTRAINTS.yearMin = 2000;
        DATE_CONSTRAINTS.yearMax = 2025;
        return;
    }
    const minDate = new Date(debut);
    minDate.setFullYear(minDate.getFullYear() - 1);
    const minYear = minDate.getFullYear();
    const maxYear = fin.getFullYear();
    DATE_CONSTRAINTS.min = minDate.toISOString().split('T')[0];
    DATE_CONSTRAINTS.max = fin.toISOString().split('T')[0];
    DATE_CONSTRAINTS.yearMin = minYear;
    DATE_CONSTRAINTS.yearMax = maxYear;

    // Filter ACADEMIC_YEARS (academic year ranges like "2017-2018")
    const filteredAY = [];
    for (const range of ACADEMIC_YEARS) {
        const y = parseInt(range.split('-')[0], 10);
        if (y >= minYear && y <= maxYear) filteredAY.push(range);
    }
    ACADEMIC_YEARS.length = 0;
    ACADEMIC_YEARS.push(...filteredAY);

    // Filter SINGLE_YEARS (plain years like "2017")
    const filteredSY = [];
    for (const yStr of SINGLE_YEARS) {
        const y = parseInt(yStr, 10);
        if (y >= minYear && y <= maxYear) filteredSY.push(yStr);
    }
    SINGLE_YEARS.length = 0;
    SINGLE_YEARS.push(...filteredSY);
}

window.setDateConstraints = setDateConstraints;

// ==========================================
// Stable modal handlers
// ==========================================
// The generated modal code above was left in an inconsistent state. These
// handlers are intentionally loaded last so inline Ajouter/Modifier buttons use
// one predictable path for opening a modal and writing table rows.
(function installStableTableModalHandlers() {
    const TYPE_SCHEMAS = {
        'licence': {
            title: 'Enseignements assurés en Licence',
            fields: [
                { name: 'annee_univ', label: 'Année Univ.', type: 'text', required: true },
                { name: 'filiere', label: 'Filière', type: 'text', required: true },
                { name: 'semestre', label: 'Semestre', type: 'text', required: true },
                { name: 'cours', label: 'Cours', type: 'textarea', required: true },
                { name: 'vh_cours', label: 'VH Cours', type: 'number', required: true },
                { name: 'td', label: 'TD', type: 'textarea', required: true },
                { name: 'vh_td', label: 'VH TD', type: 'number', required: true },
                { name: 'tp', label: 'TP', type: 'textarea', required: true },
                { name: 'vh_tp', label: 'VH TP', type: 'number', required: true }
            ]
        },
        'encadrement-licence': {
            title: 'Encadrement en Licence',
            fields: [
                { name: 'annee_univ', label: 'Année Univ.', type: 'text', required: true },
                { name: 'type_licence', label: 'Type Licence', type: 'text', required: true },
                { name: 'titre_pfe', label: 'Titre PFE', type: 'textarea', required: true },
                { name: 'etudiants', label: 'Étudiants', type: 'textarea', required: true },
                { name: 'nom_encadrants', label: 'Nom des encadrants', type: 'textarea', required: true },
                { name: 'page_de_garde', label: 'Page de garde', type: 'file', className: 'step2-hidden-file' }
            ]
        },
        'master': {
            title: 'Enseignements assurés en Master',
            fields: [
                { name: 'annee_univ', label: 'Année Univ.', type: 'text', required: true },
                { name: 'filiere', label: 'Filière', type: 'text', required: true },
                { name: 'semestre', label: 'Semestre', type: 'text', required: true },
                { name: 'cours_td_tp', label: 'Cours/TD/TP', type: 'textarea', required: true },
                { name: 'vh', label: 'VH', type: 'number', required: true }
            ]
        },
        'encadrement-master': {
            title: 'Encadrement en Master',
            fields: [
                { name: 'annee_univ', label: 'Année Univ.', type: 'text', required: true },
                { name: 'filiere', label: 'Filière', type: 'text', required: true },
                { name: 'type_master', label: 'Type Master', type: 'text', required: true },
                { name: 'titre_memoire', label: 'Titre mémoire', type: 'textarea', required: true },
                { name: 'nom_etudiants', label: 'Nom des étudiants', type: 'textarea', required: true },
                { name: 'nom_encadrants', label: 'Nom des encadrants', type: 'textarea', required: true },
                { name: 'page_de_garde', label: 'Page de garde', type: 'file', className: 'step2-hidden-file' }
            ]
        },
        'responsabilites': {
            title: 'Responsabilités pédagogiques',
            fields: [
                { name: 'annees_univ', label: 'Années Univ.', type: 'text', required: true },
                { name: 'filiere', label: 'Filière', type: 'text', required: true },
                { name: 'semestre', label: 'Semestre', type: 'text', required: true },
                { name: 'intitule_module', label: 'Intitulé du module', type: 'textarea', required: true },
                { name: 'cycle', label: 'Cycle', type: 'text', required: true }
            ]
        },
        'ae1-1': {
            title: 'Activités d\'enseignement - AE1-1',
            fields: [
                { name: 'titres', label: 'Titres', type: 'textarea', required: true },
                { name: 'auteurs', label: 'Auteurs', type: 'textarea', required: true },
                { name: 'niveaux', label: 'Niveaux', type: 'text', required: true },
                { name: 'editeurs', label: 'Éditeurs', type: 'text', required: true },
                { name: 'annees', label: 'Année de publication', type: 'select', options: SINGLE_YEARS, required: true },
                { name: 'PDF', label: 'Fichier PDF', type: 'file', className: 'ae11-hidden-file' },
                { name: 'numero_depot', label: 'Numéro dépôt/ISSN/ISBN', type: 'text', required: true }
            ]
        },
        'ae1-2': {
            title: 'Activités d\'enseignement - AE1-2',
            fields: [
                { name: 'PDF', label: 'Fichier PDF', type: 'file', className: 'ae12-hidden-file' },
                { name: 'auteurs', label: 'Auteurs', type: 'textarea', required: true },
                { name: 'departements', label: 'Départements', type: 'text', required: true },
                { name: 'annees', label: 'Année d\'élaboration', type: 'select', options: SINGLE_YEARS, required: true },
                { name: 'filieres', label: 'Filières', type: 'text', required: true },
                { name: 'semestres', label: 'Semestres', type: 'text', required: true },
                { name: 'titres', label: 'Titre', type: 'text', required: true },
                { name: 'types', label: 'Type de polycopié', type: 'select', options: ['Cours Magistral (CM)', 'TD', 'TP'], required: true }
            ]
        },
        'ae1-3': {
            title: 'Activités d\'enseignement - AE1-3',
            fields: [
                { name: 'objectifs', label: 'Objectifs', type: 'textarea', required: true },
                { name: 'auteurs', label: 'Auteurs', type: 'textarea', required: true },
                { name: 'filieres', label: 'Filières', type: 'text', required: true },
                { name: 'niveaux', label: 'Niveau', type: 'select', options: ['Licence', 'Master', 'Doctorat'], required: true },
                { name: 'annees', label: 'Année universitaire', type: 'text', required: true },
                { name: 'liens', label: 'Liens', type: 'text' },
                { name: 'support_ntic', label: 'Support NTIC', type: 'text', required: true },
                { name: 'types', label: 'Type de support', type: 'select', options: ['Diaporama', 'Didacticiel', 'Nouveau TP', 'Page web ou homepage'], required: true },
                { name: 'PDF', label: 'Justificatif', type: 'file', className: 'ae13-hidden-file' }
            ]
        },
        'ae2-1': {
            title: 'AE2-1 : Encadrement de cours, TD, TP et PFE (cycle Licence)',
            fields: [
                { name: 'annee_univ', label: 'Année universitaire', type: 'select', options: ACADEMIC_YEARS, required: true },
                { name: 'type', label: 'Type de la Licence', type: 'select', options: ['LF', 'LP', 'LE'], required: true },
                { name: 'intitule_licence', label: 'Intitulé de la Licence', type: 'text', required: true },
                { name: 'cours_td_tp', label: 'Type', type: 'select', options: ['Cours', 'TD', 'TP'], required: true },
                { name: 'intitule_module', label: 'Intitulé du module', type: 'text', required: true },
                { name: 'intitule_pfe', label: 'Intitulé du PFE', type: 'textarea', required: true },
                { name: 'modules', label: 'Module ou élément de module', type: 'select', options: ['Module', 'Élément de module'], required: true },
                { name: 'departements', label: 'Département d\'attache', type: 'text', required: true },
                { name: 'coenseignants', label: 'Co-encadrant(s)', type: 'text', required: true },
                { name: 'PDF', label: 'Copie de la page de garde cachetée', type: 'file', className: 'ae21-hidden-file' }
            ]
        },
        'ae2-2': {
            title: 'AE 2-2 Encadrement de cours et mémoires de fin d\'étude (cycle Master)',
            fields: [
                { name: 'annee_univ', label: 'Année universitaire', type: 'text', required: true },
                { name: 'type', label: 'Type de Master', type: 'select', options: ['MF', 'MS'], required: true },
                { name: 'intitule_master', label: 'Intitulé du Master', type: 'text', required: true },
                { name: 'cours', label: "l'intitulé du module", type: 'textarea', required: true },
                { name: 'intitule_memoire', label: 'Intitulé du mémoire', type: 'textarea', required: true },
                { name: 'coordonnateurs', label: 'Coordonnateur de Master', type: 'text', required: true },
                { name: 'coenseignants', label: 'Co-encadrant(s)', type: 'text', required: true },
                { name: 'departements', label: "Département d'attache", type: 'text', required: true },
                { name: 'PDF', label: 'Copie de la page de garde cachetée', type: 'file', className: 'ae22-hidden-file' }
            ]
        },
        'ae2-3': {
            title: 'AE 2-3 Encadrement d\'autres activités (sorties de terrain, animation de séminaires ou formations,…)',
            fields: [
                { name: 'type', label: 'Type de formation dispensée', type: 'text', required: true },
                { name: 'etablissement', label: 'Établissement', type: 'text', required: true },
                { name: 'dates', label: 'Date', type: 'date', required: true },
                { name: 'lieux', label: 'Lieu', type: 'text', required: true },
                { name: 'periode', label: 'Période de l\'ordre de mission', type: 'text', required: true },
                { name: 'PDF', label: 'Attestation du Décanat ou de la Présidence de l\'Université', type: 'file', className: 'ae23-hidden-file' }
            ]
        }
    };

    TYPE_SCHEMAS['ae3-1'] = {
        title: "AE3-1 : Chef de département ou membre de collège (ou bureau) du département",
        fields: [
            { name: 'natures', label: 'Nature de la responsabilité', type: 'select', options: ['Chef de département', 'Membre de collège', 'Membre de bureau'], required: true },
            { name: 'periodes', label: 'Période', type: 'text', required: true },
            { name: 'mandats', label: 'Nombre de mandats', type: 'number', required: true },
            { name: 'PDF', label: 'Attestation du Décanat ou attestation du Chef de département', type: 'file', className: 'ae31-hidden-file' }
        ]
    };
    TYPE_SCHEMAS['ae3-2'] = {
        title: "AE3-2 : Coordonnateur de filière",
        fields: [
            { name: 'titres', label: 'Intitulé de la filière', type: 'text', required: true },
            { name: 'accreditations', label: 'Nombre d\'accréditations', type: 'number', required: true },
            { name: 'periodes', label: 'Période', type: 'text', required: true },
            { name: 'PDF', label: 'Attestation du Chef de département', type: 'file', className: 'ae32-hidden-file' }
        ]
    };
    TYPE_SCHEMAS['ae3-3'] = {
        title: "AE3-3 : Responsable de module",
        fields: [
            { name: 'titres', label: 'Intitulé du module', type: 'text', required: true },
            { name: 'filieres', label: 'Filière', type: 'text', required: true },
            { name: 'periodes', label: 'Période', type: 'text', required: true },
            { name: 'PDF', label: 'Attestation du chef de département / responsable du master', type: 'file', className: 'ae33-hidden-file' }
        ]
    };
    TYPE_SCHEMAS['ae3-4'] = {
        title: "AE3-4 : Membre du conseil d'Établissement",
        fields: [
            { name: 'periodes', label: 'Période du mandat', type: 'text', required: true },
            { name: 'PDF', label: 'Attestation du Décanat', type: 'file', className: 'ae34-hidden-file' }
        ]
    };
    TYPE_SCHEMAS['ae3-5'] = {
        title: "AE3-5 : Membre du conseil d'Université",
        fields: [
            { name: 'periodes', label: 'Période du mandat', type: 'text', required: true },
            { name: 'PDF', label: 'Attestation de la Présidence de l\'Université', type: 'file', className: 'ae35-hidden-file' }
        ]
    };
    TYPE_SCHEMAS['ae3-6'] = {
        title: "AE3-6 : Membre de la commission scientifique",
        fields: [
            { name: 'periodes', label: 'Période du mandat', type: 'text', required: true },
            { name: 'PDF', label: 'Attestation du Décanat', type: 'file', className: 'ae36-hidden-file' }
        ]
    };
    TYPE_SCHEMAS['ae3-7'] = {
        title: "AE 3-7 Membre de commission d'expertise ou d'évaluation pédagogique à l'échelle nationale ou internationale",
        fields: [
            { name: 'natures', label: 'Nature de l\'activité effectuée', type: 'textarea', required: true },
            { name: 'dates', label: 'Date', type: 'text', required: true },
            { name: 'lieux', label: 'Lieu', type: 'text', required: true },
            { name: 'PDF', label: 'Attestation officielle', type: 'file', className: 'ae37-hidden-file' }
        ]
    };
    for (let i = 1; i <= 4; i++) {
        TYPE_SCHEMAS[`ar1-${i}`] = {
            title: `Activités de recherche - AR1-${i}`,
            fields: [{ name: 'lien', label: 'Lien', type: 'text', required: true }]
        };
    }
    for (let i = 1; i <= 2; i++) {
        TYPE_SCHEMAS[`ar2-${i}`] = fileOnlySchema(`Activités de recherche - AR2-${i}`, `ar2${i}-hidden-file`);
    }
    for (let i = 1; i <= 4; i++) {
        TYPE_SCHEMAS[`ar3-${i}`] = fileOnlySchema(`Activités de recherche - AR3-${i}`, `ar3${i}-hidden-file`);
    }
    for (let i = 1; i <= 3; i++) {
        TYPE_SCHEMAS[`ar4-${i}`] = fileOnlySchema(`Activités de recherche - AR4-${i}`, `ar4${i}-hidden-file`);
    }

    function ae2Fields(includeFiliere) {
        const fields = [
            { name: 'annee_univ', label: 'Année Univ.', type: 'text', required: true },
            { name: 'type', label: 'Type', type: 'text', required: true }
        ];
        if (includeFiliere) {
            fields.push({ name: 'filiere', label: 'Filière', type: 'text', required: true });
        }
        fields.push(
            { name: 'nom_etudiants', label: 'Nom des étudiants', type: 'textarea', required: true },
            { name: 'intitule', label: 'Intitulé', type: 'textarea', required: true },
            { name: 'details', label: 'Détails', type: 'textarea' }
        );
        return fields;
    }

    function fileOnlySchema(title, className) {
        return {
            title,
            fields: [{ name: 'PDF', label: 'Fichier PDF', type: 'file', className }]
        };
    }

    function getSchema(type) {
        return TYPE_SCHEMAS[type] || (window.schemaFor && window.schemaFor(type)) || {
            title: 'Ajouter une ligne',
            fields: [{ name: 'value', label: 'Valeur', type: 'text', required: true }]
        };
    }

    function modalEscape(value) {
        return escapeHtml(value == null ? '' : String(value));
    }

    function renderField(field, value) {
        const id = `stable_modal_${field.name}`;
        const required = field.required ? ' required' : '';
        const requiredMark = field.required ? ' <span style="color: #000;">*</span>' : '';
        if (field.type === 'textarea') {
            return `
                <div class="modal-form-group">
                    <label for="${id}">${modalEscape(field.label)}${requiredMark}</label>
                    <textarea id="${id}" name="${modalEscape(field.name)}"${required}>${modalEscape(value)}</textarea>
                </div>
            `;
        }
        if (field.type === 'file') {
            const current = value ? `<div class="file-upload-text">Fichier actuel : ${modalEscape(value)}</div>` : '';
            return `
                <div class="modal-form-group">
                    <label for="${id}">${modalEscape(field.label)}</label>
                    ${current}
                    <input id="${id}" name="${modalEscape(field.name)}" type="file" accept=".pdf,.png,.jpg,.jpeg">
                </div>
            `;
        }
        if (field.type === 'select' && field.options) {
            const options = field.options.map(opt =>
                `<option value="${modalEscape(opt)}" ${value === opt ? 'selected' : ''}>${modalEscape(opt)}</option>`
            ).join('');
            return `
                <div class="modal-form-group">
                    <label for="${id}">${modalEscape(field.label)}${requiredMark}</label>
                    <select id="${id}" name="${modalEscape(field.name)}"${required}>
                        <option value="" disabled ${!value ? 'selected' : ''}>Choisir</option>
                        ${options}
                    </select>
                </div>
            `;
        }
        let inputType = 'text';
        let extraAttrs = '';
        if (field.type === 'number') inputType = 'number';
        else if (field.type === 'date') inputType = 'date';
        else if (field.type === 'url') {
            inputType = 'url';
            if (field.placeholder) extraAttrs += ` placeholder="${modalEscape(field.placeholder)}"`;
            if (field.pattern) extraAttrs += ` pattern="${modalEscape(field.pattern)}"`;
        }
        return `
            <div class="modal-form-group">
                <label for="${id}">${modalEscape(field.label)}${requiredMark}</label>
                <input id="${id}" name="${modalEscape(field.name)}" type="${inputType}" value="${modalEscape(value)}"${required}${extraAttrs}>
            </div>
        `;
    }

    function stableOpenModal(type, rowData = null) {
        if (typeof isReadOnly !== 'undefined' && isReadOnly) {
            alert('Vous ne pouvez pas modifier un dossier soumis.');
            return;
        }

        currentModalType = type;
        rowToEdit = rowData ? rowData.row : null;

        const modal = document.getElementById('modalOverlay');
        const modalContent = document.getElementById('modalContent');
        if (!modal || !modalContent) return;

        const schema = getSchema(type);
        const data = rowData && rowData.data ? rowData.data : {};
        const fieldsHtml = schema.fields.map(field => renderField(field, data[field.name] || '')).join('');

        modalContent.innerHTML = `
            <div class="modal-header">
                <h3>${modalEscape(schema.title)}</h3>
                <button class="close-modal" type="button" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                ${fieldsHtml}
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" type="button" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" type="button" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>
        `;
        modal.classList.add('active');
    }

    function stableCloseModal() {
        const modal = document.getElementById('modalOverlay');
        if (modal) modal.classList.remove('active');
        rowToEdit = null;
    }

    function collectModalValues(schema) {
        const data = {};
        schema.fields.forEach(field => {
            const input = document.getElementById(`stable_modal_${field.name}`);
            if (!input) return;
            if (field.type === 'file') {
                if (input.files && input.files[0]) {
                    data[field.name] = input.files[0];
                    data.file = input.files[0];
                }
            } else {
                data[field.name] = input.value.trim();
            }
        });
        return data;
    }

    function validateStableModal(schema) {
        let valid = true;
        schema.fields.forEach(field => {
            const input = document.getElementById(`stable_modal_${field.name}`);
            if (!input || field.type === 'file') return;
            const val = input.value.trim();
            if (field.required && !val) {
                input.classList.add('is-invalid');
                valid = false;
            } else if (field.type === 'url' && val && !/^https?:\/\//i.test(val)) {
                input.classList.add('is-invalid');
                valid = false;
            } else {
                input.classList.remove('is-invalid');
            }
        });
        if (currentModalType === 'ar1-4') {
            const urlInput = document.getElementById('stable_modal_lien_publication');
            const fileInput = document.getElementById('stable_modal_publication_file');
            const hasUrl = urlInput && urlInput.value.trim().length > 0;
            const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
            const hasExisting = rowToEdit && rowToEdit.querySelector('a.file-link, span.file-display');
            if (!hasUrl && !hasFile && !hasExisting) {
                if (urlInput) urlInput.classList.add('is-invalid');
                if (fileInput) fileInput.classList.add('is-invalid');
                alert('Veuillez remplir le champ "Lien de la publication" ou joindre "Copie de la 1ère page de l\'article".');
                valid = false;
            }
        }
        return valid;
    }

    function fileCellHtml(field, data, existingRow) {
        const file = data[field.name] || data.file;
        const existing = existingRow ? existingRow.querySelector('a.file-link, span.file-display') : null;
        const existingText = existing ? existing.textContent.trim() : '';
        const label = file instanceof File ? file.name : (existingText || 'Aucun fichier');
        return `<span class="file-display">${modalEscape(label)}</span>`;
    }

    function attachHiddenFile(row, field, data, fileCell) {
        const file = data[field.name] || data.file;
        if (!(file instanceof File)) return;
        let hiddenInput = row.querySelector(`.${field.className}`);
        if (!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'file';
            hiddenInput.className = field.className;
            hiddenInput.style.display = 'none';
            hiddenInput.accept = '.pdf,.png,.jpg,.jpeg';
            fileCell.appendChild(hiddenInput);
        }
        const dt = new DataTransfer();
        dt.items.add(file);
        hiddenInput.files = dt.files;
    }

    function rowHtml(schema, data, existingRow) {
        const cells = schema.fields.map((field, index) => {
            if (field.type === 'file') {
                const file = data[field.name] || data.file;
                if (!(file instanceof File) && existingRow && existingRow.cells[index]) {
                    return `<td>${existingRow.cells[index].innerHTML}</td>`;
                }
                return `<td>${fileCellHtml(field, data, existingRow)}</td>`;
            }
            const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
            return `<td><input type="${inputType}" name="${modalEscape(field.name)}" value="${modalEscape(data[field.name] || '')}" readonly></td>`;
        }).join('');

        return `${cells}
            <td class="table-actions">
                <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
            </td>`;
    }

    function syncFileCells(row, schema, data) {
        schema.fields.forEach((field, index) => {
            if (field.type !== 'file') return;
            const fileCell = row.cells[index];
            if (fileCell) attachHiddenFile(row, field, data, fileCell);
        });
    }

    function stableAddOrEditModalRow() {
        const type = currentModalType;
        const schema = getSchema(type);
        if (!validateStableModal(schema)) return;

        const table = document.getElementById(`table-${type}`);
        if (!table) {
            stableCloseModal();
            return;
        }

        const data = collectModalValues(schema);
        let row = rowToEdit;
        if (!row) {
            row = document.createElement('tr');
            row.setAttribute('data-row-id', nextRowId++);
            table.querySelector('tbody').appendChild(row);
        }

        row.innerHTML = rowHtml(schema, data, rowToEdit);
        syncFileCells(row, schema, data);
        const jsonData = {};
        schema.fields.forEach(field => {
            if (field.type !== 'file') jsonData[field.name] = data[field.name] || '';
        });
        row.setAttribute('data-requirements-json', JSON.stringify(jsonData));
        stableCloseModal();
    }

    function stableEditRow(button) {
        const row = button.closest('tr');
        if (!row) return;
        const type = currentModalTypeFromRow(row);
        const schema = getSchema(type);
        const data = {};

        schema.fields.forEach((field, index) => {
            if (field.type === 'file') {
                const fileLink = row.cells[index]?.querySelector('a.file-link');
                const fileDisplay = row.cells[index]?.querySelector('span.file-display');
                data[field.name] = fileLink ? fileLink.textContent.trim() : (fileDisplay ? fileDisplay.textContent.trim() : '');
                return;
            }
            const input = row.cells[index]?.querySelector(`[name="${field.name}"]`);
            data[field.name] = input ? input.value : '';
        });

        stableOpenModal(type, { row, data });
    }

    window.openModal = stableOpenModal;
    window.closeModal = stableCloseModal;
    window.addOrEditModalRow = stableAddOrEditModalRow;
    window.editRow = stableEditRow;
})();

// ==========================================
// Validation complète AE/AR en français
// ==========================================
(function installRequirementModalValidation() {
    const MAX_TEXT_LENGTH = 3000;
    const MAX_FILE_SIZE = 1024 * 1024;
    const SEMESTERS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
    const MASTER_SEMESTERS = ['S1', 'S2', 'S3', 'S4'];
    const FILIERES = [
        'Sciences de la matière Physique (SMP)',
        'Sciences de la matière Chimie (SMC)',
        'Sciences de la Vie (SV)',
        'Sciences de la Terre et de l\'Univers (STU)',
        'Sciences Mathématiques et Applications (SMA)',
        'Sciences Mathématiques et Informatique (SMI)',
        'Conception et Simulation Numérique en Mécanique (CSNM)',
        'Chimie Analytique Contrôle Qualité',
        'Formulation des Produits industriels',
        'Gestion des Effluents liquides et solides',
        'Matériaux Organique et inorganique',
        'Energies Renouvelables (EREE)',
        'Dosimétrie',
        'Génie électrique (GE)',
        'Ingénierie en mécanique et énergétique (IME)',
        'Matériaux et Energie',
        'Analyse Mathématique',
        'Calcul Scientifique et Optimisation',
        'Codage et Cryptographie',
        'Statistiques et Aide à la Décision',
        'Pharmacologie et Développement Molécules (PDM)',
        'Biotechnologie et Environnement',
        'Biologie et Technologie',
        'Bio-Analyses Médicales',
        'Géosciences',
        'Ingénierie Logicielle',
        'Cybersécurité',
        'Développement informatique',
        'Administration des Systèmes'
    ];
    const MASTER_FILIERES = [
        'Sciences Biomédicales et Qualité (SBQ)',
        'Sciences de la Santé et BioTechnologies (SSB)',
        'Chimie et Applications Industrielles et Environnementales (CAIE)',
        'Analyse Chimique Chimiométrie et Qualité (ACCQ)',
        'Environnement Marin et Gestion des Bio-Ressources (EMGBR)',
        'Physique des Hautes Energies et Instrumentation (PHEI)',
        'Matériaux & Energies (ME)',
        'Mécanique et Ingénierie (MI)',
        'Electronique, Electrotechnique, Automatique et Informatique Industrielle (EEAII)',
        'Energies Renouvelables et Efficacité Energétique (EREE)',
        'Génie Logistique (GL)',
        'Conception et Simulation Numérique en Mécanique (CSNM)',
        'Mathématiques et Applications (MA)',
        'Méthodes Numériques et Statistiques Appliquées (MNSA)',
        'Analyse Numérique Optimisation et Contrôle (ANOC)',
        'Big Data Cloud Computing (BD2C)',
        'Ingénierie des Systèmes Intelligents (ISI)',
        'GEOressources GéoRISques et GéoEnvironnement (GEORISE)'
    ];

    const BASE_FIELDS = {
        'licence': [
            select('annee_univ', 'Année universitaire', ACADEMIC_YEARS),
            select('filiere', 'Filière', FILIERES),
            select('semestre', 'Semestre', SEMESTERS),
            area('cours', 'Cours'),
            volume('vh_cours', 'Volume horaire cours'),
            area('td', 'TD'),
            volume('vh_td', 'Volume horaire TD'),
            area('tp', 'TP'),
            volume('vh_tp', 'Volume horaire TP')
        ],
        'encadrement-licence': [
            select('annee_univ', 'Année universitaire', ACADEMIC_YEARS),
            select('type_licence', 'Type de licence', ['LF', 'LE']),
            area('titre_pfe', 'Titre du PFE'),
            area('etudiants', 'Nom(s) des étudiant(e)s'),
            area('nom_encadrants', 'Nom(s) des encadrants'),
            file('page_de_garde', 'Page de garde tamponnée')
        ],
        'master': [
            select('annee_univ', 'Année universitaire', ACADEMIC_YEARS),
            select('filiere', 'Filière', MASTER_FILIERES),
            select('semestre', 'Semestre', MASTER_SEMESTERS),
            area('cours_td_tp', 'Cours / TD / TP'),
            volume('vh', 'Volume horaire')
        ],
        'encadrement-master': [
            select('annee_univ', 'Année universitaire', ACADEMIC_YEARS),
            select('filiere', 'Filière', MASTER_FILIERES),
            select('type_master', 'Type de Master (MF/MS)', ['MF', 'MS']),
            area('titre_memoire', 'Titre du mémoire'),
            area('nom_etudiants', 'Nom(s) des étudiant(e)s'),
            area('nom_encadrants', 'Nom(s) des encadrants'),
            file('page_de_garde', 'Page de garde tamponnée')
        ],
        'responsabilites': [
            select('annees_univ', 'Années universitaires', ACADEMIC_YEARS),
            select('filiere', 'Filière', FILIERES),
            select('semestre', 'Semestre', SEMESTERS),
            area('intitule_module', 'Intitulé du module'),
            select('cycle', 'Cycle', ['Licence', 'Master'])
        ],
        'ae1-1': [
            area('titres', 'Titre de l’ouvrage'),
            area('auteurs', 'Auteur(s)'),
            select('niveaux', 'Niveau académique', ['Licence', 'Master', 'Doctorat']),
            text('editeurs', 'Éditeur'),
            select('annees', 'Année de publication', SINGLE_YEARS),
            text('numero_depot', 'Dépôt légal / ISSN / ISBN'),
            file('PDF', 'Copie de l’ouvrage incluant la page de garde')
        ],
        'ae1-2': [
            area('auteurs', 'Auteur(s)'),
            text('departements', 'Département(s) d’attache'),
            select('annees', 'Année d’élaboration', SINGLE_YEARS),
            text('filieres', 'Filière'),
            select('semestres', 'Semestre', ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']),
            select('types', 'Type de polycopié', ['Cours Magistral (CM)', 'TD', 'TP']),
            file('PDF', 'Document complet avec page de garde tamponnée')
        ],
        'ae1-3': [
            area('objectifs', 'Objectifs du support'),
            area('auteurs', 'Auteur(s)'),
            text('filieres', 'Filière'),
            select('niveaux', 'Niveau académique', ['Licence', 'Master', 'Doctorat']),
            select('annees', 'Année universitaire', ACADEMIC_YEARS),
            text('liens', 'Lien du site web'),
            text('support_ntic', 'Support NTIC'),
            select('types', 'Type de support', ['Diaporama', 'Didacticiel', 'Nouveau TP', 'Page web ou homepage']),
            file('PDF', 'Justificatif')
        ],
        'ae2-1': [
            select('annee_univ', 'Année universitaire', ACADEMIC_YEARS),
            select('type', 'Type de la Licence', ['LF', 'LP', 'LE']),
            text('intitule_licence', 'Intitulé de la Licence'),
            select('cours_td_tp', 'Type', ['Cours', 'TD', 'TP']),
            text('intitule_module', 'Intitulé du module'),
            area('intitule_pfe', 'Intitulé du PFE'),
            select('modules', 'Module ou élément de module', ['Module', 'Élément de module']),
            text('departements', 'Département d\'attache'),
            text('coenseignants', 'Co-encadrant(s)'),
            text('type_encadrement', 'Type encadrante')
        ],
        'ae2-2': [
            select('annee_univ', 'Année universitaire', ACADEMIC_YEARS),
            select('type', 'Type de Master', ['MF', 'MS']),
            text('intitule_master', 'Intitulé du Master'),
            area('cours', "l'intitulé du module"),
            area('intitule_memoire', 'Intitulé du mémoire'),
            text('coordonnateurs', 'Coordonnateur de Master'),
            text('coenseignants', 'Co-encadrant(s)'),
            text('departements', "Département d'attache"),
            text('type_encadrement', "Type d'activité")
        ],
        'ae2-3': [
            text('type', 'Type de formation dispensée'),
            text('etablissement', 'Établissement'),
            date('dates', 'Date'),
            text('lieux', 'Lieu'),
            text('periode', 'Période de l\'ordre de mission')
        ],

    };

    const EXTRA_FIELDS = {




    };

    const AE3_EXTRAS = {
        1: [
            select('natures', 'Nature de la responsabilité', ['Chef de département', 'Membre de collège', 'Membre de bureau']),
            text('periodes', 'Période'),
            number('mandats', 'Nombre de mandats')
        ],
        2: [
            text('titres', 'Intitulé de la filière'),
            number('accreditations', 'Nombre d\'accréditations'),
            text('periodes', 'Période')
        ],
        3: [
            text('titres', 'Intitulé du module'),
            text('filieres', 'Filière'),
            text('periodes', 'Période')
        ],
        4: [
            text('periodes', 'Période du mandat')
        ],
        5: [
            text('periodes', 'Période du mandat')
        ],
        6: [
            text('periodes', 'Période du mandat')
        ],
        7: [
            area('natures', 'Nature de l\'activité effectuée'),
            date('dates', 'Date'),
            text('lieux', 'Lieu')
        ]
    };

    const AR1_EXTRAS = {
        1: [
            area('reference_complete', 'Références de l’article y compris le DOI (format : Auteur — Titre — Journal — DOI)'),
            select('annee_publication', 'Année de publication', SINGLE_YEARS),
            text('doctorants', 'Nom(s) de(s) doctorant(s) co-auteur(s)'),
            text('lien', 'Lien de la publication de l’article'),
            file('ced_list', 'Liste de(s) doctorant(s) co-auteur(s) fournie par le CED')
        ],
        2: [
            area('reference', 'Référence du proceeding ou titre de la communication'),
            select('nature_activite', 'Nature de l\'activité', ['Publication intégrale', 'Abstract', 'Communication orale', 'Poster']),
            text('manifestation', 'Titre de la manifestation'),
            text('lieu', 'Lieu'),
            date('date', 'Date'),
            text('lien', 'Lien du site web de la manifestation'),
            file('attestation', 'Attestation de participation'),
            file('premiere_page', 'Copie de la 1ère page de la publication intégrale ou de l\'abstract')
        ],
        3: [
            select('type_ouvrage', 'Type', ['Livre', 'Chapitre de livre']),
            area('titre', 'Titre'),
            area('auteurs', 'Auteurs'),
            text('maison_editions', 'Maison d’éditions'),
            number('annee', 'Année d\u2019édition'),
            text('issn_isbn', 'Référence ISSN ou ISBN'),
            file('page_garde', 'Copie de l\u2019ouvrage incluant la page de garde')
        ],
        4: [
            area('reference_complete', 'Références de l\u2019article y compris le lien web'),
            select('annee_publication', 'Année de publication', SINGLE_YEARS),
            text('doctorants', 'Nom(s) de(s) doctorant(s) co-auteur(s)'),
            { name: 'lien_publication', label: 'Auteur — Titre — Journal — Année', type: 'text', required: false },
            file('publication_file', 'Copie de la 1ère page de l\u2019article'),
            file('ced_list', 'Liste de(s) doctorant(s) co-auteur(s) fournie par le CED')
        ]
    };

    const AR_EXTRAS = {
        'ar2-1': [
            text('auteur_these', 'Nom de l’auteur'),
            area('titre_these', 'Titre de la thèse'),
            text('institution', 'Nom de l’établissement'),
            date('date_soutenance', 'Date de soutenance'),
            select('type_encadrement', 'Direction ou codirection', ['Direction avec codirection', 'Direction', 'Co-directeur'])
        ],
        'ar2-2': [
            text('auteur', 'Nom de l’auteur'),
            select('type_travail', 'Type de thèse', ['Doctorat', 'Habilitation']),
            area('titre', 'Intitulé de la thèse'),
            text('institution', 'Nom de l’établissement'),
            date('date_soutenance', 'Date de soutenance'),
            select('role', 'Rôle', ['Rapporteur', 'Membre de jury'])
        ],
        'ar3-1': [
            text('structure', 'Appellation de la structure de recherche'),
            text('adresse', 'Adresse de la structure de recherche'),
            text('periode', 'Période du mandat')
        ],
        'ar3-2': [
            text('equipe', 'Appellation de l\'équipe'),
            text('adresse', 'Adresse de l\'équipe'),
            text('structure_parente', 'Structure de recherche dont elle dépend'),
            text('periode', 'Période du mandat')
        ],
        'ar3-3': [
            select('role', 'Rôle', ['Responsable', 'Participant']),
            text('responsable', 'Nom du responsable'),
            text('nature', 'Nature du projet'),
            area('titre', 'Titre du projet'),
            number('montant', 'Montant global alloué au projet'),
            text('duree', 'Période'),
            text('partenaire', 'Organisme partenaire')
        ],
        'ar3-4': [
            select('type_activite', "Type d'expertise ou d'évaluation", [
                "Expertise d'accréditation",
                "Évaluation de projet de recherche",
                "Évaluation de thèse en vue d'équivalence",
                'Editor-in-chief',
                'Editorial board',
                'Referee ou reviewer',
                'Autre'
            ]),
            area('objet', 'Objet de l’activité'),
            date('date', 'Date de réalisation')
        ],
        'ar4-1': [
            text('titre', 'Titre de la manifestation ou animation'),
            text('lieu', 'Lieu'),
            date('date', 'Date'),
            text('role', 'Rôle')
        ],
        'ar4-2': [
            select('nature', 'Nature de l’activité', ['Expertise socio-culturelle', 'Contrat extra-universitaire', 'Responsable d’association scientifique ou culturelle', 'Responsable de club scientifique']),
            text('organisme', 'Organisme'),
            text('lieu', 'Lieu'),
            date('date', 'Date')
        ],
        'ar4-3': [
            select('type_activite', "Type d'activité", ['Brevet', 'Prototype', 'Incubation de projet R&D', 'Invitation à l\'étranger', 'Prix ou distinction scientifique', 'Autre']),
            text('nature_activite', 'Nature de l’activité'),
            date('date', 'Date')
        ]
    };

    function text(name, label) {
        return { name, label, type: 'text', required: true };
    }

    function date(name, label) {
        const m = DATE_CONSTRAINTS.min ? DATE_CONSTRAINTS.min : '';
        const x = DATE_CONSTRAINTS.max ? DATE_CONSTRAINTS.max : new Date().toISOString().split('T')[0];
        return { name, label, type: 'date', required: true, min: m, max: x };
    }

    function area(name, label) {
        return { name, label, type: 'textarea', required: true };
    }

    function number(name, label) {
        return { name, label, type: 'number', required: true };
    }

    function volume(name, label) {
        return { name, label, type: 'number', min: 0, max: 100, required: true };
    }

    function select(name, label, options) {
        return { name, label, type: 'select', options, required: true };
    }

    function file(name, label) {
        return { name, label, type: 'file', required: true };
    }

    function url(name, label) {
        return { name, label, type: 'url', required: false, placeholder: 'https://', pattern: 'https?://.*' };
    }

    function schemaFor(type) {
        let fields = (BASE_FIELDS[type] || []).slice();
        if (type.startsWith('ae3-')) {
            const num = Number(type.split('-')[1]);
            let fileLabel = 'Fichier justificatif officiel';
            if (type === 'ae3-1') fileLabel = 'Attestation du Décanat ou attestation du Chef de département';
            if (type === 'ae3-2') fileLabel = 'Attestation du Chef de département';
            if (type === 'ae3-3') fileLabel = 'Attestation du chef de département / responsable du master';
            if (type === 'ae3-4') fileLabel = 'Attestation du Décanat';
            if (type === 'ae3-5') fileLabel = 'Attestation de la Présidence de l\'Université';
            if (type === 'ae3-6') fileLabel = 'Attestation du Décanat';
            if (type === 'ae3-7') fileLabel = 'Attestation officielle';
            fields = AE3_EXTRAS[num] ? AE3_EXTRAS[num].concat({ name: 'PDF', label: fileLabel, type: 'file', required: true, className: `ae3${num}-hidden-file` }) : [{ name: 'PDF', label: fileLabel, type: 'file', required: true, className: `ae3${num}-hidden-file` }];
        } else if (type === 'ae2-1') {
            fields = fields.concat({ name: 'PDF', label: 'Copie de la page de garde cachetée', type: 'file', required: false });
        } else if (type === 'ae2-2') {
            fields = fields.concat({ name: 'PDF', label: 'Copie de la page de garde cachetée', type: 'file', required: false });
        } else if (type === 'ae2-3') {
            fields = fields.concat({ name: 'PDF', label: 'Attestation du Décanat ou de la Présidence de l\'Université', type: 'file', required: true });
        } else if (type.startsWith('ar1-')) {
            const num = Number(type.split('-')[1]);
            if (type === 'ar1-1' || type === 'ar1-2' || type === 'ar1-3' || type === 'ar1-4') {
                fields = fields.concat(AR1_EXTRAS[num] || []);
            } else {
                const lienLabel = type === 'ar1-1' ? 'Lien de la publication de l’article' : type === 'ar1-2' ? 'Lien du site web de la manifestation' : 'Lien de publication ou justificatif';
                fields = [text('lien', lienLabel)].concat(AR1_EXTRAS[num] || []);
            }
        } else if (type === 'ar2-2') {
            fields = (AR_EXTRAS[type] || []).concat([
                { name: 'invitation_file', label: 'Invitation officielle à la soutenance ou lettre de nomination en tant que rapporteur', type: 'file', required: true, className: 'ar22-invitation-hidden-file' },
                { name: 'page_garde', label: 'Copie de la page de garde de la thèse ou de l\'habilitation', type: 'file', required: true, className: 'ar22-page_garde-hidden-file' }
            ]);
        } else if (type === 'ar3-1') {
            fields = (AR_EXTRAS[type] || []).concat({ name: 'PDF', label: 'Attestation officielle', type: 'file', required: true, className: 'ar31-hidden-file' });
        } else if (type === 'ar3-2') {
            fields = (AR_EXTRAS[type] || []).concat({ name: 'PDF', label: 'Attestation du directeur de la structure de recherche', type: 'file', required: true, className: 'ar32-hidden-file' });
        } else if (type === 'ar3-3') {
            fields = (AR_EXTRAS[type] || []).concat([
                { name: 'contrat', label: 'Copie du contrat, de la convention ou de tout autre document officiel', type: 'file', required: true, className: 'ar33-contrat-hidden-file' },
                { name: 'attestation_responsable', label: 'Attestation du responsable du projet (pour les membres participants uniquement)', type: 'file', required: false, className: 'ar33-attestation_responsable-hidden-file' }
            ]);
        } else if (type === 'ar3-4') {
            fields = (AR_EXTRAS[type] || []).concat({ name: 'PDF', label: 'Attestation officielle précisant l\'objet et la date de réalisation', type: 'file', required: true, className: 'ar34-hidden-file' });
        } else if (type === 'ar4-1') {
            fields = (AR_EXTRAS[type] || []).concat({ name: 'PDF', label: 'Document officiel (attestation, affiche ou lien de la page web)', type: 'file', required: true, className: 'ar41-hidden-file' });
        } else if (type === 'ar4-2') {
            fields = (AR_EXTRAS[type] || []).concat({ name: 'PDF', label: 'Document officiel', type: 'file', required: true, className: 'ar42-hidden-file' });
        } else if (type === 'ar4-3') {
            fields = (AR_EXTRAS[type] || []).concat({ name: 'PDF', label: 'Document officiel', type: 'file', required: true, className: 'ar43-hidden-file' });
        } else if (type.startsWith('ar2-') || type.startsWith('ar3-') || type.startsWith('ar4-')) {
            const match = type.match(/^ar(\d)-(\d)$/);
            const className = match ? `ar${match[1]}${match[2]}-hidden-file` : 'ar-hidden-file';
            const fileLabel = type === 'ar2-1'
                ? 'Copie de la page de garde de la thèse cachetée par le CED'
                : 'Fichier justificatif officiel';
            fields = (AR_EXTRAS[type] || []).concat({ name: 'PDF', label: fileLabel, type: 'file', required: true, className });
        }
        if (EXTRA_FIELDS[type]) fields = fields.concat(EXTRA_FIELDS[type]);
        return {
            title: titleFor(type),
            fields
        };
    }

    function titleFor(type) {
        const titles = {
            'licence': 'Enseignements assurés en Licence',
            'encadrement-licence': 'Encadrement en Licence',
            'master': 'Enseignements assurés en Master',
            'encadrement-master': 'Encadrement en Master',
            'responsabilites': 'Responsabilités pédagogiques',
            'ae1-1': 'AE 1-1 Publication d\'ouvrages d\'enseignement (ISSN ou ISBN) :',
            'ae1-2': 'AE1-2 : Manuels ou polycopiés d\'enseignement',
            'ae1-3': 'AE 1-3 Supports NTIC et Innovations pédagogiques (diaporamas, didacticiels, miseen place de nouveaux TPs, page web ou homepage à caractère pédagogique)',
            'ae2-1': 'AE2-1 : Encadrement de cours, TD, TP et PFE (cycle Licence)',
            'ae2-2': 'AE 2-2 Encadrement de cours et mémoires de fin d\'étude (cycle Master)',
            'ae2-3': 'AE 2-3 Encadrement d\'autres activités (sorties de terrain, animation de séminaires ou formations,…)',
            'ae3-1': 'AE3-1 : Chef de département ou membre de collège (ou bureau) du département',
            'ae3-2': 'AE3-2 : Coordonnateur de filière',
            'ae3-3': 'AE3-3 : Responsable de module',
            'ae3-4': 'AE3-4 : Membre du conseil d\'Établissement',
            'ae3-5': 'AE3-5 : Membre du conseil d\'Université',
            'ae3-6': 'AE3-6 : Membre de la commission scientifique',
            'ae3-7': 'AE 3-7 Membre de commission d\'expertise ou d\'évaluation pédagogique à l\'échelle nationale ou internationale',
            'ar1-1': 'AR 1-1 Publications scientifiques dans des revues spécialisées indexées (Scopus, Webof Knowledge)',
            'ar1-2': 'AR 1-2 Publications dans les actes de manifestations scientifiques avec comité de lecture',
            'ar1-3': 'AR 1-3 Ouvrages de recherche édités (livres ou chapitres de livres)',
            'ar1-4': 'AR 1-4 Publications scientifiques dans des revues spécialisées nationales ou internationales avec comité de lecture',
            'ar2-1': 'AR2-1 : Direction ou codirection de thèses de doctorat soutenues',
            'ar2-2': 'AR2-2 : Rapporteur et membre de jury de thèses ou d\'habilitations',
            'ar3-1': 'AR 3-1 Directeur de structure de recherche (laboratoire, pôle de compétence, centre thématique de recherche,…)',
            'ar3-2': 'AR3-2 : Responsable d\'équipe de recherche',
            'ar3-3': 'AR 3-3 Responsable ou participant dans des projets ou contrats de recherche financés',
            'ar3-4': 'AR 3-4 Activités d\'expertise et d\'évaluation scientifique à l\'échelle nationale ou internationale (CNACES, CNRST, reviewer, editorial board, editor-in-chief,…)',
            'ar4-1': 'AR 4-1 Animation de structures d\'interaction avec le milieu socio-économique et organisation de manifestations scientifiques (séminaires, colloques, congrès, forums,…)',
            'ar4-2': 'AR 4-2 Expertise et valorisation d\'actions et de travaux au profit du milieu socio-économique (organisations non gouvernementales, secteur privé, organismes internationaux, secteur public)',
            'ar4-3': 'AR 4-3 Travaux de recherche et innovations (Dépôt de brevets au profit de l\'établissement, conception de prototypes, incubation de projets de recherche et de développement, prix,…)',
        };
        return titles[type] || type.toUpperCase().replace('-', ' ');
    }

    function esc(value) {
        return escapeHtml(value == null ? '' : String(value));
    }

    function fileClassFor(type, field) {
        if (field.className) return field.className;
        if (type === 'encadrement-licence' || type === 'encadrement-master') return 'step2-hidden-file';
        if (type === 'ae1-1') return 'ae11-hidden-file';
        if (type === 'ae1-2') return 'ae12-hidden-file';
        if (type === 'ae1-3') return 'ae13-hidden-file';
        if (type === 'ae2-1') return 'ae21-hidden-file';
        if (type === 'ae2-2') return 'ae22-hidden-file';
        if (type === 'ae2-3') return 'ae23-hidden-file';
        if (type.startsWith('ae3-')) return `ae3${type.split('-')[1]}-hidden-file`;
        if (type.startsWith('ar1-')) return `${type.replace('-', '')}-${field.name}-hidden-file`;
        return 'modal-hidden-file';
    }

    function fieldHtml(field, value) {
        const id = `req_modal_${field.name}`;
        const isOptional = field.required === false;
        const mark = isOptional ? '' : '<span class="required-star" style="color:#000;">*</span>';
        const reqAttr = isOptional ? '' : ' required';
        const error = `<span id="${id}Error" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>`;
        const counter = field.type !== 'file' && field.type !== 'select' && field.type !== 'date'
            ? `<span id="${id}Counter" class="modal-counter" style="display:block;color:#16803c;font-size:0.8rem;margin-top:4px;"></span>`
            : '';
        if (field.type === 'textarea') {
            return `<div class="modal-form-group">
                <label for="${id}">${esc(field.label)} ${mark}</label>
                <textarea id="${id}" name="${esc(field.name)}" maxlength="${MAX_TEXT_LENGTH}"${reqAttr}>${esc(value)}</textarea>
                ${counter}${error}
            </div>`;
        }
        if (field.type === 'file') {
            const current = value ? `<span class="file-upload-text">Fichier actuel : ${esc(value)}</span>` : '';
            return `<div class="modal-form-group">
                <label for="${id}">${esc(field.label)} ${mark}</label>
                ${current}
                <input id="${id}" name="${esc(field.name)}" type="file" accept=".pdf"${reqAttr}>
                <span class="modal-counter" style="display:block;color:#16803c;font-size:0.8rem;margin-top:4px;">Taille maximale : 1 Mo</span>
                ${error}
            </div>`;
        }
        if (field.type === 'select') {
            const options = (field.options || []).map(option => {
                const selected = String(value) === String(option) ? ' selected' : '';
                return `<option value="${esc(option)}"${selected}>${esc(option)}</option>`;
            }).join('');
            return `<div class="modal-form-group">
                <label for="${id}">${esc(field.label)} ${mark}</label>
                <select id="${id}" name="${esc(field.name)}"${reqAttr}>
                    <option value="" disabled${value ? '' : ' selected'}>Choisir</option>
                    ${options}
                </select>
                ${error}
            </div>`;
        }
        const min = field.min !== undefined ? ` min="${field.min}"` : '';
        const max = field.max !== undefined ? ` max="${field.max}"` : '';
        return `<div class="modal-form-group">
            <label for="${id}">${esc(field.label)} ${mark}</label>
            <input id="${id}" name="${esc(field.name)}" type="${field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}" value="${esc(value)}"${min}${max} maxlength="${MAX_TEXT_LENGTH}" required>
            ${counter}${error}
        </div>`;
    }

    function getStoredMeta(row) {
        if (!row) return {};
        try {
            return JSON.parse(row.getAttribute('data-requirements-json') || '{}');
        } catch (_) {
            return {};
        }
    }

    function readRowData(row, type) {
        const schema = schemaFor(type);
        const data = getStoredMeta(row);
        const persisted = persistedFields(type);
        persisted.forEach((field, index) => {
            if (field.type === 'file') {
                const input = row.querySelector(`[name="${field.name}"]`);
                if (input && input.value) {
                    data[field.name] = input.value;
                }
            } else {
                const input = row.querySelector(`[name="${field.name}"]`);
                if (input) data[field.name] = input.value;
            }
        });
        schema.fields.forEach(field => {
            if (data[field.name] == null) data[field.name] = '';
        });
        return data;
    }

    function persistedFields(type) {
        if (type.startsWith('ae') || type.startsWith('ar')) {
            return schemaFor(type).fields;
        }
        if (type.startsWith('ae3-') || type.startsWith('ar2-') || type.startsWith('ar3-') || type.startsWith('ar4-')) {
            return [{ name: 'PDF', label: 'Fichier justificatif officiel', type: 'file', required: true }];
        }
        if (type.startsWith('ar1-')) {
            return [text('lien', 'Lien de publication ou justificatif')];
        }
        return BASE_FIELDS[type] || [];
    }

    function enhancedOpenModal(type, rowData = null) {
        if (typeof isReadOnly !== 'undefined' && isReadOnly) {
            alert('Vous ne pouvez pas modifier un dossier soumis.');
            return;
        }

        currentModalType = type;
        rowToEdit = rowData ? rowData.row : null;
        const modal = document.getElementById('modalOverlay');
        const modalContent = document.getElementById('modalContent');
        if (!modal || !modalContent) return;

        const schema = schemaFor(type);
        const rowValues = rowToEdit ? readRowData(rowToEdit, type) : {};
        const values = Object.assign({}, rowValues, rowData && rowData.data ? rowData.data : {});

        const iconMap = {
            'licence': 'fa-chalkboard-teacher',
            'encadrement-licence': 'fa-users',
            'master': 'fa-graduation-cap',
            'encadrement-master': 'fa-users',
            'responsabilites': 'fa-tasks',
            'ae1-1': 'fa-file-alt',
            'ae1-2': 'fa-book',
            'ae1-3': 'fa-laptop-code',
            'ae2-1': 'fa-user-graduate',
            'ae2-2': 'fa-users',
            'ae2-3': 'fa-calendar-alt',
            'ae3-1': 'fa-sitemap',
            'ae3-2': 'fa-layer-group',
            'ae3-3': 'fa-cube',
            'ae3-4': 'fa-university',
            'ae3-5': 'fa-landmark',
            'ae3-6': 'fa-users-cog',
            'ae3-7': 'fa-clipboard-check',
            'ar1-1': 'fa-scroll',
            'ar1-2': 'fa-file-invoice',
            'ar1-3': 'fa-book-open',
            'ar1-4': 'fa-newspaper',
            'ar2-1': 'fa-user-tie',
            'ar2-2': 'fa-gavel',
            'ar3-1': 'fa-building',
            'ar3-2': 'fa-users-cog',
            'ar3-3': 'fa-project-diagram',
            'ar3-4': 'fa-search',
            'ar4-1': 'fa-hands',
            'ar4-2': 'fa-handshake',
            'ar4-3': 'fa-lightbulb'
        };
        if (type === 'ae2-1') {
            const v = (key) => values[key] || '';
            let typeEnc = v('type_encadrement');
            if (!typeEnc) typeEnc = v('intitule_pfe') ? 'pfe' : 'cours_td_tp';
            const showCours = typeEnc === 'cours_td_tp';
            const showPfe = typeEnc === 'pfe';
            modalContent.innerHTML = `
            <div class="modal-header">
                <h3><i class="fas ${iconMap[type] || 'fa-file-alt'}"></i> ${esc(schema.title)}</h3>
                <button class="close-modal" type="button" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label for="req_modal_annee_univ">Année universitaire <span style="color:#000;">*</span></label>
                    <span id="req_modal_annee_univError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                    <select id="req_modal_annee_univ" name="annee_univ" required>
                        <option value="" disabled${v('annee_univ') ? '' : ' selected'}>Choisir une année universitaire</option>
                        ${ACADEMIC_YEARS.map(y => `<option value="${y}"${v('annee_univ') === y ? ' selected' : ''}>${y}</option>`).join('')}
                    </select>
                </div>
                <div class="modal-form-group">
                    <label for="req_modal_type">Type de la Licence <span style="color:#000;">*</span></label>
                    <span id="req_modal_typeError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                    <select id="req_modal_type" name="type" required>
                        <option value="" disabled${v('type') ? '' : ' selected'}>Choisir</option>
                        <option value="LF"${v('type') === 'LF' ? ' selected' : ''}>LF — Licence Fondamentale</option>
                        <option value="LP"${v('type') === 'LP' ? ' selected' : ''}>LP — Licence Professionnelle</option>
                        <option value="LE"${v('type') === 'LE' ? ' selected' : ''}>LE — Licence d'Excellence</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label for="req_modal_intitule_licence">Intitulé de la Licence <span style="color:#000;">*</span></label>
                    <span id="req_modal_intitule_licenceError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                    <textarea id="req_modal_intitule_licence" name="intitule_licence" maxlength="500" required>${esc(v('intitule_licence'))}</textarea>
                </div>
                <div class="modal-form-group">
                    <label for="req_modal_departements">Département d'attache <span style="color:#000;">*</span></label>
                    <span id="req_modal_departementsError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                    <textarea id="req_modal_departements" name="departements" maxlength="500" required>${esc(v('departements'))}</textarea>
                </div>

                <div class="modal-form-group" style="grid-column:1/-1;">
                    <span id="req_modal_type_encadrementError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                    <div role="group" aria-label="Type encadrante" style="display:flex;gap:1rem;flex-wrap:wrap;">
                        <button type="button" class="ae21-type-btn" data-value="cours_td_tp" aria-pressed="${showCours ? 'true' : 'false'}" onclick="window.toggleAe21Type('cours_td_tp')" style="padding:0.55rem 1rem;border:2px solid ${showCours ? '#2196f3' : '#dee2e6'};border-radius:6px;cursor:pointer;background:${showCours ? '#e3f2fd' : '#fff'};font:inherit;">Type encadrante : Cours, TD et/ou TP</button>
                        <button type="button" class="ae21-type-btn" data-value="pfe" aria-pressed="${showPfe ? 'true' : 'false'}" onclick="window.toggleAe21Type('pfe')" style="padding:0.55rem 1rem;border:2px solid ${showPfe ? '#2196f3' : '#dee2e6'};border-radius:6px;cursor:pointer;background:${showPfe ? '#e3f2fd' : '#fff'};font:inherit;">Type encadrante : Encadrement de PFE</button>
                    </div>
                    <input type="hidden" id="req_modal_type_encadrement" name="type_encadrement" value="${showPfe ? 'pfe' : 'cours_td_tp'}">
                </div>

                <div id="ae21_cours_fields"${showCours ? '' : ' style="display:none;"'}>
                    <div class="modal-form-group">
                        <label for="req_modal_cours_td_tp">Type <span style="color:#000;">*</span></label>
                        <span id="req_modal_cours_td_tpError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <select id="req_modal_cours_td_tp" name="cours_td_tp"${showCours ? ' required' : ''}>
                            <option value="" disabled${v('cours_td_tp') ? '' : ' selected'}>Choisir</option>
                            ${['Cours', 'TD', 'TP'].concat(v('cours_td_tp') && !['Cours', 'TD', 'TP'].includes(v('cours_td_tp')) ? [v('cours_td_tp')] : []).map(opt => `<option value="${esc(opt)}"${v('cours_td_tp') === opt ? ' selected' : ''}>${esc(opt)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="modal-form-group">
                        <label for="req_modal_intitule_module">Intitulé du module <span style="color:#000;">*</span></label>
                        <span id="req_modal_intitule_moduleError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <input id="req_modal_intitule_module" name="intitule_module" type="text" maxlength="500" value="${esc(v('intitule_module'))}"${showCours ? ' required' : ''}>
                    </div>
                    <div class="modal-form-group">
                        <label for="req_modal_modules">Module ou élément de module <span style="color:#000;">*</span></label>
                        <span id="req_modal_modulesError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <select id="req_modal_modules" name="modules"${showCours ? ' required' : ''}>
                            <option value="" disabled${v('modules') ? '' : ' selected'}>Choisir</option>
                            <option value="Module"${v('modules') === 'Module' ? ' selected' : ''}>Module</option>
                            <option value="Élément de module"${v('modules') === 'Élément de module' ? ' selected' : ''}>Élément de module</option>
                        </select>
                    </div>
                </div>

                <div id="ae21_pfe_fields"${showPfe ? '' : ' style="display:none;"'}>
                    <div class="modal-form-group">
                        <label for="req_modal_intitule_pfe">Intitulé du PFE <span style="color:#000;">*</span></label>
                        <span id="req_modal_intitule_pfeError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <textarea id="req_modal_intitule_pfe" name="intitule_pfe" maxlength="500"${showPfe ? ' required' : ''}>${esc(v('intitule_pfe'))}</textarea>
                    </div>
                    <div class="modal-form-group">
                        <label for="req_modal_coenseignants">Co-encadrant(s)</label>
                        <span id="req_modal_coenseignantsError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <textarea id="req_modal_coenseignants" name="coenseignants" maxlength="500">${esc(v('coenseignants'))}</textarea>
                    </div>
                    <div class="modal-form-group">
                        <label for="req_modal_PDF">Copie de la page de garde cachetée <span style="color:#000;">*</span></label>
                        <span id="req_modal_PDFError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <div class="file-upload-group">
                            <button class="file-upload-btn" type="button" onclick="document.getElementById('req_modal_PDF').click()">Sélect. fichier</button>
                            <span class="file-upload-text" id="req_modal_PDFName">${v('PDF') || 'Aucun fichier'}</span>
                            <input type="file" style="display:none;" id="req_modal_PDF" name="PDF" accept=".pdf" onchange="updateFileName(this, 'req_modal_PDFName')">
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" type="button" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" type="button" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>`;

            window.toggleAe21Type = function(nextValue) {
                const hidden = document.getElementById('req_modal_type_encadrement');
                const val = nextValue || (hidden ? hidden.value : 'cours_td_tp');
                if (hidden) hidden.value = val;
                document.querySelectorAll('.ae21-type-btn').forEach(btn => {
                    const on = btn.dataset.value === val;
                    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
                    btn.style.background = on ? '#e3f2fd' : '#fff';
                    btn.style.borderColor = on ? '#2196f3' : '#dee2e6';
                });
                const coursFields = document.getElementById('ae21_cours_fields');
                const pfeFields = document.getElementById('ae21_pfe_fields');
                const coursTdTp = document.getElementById('req_modal_cours_td_tp');
                const intituleModule = document.getElementById('req_modal_intitule_module');
                const modules = document.getElementById('req_modal_modules');
                const intitulePfe = document.getElementById('req_modal_intitule_pfe');
                const coenseignants = document.getElementById('req_modal_coenseignants');
                const pdfInput = document.getElementById('req_modal_PDF');

                if (val === 'cours_td_tp') {
                    coursFields.style.display = '';
                    pfeFields.style.display = 'none';
                    coursTdTp.required = true;
                    intituleModule.required = true;
                    modules.required = true;
                    intitulePfe.required = false;
                    intitulePfe.value = '';
                    coenseignants.value = '';
                    pdfInput.required = false;
                    pdfInput.value = '';
                    document.getElementById('req_modal_PDFName').textContent = 'Aucun fichier';
                } else {
                    coursFields.style.display = 'none';
                    pfeFields.style.display = '';
                    coursTdTp.required = false;
                    coursTdTp.value = '';
                    intituleModule.required = false;
                    intituleModule.value = '';
                    modules.required = false;
                    modules.value = '';
                    intitulePfe.required = true;
                    pdfInput.required = true;
                }
            };
        } else if (type === 'ae2-2') {
            const v = (key) => values[key] || '';
            let typeEnc = v('type_encadrement');
            if (!typeEnc) typeEnc = v('intitule_memoire') ? 'memoire' : 'cours';
            const showCours = typeEnc === 'cours';
            const showMemoire = typeEnc === 'memoire';
            modalContent.innerHTML = `
            <div class="modal-header">
                <h3><i class="fas ${iconMap[type] || 'fa-file-alt'}"></i> ${esc(schema.title)}</h3>
                <button class="close-modal" type="button" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                <div class="modal-form-group">
                    <label for="req_modal_annee_univ">Année universitaire <span style="color:#000;">*</span></label>
                    <span id="req_modal_annee_univError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                    <select id="req_modal_annee_univ" name="annee_univ" required>
                        <option value="" disabled${v('annee_univ') ? '' : ' selected'}>Choisir une année universitaire</option>
                        ${ACADEMIC_YEARS.map(y => `<option value="${y}"${v('annee_univ') === y ? ' selected' : ''}>${y}</option>`).join('')}
                    </select>
                </div>
                <div class="modal-form-group">
                    <label for="req_modal_type">Type de Master <span style="color:#000;">*</span></label>
                    <span id="req_modal_typeError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                    <select id="req_modal_type" name="type" required>
                        <option value="" disabled${v('type') ? '' : ' selected'}>Choisir</option>
                        <option value="MF"${v('type') === 'MF' ? ' selected' : ''}>MF — Master Fondamental</option>
                        <option value="MS"${v('type') === 'MS' ? ' selected' : ''}>MS — Master Spécialisé</option>
                    </select>
                </div>
                <div class="modal-form-group">
                    <label for="req_modal_intitule_master">Intitulé du Master <span style="color:#000;">*</span></label>
                    <span id="req_modal_intitule_masterError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                    <textarea id="req_modal_intitule_master" name="intitule_master" maxlength="500" required>${esc(v('intitule_master'))}</textarea>
                </div>
                <div class="modal-form-group">
                    <label for="req_modal_coordonnateurs">Coordonnateur de Master <span style="color:#000;">*</span></label>
                    <span id="req_modal_coordonnateursError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                    <textarea id="req_modal_coordonnateurs" name="coordonnateurs" maxlength="500" required>${esc(v('coordonnateurs'))}</textarea>
                </div>

                <div class="modal-form-group" style="grid-column:1/-1;">
                    <label>Type d'activité <span style="color:#000;">*</span></label>
                    <div style="display:flex;gap:1rem;margin-top:0.5rem;">
                        <label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;border:2px solid #dee2e6;border-radius:6px;cursor:pointer;background:${showCours ? '#e3f2fd' : '#fff'};border-color:${showCours ? '#2196f3' : '#dee2e6'};">
                            <input type="radio" name="ae22_type" value="cours" ${showCours ? 'checked' : ''} onchange="window.toggleAe22Type()">
                            <span>Cours</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;border:2px solid #dee2e6;border-radius:6px;cursor:pointer;background:${showMemoire ? '#e3f2fd' : '#fff'};border-color:${showMemoire ? '#2196f3' : '#dee2e6'};">
                            <input type="radio" name="ae22_type" value="memoire" ${showMemoire ? 'checked' : ''} onchange="window.toggleAe22Type()">
                            <span>Encadrement de mémoire</span>
                        </label>
                    </div>
                </div>

                <div id="ae22_cours_fields"${showCours ? '' : ' style="display:none;"'}>
                    <div class="modal-form-group">
                        <label for="req_modal_cours">l'intitulé du module <span style="color:#000;">*</span></label>
                        <span id="req_modal_coursError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <textarea id="req_modal_cours" name="cours" maxlength="500"${showCours ? ' required' : ''}>${esc(v('cours'))}</textarea>
                    </div>
                </div>

                <div id="ae22_memoire_fields"${showMemoire ? '' : ' style="display:none;"'}>
                    <div class="modal-form-group">
                        <label for="req_modal_intitule_memoire">Intitulé du mémoire <span style="color:#000;">*</span></label>
                        <span id="req_modal_intitule_memoireError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <textarea id="req_modal_intitule_memoire" name="intitule_memoire" maxlength="500"${showMemoire ? ' required' : ''}>${esc(v('intitule_memoire'))}</textarea>
                    </div>
                    <div class="modal-form-group">
                        <label for="req_modal_coenseignants">Co-encadrant(s)</label>
                        <span id="req_modal_coenseignantsError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <textarea id="req_modal_coenseignants" name="coenseignants" maxlength="500">${esc(v('coenseignants'))}</textarea>
                    </div>
                    <div class="modal-form-group">
                        <label for="req_modal_departements">Département d'attache <span style="color:#000;">*</span></label>
                        <span id="req_modal_departementsError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <textarea id="req_modal_departements" name="departements" maxlength="500" required>${esc(v('departements'))}</textarea>
                    </div>
                    <div class="modal-form-group">
                        <label for="req_modal_PDF">Copie de la page de garde cachetée <span style="color:#000;">*</span></label>
                        <span id="req_modal_PDFError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                        <div class="file-upload-group">
                            <button class="file-upload-btn" type="button" onclick="document.getElementById('req_modal_PDF').click()">Sélect. fichier</button>
                            <span class="file-upload-text" id="req_modal_PDFName">${v('PDF') || 'Aucun fichier'}</span>
                            <input type="file" style="display:none;" id="req_modal_PDF" name="PDF" accept=".pdf" onchange="updateFileName(this, 'req_modal_PDFName')">
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" type="button" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" type="button" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>`;

            window.toggleAe22Type = function() {
                const choice = document.querySelector('input[name="ae22_type"]:checked');
                if (!choice) return;
                const val = choice.value;
                document.querySelectorAll('input[name="ae22_type"]').forEach(r => {
                    r.closest('label').style.background = r.checked ? '#e3f2fd' : '#fff';
                    r.closest('label').style.borderColor = r.checked ? '#2196f3' : '#dee2e6';
                });
                const coursFields = document.getElementById('ae22_cours_fields');
                const memoireFields = document.getElementById('ae22_memoire_fields');
                const coursInput = document.getElementById('req_modal_cours');
                const memoireInput = document.getElementById('req_modal_intitule_memoire');
                const coenseignants = document.getElementById('req_modal_coenseignants');
                const pdfInput = document.getElementById('req_modal_PDF');

                if (val === 'cours') {
                    coursFields.style.display = '';
                    memoireFields.style.display = 'none';
                    coursInput.required = true;
                    memoireInput.required = false;
                    memoireInput.value = '';
                    coenseignants.value = '';
                    pdfInput.required = false;
                    pdfInput.value = '';
                    document.getElementById('req_modal_PDFName').textContent = 'Aucun fichier';
                } else {
                    coursFields.style.display = 'none';
                    memoireFields.style.display = '';
                    coursInput.required = false;
                    coursInput.value = '';
                    memoireInput.required = true;
                    pdfInput.required = true;
                }
            };
        } else if (type === 'ar1-4') {
            const fieldsHtml = schema.fields
                .filter(f => f.name !== 'lien_publication' && f.name !== 'publication_file')
                .map(f => fieldHtml(f, values[f.name] || '')).join('');
            const hasUrl = !!(values.lien_publication || '');
            const hasFile = !!(values.publication_file || '');
            const preselected = hasUrl ? 'url' : hasFile ? 'file' : 'url';
            modalContent.innerHTML = `
            <div class="modal-header">
                <h3><i class="fas ${iconMap[type] || 'fa-file-alt'}"></i> ${esc(schema.title)}</h3>
                <button class="close-modal" type="button" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">
                ${fieldsHtml}
                <div class="modal-form-group">
                    <label>Type de justificatif <span style="color:#000;">*</span></label>
                    <div class="ar14-toggle">
                        <label class="ar14-option${preselected === 'url' ? ' active' : ''}">
                            <input type="radio" name="ar14_choice" value="url" ${preselected === 'url' ? 'checked' : ''} onchange="toggleAr14Choice()">
                            Auteur — Titre — Journal — Année
                        </label>
                        <label class="ar14-option${preselected === 'file' ? ' active' : ''}">
                            <input type="radio" name="ar14_choice" value="file" ${preselected === 'file' ? 'checked' : ''} onchange="toggleAr14Choice()">
                            Copie de la 1ère page de l'article
                        </label>
                    </div>
                </div>
                <div class="modal-form-group" id="ar14_url_group"${preselected !== 'url' ? ' style="display:none;"' : ''}>
                    <label for="req_modal_lien_publication">Auteur — Titre — Journal — Année <span style="color:#000;">*</span></label>
                    <input id="req_modal_lien_publication" name="lien_publication" type="text" value="${esc(values.lien_publication || '')}" placeholder="Auteur — Titre — Journal — Année" required>
                    <span id="req_modal_lien_publicationError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                </div>
                <div class="modal-form-group" id="ar14_file_group"${preselected !== 'file' ? ' style="display:none;"' : ''}>
                    <label for="req_modal_publication_file">Copie de la 1ère page de l'article <span style="color:#000;">*</span></label>
                    ${values.publication_file ? '<span class="file-upload-text">Fichier actuel : ' + esc(values.publication_file) + '</span>' : ''}
                    <input id="req_modal_publication_file" name="publication_file" type="file" accept=".pdf"${preselected === 'file' && !values.publication_file ? ' required' : ''}>
                    <span id="req_modal_publication_fileError" class="modal-error" style="display:none;color:#c62828;font-size:0.85rem;margin-top:4px;"></span>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" type="button" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" type="button" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>`;
            wireCounters(modalContent);
            window.toggleAr14Choice = function() {
                const choice = document.querySelector('input[name="ar14_choice"]:checked');
                if (!choice) return;
                const val = choice.value;
                document.querySelectorAll('.ar14-option').forEach(opt => opt.classList.remove('active'));
                choice.closest('.ar14-option').classList.add('active');
                const urlGroup = document.getElementById('ar14_url_group');
                const fileGroup = document.getElementById('ar14_file_group');
                const urlInput = document.getElementById('req_modal_lien_publication');
                const fileInput = document.getElementById('req_modal_publication_file');
                if (val === 'url') {
                    urlGroup.style.display = '';
                    fileGroup.style.display = 'none';
                    urlInput.required = true;
                    fileInput.required = false;
                    fileInput.value = '';
                    delete fileInput.dataset.previousFile;
                } else {
                    urlGroup.style.display = 'none';
                    fileGroup.style.display = '';
                    urlInput.required = false;
                    urlInput.value = '';
                    fileInput.required = !fileInput.dataset.previousFile;
                }
            };
            toggleAr14Choice();
        } else {
            modalContent.innerHTML = `
            <div class="modal-header">
                <h3><i class="fas ${iconMap[type] || 'fa-file-alt'}"></i> ${esc(schema.title)}</h3>
                <button class="close-modal" type="button" onclick="closeModal()">×</button>
            </div>
            <div class="modal-grid">${schema.fields.map(field => fieldHtml(field, values[field.name] || '')).join('')}</div>
            <div class="modal-actions">
                <button class="btn btn-outline" type="button" onclick="closeModal()">Annuler</button>
                <button class="btn btn-primary" type="button" onclick="addOrEditModalRow()">${rowToEdit ? 'Modifier' : 'Ajouter'}</button>
            </div>`;
            wireCounters(modalContent);
        }

        if (type === 'responsabilites') {
            const cycleSelect = document.getElementById('req_modal_cycle');
            const filiereSelect = document.getElementById('req_modal_filiere');
            const semestreSelect = document.getElementById('req_modal_semestre');
            if (cycleSelect) {
                const MASTER_SEMESTERS = ['S1', 'S2', 'S3'];
                const LICENCE_SEMESTERS = SEMESTERS;

                function updateCycleDependentFields() {
                    const cycle = cycleSelect.value;
                    const isLicence = cycle === 'Licence';
                    const isMaster = cycle === 'Master';
                    const enabled = isLicence || isMaster;

                    // Filière
                    if (filiereSelect) {
                        filiereSelect.innerHTML = '<option value="" disabled selected>Choisir une filière</option>';
                        filiereSelect.disabled = !enabled;
                        if (enabled) {
                            const list = isLicence ? FILIERES : MASTER_FILIERES;
                            list.forEach(opt => {
                                const o = document.createElement('option');
                                o.value = opt;
                                o.textContent = opt;
                                if (opt === values.filiere) o.selected = true;
                                filiereSelect.appendChild(o);
                            });
                        }
                    }

                    // Semestre
                    if (semestreSelect) {
                        semestreSelect.innerHTML = '<option value="" disabled selected>Choisir un semestre</option>';
                        semestreSelect.disabled = !enabled;
                        if (enabled) {
                            const list = isLicence ? LICENCE_SEMESTERS : MASTER_SEMESTERS;
                            list.forEach(opt => {
                                const o = document.createElement('option');
                                o.value = opt;
                                o.textContent = opt;
                                if (opt === values.semestre) o.selected = true;
                                semestreSelect.appendChild(o);
                            });
                        }
                    }
                }

                cycleSelect.addEventListener('change', updateCycleDependentFields);
                if (cycleSelect.value) {
                    updateCycleDependentFields();
                } else {
                    if (filiereSelect) filiereSelect.disabled = true;
                    if (semestreSelect) semestreSelect.disabled = true;
                }
            }
        }

        modal.classList.add('active');
    }

    function wireCounters(container) {
        container.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(input => {
            const update = () => {
                if (input.type === 'number') {
                    input.value = input.value.replace(/[^0-9]/g, '');
                    if (input.value !== '') {
                        const min = input.min === '' ? null : Number(input.min);
                        const max = input.max === '' ? null : Number(input.max);
                        let value = Number(input.value);
                        if (min !== null && value < min) value = min;
                        if (max !== null && value > max) value = max;
                        input.value = String(value);
                    }
                }
                if (input.value.length > MAX_TEXT_LENGTH) input.value = input.value.slice(0, MAX_TEXT_LENGTH);
                const counter = document.getElementById(`${input.id}Counter`);
                if (counter) counter.textContent = '';
            };
            input.addEventListener('input', update);
        });
    }

    function showError(input, message) {
        const error = document.getElementById(`${input.id}Error`);
        if (error) {
            error.textContent = message;
            error.style.display = 'block';
        }
        input.classList.add('is-invalid');
    }

    function clearError(input) {
        const error = document.getElementById(`${input.id}Error`);
        if (error) {
            error.textContent = '';
            error.style.display = 'none';
        }
        input.classList.remove('is-invalid');
    }

    function validateField(input) {
        if (!input.value.trim()) {
            showError(input, 'Merci de remplir ce champ');
            return false;
        }
        if (input.value.length > MAX_TEXT_LENGTH) {
            showError(input, 'Le texte ne doit pas dépasser ' + MAX_TEXT_LENGTH + ' caractères');
            return false;
        }
        // Champs "lien(s)" : exiger http:// ou https://
        const fieldName = (input.getAttribute('name') || '').toLowerCase();
        if (fieldName === 'lien' || fieldName === 'liens') {
            const raw = input.value.trim();
            const parts = raw.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
            const invalid = parts.find(p => !/^https?:\/\//i.test(p));
            if (invalid) {
                showError(input, 'Le lien doit commencer par http:// ou https://');
                return false;
            }
        }
        if (input.type === 'number') {
            const numericValue = Number(input.value);
            if (input.min !== '' && numericValue < Number(input.min)) {
                showError(input, `La valeur doit être au minimum ${input.min}.`);
                return false;
            }
            if (input.max !== '' && numericValue > Number(input.max)) {
                showError(input, `La valeur doit être au maximum ${input.max}.`);
                return false;
            }
        }
        clearError(input);
        return true;
    }

    function validateFile(input, hasExistingFile) {
        if (!input.files || input.files.length === 0) {
            if (hasExistingFile) {
                clearError(input);
                return true;
            }
            showError(input, 'Merci de remplir ce champ');
            return false;
        }
        const file = input.files[0];
        if (file.size > MAX_FILE_SIZE) {
            showError(input, 'Le fichier ne doit pas dépasser 1 Mo.');
            input.value = '';
            return false;
        }
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            showError(input, 'Seuls les fichiers PDF sont acceptés.');
            input.value = '';
            return false;
        }
        clearError(input);
        return true;
    }

    function collect(schema) {
        const data = {};
        schema.fields.forEach(field => {
            const input = document.getElementById(`req_modal_${field.name}`);
            if (!input) return;
            if (field.type === 'file') {
                if (input.files && input.files[0]) data[field.name] = input.files[0];
            } else {
                data[field.name] = input.value.trim();
            }
        });
        return data;
    }

    function validateModal(schema) {
        let ok = true;
        schema.fields.forEach(field => {
            const input = document.getElementById(`req_modal_${field.name}`);
            if (!input) return;
            if (field.required === false) {
                // Optional field: only validate when filled (size/type/length),
                // empty is always accepted.
                const isEmpty = field.type === 'file'
                    ? !(input.files && input.files.length > 0)
                    : !input.value.trim();
                if (isEmpty) {
                    clearError(input);
                    return;
                }
            }
            ok = (field.type === 'file' ? validateFile(input, Boolean(rowToEdit)) : validateField(input)) && ok;
            if (ok && field.type === 'date' && input.type === 'date' && input.value) {
                const min = DATE_CONSTRAINTS.min;
                const max = DATE_CONSTRAINTS.max;
                if (min && input.value < min) {
                    showError(input, 'Cette date est antérieure à la période autorisée.');
                    ok = false;
                } else if (max && input.value > max) {
                    showError(input, 'Cette date est postérieure à la période autorisée.');
                    ok = false;
                }
            }
        });
        return ok;
    }

    function validateAr14Modal() {
        const choice = document.querySelector('input[name="ar14_choice"]:checked');
        if (!choice) return false;
        const urlInput = document.getElementById('req_modal_lien_publication');
        const fileInput = document.getElementById('req_modal_publication_file');
        const refInput = document.getElementById('req_modal_reference_complete');
        const docInput = document.getElementById('req_modal_doctorants');
        const yearInput = document.getElementById('req_modal_annee_publication');
        const cedInput = document.getElementById('req_modal_ced_list');
        let ok = true;
        const requiredFields = [
            { input: refInput, name: 'Références de l\'article' },
            { input: yearInput, name: 'Année de publication' },
            { input: docInput, name: 'Nom des doctorants co-auteurs' }
        ];
        const hasCedFile = cedInput && cedInput.files && cedInput.files.length > 0;
        const oldMeta = rowToEdit ? getStoredMeta(rowToEdit) : {};
        const hasCedExisting = !!(oldMeta.ced_list || '');
        if (!hasCedFile && !hasCedExisting) {
            showError(cedInput, 'Veuillez joindre la liste CED');
            ok = false;
        } else {
            clearError(cedInput);
        }
        requiredFields.forEach(({ input, name }) => {
            if (!input || !input.value.trim()) {
                showError(input, 'Ce champ est obligatoire');
                ok = false;
            } else {
                clearError(input);
            }
        });
        if (choice.value === 'url') {
            if (!urlInput || !urlInput.value.trim()) {
                showError(urlInput, 'Veuillez saisir la référence (Auteur — Titre — Journal — Année)');
                ok = false;
            } else {
                clearError(urlInput);
            }
        } else {
            const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
            const oldMeta = rowToEdit ? getStoredMeta(rowToEdit) : {};
            const hasExisting = !!(oldMeta.publication_file || '');
            if (!hasFile && !hasExisting) {
                showError(fileInput, 'Veuillez joindre le fichier PDF');
                ok = false;
            } else {
                clearError(fileInput);
            }
        }
        if (!ok) {
            alert('Veuillez remplir tous les champs obligatoires.');
        }
        return ok;
    }

    function collectAr14Data() {
        const data = {};
        const refInput = document.getElementById('req_modal_reference_complete');
        const docInput = document.getElementById('req_modal_doctorants');
        const cedInput = document.getElementById('req_modal_ced_list');
        const urlInput = document.getElementById('req_modal_lien_publication');
        const fileInput = document.getElementById('req_modal_publication_file');
        data.reference_complete = refInput ? refInput.value.trim() : '';
        data.doctorants = docInput ? docInput.value.trim() : '';
        data.annee_publication = getVal('req_modal_annee_publication');
        data.ced_list = '';
        const choice = document.querySelector('input[name="ar14_choice"]:checked');
        if (choice && choice.value === 'url') {
            data.lien_publication = urlInput ? urlInput.value.trim() : '';
            if (fileInput && fileInput.files && fileInput.files[0]) fileInput.value = '';
        } else {
            data.lien_publication = '';
            if (fileInput && fileInput.files && fileInput.files[0]) data.publication_file = fileInput.files[0];
            if (fileInput && fileInput.files && fileInput.files[0]) data.file = fileInput.files[0];
        }
        if (cedInput && cedInput.files && cedInput.files[0]) data.ced_list = cedInput.files[0];
        return data;
    }

    function validateAe21Modal() {
        const hiddenType = document.getElementById('req_modal_type_encadrement');
        const typeEnc = hiddenType ? hiddenType.value : '';
        if (typeEnc !== 'cours_td_tp' && typeEnc !== 'pfe') return false;
        let ok = true;

        const commonFields = [
            { id: 'req_modal_annee_univ', name: 'Année universitaire' },
            { id: 'req_modal_type', name: 'Type de la Licence' },
            { id: 'req_modal_intitule_licence', name: 'Intitulé de la Licence' },
            { id: 'req_modal_departements', name: 'Département d\'attache' }
        ];
        commonFields.forEach(({ id, name }) => {
            const input = document.getElementById(id);
            if (!input || !input.value.trim()) {
                showError(input, 'Ce champ est obligatoire');
                ok = false;
            } else {
                clearError(input);
            }
        });

        if (typeEnc === 'cours_td_tp') {
            const coursInput = document.getElementById('req_modal_cours_td_tp');
            const intituleModuleInput = document.getElementById('req_modal_intitule_module');
            const modulesInput = document.getElementById('req_modal_modules');
            if (!coursInput || !coursInput.value.trim()) {
                showError(coursInput, 'Ce champ est obligatoire');
                ok = false;
            } else {
                clearError(coursInput);
            }
            if (!intituleModuleInput || !intituleModuleInput.value.trim()) {
                showError(intituleModuleInput, 'Ce champ est obligatoire');
                ok = false;
            } else {
                clearError(intituleModuleInput);
            }
            if (!modulesInput || !modulesInput.value.trim()) {
                showError(modulesInput, 'Ce champ est obligatoire');
                ok = false;
            } else {
                clearError(modulesInput);
            }
        } else {
            const intituleInput = document.getElementById('req_modal_intitule_pfe');
            const pdfInput = document.getElementById('req_modal_PDF');
            if (!intituleInput || !intituleInput.value.trim()) {
                showError(intituleInput, 'Ce champ est obligatoire');
                ok = false;
            } else {
                clearError(intituleInput);
            }
            const hasFile = pdfInput && pdfInput.files && pdfInput.files.length > 0;
            const oldMeta = rowToEdit ? getStoredMeta(rowToEdit) : {};
            const hasExisting = !!(oldMeta.PDF || '');
            if (!hasFile && !hasExisting) {
                showError(pdfInput, 'Veuillez joindre le fichier PDF');
                ok = false;
            } else {
                clearError(pdfInput);
            }
        }
        if (!ok) {
            alert('Veuillez remplir tous les champs obligatoires.');
        }
        return ok;
    }

    function collectAe21Data() {
        const data = {};
        const hiddenType = document.getElementById('req_modal_type_encadrement');
        const typeEnc = hiddenType && hiddenType.value ? hiddenType.value : 'cours_td_tp';
        data.type_encadrement = typeEnc;

        data.annee_univ = getVal('req_modal_annee_univ');
        data.type = getVal('req_modal_type');
        data.intitule_licence = getVal('req_modal_intitule_licence');
        data.departements = getVal('req_modal_departements');

        if (typeEnc === 'cours_td_tp') {
            data.cours_td_tp = getVal('req_modal_cours_td_tp');
            data.intitule_module = getVal('req_modal_intitule_module');
            data.modules = getVal('req_modal_modules');
            data.intitule_pfe = '';
            data.coenseignants = '';
            data.PDF = '';
        } else {
            data.cours_td_tp = '';
            data.intitule_module = '';
            data.modules = '';
            const intituleInput = document.getElementById('req_modal_intitule_pfe');
            data.intitule_pfe = intituleInput ? intituleInput.value.trim() : '';
            const coensInput = document.getElementById('req_modal_coenseignants');
            data.coenseignants = coensInput ? coensInput.value.trim() : '';
            const pdfInput = document.getElementById('req_modal_PDF');
            if (pdfInput && pdfInput.files && pdfInput.files[0]) {
                data.PDF = pdfInput.files[0];
            } else {
                data.PDF = '';
            }
        }
        return data;
    }

    function validateAe22Modal() {
        const choice = document.querySelector('input[name="ae22_type"]:checked');
        if (!choice) return false;
        const typeEnc = choice.value;
        let ok = true;

        const commonFields = [
            { id: 'req_modal_annee_univ', name: 'Année universitaire' },
            { id: 'req_modal_type', name: 'Type de Master' },
            { id: 'req_modal_intitule_master', name: 'Intitulé du Master' },
            { id: 'req_modal_coordonnateurs', name: 'Coordonnateur de Master' },
            { id: 'req_modal_departements', name: "Département d'attache" }
        ];
        commonFields.forEach(({ id, name }) => {
            const input = document.getElementById(id);
            if (!input || !input.value.trim()) {
                showError(input, 'Ce champ est obligatoire');
                ok = false;
            } else {
                clearError(input);
            }
        });

        if (typeEnc === 'cours') {
            const coursInput = document.getElementById('req_modal_cours');
            if (!coursInput || !coursInput.value.trim()) {
                showError(coursInput, 'Ce champ est obligatoire');
                ok = false;
            } else {
                clearError(coursInput);
            }
        } else {
            const memoireInput = document.getElementById('req_modal_intitule_memoire');
            if (!memoireInput || !memoireInput.value.trim()) {
                showError(memoireInput, 'Ce champ est obligatoire');
                ok = false;
            } else {
                clearError(memoireInput);
            }
            const pdfInput = document.getElementById('req_modal_PDF');
            const hasFile = pdfInput && pdfInput.files && pdfInput.files.length > 0;
            const oldMeta = rowToEdit ? getStoredMeta(rowToEdit) : {};
            const hasExisting = !!(oldMeta.PDF || '');
            if (!hasFile && !hasExisting) {
                showError(pdfInput, 'Veuillez joindre le fichier PDF');
                ok = false;
            } else {
                clearError(pdfInput);
            }
        }
        if (!ok) {
            alert('Veuillez remplir tous les champs obligatoires.');
        }
        return ok;
    }

    function collectAe22Data() {
        const data = {};
        const choice = document.querySelector('input[name="ae22_type"]:checked');
        const typeEnc = choice ? choice.value : 'cours';
        data.type_encadrement = typeEnc;

        data.annee_univ = getVal('req_modal_annee_univ');
        data.type = getVal('req_modal_type');
        data.intitule_master = getVal('req_modal_intitule_master');
        data.coordonnateurs = getVal('req_modal_coordonnateurs');
        data.departements = getVal('req_modal_departements');

        if (typeEnc === 'cours') {
            data.cours = getVal('req_modal_cours');
            data.intitule_memoire = '';
            data.coenseignants = '';
            data.PDF = '';
        } else {
            data.cours = '';
            const memoireInput = document.getElementById('req_modal_intitule_memoire');
            data.intitule_memoire = memoireInput ? memoireInput.value.trim() : '';
            const coensInput = document.getElementById('req_modal_coenseignants');
            data.coenseignants = coensInput ? coensInput.value.trim() : '';
            const pdfInput = document.getElementById('req_modal_PDF');
            if (pdfInput && pdfInput.files && pdfInput.files[0]) {
                data.PDF = pdfInput.files[0];
            } else {
                data.PDF = '';
            }
        }
        return data;
    }

    function getVal(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function enhancedAddOrEditModalRow() {
        const type = currentModalType;
        const schema = schemaFor(type);
        if (type === 'ar1-4') {
            if (!validateAr14Modal()) return;
        } else if (type === 'ae2-1') {
            if (!validateAe21Modal()) return;
        } else if (type === 'ae2-2') {
            if (!validateAe22Modal()) return;
        } else {
            if (!validateModal(schema)) return;
        }

        const table = document.getElementById(`table-${type}`);
        if (!table) return;
        const data = type === 'ar1-4' ? collectAr14Data() : type === 'ae2-1' ? collectAe21Data() : type === 'ae2-2' ? collectAe22Data() : collect(schema);
        const persisted = persistedFields(type);
        let row = rowToEdit;
        if (!row) {
            row = document.createElement('tr');
            row.setAttribute('data-row-id', nextRowId++);
            table.querySelector('tbody').appendChild(row);
        }
        row._arFiles = {};
        const rowId = row.getAttribute('data-row-id');
        if (rowId && window.__arFiles) delete window.__arFiles[rowId];

        const oldMeta = getStoredMeta(row);
        const meta = {};
        schema.fields.forEach(field => {
            if (field.type === 'file') {
                const fileValue = data[field.name];
                meta[field.name] = fileValue instanceof File ? fileValue.name : oldMeta[field.name] || '';
            } else {
                meta[field.name] = data[field.name] || '';
            }
        });
        if (type === 'ar1-4') {
            const choice = document.querySelector('input[name="ar14_choice"]:checked');
            const choiceVal = choice ? choice.value : 'url';
            if (choiceVal === 'url') {
                meta.publication_file = '';
                if (data.publication_file) delete data.publication_file;
                const fileIdx = persisted.findIndex(f => f.name === 'publication_file');
                if (fileIdx >= 0 && row.cells[fileIdx]) {
                    row.cells[fileIdx].innerHTML = '<span class="file-display">Aucun fichier</span>';
                }
            } else {
                meta.lien_publication = '';
                if (data.lien_publication) data.lien_publication = '';
                const urlIdx = persisted.findIndex(f => f.name === 'lien_publication');
                if (urlIdx >= 0 && row.cells[urlIdx]) {
                    const inp = row.cells[urlIdx].querySelector('input');
                    if (inp) inp.value = '';
                }
            }
        }
        if (type === 'ae2-1') {
            const typeEnc = data.type_encadrement || 'cours_td_tp';
            if (typeEnc === 'cours_td_tp') {
                meta.PDF = '';
                if (data.PDF) delete data.PDF;
                const fileIdx = persisted.findIndex(f => f.name === 'PDF');
                if (fileIdx >= 0 && row.cells[fileIdx]) {
                    row.cells[fileIdx].innerHTML = '<span class="file-display">Aucun fichier</span>';
                }
            }
        }
        if (type === 'ae2-2') {
            const typeEnc = data.type_encadrement || 'cours';
            if (typeEnc === 'cours') {
                meta.PDF = '';
                if (data.PDF) delete data.PDF;
                const fileIdx = persisted.findIndex(f => f.name === 'PDF');
                if (fileIdx >= 0 && row.cells[fileIdx]) {
                    row.cells[fileIdx].innerHTML = '<span class="file-display">Aucun fichier</span>';
                }
            }
        }

        row.innerHTML = persisted.map((field, index) => cellHtml(type, field, data, row, index)).join('') + `
            <td class="table-actions">
                <button class="btn-action btn-edit" type="button" onclick="editRow(this)">Modifier</button>
                <button class="btn-action btn-delete" type="button" onclick="deleteRow(this)">Supprimer</button>
            </td>`;
        if (type === 'ae2-1') {
            const typeEncIdx = persisted.findIndex(f => f.name === 'type_encadrement');
            if (typeEncIdx >= 0 && row.cells[typeEncIdx]) {
                const rawVal = data.type_encadrement || (data.intitule_pfe ? 'pfe' : 'cours_td_tp');
                const label = rawVal === 'pfe' ? 'Encadrement de PFE' : 'Cours, TD et/ou TP';
                row.cells[typeEncIdx].innerHTML = `<input type="hidden" name="type_encadrement" value="${esc(rawVal)}"><span>${esc(label)}</span>`;
            }
        }
        if (type === 'ae2-2') {
            const typeEncIdx = persisted.findIndex(f => f.name === 'type_encadrement');
            if (typeEncIdx >= 0 && row.cells[typeEncIdx]) {
                const rawVal = data.type_encadrement || (data.intitule_memoire ? 'memoire' : 'cours');
                const label = rawVal === 'memoire' ? 'Encadrement de mémoire' : 'Cours';
                row.cells[typeEncIdx].innerHTML = `<input type="hidden" name="type_encadrement" value="${esc(rawVal)}"><span>${esc(label)}</span>`;
            }
        }
        row.setAttribute('data-requirements-json', JSON.stringify(meta));
        persisted.forEach((field, index) => {
            if (field.type === 'file') attachHidden(row, type, field, data[field.name], row.cells[index]);
        });
        closeModal();
    }

    function cellHtml(type, field, data, oldRow, index) {
        if (field.type === 'file') {
            const fileValue = data[field.name];
            if (!(fileValue instanceof File) && oldRow && oldRow.cells) {
                const existingCell = Array.from(oldRow.cells).find(cell =>
                    cell.querySelector('.file-link, .file-display')
                );
                if (existingCell) {
                    return `<td>${existingCell.innerHTML}</td>`;
                }
            }
            const label = fileValue instanceof File ? fileValue.name : 'Aucun fichier';
            return `<td><span class="file-display">${esc(label)}</span></td>`;
        }
        const value = data[field.name] || '';
        const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
        return `<td><input type="${inputType}" name="${esc(field.name)}" value="${esc(value)}" readonly></td>`;
    }

    window.__arFiles = window.__arFiles || {};

    function attachHidden(row, type, field, fileValue, cell) {
        if (!(fileValue instanceof File) || !cell) return;
        const rowId = row.getAttribute('data-row-id') || 'anon';
        window.__arFiles[rowId] = window.__arFiles[rowId] || {};
        window.__arFiles[rowId][field.name] = fileValue;
        const cls = fileClassFor(type, field);
        let hidden = row.querySelector(`.${cls}`);
        if (!hidden) {
            hidden = document.createElement('input');
            hidden.type = 'file';
            hidden.className = cls;
            hidden.style.display = 'none';
            hidden.accept = '.pdf';
            cell.appendChild(hidden);
        }
        const dt = new DataTransfer();
        dt.items.add(fileValue);
        hidden.files = dt.files;
        row._arFiles = row._arFiles || {};
        row._arFiles[field.name] = fileValue;
    }

    function enhancedEditRow(button) {
        const row = button.closest('tr');
        if (!row) return;
        enhancedOpenModal(currentModalTypeFromRow(row), { row, data: readRowData(row, currentModalTypeFromRow(row)) });
    }

    function validateCurrentStepBeforeSave() {
        const fileInputs = document.querySelectorAll('tr input[type="file"][class*="hidden-file"]');
        for (const input of fileInputs) {
            if (input.files && input.files[0] && input.files[0].size > MAX_FILE_SIZE) {
                alert('Un fichier dépasse la taille maximale autorisée de 1 Mo.');
                return false;
            }
        }
        return true;
    }

    window.openModal = enhancedOpenModal;
    window.addOrEditModalRow = enhancedAddOrEditModalRow;
    window.editRow = enhancedEditRow;
    window.deleteRow = deleteRow;
    window.validateCurrentStepBeforeSave = validateCurrentStepBeforeSave;

    function updateRequirementTableHeaders() {
        Object.keys({
            'ae1-1': 1, 'ae1-2': 1, 'ae1-3': 1, 'ae2-1': 1, 'ae2-2': 1, 'ae2-3': 1,
            'ae3-1': 1, 'ae3-2': 1, 'ae3-3': 1, 'ae3-4': 1, 'ae3-5': 1, 'ae3-6': 1, 'ae3-7': 1,
            'ar1-1': 1, 'ar1-2': 1, 'ar1-3': 1, 'ar1-4': 1,
            'ar2-1': 1, 'ar2-2': 1, 'ar3-1': 1, 'ar3-2': 1, 'ar3-3': 1, 'ar3-4': 1,
            'ar4-1': 1, 'ar4-2': 1, 'ar4-3': 1
        }).forEach(type => {
            const table = document.getElementById(`table-${type}`);
            const headerRow = table?.querySelector('thead tr');
            if (!headerRow) return;
            const addButton = headerRow.querySelector('.add-row-btn');
            headerRow.innerHTML = schemaFor(type).fields
                .map(field => `<th>${esc(field.label)}</th>`)
                .join('') + `<th class="th-add-button-flex"></th>`;
            if (addButton) headerRow.lastElementChild.appendChild(addButton);
        });
    }

    window.schemaFor = schemaFor;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateRequirementTableHeaders);
    } else {
        updateRequirementTableHeaders();
    }
})();
