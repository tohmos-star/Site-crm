-- AlterTable: doorCodeSecond removed — unused field, only doorCodeMain is used anywhere
ALTER TABLE "Club" DROP COLUMN "doorCodeSecond";

-- AlterTable: doorCodeMain becomes a list of up to 10 codes instead of exactly one.
-- Existing single value (if any) is preserved as a one-element array.
ALTER TABLE "Club"
  ALTER COLUMN "doorCodeMain" DROP DEFAULT,
  ALTER COLUMN "doorCodeMain" TYPE TEXT[] USING (
    CASE WHEN "doorCodeMain" IS NULL OR "doorCodeMain" = '' THEN ARRAY[]::TEXT[] ELSE ARRAY["doorCodeMain"] END
  ),
  ALTER COLUMN "doorCodeMain" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "doorCodeMain" SET NOT NULL;
