# utils/validators.py

# Hiérarchie des grades académiques (ordre croissant = du plus bas au plus élevé)
GRADE_HIERARCHY = {
    'MC C': 1,
    'MC B': 2,
    'MC A': 3,
    'MCH C': 4,
    'MCH B': 5,
    'MCH A': 6,
    'PES D': 7,
    'PES C': 8,
    'PES B': 9,
    'PES A': 10,
}


def grade_rank(grade):
    """Retourne le rang numérique d'un grade. Retourne 0 si inconnu."""
    return GRADE_HIERARCHY.get(grade, 0)


def can_evaluate(membre_grade, enseignant_grade):
    """
    Vérifie si un membre de commission peut évaluer un enseignant.
    Le grade du membre doit être STRICTEMENT supérieur à celui de l'enseignant.
    Retourne (True, '') si autorisé, (False, message_erreur) sinon.
    """
    if not membre_grade or not enseignant_grade:
        return False, 'Grade du membre de commission non défini.'

    membre_rank = grade_rank(membre_grade)
    enseignant_rank = grade_rank(enseignant_grade)

    if membre_rank == 0:
        return False, f'Grade du membre "{membre_grade}" non reconnu.'
    if enseignant_rank == 0:
        return False, f'Grade de l\'enseignant "{enseignant_grade}" non reconnu.'

    if membre_rank <= enseignant_rank:
        return False, (
            f'Le membre de commission (grade {membre_grade}) ne peut pas évaluer '
            f'un enseignant de grade {enseignant_grade}. '
            f'Le grade du membre doit être strictement supérieur.'
        )

    return True, ''
