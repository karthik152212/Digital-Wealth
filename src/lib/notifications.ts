import { prisma } from "@/lib/prisma";

export async function listMyNotifications(userId: string, take = 8) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      isDemo: true,
      createdAt: true,
    },
  });
  return notifications;
}

export async function isNomineeSomewhere(email: string): Promise<boolean> {
  const count = await prisma.nominee.count({
    where: { email: email.trim().toLowerCase() },
  });
  return count > 0;
}
