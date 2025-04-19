//logout of tovy

import { NextApiRequest, NextApiResponse } from "next";
import { withSessionRoute } from '@/lib/withSession'
import { getUsername, getThumbnail, getDisplayName } from '@/utils/userinfoEngine'
import { getRobloxUsername, getRobloxThumbnail, getRobloxDisplayName, getRobloxUserId } from "@/utils/roblox";
import bcrypt from 'bcrypt'
import * as noblox from 'noblox.js'
import prisma from '@/utils/database';
import axios from "axios";

export default withSessionRoute(handler);

type User = {
	userId: number
	username: string
	displayname: string
	thumbnail: string
	isOwner: boolean
}

type DatabaseUser = {
	info: {
		passwordhash: string;
	} | null;
	roles: {
		workspaceGroupId: number;
	}[];
	isOwner: boolean;
}

type DatabaseResponse = DatabaseUser | { error: string };

type response = {
	success: boolean
	error?: string
	user?: User
	workspaces?: {
		groupId: number
		groupthumbnail: string
		groupname: string
	}[]
}

export async function handler(
	req: NextApiRequest,
	res: NextApiResponse<response>
) {
	try {
		if (req.method !== 'POST') {
			return res.status(405).json({ success: false, error: 'Method not allowed' })
		}

		if (!req.body.username || !req.body.password) {
			return res.status(400).json({ success: false, error: 'Username and password are required' })
		}

		const id = await getRobloxUserId(req.body.username, req.headers.origin).catch(e => null) as number | undefined;
		if (!id) {
			return res.status(404).json({ success: false, error: 'Please enter a valid username' })
		}

		const user = await prisma.user.findUnique({
			where: {
				userid: id
			},
			select: {
				info: true,
				roles: true,
				isOwner: true
			}
		}).catch(error => {
			console.error('Database error:', error);
			// Check for specific database connection errors
			if (error.name === 'PrismaClientInitializationError') {
				return { error: 'Database connection error' } as DatabaseResponse;
			}
			return null;
		});

		if (user && 'error' in user) {
			return res.status(503).json({ 
				success: false, 
				error: 'Database service is temporarily unavailable. Please try again later.' 
			});
		}

		if (!user) {
			return res.status(500).json({ 
				success: false, 
				error: 'An error occurred while accessing the database. Please try again later.' 
			});
		}

		if (!user.info?.passwordhash) {
			return res.status(401).json({ success: false, error: 'Invalid username or password' })
		}

		const valid = await bcrypt.compare(req.body.password, user.info.passwordhash)
		if (!valid) {
			return res.status(401).json({ success: false, error: 'Invalid username or password' })
		}

		req.session.userid = id
		await req.session?.save()

		const tovyuser: User = {
			userId: req.session.userid,
			username: await getUsername(req.session.userid),
			displayname: await getDisplayName(req.session.userid),
			thumbnail: await getThumbnail(req.session.userid),
			isOwner: user.isOwner || false
		}

		let roles: any[] = [];
		if (user.roles.length) {
			try {
				for (const role of user.roles) {
					const [logo, group] = await Promise.all([
						noblox.getLogo(role.workspaceGroupId),
						noblox.getGroup(role.workspaceGroupId)
					]);
					
					roles.push({
						groupId: role.workspaceGroupId,
						groupThumbnail: logo,
						groupName: group.name,
					})
				}
			} catch (error) {
				console.error('Error fetching group information:', error);
			}
		}

		return res.status(200).json({ success: true, user: tovyuser, workspaces: roles })
	} catch (error) {
		console.error('Login error:', error);
		return res.status(500).json({ success: false, error: 'An unexpected error occurred during login' })
	}
}
