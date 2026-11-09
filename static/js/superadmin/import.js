/* =============================================
   IMPORT EN MASSE — Flux 4 étapes
   ============================================= */

let importState = {
    step: 1,
    file: null,
    lignes: [],
    resume: null,
    resultats: [],
    rapportCsv: '',
}

const GRADES = ['MC C', 'MC B', 'MC A', 'MCH C', 'MCH B', 'MCH A', 'PES D', 'PES C', 'PES B', 'PES A']
const ROLES = ['ENSEIGNANT', 'COORDINATEUR', 'COMMISSION', 'SUPERADMIN']

function showImportStep(n) {
    document.querySelectorAll('.import-step').forEach((el, i) => {
        el.classList.toggle('active', i + 1 === n)
        el.classList.toggle('done', i + 1 < n)
    })
    document.querySelectorAll('.import-step-content').forEach((el, i) => {
        el.classList.toggle('active', i + 1 === n)
    })
    importState.step = n
}

function resetImport() {
    importState = { step: 1, file: null, lignes: [], resume: null, resultats: [], rapportCsv: '' }
    document.getElementById('importFileInput').value = ''
    document.getElementById('importFileInfo').classList.remove('show')
    document.getElementById('importPreview').innerHTML = ''
    document.getElementById('importResult').innerHTML = ''
    document.getElementById('importConfirmSummary').innerHTML = ''
    showImportStep(1)
}

// Step 1 — Upload
document.addEventListener('DOMContentLoaded', function () {
    const dropZone = document.getElementById('importDropZone')
    const fileInput = document.getElementById('importFileInput')

    if (!dropZone || !fileInput) return

    dropZone.addEventListener('click', () => fileInput.click())

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault()
        dropZone.classList.add('dragover')
    })
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover')
    })
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault()
        dropZone.classList.remove('dragover')
        if (e.dataTransfer.files.length) handleImportFile(e.dataTransfer.files[0])
    })
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleImportFile(fileInput.files[0])
    })
})

function handleImportFile(file) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx'].includes(ext)) {
        showToast('Format non supporté. Utilisez .csv ou .xlsx.', 'error')
        return
    }
    if (file.size > 2 * 1024 * 1024) {
        showToast('Le fichier dépasse 2 Mo.', 'error')
        return
    }
    importState.file = file

    const info = document.getElementById('importFileInfo')
    document.getElementById('importFileName').textContent = file.name
    document.getElementById('importFileSize').textContent = (file.size / 1024).toFixed(1) + ' Ko'
    info.classList.add('show')

    document.getElementById('importPreviewBtn').disabled = false
}

function uploadAndPreview() {
    if (!importState.file) return
    const btn = document.getElementById('importPreviewBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyse...'

    const formData = new FormData()
    formData.append('file', importState.file)

    fetch('/api/import-users/preview', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            btn.disabled = false
            btn.innerHTML = '<i class="fas fa-eye"></i> Prévisualiser'
            if (!data.success) {
                showToast(data.message || 'Erreur lors de l\'analyse.', 'error')
                return
            }
            importState.lignes = data.lignes
            importState.resume = data.resume
            renderPreview()
            showImportStep(2)
        })
        .catch(() => {
            btn.disabled = false
            btn.innerHTML = '<i class="fas fa-eye"></i> Prévisualiser'
            showToast('Erreur réseau.', 'error')
        })
}

// Step 2 — Preview
function renderPreview() {
    const container = document.getElementById('importPreview')
    const lignes = importState.lignes
    const resume = importState.resume

    let html = `
    <div class="import-summary">
        <div class="summary-item total"><span class="num">${resume.total}</span> lignes</div>
        <div class="summary-item valides"><span class="num">${resume.valides}</span> valides</div>
        <div class="summary-item erreurs"><span class="num">${resume.erreurs}</span> erreurs</div>
    </div>
    <div class="import-table-wrap">
    <table class="import-table">
    <thead><tr>
        <th class="cell-exclude">Inclure</th>
        <th>Nom</th>
        <th>Prénom</th>
        <th>CIN</th>
        <th>PPR</th>
        <th>Tél.</th>
        <th>Rôle</th>
        <th>Grade</th>
        <th>Date début avancement</th>
        <th>Date fin avancement</th>
        <th>Email généré</th>
        <th>Statut</th>
    </tr></thead><tbody>`

    lignes.forEach((row, i) => {
        const excluded = row.valide ? '' : ' row-excluded'
        const checked = row.valide ? 'checked' : ''
        html += `<tr class="import-row${excluded}" data-idx="${i}">
            <td class="cell-exclude"><input type="checkbox" class="import-row-checkbox" ${checked} onchange="toggleImportRow(${i})"></td>
            <td><input type="text" value="${esc(row.nom)}" onchange="editImportCell(${i},'nom',this.value)"></td>
            <td><input type="text" value="${esc(row.prenom)}" onchange="editImportCell(${i},'prenom',this.value)"></td>
            <td><input type="text" value="${esc(row.cin)}" onchange="editImportCell(${i},'cin',this.value)"></td>
            <td><input type="text" value="${esc(row.ppr)}" onchange="editImportCell(${i},'ppr',this.value)"></td>
            <td><input type="text" value="${esc(row.tel)}" onchange="editImportCell(${i},'tel',this.value)"></td>
            <td><select onchange="editImportCell(${i},'role',this.value)">
                ${ROLES.map(r => `<option value="${r}" ${r === row.role ? 'selected' : ''}>${r}</option>`).join('')}
            </select></td>
            <td><select onchange="editImportCell(${i},'grade',this.value)">
                <option value="">—</option>
                ${GRADES.map(g => `<option value="${g}" ${g === row.grade ? 'selected' : ''}>${g}</option>`).join('')}
            </select></td>
            <td><input type="date" value="${esc(row.date_debut_avancement)}" onchange="editImportCell(${i},'date_debut_avancement',this.value)"></td>
            <td><input type="date" value="${esc(row.date_fin_avancement)}" onchange="editImportCell(${i},'date_fin_avancement',this.value)"></td>
            <td style="font-size:12px; color:#475569;">${esc(row.email)}</td>
            <td class="cell-status">${renderStatus(row)}</td>
        </tr>`
    })

    html += `</tbody></table></div>
    <div class="import-actions">
        <button class="btn-import btn-import-outline" onclick="resetImport()"><i class="fas fa-arrow-left"></i> Nouveau fichier</button>
        <button class="btn-import btn-import-primary" onclick="goToConfirm()" ${resume.valides === 0 ? 'disabled' : ''}>
            <i class="fas fa-arrow-right"></i> Confirmer (${resume.valides})
        </button>
    </div>`

    container.innerHTML = html
}

function renderStatus(row) {
    if (row.valide) {
        if (row.suffixe) return '<span class="status-warning"><i class="fas fa-exclamation-triangle"></i> Email modifié (suffixe)</span>'
        return '<span class="status-valid"><i class="fas fa-check-circle"></i> Valide</span>'
    }
    return '<span class="status-error"><i class="fas fa-times-circle"></i> Erreur</span>' +
        '<ul class="status-error-list">' + row.erreurs.map(e => '<li>• ' + esc(e) + '</li>').join('') + '</ul>'
}

function toggleImportRow(idx) {
    const row = document.querySelector(`.import-row[data-idx="${idx}"]`)
    if (row) row.classList.toggle('row-excluded')
    updateConfirmButton()
}

function editImportCell(idx, field, value) {
    importState.lignes[idx][field] = value
}

function updateConfirmButton() {
    const checked = document.querySelectorAll('.import-row-checkbox:checked').length
    const btn = document.querySelector('#importPreview .btn-import-primary')
    if (btn) {
        btn.disabled = checked === 0
        btn.innerHTML = '<i class="fas fa-arrow-right"></i> Confirmer (' + checked + ')'
    }
}

function getSelectedLignes() {
    return importState.lignes.filter((_, i) => {
        const cb = document.querySelector(`.import-row[data-idx="${i}"] .import-row-checkbox`)
        return cb && cb.checked
    })
}

function goToConfirm() {
    const selected = getSelectedLignes()
    if (selected.length === 0) return
    importState.selectedLignes = selected

    const container = document.getElementById('importConfirmSummary')
    container.innerHTML = `
    <div class="import-summary">
        <div class="summary-item total"><span class="num">${selected.length}</span> comptes à créer</div>
    </div>
    <div class="import-actions">
        <button class="btn-import btn-import-outline" onclick="showImportStep(2)"><i class="fas fa-arrow-left"></i> Retour</button>
        <button class="btn-import btn-import-success" onclick="confirmImport()"><i class="fas fa-check"></i> Confirmer l'import</button>
    </div>`
    showImportStep(3)
}

// Step 3 → 4 — Confirm
function confirmImport() {
    const btn = document.querySelector('#importConfirmSummary .btn-import-success')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création en cours...'

    fetch('/api/import-users/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            lignes: importState.selectedLignes,
            fichier_nom: importState.file ? importState.file.name : 'import'
        })
    })
        .then(r => r.json())
        .then(data => {
            if (!data.success) {
                showToast(data.message || 'Erreur lors de l\'import.', 'error')
                btn.disabled = false
                btn.innerHTML = '<i class="fas fa-check"></i> Confirmer l\'import'
                return
            }
            importState.resultats = data.resultats
            importState.rapportCsv = data.rapport_csv
            renderResult(data)
            showImportStep(4)
            setTimeout(() => location.reload(), 2500)
        })
        .catch(() => {
            showToast('Erreur réseau.', 'error')
            btn.disabled = false
            btn.innerHTML = '<i class="fas fa-check"></i> Confirmer l\'import'
        })
}

function renderResult(data) {
    const container = document.getElementById('importResult')
    const r = data.resume

    let html = `
    <div class="import-summary">
        <div class="summary-item total"><span class="num">${r.total}</span> traités</div>
        <div class="summary-item valides"><span class="num">${r.crees}</span> créés</div>
        <div class="summary-item erreurs"><span class="num">${r.erreurs}</span> échoués</div>
    </div>
    <div class="import-table-wrap">
    <table class="import-table">
    <thead><tr>
        <th>Nom</th><th>Prénom</th><th>Email</th><th>Statut</th><th>Raison</th>
    </tr></thead><tbody>`

    data.resultats.forEach(row => {
        const cls = row.statut === 'cree' ? 'result-success' : 'result-error'
        const icon = row.statut === 'cree' ? 'check-circle' : 'times-circle'
        html += `<tr>
            <td>${esc(row.nom)}</td>
            <td>${esc(row.prenom)}</td>
            <td>${esc(row.email)}</td>
            <td class="${cls}"><i class="fas fa-${icon}"></i> ${row.statut === 'cree' ? 'Créé' : 'Échoué'}</td>
            <td style="font-size:12px; color:#868e96;">${esc(row.raison || '—')}</td>
        </tr>`
    })

    html += `</tbody></table></div>
    <div class="import-actions">
        <button class="btn-import btn-import-outline" onclick="downloadRapport()"><i class="fas fa-download"></i> Télécharger le rapport</button>
        <button class="btn-import btn-import-primary" onclick="resetImport()"><i class="fas fa-plus"></i> Nouvel import</button>
    </div>`

    container.innerHTML = html
}

function downloadRapport() {
    fetch('/api/import-users/download-rapport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rapport_csv: importState.rapportCsv })
    })
        .then(r => r.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'rapport_import.csv'
            a.click()
            URL.revokeObjectURL(url)
        })
}

function esc(s) {
    if (!s) return ''
    const div = document.createElement('div')
    div.textContent = s
    return div.innerHTML
}
