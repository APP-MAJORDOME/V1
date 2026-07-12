from __future__ import annotations

import base64

from sqlalchemy.orm import Session

from app.models.models import UserVaultSecret
from app.services.vault_crypto import decrypt_vault_blob, encrypt_vault_blob, vault_encryption_enabled

_CREDENTIAL_ENC_PREFIX = "enc:v1:"
_STORE_LABEL_TO_KEY: dict[str, str] = {
    "carrefour": "carrefour",
    "marche u": "marche_u",
    "marché u": "marche_u",
    "hyper u": "marche_u",
    "super u": "marche_u",
    "leclerc": "leclerc",
    "e.leclerc": "leclerc",
    "auchan": "auchan",
    "intermarche": "intermarche",
    "intermarché": "intermarche",
    "lidl": "lidl",
    "aldi": "aldi",
}


def store_label_to_service_key(store_label: str) -> str | None:
    key = (store_label or "").strip().lower()
    return _STORE_LABEL_TO_KEY.get(key)


def encrypt_credential_field(plain: str) -> str:
    """Chiffre un champ credential (ex. mot de passe domotique dans scopes_json)."""
    if not plain:
        return ""
    return _CREDENTIAL_ENC_PREFIX + _encrypt_password(plain)


def decrypt_credential_field(stored: str) -> str:
    if not stored:
        return ""
    if stored.startswith(_CREDENTIAL_ENC_PREFIX):
        return _decrypt_password(stored[len(_CREDENTIAL_ENC_PREFIX) :])
    return stored


def _encrypt_password(plain: str) -> str:
    if not plain:
        return ""
    blob = encrypt_vault_blob(plain.encode("utf-8"))
    return base64.b64encode(blob).decode("ascii")


def _decrypt_password(stored: str) -> str:
    if not stored:
        return ""
    try:
        blob = base64.b64decode(stored.encode("ascii"))
    except Exception:
        return ""
    return decrypt_vault_blob(blob).decode("utf-8")


def _row_to_read(row: UserVaultSecret) -> dict:
    return {
        "id": row.id,
        "label": row.label,
        "service_key": row.service_key,
        "username": row.username,
        "has_password": bool((row.password_blob or "").strip()),
        "login_url": row.login_url,
        "notes": row.notes or "",
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def list_user_vault_secrets(db: Session, user_id: int) -> dict:
    rows = (
        db.query(UserVaultSecret)
        .filter(UserVaultSecret.user_id == user_id)
        .order_by(UserVaultSecret.label.asc())
        .limit(120)
        .all()
    )
    return {
        "secrets": [_row_to_read(r) for r in rows],
        "encryption_at_rest": vault_encryption_enabled(),
    }


def create_user_vault_secret(
    db: Session,
    user_id: int,
    *,
    label: str,
    service_key: str,
    username: str | None,
    password: str | None,
    login_url: str | None,
    notes: str | None,
) -> dict:
    clean_label = (label or "").strip()
    if not clean_label:
        raise ValueError("label_required")
    row = UserVaultSecret(
        user_id=user_id,
        label=clean_label[:255],
        service_key=(service_key or "other").strip().lower()[:64],
        username=(username or "").strip()[:255] or None,
        password_blob=_encrypt_password((password or "").strip()),
        login_url=(login_url or "").strip()[:512] or None,
        notes=(notes or "").strip()[:2000],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_read(row)


def update_user_vault_secret(
    db: Session,
    user_id: int,
    secret_id: int,
    *,
    label: str | None = None,
    service_key: str | None = None,
    username: str | None = None,
    password: str | None = None,
    login_url: str | None = None,
    notes: str | None = None,
) -> dict | None:
    row = (
        db.query(UserVaultSecret)
        .filter(UserVaultSecret.id == secret_id, UserVaultSecret.user_id == user_id)
        .first()
    )
    if row is None:
        return None
    if label is not None:
        clean = label.strip()
        if not clean:
            raise ValueError("label_required")
        row.label = clean[:255]
    if service_key is not None:
        row.service_key = (service_key or "other").strip().lower()[:64]
    if username is not None:
        row.username = username.strip()[:255] or None
    if password is not None and password.strip():
        row.password_blob = _encrypt_password(password.strip())
    if login_url is not None:
        row.login_url = login_url.strip()[:512] or None
    if notes is not None:
        row.notes = notes.strip()[:2000]
    db.commit()
    db.refresh(row)
    return _row_to_read(row)


def delete_user_vault_secret(db: Session, user_id: int, secret_id: int) -> bool:
    row = (
        db.query(UserVaultSecret)
        .filter(UserVaultSecret.id == secret_id, UserVaultSecret.user_id == user_id)
        .first()
    )
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True


def list_credential_hints(db: Session, user_id: int) -> list[dict]:
    rows = (
        db.query(UserVaultSecret)
        .filter(UserVaultSecret.user_id == user_id)
        .order_by(UserVaultSecret.label.asc())
        .limit(120)
        .all()
    )
    return [
        {
            "service_key": r.service_key,
            "label": r.label,
            "username": r.username,
            "has_password": bool((r.password_blob or "").strip()),
            "login_url": r.login_url,
        }
        for r in rows
    ]


def credential_hints_for_stores(hints: list[dict], store_labels: list[str]) -> list[dict]:
    out: list[dict] = []
    for store in store_labels:
        sk = store_label_to_service_key(store)
        if not sk:
            continue
        match = next((h for h in hints if str(h.get("service_key") or "") == sk), None)
        if not match:
            continue
        out.append(
            {
                "store": store,
                "service_key": sk,
                "label": match.get("label"),
                "username": match.get("username"),
                "has_password": bool(match.get("has_password")),
                "login_url": match.get("login_url"),
                "drive_status": "credentials_ready" if match.get("has_password") else "username_only",
            }
        )
    return out


def vault_secret_plain_password(row: UserVaultSecret) -> str:
    return _decrypt_password(row.password_blob or "")


def reveal_user_vault_secret_password(db: Session, user_id: int, secret_id: int) -> dict | None:
    row = (
        db.query(UserVaultSecret)
        .filter(UserVaultSecret.id == secret_id, UserVaultSecret.user_id == user_id)
        .first()
    )
    if row is None:
        return None
    return {
        "id": row.id,
        "password": _decrypt_password(row.password_blob or ""),
        "encryption_at_rest": vault_encryption_enabled(),
    }
