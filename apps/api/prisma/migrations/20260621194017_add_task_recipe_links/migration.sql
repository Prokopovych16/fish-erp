-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "recipeStageIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
