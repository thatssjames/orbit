import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/utils/database";

function getDaysUntilBirthday(day: number, month: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let nextBirthday = new Date(today.getFullYear(), month - 1, day);

  if (nextBirthday < today) {
    nextBirthday = new Date(today.getFullYear() + 1, month - 1, day);
  }

  const diffTime = nextBirthday.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const days = Number(req.query.days) || 7;
  const workspaceGroupId = parseInt(req.query.id as string);

  const roles = await prisma.role.findMany({
    where: { workspaceGroupId },
    include: {
      members: {
        select: {
          userid: true,
          username: true,
          picture: true,
          birthdayDay: true,
          birthdayMonth: true,
        }
      }
    }
  });

  const userMap = new Map<string, any>();
  for (const role of roles) {
    for (const user of role.members) {
      if (
        user.birthdayDay !== null &&
        user.birthdayMonth !== null &&
        !userMap.has(user.userid.toString())
      ) {
        userMap.set(user.userid.toString(), user);
      }
    }
  }
  const users = Array.from(userMap.values());

  const birthdays = users
    .map((user) => ({
      ...user,
      userid: user.userid.toString(),
      daysAway: getDaysUntilBirthday(user.birthdayDay as number, user.birthdayMonth as number),
    }))
    .filter((user) => user.daysAway >= 0 && user.daysAway <= days)
    .sort((a, b) => a.daysAway - b.daysAway);

  res.status(200).json({
    birthdays: birthdays.map(({ daysAway, ...user }) => user),
  });
}