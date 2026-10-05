CREATE TABLE "Fop" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "edrpou"      TEXT,
  "ipn"         TEXT,
  "iban"        TEXT,
  "address"     TEXT,
  "phone"       TEXT,
  "director"    TEXT,
  "isDefault"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Fop_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "fopId" TEXT;

ALTER TABLE "Order" ADD CONSTRAINT "Order_fopId_fkey"
  FOREIGN KEY ("fopId") REFERENCES "Fop"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
