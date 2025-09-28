// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchworkspace, getConfig, setConfig } from '@/utils/configEngine'
import prisma from '@/utils/database';
import { withPermissionCheck } from '@/utils/permissionsManager'
import { getUsername, getThumbnail, getDisplayName } from '@/utils/userinfoEngine'
import * as noblox from 'noblox.js'
type Data = {
	success: boolean
	error?: string
}

export default withPermissionCheck(handler, 'manage_docs');

export async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
	if (!req.query.docid) return res.status(400).json({ success: false, error: 'Document ID not provided' });
	const workspaceId = parseInt(req.query.id as string);
	const result = await prisma.document.deleteMany({
		where: {
			id: (req.query.docid as string),
			workspaceGroupId: workspaceId
		}
	});
	if (result.count === 0) return res.status(404).json({ success: false, error: 'Document not found in this workspace' });

	res.status(200).json({ success: true })
}
