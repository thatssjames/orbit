import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/utils/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const configs = await prisma.instanceConfig.findMany({
			where: {
				key: { in: ['robloxClientId', 'robloxClientSecret', 'robloxRedirectUri'] }
			}
		});

		const configMap = configs.reduce((acc, config) => {
		acc[config.key] = config.value;
		return acc;
		}, {} as Record<string, any>);
		const clientId = configMap.robloxClientId;
		const clientSecret = configMap.robloxClientSecret;
		const redirectUri = configMap.robloxRedirectUri;
		const available = !!(clientId && clientSecret && redirectUri);

		return res.json({ 
			available,
			configured: {
				clientId: !!clientId,
				clientSecret: !!clientSecret,
				redirectUri: !!redirectUri
			}
		});
	} catch (error) {
		console.error('Failed to check OAuth configuration:', error);
		return res.json({ available: false });
	}
}