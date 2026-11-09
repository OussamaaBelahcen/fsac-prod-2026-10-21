// ============================================
// ÉTAPE 1 : INFORMATIONS PERSONNELLES
// ============================================

/**
 * Sauvegarde les données de l'étape 1 (Informations personnelles)
 * @returns {Promise<Object>} Résultat de la sauvegarde
 */
async function saveStep1() {
    // Réinitialiser les messages d'erreur
    resetErrors();
    
    // Valider le formulaire
    if (!validateForm()) {
        return false; // Arrêter la sauvegarde si la validation échoue
    }
    
    const payload = new FormData();
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

    const response = await fetch('/api/save-step1', {
        method: 'POST',
        body: payload
    });

    return await response.json();
}

/**
 * Valide le formulaire en temps réel
 * @returns {boolean} True si le formulaire est valide, false sinon
 */
function validateForm() {
    let isValid = true;
    
// Valider la photo
    const photoInput = document.getElementById('photo');
    const bottomError = document.getElementById('photoRequiredError');
    const photoFileNameEl = document.getElementById('photoFileName');
    const currentPhotoLink = document.getElementById('currentPhotoLink');
    const currentPhotoContainer = document.getElementById('currentPhotoContainer');
    
    const hasExistingPhotoText = photoFileNameEl && photoFileNameEl.textContent && photoFileNameEl.textContent.includes('Fichier actuel');
    const hasPhotoDataAttr = currentPhotoContainer && currentPhotoContainer.getAttribute('data-has-photo') === 'true';
    const hasExistingPhoto = hasExistingPhotoText || hasPhotoDataAttr;
    const hasNewPhoto = photoInput && photoInput.files.length > 0;
    
    // Hide error message if there's an existing photo (from database)
    if (hasExistingPhoto) {
        if (bottomError) bottomError.style.display = 'none';
    }
    
    // Check if there's a valid photo (either existing or new)
    if (!hasExistingPhoto && !hasNewPhoto) {
        if (bottomError) bottomError.style.display = 'block';
        isValid = false;
    } else if (hasNewPhoto) {
        const file = photoInput.files[0];
        const maxSizeInBytes = 1 * 1024 * 1024; // 1 Mo
        if (file.size > maxSizeInBytes) {
            showPhotoError(`La photo ne doit pas dépasser 1 Mo. Votre fichier fait ${(file.size / (1024 * 1024)).toFixed(2)} Mo.`);
            if (bottomError) bottomError.style.display = 'none';
            isValid = false;
        } else {
            if (bottomError) bottomError.style.display = 'none';
            hidePhotoError();
        }
    }
    
    // Validation PPR (format uniquement, pas d'erreur si vide)
    const ppr = document.getElementById('ppr');
    if (ppr && ppr.value.trim() !== '' && !/^\d+$/.test(ppr.value)) {
        showFieldError('ppr', 'Le PPR doit contenir uniquement des chiffres');
        isValid = false;
    }
    
    // Validation téléphone (format uniquement, pas d'erreur si vide)
    const tel = document.getElementById('telephone');
    if (tel && tel.value.trim() !== '' && !/^(0[5-7]\d{8}|\+212[5-7]\d{8})$/.test(tel.value)) {
        showFieldError('telephone', 'Format: 0612345678 ou +212612345678');
        isValid = false;
    }

    // Validation date naissance >= 1930 et écart >= 25 ans
    var dn = document.getElementById('date_naissance');
    var dr = document.getElementById('date_recrutement');
    var minNaissance = '1930-01-01';
    if (dn && dn.value) {
        if (dn.value < minNaissance) {
            showFieldError('date_naissance', 'La date de naissance doit être ≥ 1930');
            isValid = false;
        } else if (dr && dr.value) {
            var birth = new Date(dn.value);
            var recruit = new Date(dr.value);
            var diffYears = (recruit - birth) / (365.25 * 24 * 60 * 60 * 1000);
            if (diffYears < 25) {
                showFieldError('date_naissance', 'L\'écart Naissance/Recrutement doit être ≥ 25 ans');
                showFieldError('date_recrutement', 'L\'écart Naissance/Recrutement doit être ≥ 25 ans');
                isValid = false;
            }
        }
    }

    return isValid;
}

/**
 * Active la validation en temps réel pour le bouton Suivant
 */
function setupStep1RealTimeValidation() {
    const step1Container = document.getElementById('content-1');
    if (!step1Container) return;
    
    const content1 = document.getElementById('content-1');
    if (!content1 || !content1.classList.contains('active')) return;
    
    const inputs = step1Container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            if (typeof validateForm === 'function') {
                validateForm();
            }
        });
        input.addEventListener('change', function() {
            if (typeof validateForm === 'function') {
                validateForm();
            }
        });
    });
}

/**
 * Affiche l'erreur de la photo
 * @param {string} message - Message d'erreur à afficher
 */
function showPhotoError(message) {
    const errorElement = document.getElementById('photoError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

/**
 * Masque l'erreur de la photo
 */
function hidePhotoError() {
    const errorElement = document.getElementById('photoError');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

/**
 * Affiche l'erreur d'un champ
 * @param {string} fieldId - ID du champ
 * @param {string} message - Message d'erreur à afficher
 */
function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

/**
 * Masque l'erreur d'un champ
 * @param {string} fieldId - ID du champ
 */
function hideFieldError(fieldId) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}

/**
 * Réinitialise tous les messages d'erreur
 */
function resetErrors() {
    // Réinitialiser l'erreur de photo
    hidePhotoError();
    const photoRequiredError = document.getElementById('photoRequiredError');
    if (photoRequiredError) photoRequiredError.style.display = 'none';
    
    // Réinitialiser les erreurs de champs
    const requiredFields = [
        'nom', 'prenom', 'email', 'grade', 'etablissement', 
        'departement', 'date_naissance', 'lieu_naissance', 
        'date_recrutement', 'ppr', 'laboratoire', 
        'equipe_recherche', 'adresse_personnelle', 'telephone'
    ];
    
    requiredFields.forEach(fieldId => {
        hideFieldError(fieldId);
    });
}

/**
 * Valide la photo lorsqu'elle est sélectionnée
 * @param {HTMLInputElement} input - Élément d'entrée de fichier
 */
function validatePhoto(input) {
    if (input.files.length > 0) {
        const file = input.files[0];
        const maxSizeInBytes = 1 * 1024 * 1024; // 1 Mo
        if (file.size > maxSizeInBytes) {
            showPhotoError(`La photo ne doit pas dépasser 1 Mo. Votre fichier fait ${(file.size / (1024 * 1024)).toFixed(2)} Mo.`);
            const bottomError = document.getElementById('photoRequiredError');
            if (bottomError) bottomError.style.display = 'none';
            if (typeof disableNextButton === 'function') {
                disableNextButton(1);
            }
        } else {
            hidePhotoError();
            const bottomError = document.getElementById('photoRequiredError');
            if (bottomError) bottomError.style.display = 'none';
            updateFileName(input, 'photoFileName');
            if (typeof validateForm === 'function') {
                validateForm();
            }
        }
    } else {
        hidePhotoError();
        const bottomError = document.getElementById('photoRequiredError');
        if (bottomError) bottomError.style.display = 'none';
        document.getElementById('photoFileName').textContent = 'Aucun fichier choisi';
        if (typeof validateForm === 'function') {
            validateForm();
        }
    }
}

/**
 * Met à jour le nom du fichier affiché
 * @param {HTMLInputElement} input - Élément d'entrée de fichier
 * @param {string} spanId - ID de l'élément span pour afficher le nom du fichier
 */
function updateFileName(input, spanId) {
    if (input.files.length > 0) {
        document.getElementById(spanId).textContent = input.files[0].name;
    } else {
        document.getElementById(spanId).textContent = 'Aucun fichier choisi';
    }
}

/**
 * Charge les données de l'étape 1
 * @param {Object} data - Données à charger
 */
function loadStep1Data(data) {
    if (!data) return;

    Object.keys(data).forEach(key => {
        const field = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
        if (field && data[key]) {
            if (field.type === 'date') {
                field.value = data[key].split(' ')[0] || '';
            } else {
                field.value = data[key];
            }
        }
    });
}

// ============================================
// Validation dynamique en temps réel
// ============================================

const requiredFields = [
    'nom', 'prenom', 'email', 'grade', 'etablissement',
    'departement', 'lieu_naissance',
    'ppr', 'laboratoire',
    'equipe_recherche', 'adresse_personnelle', 'telephone',
    'date_naissance', 'date_recrutement'
];

requiredFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const validateField = () => {
        let isEmpty = false;

        if (field.tagName === 'SELECT') {
            isEmpty = !field.value;
        } else {
            isEmpty = field.value.trim() === '';
        }

        // Validation spécifique pour PPR (chiffres uniquement)
        if (fieldId === 'ppr' && !isEmpty) {
            if (!/^\d+$/.test(field.value)) {
                showFieldError(fieldId, 'Le PPR doit contenir uniquement des chiffres');
                return;
            }
        }

        // Validation spécifique pour téléphone (format marocain)
        if (fieldId === 'telephone' && !isEmpty) {
            if (!/^(0[5-7]\d{8}|\+212[5-7]\d{8})$/.test(field.value)) {
                showFieldError(fieldId, 'Format: 0612345678 ou +212612345678');
                return;
            }
        }

        hideFieldError(fieldId);
    };

    if (field.tagName === 'SELECT') {
        field.addEventListener('change', validateField);
    } else {
        field.addEventListener('input', validateField);
    }
});

// Validation dynamique pour la photo
const photoInput = document.getElementById('photo');
if (photoInput) {
    photoInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            const file = this.files[0];
            const maxSizeInBytes = 1 * 1024 * 1024;
            if (file.size > maxSizeInBytes) {
                showPhotoError(`La photo ne doit pas dépasser 1 Mo. Votre fichier fait ${(file.size / (1024 * 1024)).toFixed(2)} Mo.`);
            } else {
                hidePhotoError();
            }
        } else {
            hidePhotoError();
        }
    });
}
