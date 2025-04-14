// /api/history - Get user trade history
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // TODO: Query database for user history
  res.status(200).json({ history: [] });
}
