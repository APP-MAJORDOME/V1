"""Dates UTC compatibles colonnes DateTime « naïves » (schéma actuel)."""

from __future__ import annotations

from datetime import datetime, timezone


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
