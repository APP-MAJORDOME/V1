"""Stockage fichiers du coffre documents (isolé par foyer, chemins normalisés)."""

from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

from app.core.config import settings
from app.services.vault_crypto import decrypt_vault_blob, encrypt_vault_blob

_HEX32 = re.compile(r"^[0-9a-f]{32}$")


def upload_root() -> Path:
    return Path(settings.upload_dir).expanduser().resolve()


def path_for_storage_key(storage_key: str) -> Path:
    parts = storage_key.strip("/").split("/")
    if len(parts) != 2:
        raise ValueError("invalid_storage_key")
    hid, fname = parts
    if not hid.isdigit() or not _HEX32.match(fname):
        raise ValueError("invalid_storage_key")
    root = upload_root()
    target = (root / hid / fname).resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise ValueError("path_traversal") from exc
    return target


def build_storage_key(household_id: int) -> str:
    return f"{household_id}/{uuid4().hex}"


def ensure_household_upload_dir(household_id: int) -> Path:
    d = upload_root() / str(household_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def read_bytes(storage_key: str) -> bytes:
    path = path_for_storage_key(storage_key)
    if not path.is_file():
        raise FileNotFoundError(storage_key)
    return decrypt_vault_blob(path.read_bytes())


def save_bytes(household_id: int, data: bytes) -> str:
    ensure_household_upload_dir(household_id)
    key = build_storage_key(household_id)
    path = path_for_storage_key(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encrypt_vault_blob(data))
    return key


def delete_file(storage_key: str | None) -> None:
    if not storage_key:
        return
    try:
        path = path_for_storage_key(storage_key)
    except ValueError:
        return
    if path.is_file():
        path.unlink()
