// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchworkspace, getConfig, setConfig } from '@/utils/configEngine'
import prisma from '@/utils/database';
import { withSessionRoute } from '@/lib/withSession'
import { withPermissionCheck } from '@/utils/permissionsManager'
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
	if (req.method !== 'DELETE') return res.status(405).json({ success: false, error: 'Method not allowed' });

	const workspaceId = parseInt(req.query.id as string);
	const userId = parseInt(req.query.userid as string);

	// Check if the workspace has more than one user
	const userCount = await prisma.user.count({
		where: {
			roles: {
				some: {
					workspaceGroupId: workspaceId
				}
			}
		}
	});

	if (userCount <= 1) {
		return res.status(403).json({ success: false, error: 'You cannot remove the last user from a workspace' });
	}

	const user = await prisma.user.findUnique({
		where: {
			userid: userId
		},
		include: {
			roles: {
				where: {
					workspaceGroupId: workspaceId
				}
			}
		}
	});

	if (!user?.roles.length) return res.status(404).json({ success: false, error: 'User not found' });
	if (user.roles[0].isOwnerRole) return res.status(403).json({ success: false, error: 'You cannot remove the owner of a workspace' });

	await prisma.user.update({
		where: {
			userid: userId
		},
		data: {
			roles: {
				disconnect: {
					id: user.roles[0].id
				}
			}
		}
	});

	res.status(200).json({ success: true });
}

