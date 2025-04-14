// /api/opportunities - Fetches real-time arbitrage opportunities
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // TODO: Call AI agent to get opportunities
  res.status(200).json({ opportunities: [] });
}
