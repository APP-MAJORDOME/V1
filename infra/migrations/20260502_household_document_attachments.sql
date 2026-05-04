-- Fichiers associés aux entrées du coffre (stockage local sous MAJORDOME_UPLOAD_DIR).

ALTER TABLE household_documents
    ADD COLUMN IF NOT EXISTS attachment_storage_key VARCHAR(512),
    ADD COLUMN IF NOT EXISTS attachment_original_name VARCHAR(512),
    ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(128),
    ADD COLUMN IF NOT EXISTS attachment_size_bytes INTEGER;
