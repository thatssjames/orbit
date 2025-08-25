// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '@/utils/database'
import { withSessionRoute } from '@/lib/withSession'
import crypto from 'crypto'

type User = {
	userId: number
	username: string
	canMakeWorkspace: boolean
	displayname: string
	thumbnail: string
}

type Data = {
	success: boolean
	error?: string
	workspaceGroupId?: number
}

export default withSessionRoute(async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
	if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
	if (!req.session.userid) return res.status(401).json({ success: false, error: 'Not logged in' })

	// Accept groupId as number or numeric string
	let { groupId, color } = req.body || {}
	if (groupId === undefined || groupId === null) return res.status(400).json({ success: false, error: 'Missing groupId' })
	if (typeof groupId === 'string') {
		if (!/^\d+$/.test(groupId)) return res.status(400).json({ success: false, error: 'Invalid groupId' })
		groupId = parseInt(groupId, 10)
	}
	if (typeof groupId !== 'number' || isNaN(groupId)) return res.status(400).json({ success: false, error: 'Invalid groupId' })

	// Prevent duplicate workspace for same group
	const existingByGroup = await prisma.workspace.findUnique({ where: { groupId } })
	if (existingByGroup) return res.status(409).json({ success: false, error: 'Workspace already exists' })

	// Enforce one workspace per owner
	const alreadyOwns = await prisma.workspace.findFirst({ where: { ownerId: req.session.userid } })
	if (alreadyOwns) return res.status(403).json({ success: false, error: 'You already own a workspace' })

	// Ensure user exists (upsert)
	await prisma.user.upsert({
		where: { userid: req.session.userid },
		update: {},
		create: { userid: req.session.userid }
	})

	// Generate per-workspace session secret (32 hex chars)
	const sessionSecret = crypto.randomBytes(16).toString('hex')

	// Default color fallback
	color = 'bg-orbit'

	 const workspace = await prisma.$transaction(async (tx) => {
		const ws = await tx.workspace.create({
			data: {
				groupId,
				ownerId: req.session.userid,
				sessionSecret
			}
		})

		// Basic customization config (mirrors older behavior)
		await tx.config.create({
			data: {
				key: 'customization',
				workspaceGroupId: groupId,
				value: { color }
			}
		})

		// Create default feature flag configs
		await tx.config.createMany({
			data: [
				{
					key: 'guides',
					workspaceGroupId: groupId,
					value: { enabled: false }
				},
				{
					key: 'allies',
					workspaceGroupId: groupId,
					value: { enabled: false }
				},
				{
					key: 'sessions',
					workspaceGroupId: groupId,
					value: { enabled: false }
				}
			]
		})

		// Owner/Admin role with core permissions
		const role = await tx.role.create({
			data: {
				workspaceGroupId: groupId,
				name: 'Admin',
				isOwnerRole: true,
				permissions: [
					'admin',
					'view_staff_config',
					'manage_sessions',
					'manage_activity',
					'post_on_wall',
					'manage_wall',
					'view_wall',
					'view_members',
					'manage_members',
					'manage_docs',
					'view_entire_groups_activity'
				],
				members: { connect: { userid: req.session.userid } }
			}
		})

		// Mark user as owner flag
		await tx.user.update({
			where: { userid: req.session.userid },
			data: { isOwner: true }
		})

		return ws
	})

	return res.status(200).json({ success: true, workspaceGroupId: workspace.groupId })
})
