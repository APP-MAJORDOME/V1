import base64
from unittest.mock import MagicMock, patch

from app.services.user_secrets_vault import (
    _decrypt_password,
    _encrypt_password,
    create_user_vault_secret,
    reveal_user_vault_secret_password,
)


@patch("app.services.user_secrets_vault.encrypt_vault_blob", side_effect=lambda b: b"ENC:" + b)
@patch("app.services.user_secrets_vault.decrypt_vault_blob", side_effect=lambda b: b[4:] if b.startswith(b"ENC:") else b)
def test_encrypt_decrypt_roundtrip(_dec, _enc):
    stored = _encrypt_password("mon-mot-de-passe")
    assert stored
    assert _decrypt_password(stored) == "mon-mot-de-passe"


def test_create_and_reveal_user_vault_secret():
    db = MagicMock()
    row = MagicMock()
    row.id = 7
    row.label = "Carrefour Drive"
    row.service_key = "carrefour"
    row.username = "alex@mail.com"
    row.password_blob = base64.b64encode(b"ENC:secret123").decode("ascii")
    row.login_url = "https://www.carrefour.fr"
    row.notes = ""
    row.created_at = row.updated_at = None

    db.refresh.side_effect = lambda r: None

    with patch("app.services.user_secrets_vault._encrypt_password", return_value=row.password_blob):
        with patch("app.services.user_secrets_vault._decrypt_password", return_value="secret123"):
            db.add.side_effect = lambda r: setattr(r, "id", 7)
            out = create_user_vault_secret(
                db,
                user_id=1,
                label="Carrefour Drive",
                service_key="carrefour",
                username="alex@mail.com",
                password="secret123",
                login_url="https://www.carrefour.fr",
                notes="",
            )
            assert out["label"] == "Carrefour Drive"
            db.commit.assert_called()

            db.query.return_value.filter.return_value.first.return_value = row
            revealed = reveal_user_vault_secret_password(db, user_id=1, secret_id=7)
            assert revealed["password"] == "secret123"
