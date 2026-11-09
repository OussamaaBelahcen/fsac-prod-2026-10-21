// ============================================
// NAVIGATION ET GESTION DU FORMULAIRE
// ============================================

/**
 * Affiche ou masque le formulaire multi-étapes
 */
function toggleForm() {
    const form = document.getElementById('formContainer');
    form.classList.toggle('active');
}

/**
 * Crée le dossier côté serveur puis affiche le formulaire
 */
function createDossier() {
    const btn = document.querySelector('.btn-create-dossier');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création...';
    btn.disabled = true;

    fetch('/api/create-dossier', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Dossier créé avec succès, on affiche le formulaire
                toggleForm();
                // On peut aussi recharger la page pour mettre à jour l'état global si nécessaire
                // location.reload(); 
                // Mais pour l'instant, on affiche juste le formulaire pour une expérience fluide

                // Masquer le bouton créer ou le changer en "Continuer"
                btn.innerHTML = '<i class="fas fa-edit"></i> Continuer mon dossier';
                btn.onclick = toggleForm; // Rebind to simple toggle
                btn.disabled = false;
            } else {
                alert('Erreur: ' + data.message);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Une erreur est survenue.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
}

/**
 * Change l'étape active du formulaire
 * @param {number} direction - Direction du changement (-1 pour précédent, +1 pour suivant)
 */
async function changeStep(direction) {
    // Empêcher les doubles clics pendant la transition
    if (window.__changingStep) return;
    window.__changingStep = true;

    // Prevent moving forward from step 1 if form is invalid
    if (direction > 0 && currentStep === 1) {
        if (typeof validateForm === 'function' && !validateForm()) {
            window.__changingStep = false;
            return;
        }
    }

    // Auto-sauvegarde avant d'avancer à l'étape suivante (sauf en lecture seule)
    if (direction > 0 && typeof saveForm === 'function' && !(typeof isReadOnly !== 'undefined' && isReadOnly)) {
        window.__autoSave = true;
        const saved = await saveForm();
        window.__autoSave = false;
        if (!saved) {
            window.__changingStep = false;
            return;
        }
    }

    document.getElementById('content-' + currentStep).classList.remove('active');
    const currentStepEl = document.getElementById('step-' + currentStep);
    currentStepEl.classList.remove('active', 'completed');

    if (direction > 0) {
        currentStepEl.classList.add('completed');
        var prevLine = document.getElementById('line-' + currentStep);
        if (prevLine) {
            prevLine.classList.remove('active');
            prevLine.classList.add('completed');
        }
    } else {
        var nextLine = document.getElementById('line-' + (currentStep - 1));
        if (nextLine) {
            nextLine.classList.remove('completed', 'active');
        }
    }

    currentStep += direction;
    const newStepEl = document.getElementById('step-' + currentStep);
    newStepEl.classList.remove('completed');
    newStepEl.classList.add('active');

    var activeLine = document.getElementById('line-' + (currentStep - 1));
    if (activeLine && direction > 0) {
        activeLine.classList.add('active');
    }

    document.getElementById('content-' + currentStep).classList.add('active');
    updateButtons();
    document.getElementById('formContainer').scrollIntoView({ behavior: 'smooth' });

    // Désactiver le bouton Suivant jusqu'à sauvegarde
    if (savedSteps && savedSteps[currentStep]) {
        enableNextButton(currentStep);
    } else {
        disableNextButton(currentStep);
    }
    // Surveiller les modifications de champs pour griser le bouton
    if (typeof watchStepForChanges === 'function') {
        watchStepForChanges(currentStep);
    }

    window.__changingStep = false;

    // Afficher le rappel d'enregistrement à chaque changement d'étape
    showStepReminder();
}

/**
 * Affiche le rappel d'enregistrement pendant 15 secondes
 */
function showStepReminder() {
    const reminder = document.getElementById('stepReminder');
    if (reminder) {
        reminder.style.display = 'flex';
        clearTimeout(reminder._timeout);
        reminder._timeout = setTimeout(() => {
            reminder.style.display = 'none';
        }, 15000);
    }
}
window.addEventListener('beforeunload', function () {
    if (window.__dirty && dossierId) {
        window.__autoSave = true;
        const payload = new FormData();
        payload.append('step', currentStep);
        payload.append('auto_save', 'true');
        // Collecte basique des champs texte pour sauvegarde de secours
        const container = document.getElementById('content-' + currentStep);
        if (container) {
            const inputs = container.querySelectorAll('input:not([type="file"]):not([type="button"]):not([type="submit"]), select, textarea');
            inputs.forEach(el => {
                if (el.name) payload.append(el.name, el.value);
            });
        }
        navigator.sendBeacon('/api/save-step' + currentStep, payload);
    }
});

/**
 * Met à jour l'affichage des boutons de navigation
 */
function updateButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-block';
    if (currentStep === totalSteps) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-block';
    } else {
        nextBtn.style.display = 'inline-block';
        submitBtn.style.display = 'none';
    }
}

/**
 * Affiche l'indicateur de sauvegarde pendant 3 secondes
 */
function showSaveIndicator() {
    const indicator = document.getElementById('saveIndicator');
    indicator.classList.add('show');
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 3000);
}

/**
 * Active le mode lecture seule pour les dossiers soumis
 */
function setReadOnlyMode() {
    if (typeof isReadOnly === 'undefined' || !isReadOnly) return;

    // Désactiver tous les inputs, selects, textareas
    document.querySelectorAll('input:not([type="button"]):not([type="submit"]), select, textarea').forEach(el => {
        el.setAttribute('readonly', 'readonly');
        if (el.tagName === 'SELECT') {
            el.setAttribute('disabled', 'disabled');
        }
        el.style.backgroundColor = '#f5f5f5';
        el.style.cursor = 'not-allowed';
    });

    // Désactiver et griser tous les boutons d'action (Ajouter, Modifier, Supprimer)
    document.querySelectorAll('.add-row-btn, .btn-edit, .btn-delete').forEach(btn => {
        btn.setAttribute('disabled', 'disabled');
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.style.pointerEvents = 'none';
    });
}
