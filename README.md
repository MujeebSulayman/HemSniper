# HemSniper AI

HemSniper AI is an advanced cross-chain arbitrage system that leverages artificial intelligence to identify and execute profitable trading opportunities across multiple decentralized exchanges (DEXs) on Ethereum.

## Project Overview

The project consists of four main components:

1. **Smart Contracts**: Solidity contracts for executing arbitrage trades using flash loans
2. **AI Agent**: Machine learning models for identifying profitable arbitrage opportunities
3. **Backend**: API and services for coordinating the AI agent with the smart contracts
4. **Frontend**: User interface for monitoring and configuring the arbitrage system

## Architecture

![HemSniper Architecture](docs/images/architecture.png)

### Key Components

- **ArbExecutor Contract**: Core smart contract that executes arbitrage trades using flash loans
- **AI Prediction Engine**: Analyzes market data to identify profitable trading routes
- **DEX Integration Layer**: Connects to multiple DEXs (Uniswap V2/V3, SushiSwap, Curve, etc.)
- **Monitoring Dashboard**: Real-time visualization of arbitrage opportunities and execution

## Getting Started

### Prerequisites

- Node.js v18+
- Python 3.9+
- Hardhat
- Ethereum wallet with testnet ETH

### Installation

```bash
# Clone the repository
git clone https://github.com/MujeebSulayman/HemSniper.git
cd hemsniper-ai

# Install dependencies for all components
npm run install:all
```

### Configuration

1. Create a `.env` file in the `smart-contracts` directory (use `.env.example` as a template)
2. Configure your Ethereum wallet and RPC endpoints
3. Set up API keys for data providers

### Running the System

```bash
# Deploy smart contracts
cd smart-contracts
npx hardhat run scripts/deploy.js --network <network>

# Start the backend
cd ../backend
npm run start

# Start the frontend
cd ../frontend
npm run dev
```

## Documentation

For detailed documentation on each component, see:

- [Smart Contracts Documentation](docs/smart-contracts.md)
- [AI Agent Documentation](docs/ai-agent.md)
- [Backend API Documentation](docs/backend-api.md)
- [Frontend Documentation](docs/frontend.md)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributors

- Mujeeb Sulayman - Project Lead
