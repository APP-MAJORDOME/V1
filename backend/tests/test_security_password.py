"""Régression : hachage bcrypt (sans passlib)."""

import bcrypt

from app.core.security import hash_password, verify_password


def test_hash_and_verify_roundtrip():
    h = hash_password("correct horse battery staple")
    assert h.startswith("$2b$")
    assert verify_password("correct horse battery staple", h) is True
    assert verify_password("wrong", h) is False


def test_verify_rejects_empty_hash():
    assert verify_password("x", None) is False
    assert verify_password("x", "") is False


def test_password_truncated_to_bcrypt_72_byte_limit():
    long_pw = "é" * 80  # UTF-8 multi-byte — truncation par octets
    h = hash_password(long_pw)
    assert verify_password(long_pw, h) is True


def test_verify_accepts_hash_produced_by_raw_bcrypt():
    raw = bcrypt.hashpw(b"interop-check", bcrypt.gensalt(rounds=12)).decode("ascii")
    assert verify_password("interop-check", raw) is True
