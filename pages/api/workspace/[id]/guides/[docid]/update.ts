import type { NextApiRequest, NextApiResponse } from 'next'
import { withPermissionCheck } from '@/utils/permissionsManager'
import prisma from '@/utils/database';

type Data = {
	success: boolean
	error?: string
	document?: any
}

export default withPermissionCheck(handler, 'manage_docs');

export async function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
	if (!req.query.docid) return res.status(400).json({ success: false, error: 'Document ID not provided' });
	
	const { name, content, roles } = req.body;
	if (!name || !content || !roles) return res.status(400).json({ success: false, error: 'Missing required fields' });
	const workspaceId = parseInt(req.query.id as string);

	try {
		const document = await prisma.$transaction(async (tx) => {
			const found = await tx.document.findFirst({
				where: {
					id: req.query.docid as string,
					workspaceGroupId: workspaceId
				},
				select: { id: true }
			});
			if (!found) throw new Error('NOT_FOUND');
			return await tx.document.update({
				where: { id: req.query.docid as string },
				data: {
					name,
					content,
					roles: {
						set: [],
						connect: roles.map((role: string) => ({ id: role }))
					}
				}
			});
		});

		return res.status(200).json({
			success: true,
			document: JSON.parse(JSON.stringify(document, (key, value) => (typeof value === 'bigint' ? value.toString() : value)))
		});
	} catch (e: any) {
		if (e && e.message === 'NOT_FOUND') {
			return res.status(404).json({ success: false, error: 'Document not found in this workspace' });
		}
		return res.status(500).json({ success: false, error: 'Internal server error' });
	}
}
