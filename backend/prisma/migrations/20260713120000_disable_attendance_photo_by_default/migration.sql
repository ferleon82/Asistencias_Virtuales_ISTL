UPDATE "system_settings"
SET "value" = 'false',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'attendance_photo_required'
  AND "value" = 'true';
