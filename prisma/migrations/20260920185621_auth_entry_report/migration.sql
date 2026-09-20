-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "doorCodeMain" TEXT,
ADD COLUMN     "doorCodeSecond" TEXT;

-- AlterTable
ALTER TABLE "Guest" DROP COLUMN "doorCode";

