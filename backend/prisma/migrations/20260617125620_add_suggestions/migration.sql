-- CreateEnum
CREATE TYPE "SuggestionCategory" AS ENUM ('COMMON_AREAS', 'SECURITY', 'SUSTAINABILITY', 'INFRASTRUCTURE', 'FINANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'PLANNED', 'DONE', 'REJECTED');

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "condominiumId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SuggestionCategory" NOT NULL DEFAULT 'OTHER',
    "status" "SuggestionStatus" NOT NULL DEFAULT 'OPEN',
    "responseMessage" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionVote" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suggestion_condominiumId_status_idx" ON "Suggestion"("condominiumId", "status");

-- CreateIndex
CREATE INDEX "SuggestionVote_suggestionId_idx" ON "SuggestionVote"("suggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionVote_suggestionId_residentId_key" ON "SuggestionVote"("suggestionId", "residentId");

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionVote" ADD CONSTRAINT "SuggestionVote_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionVote" ADD CONSTRAINT "SuggestionVote_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
