import { findArbitrageOpportunities } from './agent';

// Simple runner
type Opportunity = any;

async function main() {
  const ops: Opportunity[] = await findArbitrageOpportunities();
  console.log(ops);
}

main();
