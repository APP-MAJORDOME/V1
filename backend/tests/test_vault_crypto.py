"""Tests chiffrement coffre documents."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet

from app.services import document_attachments as doc_attach
from app.services.vault_crypto import decrypt_vault_blob, encrypt_vault_blob, vault_encryption_enabled


def test_encrypt_decrypt_roundtrip():
    key = Fernet.generate_key().decode()
    with patch("app.services.vault_crypto.settings") as mock_settings:
        mock_settings.vault_encryption_key = key
        import app.services.vault_crypto as vc

        vc._fernet = None
        vc._fernet_init_attempted = False
        plain = b"%PDF-1.4 test facture"
        wrapped = encrypt_vault_blob(plain)
        assert wrapped.startswith(b"MDVENC1")
        assert decrypt_vault_blob(wrapped) == plain


def test_plaintext_legacy_read_without_magic():
    with patch("app.services.vault_crypto.settings") as mock_settings:
        mock_settings.vault_encryption_key = ""
        import app.services.vault_crypto as vc

        vc._fernet = None
        vc._fernet_init_attempted = False
        raw = b"hello legacy"
        assert decrypt_vault_blob(raw) == raw


def test_save_and_read_bytes_encrypted(tmp_path):
    key = Fernet.generate_key().decode()
    with (
        patch("app.services.vault_crypto.settings") as mock_vc,
        patch("app.services.document_attachments.settings") as mock_da,
    ):
        mock_vc.vault_encryption_key = key
        mock_da.upload_dir = str(tmp_path)
        import app.services.vault_crypto as vc

        vc._fernet = None
        vc._fernet_init_attempted = False
        storage_key = doc_attach.save_bytes(42, b"secret pdf")
        on_disk = (tmp_path / "42" / storage_key.split("/")[1]).read_bytes()
        assert on_disk.startswith(b"MDVENC1")
        assert doc_attach.read_bytes(storage_key) == b"secret pdf"
        assert vault_encryption_enabled()
