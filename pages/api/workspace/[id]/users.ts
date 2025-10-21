import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/utils/database';
import { withPermissionCheck } from '@/utils/permissionsManager';

export default withPermissionCheck(async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const { id } = req.query;

	try {
		const workspaceUsers = await prisma.workspaceMember.findMany({
			where: {
				workspaceGroupId: parseInt(id as string)
			},
			include: {
				user: {
					select: {
						userid: true,
						username: true,
						picture: true
					}
				}
			}
		});

		const users = workspaceUsers.map(wu => ({
			userid: wu.user.userid.toString(),
			username: wu.user.username,
			picture: wu.user.picture
		}));

		res.status(200).json(users);
	} catch (error) {
		console.error('Error fetching workspace users:', error);
		res.status(500).json({ error: 'Failed to fetch users' });
	}
}, 'view_sessions');