// ============================================
// VARIABLES GLOBALES
// ============================================
let currentStep = 1;
const totalSteps = 3;
let dossierId = null;
let currentModalType = null;
let rowToEdit = null;
let nextRowId = 1;
let savedSteps = {};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Échappe les caractères HTML pour prévenir les attaques XSS
 * @param {string} text - Texte à échapper
 * @returns {string} Texte échappé
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Valide qu'un champ contient un nombre positif
 * @param {string} value - Valeur à valider
 * @param {string} fieldName - Nom du champ pour le message d'erreur
 * @returns {boolean} true si valide, false sinon
 */
function validateNumericField(value, fieldName) {
    if (!value || value.trim() === '') {
        return true; // Les champs vides sont OK (validation required séparée)
    }

    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
        alert(`Le champ "${fieldName}" doit contenir uniquement des nombres.`);
        return false;
    }

    if (numValue < 0) {
        alert(`Le champ "${fieldName}" ne peut pas être négatif.`);
        return false;
    }

    return true;
}

/**
 * Met à jour l'affichage du nom de fichier sélectionné
 * @param {HTMLInputElement} input - Input file
 * @param {string} spanId - ID du span à mettre à jour
 */
function updateFileName(input, spanId) {
    const span = document.getElementById(spanId);
    if (input.files.length > 0) {
        const fileName = input.files[0].name;
        span.textContent = fileName;
        console.log('Fichier sélectionné :', fileName);
    } else {
        span.textContent = 'Aucun fichier choisi';
    }
}

function validateModalFile(input, fieldName) {
    const errorId = fieldName + 'Error';
    const errorElement = document.getElementById(errorId);
    const spanId = fieldName + '_fileName';
    const span = document.getElementById(spanId);
    const maxSizeInBytes = 1 * 1024 * 1024; // 1 Mo
    
    console.log('validateModalFile debug - span:', span ? span.id : 'null', 'spanText:', span ? span.textContent : 'null');
    
    // If no input element found, return false
    if (!input) {
        if (errorElement) {
            errorElement.textContent = 'Champ non trouvé';
            errorElement.style.display = 'block';
        }
        console.log('validateModalFile: no input element');
        return false;
    }
    
    // Check if there's a new file selected
    if (input.files && input.files.length > 0) {
        const file = input.files[0];
        if (file.size > maxSizeInBytes) {
            if (errorElement) {
                errorElement.textContent = 'Le fichier ne doit pas dépasser 1 Mo. Votre fichier fait ' + (file.size / (1024 * 1024)).toFixed(2) + ' Mo.';
                errorElement.style.display = 'block';
            }
            input.value = '';
            if (span) span.textContent = 'Aucun fichier';
            console.log('validateModalFile: file too large');
            return false;
        }
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        if (span) {
            span.textContent = file.name;
        }
        console.log('validateModalFile: new file selected, valid');
        return true;
    }
    
    // Check if there's an existing file (for edit mode) - ONLY in edit mode when rowToEdit exists
    if (typeof rowToEdit !== 'undefined' && rowToEdit) {
        if (span) {
            const spanText = span.textContent || '';
            const hasExistingFile = spanText.includes('Voir fichier existant') || 
                               spanText.includes('Fichier actuel') || 
                               (spanText !== 'Aucun fichier' && spanText !== 'Aucun fichier choisi');
            if (hasExistingFile) {
                if (errorElement) {
                    errorElement.style.display = 'none';
                }
                console.log('validateModalFile: edit mode with existing file');
                return true;
            }
        }
    }
    
    // No file and no existing file
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'block';
    }
    console.log('validateModalFile: no file, returning false');
    return false;
}

/**
 * Configure la validation d'un champ (restriction de saisie + feedback visuel)
 * @param {string} inputId - ID de l'élément input
 * @param {string} type - 'text' (lettres), 'number' (chiffres), 'tel' (téléphone)
 * @param {string} customMessage - Message d'erreur personnalisé
 */
function setupInputValidation(inputId, type, customMessage) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Création du div d'erreur s'il n'existe pas
    let feedback = input.parentNode.querySelector('.invalid-feedback');
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        input.parentNode.appendChild(feedback);
    }

    // 1. Restriction de la saisie en temps réel + Validation instantanée pour téléphone
    input.addEventListener('input', function () {
        let value = this.value;
        let originalValue = value;

        if (type === 'text') {
            // Autorise lettres, espaces, tirets, apostrophes, accents
            this.value = value.replace(/[^a-zA-Z\s\-'\u00C0-\u00FF]/g, '');
        } else if (type === 'number') {
            // Autorise uniquement chiffres
            this.value = value.replace(/[^0-9]/g, '');
        } else if (type === 'tel') {
            // Autorise chiffres et + au début
            if (value.length > 0) {
                if (value[0] === '+') {
                    this.value = '+' + value.substring(1).replace(/[^0-9]/g, '');
                } else {
                    this.value = value.replace(/[^0-9]/g, '');
                }
            }

            // ✨ Validation en temps réel pour le téléphone (pendant la saisie)
            let currentValue = this.value.trim();

            // Vérifier si le numéro dépasse 10 chiffres
            if (currentValue.length > 10) {
                this.classList.add('is-invalid');
                feedback.textContent = "Le numéro ne doit pas dépasser 10 chiffres";
            }
            // Vérifier si le numéro ne commence pas par 0 (et qu'il y a au moins 1 caractère)
            else if (currentValue.length > 0 && !currentValue.startsWith('0')) {
                this.classList.add('is-invalid');
                feedback.textContent = "Le numéro doit commencer par 0";
            }
            // Sinon, retirer l'erreur
            else {
                this.classList.remove('is-invalid');
                feedback.textContent = '';
            }
        }

        // Si la valeur a été corrigée (pour text et number), on retire l'erreur temporairement
        if (type !== 'tel' && this.value !== originalValue) {
            this.classList.remove('is-invalid');
        }
    });

    // 2. Validation à la perte du focus (blur)
    input.addEventListener('blur', function () {
        let isValid = true;
        let value = this.value.trim();
        let msg = customMessage;

        if (value === '') {
            if (this.hasAttribute('required')) {
                isValid = false;
                msg = "";
            }
        } else {
            if (type === 'tel') {
                // Validation intelligente du format téléphone marocain
                // Vérifier si le numéro dépasse 10 chiffres
                if (value.length > 10) {
                    isValid = false;
                    msg = "Le numéro ne doit pas dépasser 10 chiffres";
                }
                // Vérifier si le numéro ne commence pas par 0
                else if (!value.startsWith('0')) {
                    isValid = false;
                    msg = "Le numéro doit commencer par 0";
                }
                // Vérifier si le numéro a moins de 10 chiffres
                else if (value.length < 10) {
                    isValid = false;
                    msg = "Le numéro doit contenir exactement 10 chiffres";
                }
                // Vérifier si le deuxième chiffre est valide (5, 6 ou 7)
                else if (value.length >= 2 && !['5', '6', '7'].includes(value[1])) {
                    isValid = false;
                    msg = "Le deuxième chiffre doit être 5, 6 ou 7";
                }
                // Vérifier le format complet (0 suivi de 5-7, puis 8 chiffres)
                else if (!/^0[5-7][0-9]{8}$/.test(value)) {
                    isValid = false;
                    msg = "Format invalide";
                }
            }
        }

        if (!isValid) {
            this.classList.add('is-invalid');
            feedback.textContent = msg || "Valeur invalide.";
        } else {
            this.classList.remove('is-invalid');
        }
    });

    // 3. Nettoyage au focus
    input.addEventListener('focus', function () {
        this.classList.remove('is-invalid');
    });
}
