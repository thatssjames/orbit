// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchworkspace, getConfig, setConfig } from '@/utils/configEngine'
import prisma from '@/utils/database';
import { withSessionRoute } from '@/lib/withSession'
import { withPermissionCheck } from '@/utils/permissionsManager'
import { logAudit } from '@/utils/logs';
import { getUsername, getThumbnail, getDisplayName } from '@/utils/userinfoEngine'
import * as noblox from 'noblox.js'
type Data = {
	success: boolean
	error?: string
}

export default withPermissionCheck(handler, 'admin');

export async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
	const user = await prisma.user.findUnique({
		where: {
			userid: parseInt(req.query.userid as string)
		},
		include: {
			roles: {
				where: {
					workspaceGroupId: parseInt(req.query.id as string)
				},
				orderBy: {
					isOwnerRole: 'desc'
				}
			}
		}
	});
	if (!user?.roles.length) return res.status(404).json({ success: false, error: 'User not found' });
	if (user.roles[0].isOwnerRole) return res.status(403).json({ success: false, error: 'You cannot change the role of the workspace owner' });
	const newrole = await prisma.role.findUnique({
		where: {
			id: req.body.role
		}
	});
	if (!newrole) return res.status(404).json({ success: false, error: 'Role not found' });
	if (newrole.isOwnerRole) return res.status(403).json({ success: false, error: 'You cannot assign anyone to the owner role' });
	if (user.roles.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
	await prisma.user.update({
		where: {
			userid: parseInt(req.query.userid as string)
		},
		data: {
			roles: {
				disconnect: {
					id: user.roles[0].id
				},
				connect: {
					id: req.body.role
				}
			}
		}
	});

	try {
		const afterUser = await prisma.user.findUnique({ where: { userid: parseInt(req.query.userid as string) }, include: { roles: { where: { workspaceGroupId: parseInt(req.query.id as string) } } } });
		await logAudit(parseInt(req.query.id as string), (req as any).session?.userid || null, 'settings.users.update', `user:${req.query.userid}`, { before: { role: user.roles[0].id }, after: { role: req.body.role }, userId: parseInt(req.query.userid as string) });
	} catch (e) {}

	res.status(200).json({ success: true })
}
