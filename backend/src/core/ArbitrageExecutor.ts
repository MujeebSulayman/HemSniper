import { ethers } from 'ethers';
import { CONFIG } from '../config/config';
import ArbExecutor from '../abi/ArbExecutor.json';

enum DexType {
    UniswapV2,
    UniswapV3,
    Curve,
    Balancer
}

interface ArbitrageParams {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    minAmountOut: string;
    dexRouters: string[];
    swapData: string[];
    deadline: number;
}

export class ArbitrageExecutor {
    private contract: ethers.Contract;
    private wallet: ethers.Wallet;

    constructor(privateKey: string) {
        const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
        this.wallet = new ethers.Wallet(privateKey, provider);
        this.contract = new ethers.Contract(CONFIG.ARB_EXECUTOR, ArbExecutor.abi, this.wallet);
    }

    async executeArbitrage(params: ArbitrageParams) {
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
            const tx = await this.contract.executeArbitrage(
                params,
                {
                    gasLimit: CONFIG.GAS_LIMIT,
                    maxFeePerGas: CONFIG.MAX_FEE_PER_GAS,
                    maxPriorityFeePerGas: CONFIG.PRIORITY_FEE
                }
            );

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
