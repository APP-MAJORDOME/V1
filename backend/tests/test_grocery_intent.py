from app.services.grocery_intent import (
    extract_grocery_label,
    grocery_interpret,
    looks_like_grocery_add,
    looks_like_grocery_correction,
)


def test_grocery_carottes_liste():
    assert looks_like_grocery_add("ajoute des carottes a la liste des courses 2KG")
    out = grocery_interpret("ajoute des carottes a la liste des courses 2KG")
    assert out["intent"] == "grocery_add"
    label = out["proposal"]["label"].lower()
    assert "carotte" in label
    assert "2" in label
    assert "liste" not in label


def test_grocery_patates_douces():
    assert looks_like_grocery_add("ajoute-moi des patates douces")
    assert grocery_interpret("ajoute-moi des patates douces")["proposal"]["label"].lower().startswith("patate")


def test_grocery_not_task_for_food():
    assert looks_like_grocery_add("acheter des alloco")
    assert not looks_like_grocery_add("ajoute une tâche : appeler le dentiste")


def test_grocery_correction():
    assert looks_like_grocery_correction("ajoute le en courses pas en tache")
    assert looks_like_grocery_add("ajoute le en courses pas en tache")
    assert extract_grocery_label("ajoute le en courses pas en tache", fallback="patates douces") == "patates douces"


def test_ferrari_budget_not_grocery():
    assert not looks_like_grocery_add("Est-ce que je peux m'acheter une Ferrari ?")
