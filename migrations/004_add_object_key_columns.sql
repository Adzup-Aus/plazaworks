-- S3-style object key for all uploads (single format: uploads/{uuid}.{ext})
ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS object_key varchar(512);
ALTER TABLE job_receipts ADD COLUMN IF NOT EXISTS object_key varchar(512);
ALTER TABLE milestone_media ADD COLUMN IF NOT EXISTS object_key varchar(512);
