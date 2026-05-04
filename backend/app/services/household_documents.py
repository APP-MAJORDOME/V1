"""Jeux de documents par défaut pour le coffre famille (personnalisables par prénoms)."""


def default_document_templates(*, prenom: str, partenaire: str, enfant: str) -> list[dict]:
    J, A, L = prenom.strip() or "Joanne", partenaire.strip() or "Alexandre", enfant.strip() or "Léa"
    return [
        {"icon": "💊", "name": f"Ordonnance {L} – Amoxicilline", "category": "🏥 Santé", "date_label": "12 avr.", "expires_at": None, "who": L, "urgent": False},
        {"icon": "💉", "name": f"Carnet vaccinations {L}", "category": "🏥 Santé", "date_label": "2023", "expires_at": None, "who": L, "urgent": False},
        {"icon": "🃏", "name": f"Carte Vitale {J}", "category": "🏥 Santé", "date_label": "2021", "expires_at": None, "who": J, "urgent": False},
        {"icon": "🃏", "name": f"Carte Vitale {A}", "category": "🏥 Santé", "date_label": "2021", "expires_at": None, "who": A, "urgent": False},
        {"icon": "📄", "name": f"Attestation scolaire {L}", "category": "📚 École", "date_label": "Sep. 2024", "expires_at": None, "who": L, "urgent": False},
        {"icon": "🏫", "name": "Coordonnées école + direction", "category": "📚 École", "date_label": "Permanent", "expires_at": None, "who": L, "urgent": False},
        {"icon": "📜", "name": f"Acte de naissance {L}", "category": "🏛️ Admin", "date_label": "2016", "expires_at": None, "who": L, "urgent": False},
        {"icon": "🛂", "name": f"Passeport {J}", "category": "🛂 Identité", "date_label": "2020", "expires_at": None, "who": J, "urgent": False},
        {"icon": "🛂", "name": f"Passeport {A}", "category": "🛂 Identité", "date_label": "2019", "expires_at": None, "who": A, "urgent": False},
        {"icon": "🏠", "name": "Assurance habitation", "category": "🏠 Maison", "date_label": "Jan. 2024", "expires_at": None, "who": "Famille", "urgent": True},
        {"icon": "🚗", "name": "Assurance voiture", "category": "💰 Finance", "date_label": "Mar. 2024", "expires_at": None, "who": A, "urgent": False},
        {"icon": "💰", "name": "Avis imposition 2023", "category": "💰 Finance", "date_label": "Aug. 2024", "expires_at": None, "who": "Famille", "urgent": False},
        {"icon": "📋", "name": f"Contrat de travail {J}", "category": "💰 Finance", "date_label": "2019", "expires_at": None, "who": J, "urgent": False},
        {"icon": "📋", "name": "Mutuelle famille", "category": "🏥 Santé", "date_label": "Jan. 2024", "expires_at": None, "who": "Famille", "urgent": False},
    ]
