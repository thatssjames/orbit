// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { getUsername, getThumbnail, getDisplayName } from '@/utils/userinfoEngine'
import { User } from '@/types/index.d'
import { PrismaClient } from '@prisma/client'
import * as noblox from 'noblox.js'
import { withSessionRoute } from '@/lib/withSession'
import * as bcrypt from 'bcrypt'
const prisma = new PrismaClient()
import { setRegistry } from '@/utils/registryManager'
import { getRobloxUsername, getRobloxThumbnail, getRobloxDisplayName, getRobloxUserId } from "@/utils/roblox";

type Data = {
	success: boolean
	error?: string
	user?: User & { isOwner: boolean }
}

type requestData = {
	groupid: number
	username: string;
}

export default withSessionRoute(handler)

export async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
	let userid = await getRobloxUserId(req.body.username, req.headers.origin).catch(e => null) as number | undefined;

	console.log("we got the userid in setup workspace")
	console.log(userid);

	if (!userid) {
		console.log("we got an error in setup workspace. tf???")
		res.status(404).json({ success: false, error: 'Username not found' })
		return
	};
	const workspaceCount = await prisma.workspace.count({})
	if (workspaceCount > 0) {
		res.status(403).json({ success: false, error: 'Workspace already exists' })
		return
	}
	await prisma.workspace.create({
		data: {
			groupId: parseInt(req.body.groupid)
		}
	})

	// Initialize all required configs
	await Promise.all([
		prisma.config.create({
			data: {
				key: "customization",
				workspaceGroupId: parseInt(req.body.groupid),
				value: {
					color: req.body.color
				}
			}
		}),
		prisma.config.create({
			data: {
				key: "theme",
				workspaceGroupId: parseInt(req.body.groupid),
				value: req.body.color
			}
		}),
		prisma.config.create({
			data: {
				key: "guides",
				workspaceGroupId: parseInt(req.body.groupid),
				value: {
					enabled: true
				}
			}
		}),
		prisma.config.create({
			data: {
				key: "sessions",
				workspaceGroupId: parseInt(req.body.groupid),
				value: {
					enabled: true
				}
			}
		}),
		prisma.config.create({
			data: {
				key: "home",
				workspaceGroupId: parseInt(req.body.groupid),
				value: {
					widgets: []
				}
			}
		})
	]);

	const role = await prisma.role.create({
		data: {
			workspaceGroupId: parseInt(req.body.groupid),
			name: "Admin",
			isOwnerRole: true,
			permissions: [
				'admin',
				'view_staff_config',
				'manage_sessions',
				'manage_activity',
				'post_on_wall',
				'view_wall',
				'view_members',
				'manage_members',
				'manage_docs',
				'view_entire_groups_activity'
			]
		}
	});

	await prisma.user.create({
		data: {
			userid: userid,
			info: {
				create: {
					passwordhash: await bcrypt.hash(req.body.password, 10),
				}
			},
			isOwner: true,
			roles: {
				connect: {
					id: role.id
				}
			}
		}
	});

	req.session.userid = userid
	await req.session?.save()

	const user: User & { isOwner: boolean } = {
		userId: req.session.userid,
		username: await getUsername(req.session.userid),
		displayname: await getDisplayName(req.session.userid),
		thumbnail: await getThumbnail(req.session.userid),
		isOwner: true
	}

	await setRegistry((req.headers.host as string))

	res.status(200).json({ success: true, user })
}