from unittest.mock import patch

from app.services.alfred_attachments import (
    ALFRED_ATTACHMENT_MIME,
    analyze_alfred_attachment,
    extract_pdf_text,
    resolve_attachment_mime,
)


def test_resolve_attachment_mime_from_extension():
    assert (
        resolve_attachment_mime("facture.pdf", "application/octet-stream")
        == "application/pdf"
    )
    assert resolve_attachment_mime("scan.JPG", None) == "image/jpeg"


def test_analyze_docx_fallback_without_llm():
  sample = (
      b"PK\x03\x04"
  )
  with patch("app.services.alfred_attachments.extract_docx_text", return_value="Ligne une\nLigne deux"):
    with patch("app.services.alfred_attachments._answer_with_openai_text", return_value=None):
      out = analyze_alfred_attachment(
          sample,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "notes.docx",
          "Résume ce document",
          None,
      )
  assert out["intent"] == "document_analyze"
  assert "Ligne une" in out["explanation"]


def test_analyze_unsupported_doc_format():
    out = analyze_alfred_attachment(
        b"legacy",
        "application/msword",
        "old.doc",
        "",
        None,
    )
    assert out["mode"] == "suggest"
    assert "DOCX" in out["explanation"] or "PDF" in out["explanation"]


@patch("app.services.alfred_attachments._answer_with_openai_vision", return_value="Facture EDF 120 €")
def test_analyze_image(mock_vision):
    out = analyze_alfred_attachment(b"\xff\xd8\xff", "image/jpeg", "facture.jpg", "Que vois-tu ?", None)
    mock_vision.assert_called_once()
    assert out["proposal"]["kind"] == "image"
    assert "EDF" in out["explanation"]


def test_pdf_extract_empty_on_invalid_bytes():
    assert extract_pdf_text(b"not-a-pdf") == ""
