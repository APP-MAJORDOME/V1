"""Chiffrement au repos des pièces jointes du coffre (Fernet)."""

from __future__ import annotations

import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)

_VAULT_ENC_MAGIC = b"MDVENC1"
_fernet: Fernet | None = None
_fernet_init_attempted = False


def vault_encryption_enabled() -> bool:
    return bool((settings.vault_encryption_key or "").strip())


def _get_fernet() -> Fernet | None:
    global _fernet, _fernet_init_attempted
    if _fernet_init_attempted:
        return _fernet
    _fernet_init_attempted = True
    raw = (settings.vault_encryption_key or "").strip()
    if not raw:
        return None
    try:
        _fernet = Fernet(raw.encode("ascii") if isinstance(raw, str) else raw)
    except Exception as exc:
        logger.error("Invalid MAJORDOME_VAULT_ENCRYPTION_KEY: %s", exc)
        _fernet = None
    return _fernet


def encrypt_vault_blob(plain: bytes) -> bytes:
    f = _get_fernet()
    if f is None:
        return plain
    return _VAULT_ENC_MAGIC + f.encrypt(plain)


def decrypt_vault_blob(stored: bytes) -> bytes:
    if stored.startswith(_VAULT_ENC_MAGIC):
        f = _get_fernet()
        if f is None:
            raise ValueError("vault_encrypted_but_no_key")
        try:
            return f.decrypt(stored[len(_VAULT_ENC_MAGIC) :])
        except InvalidToken as exc:
            raise ValueError("vault_decrypt_failed") from exc
    return stored
