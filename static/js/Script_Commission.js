// ========================================
// GLOBAL STATE MANAGEMENT
// ========================================
let currentDossierId = null;
let currentDossierData = null;
let currentDossierStatut = null;

// Wizard state
let currentStep = 1;
const totalSteps = 3;
const evaluationState = {
    step1: {},
    step2: {},
    step3: {}
};

// Helper to render standard Evaluation Inputs (Comment only) - Mode Saisie Libre
function renderEvalInput(sectionCode, isEditable) {
    const disabledAttr = isEditable ? '' : 'disabled';

    return `
    <div class="eval-inputs" style="background:#f8f4ff; border:1px solid #e0d6f2; border-radius:10px; padding:16px; margin-bottom:10px;">
        <div class="row align-items-center">
            <div class="col-md-12">
                <label class="form-label fw-bold small text-uppercase" style="color:#4a3f6b; font-size:12px;">Commentaire de la commission</label>
                <textarea class="form-control section-comment" 
                          data-section="${sectionCode}" rows="2" maxlength="3000"
                          placeholder="${isEditable ? 'Saisir une observation pour cette section...' : 'Aucun commentaire'}"
                          style="border:2px solid #e0d6f2; border-radius:8px; background:#fff; resize:vertical;"
                          ${disabledAttr}
                          onfocus="this.style.borderColor='#bda4eb'; this.style.boxShadow='0 0 0 3px rgba(189,164,235,0.15)'"
                          onblur="this.style.borderColor='#e0d6f2'; this.style.boxShadow='none'"></textarea>
                <div class="comment-counter text-muted small text-end mt-1"></div>
            </div>
        </div>
    </div>
    `;
}

// ========================================
// EXTRACTED DATA HANDLING
// ========================================
// ========================================
// NAVIGATION FUNCTIONS
// ========================================
function nextStep() {
    if (currentStep < totalSteps) {
        saveCurrentStepData();
        currentStep++;
        renderCurrentStep();
        updateNavigation();
    }
}

function previousStep() {
    if (currentStep > 1) {
        saveCurrentStepData();
        currentStep--;
        renderCurrentStep();
        updateNavigation();
    }
}

function updateNavigation() {
    const btnPrev = document.getElementById('btnPrevious');
    const btnNext = document.getElementById('btnNext');
    const btnSubmit = document.getElementById('btnSubmit');
    const stepNum = document.getElementById('currentStepNum');

    // Bouton Précédent
    if (btnPrev) {
        btnPrev.disabled = (currentStep === 1);
        btnPrev.style.opacity = (currentStep === 1) ? '0.5' : '1';
    }

    // Bouton Suivant / Soumettre
    if (currentStep === totalSteps) {
        if (btnNext) btnNext.style.display = 'none';
        if (btnSubmit) btnSubmit.style.display = 'inline-flex';
    } else {
        if (btnNext) btnNext.style.display = 'inline-flex';
        if (btnSubmit) btnSubmit.style.display = 'none';
    }

    // Indicateur d'étape (texte seulement)
    if (stepNum) stepNum.textContent = currentStep;

    // Step progress dots
    updateStepProgress(currentStep);
}

function updateStepProgress(step) {
    const dots = document.querySelectorAll('.step-dot');
    const lines = document.querySelectorAll('.step-line');
    dots.forEach((dot, i) => {
        const s = i + 1;
        dot.classList.remove('active', 'completed');
        if (s === step) {
            dot.classList.add('active');
        } else if (s < step) {
            dot.classList.add('completed');
        }
    });
    lines.forEach((line, i) => {
        line.classList.remove('active', 'completed');
        if (i + 1 < step) {
            line.classList.add('completed');
        } else if (i + 1 === step) {
            line.classList.add('active');
        }
    });
}


function renderCurrentStep() {
    const modalBody = document.getElementById('modalBody');
    if (!modalBody || !currentDossierData) return;

    let html = '';
    switch (currentStep) {
        case 1:
            html = renderStep1(currentDossierData, currentDossierStatut);
            break;
        case 2:
            html = renderStep2(currentDossierData, currentDossierStatut);
            break;
        case 3:
            html = renderStep3(currentDossierData, currentDossierStatut);
            break;
    }

    modalBody.innerHTML = html;

    // Restaurer les données de l'étape actuelle
    restoreStepData(currentStep);

    // Attacher les écouteurs d'événements
    attachScoreListeners();
}

function saveCurrentStepData() {
    const comments = document.querySelectorAll('.section-comment');

    comments.forEach(input => {
        const section = input.dataset.section;
        if (!evaluationState[`step${currentStep}`][section]) {
            evaluationState[`step${currentStep}`][section] = {};
        }
        evaluationState[`step${currentStep}`][section].commentaire = input.value;
    });

    // Sauvegarder le commentaire global (étape 3)
    if (currentStep === 3) {
        const globalComment = document.getElementById('commentaireGlobal');
        if (globalComment) {
            evaluationState.step3.commentaireGlobal = globalComment.value;
        }
        const noteInput = document.getElementById('noteGlobale');
        if (noteInput) {
            evaluationState.step3.noteGlobale = noteInput.value;
        }
    }
}

function restoreStepData(step) {
    const stepData = evaluationState[`step${step}`];
    if (!stepData) return;

    Object.keys(stepData).forEach(section => {
        if (section === 'commentaireGlobal') {
            const globalComment = document.getElementById('commentaireGlobal');
            if (globalComment) globalComment.value = stepData[section] || '';
            return;
        }
        if (section === 'noteGlobale') {
            const noteInput = document.getElementById('noteGlobale');
            if (noteInput) noteInput.value = stepData[section] ?? '';
            return;
        }

        const commentInput = document.querySelector(`[data-section="${section}"].section-comment`);

        if (commentInput && stepData[section].commentaire !== undefined) {
            commentInput.value = stepData[section].commentaire;
        }
    });
}

function attachScoreListeners() {
    const commentInputs = document.querySelectorAll('.section-comment');
    commentInputs.forEach(input => {
        const counter = input.parentNode.querySelector('.comment-counter');
        if (counter) {
            const updateCount = () => {
                counter.textContent = '';
                if (input.value.length >= 3000) {
                    counter.classList.add('text-danger');
                    counter.classList.remove('text-muted');
                } else {
                    counter.classList.remove('text-danger');
                    counter.classList.add('text-muted');
                }
            };
            input.addEventListener('input', updateCount);
            updateCount();
        }
    });
}

// ========================================
// MODAL INITIALIZATION
// ========================================
function openDossierModal(dossierId, statut) {
    currentDossierId = dossierId;
    currentDossierStatut = statut;

    // Reset wizard state
    currentStep = 1;
    evaluationState.step1 = {};
    evaluationState.step2 = {};
    evaluationState.step3 = {};

    const modal = document.getElementById('dossierModal');

    // Initialize wizard modal structure
    initializeWizardModal(statut);

    modal.style.display = 'flex';

    const modalBody = document.getElementById('modalBody');
    if (modalBody) {
        modalBody.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement du dossier...</p></div>';
    }

    fetch(`/api/dossier-complet/${dossierId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentDossierData = data;
                // Pre-load saved evaluations if not in submission mode
                if (statut !== 'soumis') {
                    loadSavedEvaluations(data);
                }
                renderCurrentStep();
                updateNavigation();
            } else {
                modalBody.innerHTML = `<div class="alert alert-danger">${data.message}</div>`;
            }
        })
        .catch(err => {
            console.error(err);
            modalBody.innerHTML = '<div class="alert alert-danger">Erreur de chargement des données.</div>';
        });
}

function initializeWizardModal(statut) {
    const modal = document.getElementById('dossierModal');
    const modalContent = modal.querySelector('.modal-content');

    // Only modify if in evaluation mode
    // if (statut !== 'soumis') {
    //    // Keep old structure for read-only mode
    //    return;
    // }

    // Update modal structure for wizard - SIMPLE STYLE
    const isEditable = (statut === 'soumis');

    modalContent.innerHTML = `
        <div class="modal-header">
            <div class="modal-header-left">
                <h3 id="modalTitle">${isEditable ? 'Évaluation du dossier' : 'Consulter Dossier'}</h3>
            </div>
            <button class="close-modal" onclick="closeModal()">&times;</button>
        </div>
        ${isEditable ? `
        <div class="step-progress">
            <div class="step-dot active" data-step="1">
                <div class="step-dot-circle">1</div>
                <span class="step-dot-label">Informations personnelles</span>
            </div>
            <div class="step-line"></div>
            <div class="step-dot" data-step="2">
                <div class="step-dot-circle">2</div>
                <span class="step-dot-label">AE - Activités d'Enseignement</span>
            </div>
            <div class="step-line"></div>
            <div class="step-dot" data-step="3">
                <div class="step-dot-circle">3</div>
                <span class="step-dot-label">AR - Activités de Recherche</span>
            </div>
        </div>
        ` : ''}
        <div id="modalBody" class="wizard-body">
            <!-- Contenu chargé dynamiquement -->
        </div>
        ${isEditable ? `
        <div class="wizard-footer">
            <button id="btnPrevious" class="btn-coord btn-coord-secondary" onclick="previousStep()">
                <i class="fas fa-arrow-left"></i> Précédent
            </button>
            <div class="step-info">
                Étape <span id="currentStepNum">1</span> / 3
            </div>
            <div class="wizard-footer-right">
                <button id="btnNext" class="btn-wizard-next" onclick="nextStep()">
                    Suivant <i class="fas fa-arrow-right"></i>
                </button>
                <button id="btnSubmit" class="btn-coord btn-coord-success" onclick="submitEvaluation()" style="display:none;">
                    <i class="fas fa-check"></i> Soumettre
                </button>
            </div>
        </div>
        ` : `
        <div class="wizard-footer">
            <button id="btnPrevious" class="btn-coord btn-coord-secondary" onclick="previousStep()">
                <i class="fas fa-arrow-left"></i> Précédent
            </button>
            <div class="step-info">
                Consultation - Étape <span id="currentStepNum">1</span> / 3
            </div>
            <button id="btnNext" class="btn-wizard-next" onclick="nextStep()">
                Suivant <i class="fas fa-arrow-right"></i>
            </button>
        </div>
        `}
    `;
}

function loadSavedEvaluations(data) {
    const details = data.evaluations_details || {};
    const d = data.dossier || {};

    // Helper to set state
    const setState = (step, section, key, value) => {
        if (!evaluationState[`step${step}`][section]) evaluationState[`step${step}`][section] = {};
        evaluationState[`step${step}`][section][key] = value;
    };

    // Step 2 Sections
    ['ae1', 'ae2', 'ae3'].forEach(sec => {
        if (details[sec]) {
            setState(2, sec, 'commentaire', details[sec].commentaire);
        }
    });

    // Step 3 Sections
    ['ar1', 'ar2', 'ar3', 'ar4'].forEach(sec => {
        if (details[sec]) {
            setState(3, sec, 'commentaire', details[sec].commentaire);
        }
    });

    // Global Comment
    evaluationState.step3.commentaireGlobal = d.commentaire;
    evaluationState.step3.noteGlobale = d.note ?? '';

    // Totals (Optional, will be recalculated or can be set if saved separately)
    // For now we let them recalculate based on inputs
}

// ========================================
// HELPER FUNCTIONS
// ========================================
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
}

// Render a standard table



// ========================================
// STEP 1: ÉVALUATION PÉDAGOGIQUE
// ========================================
function renderStep1(data, statut) {
    const d = data.dossier;
    const isEditable = (statut === 'soumis');

    return `
        <div class="wizard-step" data-step="1">
            
            ${renderSignedAnnexes(data)}

            <!-- Informations Personnelles -->
            <div style="max-width:500px; margin:0 auto 24px;">
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:0; box-shadow:0 8px 30px rgba(59,130,246,.08), 0 1px 3px rgba(0,0,0,.04); overflow:hidden;">
                    <div style="height:5px; background:linear-gradient(90deg,#2563eb,#7c3aed,#2563eb);"></div>
                    <div style="padding:24px 28px 20px; background:radial-gradient(ellipse at 50% 0%, rgba(59,130,246,.03) 0%, transparent 70%);">
                        <div style="display:flex; flex-direction:column; align-items:center; text-align:center; margin-bottom:16px;">
                            <div style="position:relative; margin-bottom:10px;">
                                ${d.photo
                                    ? `<img src="/static/${d.photo}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #fff; box-shadow:0 4px 16px rgba(59,130,246,.15);">`
                                    : `<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#eff6ff,#dbeafe);display:flex;align-items:center;justify-content:center;border:3px solid #fff; box-shadow:0 4px 16px rgba(59,130,246,.15);"><i class="fas fa-user" style="font-size:1.4rem;color:#3b82f6;"></i></div>`
                                }
                            </div>
                            <h4 style="margin:0; font-size:15px; font-weight:700; color:#0f172a;">Informations personnelles</h4>
                        </div>
                        <div style="background:#f8fafc; border-radius:10px; padding:14px 18px;">
                            <div style="display:grid; grid-template-columns:auto 1fr; gap:6px 16px;">
                                <span style="font-size:11px; font-weight:600; color:#64748b;">Nom</span>
                                <span style="font-size:13px; font-weight:500; color:#0f172a;">${d.nom}</span>
                                <span style="font-size:11px; font-weight:600; color:#64748b;">Prénom</span>
                                <span style="font-size:13px; font-weight:500; color:#0f172a;">${d.prenom}</span>
                                <span style="font-size:11px; font-weight:600; color:#64748b;">Né(e) le</span>
                                <span style="font-size:13px; font-weight:500; color:#0f172a;">${formatDate(d.date_naissance)}</span>
                                <span style="font-size:11px; font-weight:600; color:#64748b;">Grade</span>
                                <span style="font-size:13px; font-weight:500; color:#0f172a;">${d.grade || '—'}</span>
                                <span style="font-size:11px; font-weight:600; color:#64748b;">Département</span>
                                <span style="font-size:13px; font-weight:500; color:#0f172a;">${d.departement || '—'}</span>
                                <span style="font-size:11px; font-weight:600; color:#64748b;">Période d'avancement</span>
                                <span style="font-size:13px; font-weight:500; color:#0f172a;">${d.date_debut_avancement && d.date_fin_avancement ? 'du ' + d.date_debut_avancement + ' au ' + d.date_fin_avancement : '—'}</span>
                                <span style="font-size:11px; font-weight:600; color:#64748b;">Établissement</span>
                                <span style="font-size:13px; font-weight:500; color:#0f172a;">${d.etablissement || '—'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderSignedAnnexes(data) {
    const d = data.dossier || {};
    const annexes = [
        {num: 'I', label: 'AE - Activités d\'Enseignement', path: d.annexe_i_signe},
        {num: 'II', label: 'AR - Activités de Recherche', path: d.annexe_ii_signe},
    ];
    const hasSigned = annexes.some(a => a.path);
    if (!hasSigned) {
        return '';
    }
    return `
        <div class="annexes-card mb-4">
            <div class="annexes-header">
                <i class="fas fa-signature"></i> Annexes signées
            </div>
            <div class="annexes-body">
                ${annexes.filter(a => a.path).map(a => `
                    <a href="/static/${a.path}" target="_blank" class="annexe-link">
                        <div class="annexe-icon"><i class="fas fa-file-pdf"></i></div>
                        <div class="annexe-info">
                            <span class="annexe-title">Annexe ${a.num}</span>
                            <span class="annexe-subtitle">${a.label}</span>
                        </div>
                        
                    </a>
                `).join('')}
            </div>
        </div>
    `;
}


















function escHtml(s) {
    if (!s) return '-';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML || '-';
}

function renderFileCell(val) {
    if (!val) return '-';
    const files = val.split(';');
    return files.map(f => {
        return `<a href="/static/${f.trim()}" target="_blank" class="file-link"><i class="fas fa-file-pdf text-danger"></i> Voir Fichier</a>`;
    }).join('<br>');
}

// Combines a section title with renderDataTable (no duplicate headers)
function renderDataSection(title, columns, rows) {
    if (!rows || rows.length === 0) {
        return `
        <div class="sub-tbl-wrap">
            <div class="sub-lbl">${title}</div>
            <p class="text-muted fst-italic small" style="padding:8px 16px;">Aucune donnée.</p>
        </div>`;
    }
    const header = columns.map(c => `<th>${c.label}</th>`).join('');
    const body = rows.map(row => {
        const cells = columns.map(c => {
            const val = row[c.key] || '';
            if (c.render) return `<td>${c.render(val, row)}</td>`;
            if (c.type === 'file') return `<td>${renderFileCell(val)}</td>`;
            if (c.type === 'link') return `<td>${val ? `<a href="${val}" target="_blank" class="text-primary"><i class="fas fa-link"></i> Lien</a>` : '—'}</td>`;
            return `<td>${escHtml(val)}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');
    return `
        <div class="sub-tbl-wrap">
            <div class="sub-lbl">${title}</div>
            <div class="tbl-wrap">
                <table class="tbl-futur">
                    <thead>
                        <tr>${header}</tr>
                    </thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
        </div>`;
}

function renderStep2(data, statut) {
    const aeData = data.ae_data || {};
    const isEditable = (statut === 'soumis');

    // Column definitions for each AE section
    const ae1_1_cols = [
        {key: 'ae1_1_titres', label: 'Titre de l\'ouvrage'},
        {key: 'ae1_1_auteurs', label: 'Auteur(s)'},
        {key: 'ae1_1_niveaux', label: 'Niveau académique'},
        {key: 'ae1_1_editeurs', label: 'Éditeur'},
        {key: 'ae1_1_annees', label: 'Année de publication'},
        {key: 'ae1_1_numero_depot', label: 'Dépôt légal / ISSN / ISBN'},
        {key: 'ae1_1_justificatifs', label: 'Copie de l\'ouvrage incluant la page de garde', type: 'file'},
    ];
    const ae1_2_cols = [
        {key: 'ae1_2_auteurs', label: 'Auteur(s)'},
        {key: 'ae1_2_departements', label: 'Département(s) d\'attache'},
        {key: 'ae1_2_annees', label: 'Année d\'élaboration'},
        {key: 'ae1_2_filieres', label: 'Filière'},
        {key: 'ae1_2_semestres', label: 'Semestre'},
        {key: 'ae1_2_types', label: 'Type de polycopié'},
        {key: 'ae1_2_fichiers', label: 'Document complet avec page de garde tamponnée', type: 'file'},
    ];
    const ae1_3_cols = [
        {key: 'ae1_3_objectifs', label: 'Objectifs du support'},
        {key: 'ae1_3_auteurs', label: 'Auteur(s)'},
        {key: 'ae1_3_filieres', label: 'Filière'},
        {key: 'ae1_3_niveaux', label: 'Niveau académique'},
        {key: 'ae1_3_annees', label: 'Année universitaire'},
        {key: 'ae1_3_liens', label: 'Lien du site web', type: 'link'},
        {key: 'ae1_3_support_ntic', label: 'Support NTIC'},
        {key: 'ae1_3_types', label: 'Type de support'},
        {key: 'ae1_3_fichiers', label: 'Justificatif', type: 'file'},
    ];
    const ae2_1_cols = [
        {key: 'ae2_1_annees_univ', label: 'Année universitaire'},
        {key: 'ae2_1_types', label: 'Type de la Licence'},
        {key: 'ae2_1_filieres', label: 'Intitulé de la Licence'},
        {key: 'ae2_1_intitules', label: 'Type'},
        {key: 'ae2_1_intitule_module', label: 'Intitulé du module'},
        {key: 'ae2_1_details', label: 'Intitulé du PFE'},
        {key: 'ae2_1_modules', label: 'Module ou élément de module'},
        {key: 'ae2_1_departements', label: 'Département d\'attache'},
        {key: 'ae2_1_coenseignants', label: 'Co-encadrant(s)'},
        {key: 'ae2_1_type_encadrement', label: 'Type encadrante', render: v => v === 'pfe' ? 'Encadrement de PFE' : 'Cours, TD et/ou TP'},
        {key: 'ae2_1_fichiers', label: 'Copie de la page de garde cachetée', type: 'file'},
    ];
    const ae2_2_cols = [
        {key: 'ae2_2_annees_univ', label: 'Année universitaire'},
        {key: 'ae2_2_types', label: 'Type de Master'},
        {key: 'ae2_2_filieres', label: 'Intitulé du Master'},
        {key: 'ae2_2_intitules', label: "l'intitulé du module"},
        {key: 'ae2_2_nom_etudiants', label: 'Intitulé du mémoire'},
        {key: 'ae2_2_coordonnateurs', label: 'Coordonnateur de Master'},
        {key: 'ae2_2_coenseignants', label: 'Co-encadrant(s)'},
        {key: 'ae2_2_departements', label: "Département d'attache"},
        {key: 'ae2_2_type_encadrement', label: "Type d'activité", render: v => v === 'memoire' ? 'Encadrement de mémoire' : 'Cours'},
        {key: 'ae2_2_fichiers', label: 'Copie de la page de garde cachetée', type: 'file'},
    ];
    const ae2_3_cols = [
        {key: 'ae2_3_types', label: 'Type de formation dispensée'},
        {key: 'ae2_3_nom_etudiants', label: 'Établissement'},
        {key: 'ae2_3_dates', label: 'Date'},
        {key: 'ae2_3_lieux', label: 'Lieu'},
        {key: 'ae2_3_durees', label: 'Période de l\'ordre de mission'},
    ];

    const ae3_col_config = {
        1: [{key: 'ae3_1_natures', label: 'Nature de la responsabilité'}, {key: 'ae3_1_periodes', label: 'Période'}, {key: 'ae3_1_mandats', label: 'Nombre de mandats'}, {key: 'ae3_1_fichiers', label: 'Attestation du Décanat ou attestation du Chef de département', type: 'file'}],
        2: [{key: 'ae3_2_titres', label: 'Intitulé de la filière'}, {key: 'ae3_2_accreditations', label: 'Nombre d\'accréditations'}, {key: 'ae3_2_periodes', label: 'Période'}, {key: 'ae3_2_fichiers', label: 'Attestation du Chef de département', type: 'file'}],
        3: [{key: 'ae3_3_titres', label: 'Intitulé du module'}, {key: 'ae3_3_filieres', label: 'Filière'}, {key: 'ae3_3_periodes', label: 'Période'}, {key: 'ae3_3_fichiers', label: 'Attestation du chef de département / responsable du master', type: 'file'}],
        4: [{key: 'ae3_4_periodes', label: 'Période du mandat'}, {key: 'ae3_4_fichiers', label: 'Attestation du Décanat', type: 'file'}],
        5: [{key: 'ae3_5_periodes', label: 'Période du mandat'}, {key: 'ae3_5_fichiers', label: 'Attestation de la Présidence de l\'Université', type: 'file'}],
        6: [{key: 'ae3_6_periodes', label: 'Période du mandat'}, {key: 'ae3_6_fichiers', label: 'Attestation du Décanat', type: 'file'}],
        7: [{key: 'ae3_7_natures', label: 'Nature de l\'activité effectuée'}, {key: 'ae3_7_dates', label: 'Date'}, {key: 'ae3_7_lieux', label: 'Lieu'}, {key: 'ae3_7_fichiers', label: 'Attestation officielle', type: 'file'}],
    };

    const ae3_labels = {
        1: 'AE3-1 : Chef de département / Membre collège',
        2: 'AE3-2 : Coordonnateur de filière',
        3: 'AE3-3 : Responsable de module',
        4: 'AE3-4 : Membre conseil Établissement',
        5: 'AE3-5 : Membre conseil Université',
        6: 'AE3-6 : Membre commission scientifique',
        7: 'AE 3-7 Membre de commission d\'expertise ou d\'évaluation pédagogique à l\'échelle nationale ou internationale',
    };

    return `
        <div class="wizard-step" data-step="2">
            <h4 class="step-title mb-4">
                <i class="fas fa-graduation-cap text-primary"></i>
                AE - Activités d'Enseignement
            </h4>

            <div class="eval-section mb-4">
                <h5 class="d-flex align-items-center mb-3">
                    <i class="fas fa-book me-2"></i> <span class="badge me-2" style="background:#1e293b;color:white;">AE1</span> : Production Pédagogique
                </h5>
                <div class="p-3">
                    ${renderDataSection('AE1-1 : Publications d\'ouvrages d\'enseignement (ISSN ou ISBN)', ae1_1_cols, aeData.ae1_1)}
                    ${renderDataSection('AE1-2 : Manuels ou polycopiés d\'enseignement', ae1_2_cols, aeData.ae1_2)}
                    ${renderDataSection('AE1-3 : Supports NTIC et Innovations pédagogiques', ae1_3_cols, aeData.ae1_3)}
                </div>
                ${renderEvalInput('ae1', isEditable)}
            </div>

            <div class="eval-section mb-4">
                <h5 class="d-flex align-items-center mb-3">
                    <i class="fas fa-user-graduate me-2"></i> <span class="badge me-2" style="background:#1e293b;color:white;">AE2</span> : Encadrement Pédagogique
                </h5>
                <div class="p-3">
                    ${renderDataSection('AE2-1 : Encadrement de cours, TD, et de PFE (cycle Licence)', ae2_1_cols, aeData.ae2_1)}
                    ${renderDataSection('AE 2-2 Encadrement de cours et mémoires de fin d\'étude (cycle Master)', ae2_2_cols, aeData.ae2_2)}
                    ${renderDataSection('AE 2-3 Encadrement d\'autres activités (sorties de terrain, animation de séminaires ou formations,…)', ae2_3_cols, aeData.ae2_3)}
                </div>
                ${renderEvalInput('ae2', isEditable)}
            </div>

            <div class="eval-section mb-4">
                <h5 class="d-flex align-items-center mb-3">
                    <i class="fas fa-briefcase me-2"></i> <span class="badge me-2" style="background:#1e293b;color:white;">AE3</span> : Responsabilités Pédagogiques
                </h5>
                <div class="p-3">
                    ${[1,2,3,4,5,6,7].map(i => renderDataSection(ae3_labels[i], ae3_col_config[i], aeData[`ae3_${i}`])).join('')}
                </div>
                ${renderEvalInput('ae3', isEditable)}
            </div>
        </div>
    `;
}



























// ========================================
// STEP 3: AR - ACTIVITÉS DE RECHERCHE
// ========================================
function renderStep3(data, statut) {
    const arData = data.ar_data || {};
    const isEditable = (statut === 'soumis');

    // Column definitions — keys match actual DB column names
    const ar1_1_cols = [
        {key: 'ar1_1_referenceComplete', label: 'Références de l\'article y compris le DOI'},
        {key: 'ar1_1_anneePublication', label: 'Année de publication'},
        {key: 'ar1_1_doctorantsCoAuteurs', label: 'Nom(s) de(s) doctorant(s) co-auteur(s)'},
        {key: 'ar1_1_lien', label: 'Lien de la publication de l\'article', type: 'link'},
        {key: 'ar1_1_cedList', label: 'Liste de(s) doctorant(s) co-auteur(s) fournie par le CED', type: 'file'},
    ];
    const ar1_2_cols = [
        {key: 'ar1_2_reference', label: 'Référence du proceeding ou titre de la communication'},
        {key: 'ar1_2_natureTravail', label: 'Nature de l\'activité'},
        {key: 'ar1_2_nomEvenement', label: 'Titre de la manifestation'},
        {key: 'ar1_2_lieu', label: 'Lieu'},
        {key: 'ar1_2_dateEvenement', label: 'Date'},
        {key: 'ar1_2_lienSite', label: 'Lien du site web de la manifestation', type: 'link'},
        {key: 'ar1_2_attestation', label: 'Attestation de participation', type: 'file'},
        {key: 'ar1_2_premiere_page', label: 'Copie de la 1ère page de la publication intégrale ou de l\'abstract', type: 'file'},
    ];
    const ar1_3_cols = [
        {key: 'ar1_3_typeOuvrage', label: 'Type'},
        {key: 'ar1_3_titreOuvrage', label: 'Titre'},
        {key: 'ar1_3_auteurs', label: 'Auteurs'},
        {key: 'ar1_3_maisonEditions', label: 'Maison d’éditions'},
        {key: 'ar1_3_annee', label: 'Année d\'édition'},
        {key: 'ar1_3_issn', label: 'Référence ISSN ou ISBN'},
        {key: 'ar1_3_page_garde', label: 'Copie de l\'ouvrage incluant la page de garde', type: 'file'},
    ];
    const ar1_4_cols = [
        {key: 'ar1_4_referenceComplete', label: 'Références de l\'article y compris le lien web'},
        {key: 'ar1_4_anneePublication', label: 'Année de publication'},
        {key: 'ar1_4_doctorantsCoAuteurs', label: 'Nom(s) de(s) doctorant(s) co-auteur(s)'},
        {key: 'ar1_4_publication_url', label: 'Auteur — Titre — Journal — Année'},
        {key: 'ar1_4_lien', label: 'Copie de la 1ère page de l\'article', type: 'file'},
        {key: 'ar1_4_cedList', label: 'Liste de(s) doctorant(s) co-auteur(s) fournie par le CED', type: 'file'},
    ];
    const ar2_1_cols = [
        {key: 'ar2_1_nomAuteur', label: 'Nom de l\'auteur'},
        {key: 'ar2_1_titreThese', label: 'Titre de la thèse'},
        {key: 'ar2_1_institution', label: 'Nom de l\'établissement'},
        {key: 'ar2_1_dateSoutenance', label: 'Date de soutenance'},
        {key: 'ar2_1_type', label: 'Direction ou codirection'},
        {key: 'ar2_1_these', label: 'Fichier thèse', type: 'file'},
    ];
    const ar2_2_cols = [
        {key: 'ar2_2_nomAuteur', label: 'Nom de l\'auteur'},
        {key: 'ar2_2_typeTravail', label: 'Type de thèse'},
        {key: 'ar2_2_titre', label: 'Intitulé de la thèse'},
        {key: 'ar2_2_institution', label: 'Nom de l\'établissement'},
        {key: 'ar2_2_dateSoutenance', label: 'Date de soutenance'},
        {key: 'ar2_2_role', label: 'Rôle'},
        {key: 'ar2_2_fichiers', label: 'Invitation', type: 'file'},
        {key: 'ar2_2_page_garde', label: 'Page de garde', type: 'file'},
    ];

    const ar3_1_cols = [
        {key: 'ar3_1_nomStructure', label: 'Appellation de la structure de recherche'},
        {key: 'ar3_1_adresseStructure', label: 'Adresse de la structure de recherche'},
        {key: 'ar3_1_periode', label: 'Période du mandat'},
        {key: 'ar3_1_fichiers', label: 'Attestation', type: 'file'},
    ];
    const ar3_2_cols = [
        {key: 'ar3_2_nomEquipe', label: 'Appellation de l\'équipe'},
        {key: 'ar3_2_adresseEquipe', label: 'Adresse de l\'équipe'},
        {key: 'ar3_2_structure_parente', label: 'Structure de recherche dont elle dépend'},
        {key: 'ar3_2_periode', label: 'Période du mandat'},
        {key: 'ar3_2_fichiers', label: 'Attestation', type: 'file'},
    ];
    const ar3_3_cols = [
        {key: 'ar3_3_role', label: 'Rôle'},
        {key: 'ar3_3_nomResponsable', label: 'Nom du responsable'},
        {key: 'ar3_3_nature', label: 'Nature du projet'},
        {key: 'ar3_3_titre', label: 'Titre du projet'},
        {key: 'ar3_3_montant', label: 'Montant global alloué au projet'},
        {key: 'ar3_3_duree', label: 'Période'},
        {key: 'ar3_3_partenaire', label: 'Organisme partenaire'},
        {key: 'ar3_3_fichiers', label: 'Contrat', type: 'file'},
        {key: 'ar3_3_attestation_responsable', label: 'Attestation', type: 'file'},
    ];
    const ar3_4_cols = [
        {key: 'ar3_4_typeActivite', label: 'Type d\'expertise ou d\'évaluation'},
        {key: 'ar3_4_objet', label: 'Objet de l\'activité'},
        {key: 'ar3_4_date', label: 'Date de réalisation'},
        {key: 'ar3_4_fichiers', label: 'Attestation', type: 'file'},
    ];
    const ar4_1_cols = [
        {key: 'ar4_1_titre', label: 'Titre de la manifestation ou animation'},
        {key: 'ar4_1_lieu', label: 'Lieu'},
        {key: 'ar4_1_date', label: 'Date'},
        {key: 'ar4_1_role', label: 'Rôle'},
        {key: 'ar4_1_fichiers', label: 'Document', type: 'file'},
    ];
    const ar4_2_cols = [
        {key: 'ar4_2_nature', label: 'Nature de l\'activité'},
        {key: 'ar4_2_organisme', label: 'Organisme'},
        {key: 'ar4_2_lieu', label: 'Lieu'},
        {key: 'ar4_2_date', label: 'Date'},
        {key: 'ar4_2_fichiers', label: 'Document', type: 'file'},
    ];
    const ar4_3_cols = [
        {key: 'ar4_3_type_activite', label: 'Type d\'activité'},
        {key: 'ar4_3_nature_activite', label: 'Nature de l’activité'},
        {key: 'ar4_3_date', label: 'Date'},
        {key: 'ar4_3_fichiers', label: 'Document', type: 'file'},
    ];

    return `
        <div class="wizard-step" data-step="3">
            <h4 class="step-title mb-4">
                <i class="fas fa-flask text-primary"></i>
                AR - Activités de Recherche
            </h4>

            <div class="eval-section mb-4">
                <h5 class="d-flex align-items-center mb-3">
                    <i class="fas fa-flask me-2"></i> <span class="badge me-2" style="background:#1e293b;color:white;">AR1</span> : Production scientifique
                </h5>
                <div class="p-3">
                    ${renderDataSection('AR 1-1 Publications scientifiques dans des revues spécialisées indexées (Scopus, Webof Knowledge)', ar1_1_cols, arData.ar1_1)}
                    ${renderDataSection('AR 1-2 Publications dans les actes de manifestations scientifiques avec comité de lecture', ar1_2_cols, arData.ar1_2)}
                    ${renderDataSection('AR 1-3 Ouvrages de recherche édités (livres ou chapitres de livres)', ar1_3_cols, arData.ar1_3)}
                    ${renderDataSection('AR 1-4 Publications scientifiques dans des revues spécialisées nationales ou internationales avec comité de lecture', ar1_4_cols, arData.ar1_4)}
                </div>
                ${renderEvalInput('ar1', isEditable)}
            </div>

            <div class="eval-section mb-4">
                <h5 class="d-flex align-items-center mb-3">
                    <i class="fas fa-user-tie me-2"></i> <span class="badge me-2" style="background:#1e293b;color:white;">AR2</span> : Encadrement scientifique
                </h5>
                <div class="p-3">
                    ${renderDataSection('AR2-1 : Direction ou codirection de thèses de doctorat soutenues', ar2_1_cols, arData.ar2_1)}
                    ${renderDataSection('AR2-2 : Rapporteur et membre de jury de thèses ou d\'habilitations', ar2_2_cols, arData.ar2_2)}
                </div>
                ${renderEvalInput('ar2', isEditable)}
            </div>

            <div class="eval-section mb-4">
                <h5 class="d-flex align-items-center mb-3">
                    <i class="fas fa-sitemap me-2"></i> <span class="badge me-2" style="background:#1e293b;color:white;">AR3</span> : Responsabilités scientifiques
                </h5>
                <div class="p-3">
                    ${renderDataSection('AR 3-1 Directeur de structure de recherche (laboratoire, pôle de compétence, centre thématique de recherche,…)', ar3_1_cols, arData.ar3_1)}
                    ${renderDataSection('AR3-2 : Responsable d\'équipe de recherche', ar3_2_cols, arData.ar3_2)}
                    ${renderDataSection('AR 3-3 Responsable ou participant dans des projets ou contrats de recherche financés', ar3_3_cols, arData.ar3_3)}
                    ${renderDataSection('AR 3-4 Activités d\'expertise et d\'évaluation scientifique à l\'échelle nationale ou internationale (CNACES, CNRST, reviewer, editorial board, editor-in-chief,…)', ar3_4_cols, arData.ar3_4)}
                </div>
                ${renderEvalInput('ar3', isEditable)}
            </div>

            <div class="eval-section mb-4">
                <h5 class="d-flex align-items-center mb-3">
                    <i class="fas fa-globe me-2"></i> <span class="badge me-2" style="background:#1e293b;color:white;">AR4</span> : Ouverture et valorisation
                </h5>
                <div class="p-3">
                    ${renderDataSection('AR 4-1 Animation de structures d\'interaction avec le milieu socio-économique et organisation de manifestations scientifiques (séminaires, colloques, congrès, forums,…)', ar4_1_cols, arData.ar4_1)}
                    ${renderDataSection('AR 4-2 Expertise et valorisation d\'actions et de travaux au profit du milieu socio-économique (organisations non gouvernementales, secteur privé, organismes internationaux, secteur public)', ar4_2_cols, arData.ar4_2)}
                    ${renderDataSection('AR 4-3 Travaux de recherche et innovations (Dépôt de brevets au profit de l\'établissement, conception de prototypes, incubation de projets de recherche et de développement, prix,…)', ar4_3_cols, arData.ar4_3)}
                </div>
                ${renderEvalInput('ar4', isEditable)}

            </div>

            <div class="eval-inputs" style="background:#f8f4ff; border:1px solid #e0d6f2; border-radius:10px; padding:16px; margin-top:8px;">
                <label class="form-label fw-bold" style="color:#4a3f6b; font-size:13px;">Note générale</label>
                <div style="display:flex; align-items:center; gap:8px; max-width:180px;">
                    <input type="number" id="noteGlobale" min="0" max="100" step="0.01"
                        ${isEditable ? '' : 'disabled'}
                        placeholder="0"
                        style="width:120px; padding:10px 12px; border:2px solid #e0d6f2; border-radius:8px; font-weight:700;">
                    <span style="font-weight:700; color:#64748b;">/ 100</span>
                </div>
            </div>
        </div>
    `;
}


function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
}

function closeModal() {
    document.getElementById('dossierModal').style.display = 'none';
}

function submitEvaluation() {
    // Save current step data first
    saveCurrentStepData();

    // Get global comment from step 3
    const commentaireGlobal = document.getElementById('commentaireGlobal')?.value.trim() || '';
    const noteValue = document.getElementById('noteGlobale')?.value;
    const noteGlobale = noteValue === undefined || noteValue === '' ? null : Number(noteValue);

    if (noteGlobale === null || Number.isNaN(noteGlobale) || noteGlobale < 0 || noteGlobale > 100) {
        showPopup('warning', 'Note générale', 'Veuillez saisir une note générale entre 0 et 100.');
        document.getElementById('noteGlobale')?.focus();
        return;
    }

    // Collect all details from all 3 steps
    const details = {};

    // Merge data from all steps
    [evaluationState.step1, evaluationState.step2, evaluationState.step3].forEach(stepData => {
        Object.keys(stepData).forEach(section => {
            if (section !== 'commentaireGlobal' && section !== 'noteGlobale') {
                details[section] = stepData[section];
            }
        });
    });

    // Validation: Check if at least some sections have comments
    const filledSections = Object.keys(details).filter(key => details[key].commentaire !== undefined && details[key].commentaire !== '');
    if (filledSections.length === 0) {
        showPopup('warning', 'Validation', 'Veuillez remplir au moins une section d\'évaluation.');
        return;
    }

    // Validation: comments do not exceed 3000 chars
    const commentInputs = document.querySelectorAll('.section-comment');
    for (const input of commentInputs) {
        if (input.value.length > 3000) {
            showPopup('warning', 'Commentaire trop long', 'Le commentaire ne peut pas dépasser 3000 caractères.');
            input.focus();
            return;
        }
    }
    if (commentaireGlobal.length > 3000) {
        showPopup('warning', 'Commentaire trop long', 'Le commentaire global ne peut pas dépasser 3000 caractères.');
        document.getElementById('commentaireGlobal')?.focus();
        return;
    }

    const btn = document.getElementById('btnSubmit');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';

    fetch(`/api/evaluer-dossier/${currentDossierId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            commentaire: commentaireGlobal,
            note: noteGlobale,
            details: details
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showPopup('success', 'Évaluation enregistrée', 'Évaluation enregistrée avec succès !');
                setTimeout(() => { location.reload(); }, 1800);
            } else {
                showPopup('error', 'Erreur', data.message || 'Échec de l\'enregistrement.');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        })
        .catch(err => {
            console.error(err);
            showPopup('error', 'Erreur réseau', 'Une erreur réseau est survenue.');
            btn.disabled = false;
            btn.innerHTML = originalText;
        });
}

// Fermer modal avec ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ========================================
// POPUP PERSONNALISÉE
// ========================================
function showPopup(type, title, message) {
    const existing = document.querySelector('.custom-popup-overlay');
    if (existing) existing.remove();

    const isSuccess = type === 'success';
    const iconColor = isSuccess ? '#10b981' : '#ef4444';
    const iconClass = isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle';
    const btnColor = isSuccess ? '#10b981' : '#ef4444';

    const overlay = document.createElement('div');
    overlay.className = 'custom-popup-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0; z-index:99999;
        background:rgba(15,23,42,.5); backdrop-filter:blur(4px);
        display:flex; align-items:center; justify-content:center;
        padding:20px;
    `;

    overlay.innerHTML = `
        <div style="
            background:#fff; border-radius:20px; padding:0;
            width:100%; max-width:400px;
            box-shadow:0 25px 60px rgba(0,0,0,.2);
            overflow:hidden; animation:popupIn .3s ease;
        ">
            <div style="padding:40px 32px 24px; text-align:center;">
                <div style="
                    width:64px; height:64px; border-radius:50%;
                    background:${isSuccess ? '#ecfdf5' : '#fef2f2'};
                    display:flex; align-items:center; justify-content:center;
                    margin:0 auto 16px;
                ">
                    <i class="fas ${iconClass}" style="font-size:28px; color:${iconColor};"></i>
                </div>
                <h4 style="margin:0 0 8px; font-size:18px; font-weight:700; color:#0f172a;">${title}</h4>
                <p style="margin:0 0 24px; font-size:14px; color:#64748b; line-height:1.5;">${message}</p>
                <button onclick="this.closest('.custom-popup-overlay').remove()" style="
                    background:${btnColor}; color:#fff; border:none;
                    padding:10px 40px; border-radius:10px;
                    font-size:14px; font-weight:600; cursor:pointer;
                    transition:opacity .2s;
                " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">OK</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// Keyframes injection
const stylePopup = document.createElement('style');
stylePopup.textContent = `
    @keyframes popupIn {
        from { opacity:0; transform:scale(.9) translateY(20px); }
        to { opacity:1; transform:scale(1) translateY(0); }
    }
`;
document.head.appendChild(stylePopup);
