-- Un foyer peut avoir une ligne wellness par utilisateur (F1-7).
ALTER TABLE household_moi_wellness DROP CONSTRAINT IF EXISTS household_moi_wellness_household_id_key;

-- Rattacher les lignes legacy (user_id NULL) au propriétaire du foyer.
UPDATE household_moi_wellness w
SET user_id = sub.uid
FROM (
  SELECT
    w2.id AS wid,
    (
      SELECT h.owner_user_id
      FROM households h
      WHERE h.id = w2.household_id AND h.owner_user_id IS NOT NULL
      LIMIT 1
    ) AS uid
  FROM household_moi_wellness w2
  WHERE w2.user_id IS NULL
) sub
WHERE w.id = sub.wid AND sub.uid IS NOT NULL;
