import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const configured = !!process.env.INTERCOM_API_SECRET;
  return res.status(200).json({ configured });
}
