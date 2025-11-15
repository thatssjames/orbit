import prisma from './database';

export type AuditDetails = Record<string, any>;

export async function logAudit(workspaceGroupId: number, userId: number | null, action: string, entity?: string, details?: AuditDetails) {
  try {
    const p: any = prisma as any;
    if (p && p.auditLog) {
      await p.auditLog.create({
        data: {
          workspaceGroupId,
          userId: userId ? BigInt(userId) : undefined,
          action,
          entity: entity || null,
          details: details || null,
        },
      });

      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await p.auditLog.deleteMany({
        where: {
          workspaceGroupId,
          createdAt: { lt: cutoff },
        },
      });
      return;
    }

    const detailsJson = details ? JSON.stringify(details) : null;
    await prisma.$executeRaw`
      INSERT INTO "AuditLog" ("workspaceGroupId","userId","action","entity","details","createdAt")
      VALUES (${workspaceGroupId}, ${userId ? BigInt(userId) : null}, ${action}, ${entity || null}, ${detailsJson}::jsonb, NOW())`;

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.$executeRaw`
      DELETE FROM "AuditLog" WHERE "workspaceGroupId" = ${workspaceGroupId} AND "createdAt" < ${cutoff}`;
  } catch (e) {
    console.error('[Audit] Failed to log audit', e);
  }
}

export async function queryAudit(workspaceGroupId: number, opts: { userId?: number; action?: string; search?: string; skip?: number; take?: number } = {}) {
  const where: any = { workspaceGroupId };
  if (opts.userId) where.userId = BigInt(opts.userId);
  if (opts.action) where.action = opts.action;
  if (opts.search) {
    where.OR = [
      { action: { contains: opts.search, mode: 'insensitive' } },
      { entity: { contains: opts.search, mode: 'insensitive' } },
      { details: { path: [], array_contains: [] } },
    ];
  }

  try {
    const p: any = prisma as any;
    if (p && p.auditLog) {
      const [rows, total] = await Promise.all([
        p.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: opts.skip || 0, take: opts.take || 50 }),
        p.auditLog.count({ where }),
      ]);
      const sanitize = (v: any): any => {
        if (v === null || v === undefined) return v;
        if (typeof v === 'bigint') return v.toString();
        if (Array.isArray(v)) return v.map(sanitize);
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'object') {
          const out: any = {};
          for (const k of Object.keys(v)) out[k] = sanitize(v[k]);
          return out;
        }
        return v;
      };

      return { rows: rows.map(sanitize), total };
    }

    const clauses: string[] = ['"workspaceGroupId" = $1'];
    const params: any[] = [workspaceGroupId];
    let idx = 2;
    if (opts.userId) {
      clauses.push(`"userId" = $${idx++}`);
      params.push(BigInt(opts.userId));
    }
    if (opts.action) {
      clauses.push(`"action" = $${idx++}`);
      params.push(opts.action);
    }
    if (opts.search) {
      clauses.push(`(LOWER("action") LIKE LOWER($${idx}) OR LOWER(COALESCE("entity", '')) LIKE LOWER($${idx}) OR LOWER(COALESCE(CAST("details" AS TEXT), '')) LIKE LOWER($${idx}))`);
      params.push(`%${opts.search}%`);
      idx++;
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const take = opts.take || 50;
    const skip = opts.skip || 0;

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "AuditLog" ${whereSql} ORDER BY "createdAt" DESC LIMIT ${take} OFFSET ${skip}`,
      ...params
    );

    const countRes: any = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS cnt FROM "AuditLog" ${whereSql}`,
      ...params
    );
    const total = Array.isArray(countRes) && countRes[0] ? Number(countRes[0].cnt || countRes[0].count || 0) : 0;

    return { rows, total };
  } catch (e) {
    console.error('[Audit] Error querying audits', e);
    throw e;
  }
}

export default { logAudit, queryAudit };
