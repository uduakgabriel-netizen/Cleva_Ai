-- AlterTable
ALTER TABLE "PaymentIntent" ADD COLUMN     "parsedBy" TEXT NOT NULL DEFAULT 'deterministic',
ADD COLUMN     "rawMerchant" TEXT,
ADD COLUMN     "reasoning" TEXT;
