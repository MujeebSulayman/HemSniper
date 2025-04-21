import { ethers } from 'ethers';
import { CONFIG } from '../config/config';
import ArbExecutor from '../abi/ArbExecutor.json';

export class ArbitrageExecutor {
    private contract: ethers.Contract;
    private wallet: ethers.Wallet;

    constructor(privateKey: string) {
        const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
        this.wallet = new ethers.Wallet(privateKey, provider);
        this.contract = new ethers.Contract(CONFIG.ARB_EXECUTOR, ArbExecutor.abi, this.wallet);
    }

    async executeArbitrage(params: {
        tokenIn: string;
        tokenOut: string;
        amount: string;
        sourceRouter: string;
        targetRouter: string;
    }) {
        try {
            // Estimate gas
            const gasPrice = await this.wallet.provider.getGasPrice();
            const gasCost = gasPrice.mul(CONFIG.GAS_LIMIT);

            // Check if trade is profitable after gas
            if (!this.isProfitableAfterGas(params, gasCost)) {
                console.log('Trade not profitable after gas costs');
                return null;
            }

            // Execute the arbitrage
            const tx = await this.contract.executeArbitrage({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                amountIn: params.amount,
                minAmountOut: '0', // Calculate this based on expected profit
                dexRouters: [params.sourceRouter, params.targetRouter],
                deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
            }, {
                gasLimit: CONFIG.GAS_LIMIT,
                gasPrice
            });

            console.log('Arbitrage transaction submitted:', tx.hash);
            const receipt = await tx.wait();
            console.log('Arbitrage transaction confirmed');

            return receipt;

        } catch (error) {
            console.error('Error executing arbitrage:', error);
            return null;
        }
    }

    private isProfitableAfterGas(params: any, gasCost: ethers.BigNumber): boolean {
        // Implement profitability check
        // Should consider:
        // - Expected profit from price difference
        // - Gas costs
        // - Minimum profit threshold
        return true;
    }
}
