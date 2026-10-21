import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/**
 * Verified database reader to guarantee persistent write success.
 * Reads back saved entities to confirm they exist in storage before reporting success.
 */
export async function verifyPersistence(entityType: 'workflow' | 'plan' | 'session' | 'quiz', id: string): Promise<boolean> {
  try {
    switch (entityType) {
      case 'workflow': {
        const wf = await prisma.workflow.findUnique({ where: { id } });
        return wf !== null;
      }
      case 'plan': {
        const plan = await prisma.revisionPlan.findUnique({ where: { id } });
        return plan !== null;
      }
      case 'session': {
        const session = await prisma.studySession.findUnique({ where: { id } });
        return session !== null;
      }
      case 'quiz': {
        const quiz = await prisma.quiz.findUnique({ where: { id }, include: { questions: true } });
        return quiz !== null && quiz.questions.length > 0;
      }
      default:
        return false;
    }
  } catch (error) {
    console.error(`Verification error for ${entityType} ID ${id}:`, error);
    return false;
  }
}
