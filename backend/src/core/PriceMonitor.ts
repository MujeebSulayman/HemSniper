import { ethers } from 'ethers';
import { CONFIG } from '../config/config';
import { ArbitrageExecutor } from './ArbitrageExecutor';
import { IUniswapV2Pool, IUniswapV3Pool } from '../dex/interfaces';

// DEX-specific interfaces and ABIs
import { 
    UNISWAP_V2_FACTORY_ABI,
    UNISWAP_V3_FACTORY_ABI,
    UNISWAP_V2_POOL_ABI,
    UNISWAP_V3_POOL_ABI
} from '../dex/constants';

// Constants for price calculations
const Q96 = ethers.BigNumber.from('2').pow(96);
const PRICE_DENOMINATOR = ethers.BigNumber.from('1000000');  // 6 decimals for price

interface PriceQuote {
    dexRouter: string;
    price: ethers.BigNumber;
    liquidity: ethers.BigNumber;
}

export class PriceMonitor {
    private provider: ethers.providers.Provider;
    private v2Factory: ethers.Contract;
    private v3Factory: ethers.Contract;
    private arbExecutor: ArbitrageExecutor;
    private isMonitoring: boolean;

    constructor(arbExecutor: ArbitrageExecutor) {
        this.provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
        this.v2Factory = new ethers.Contract(CONFIG.UNISWAP_V2_FACTORY, UNISWAP_V2_FACTORY_ABI, this.provider);
        this.v3Factory = new ethers.Contract(CONFIG.UNISWAP_V3_FACTORY, UNISWAP_V3_FACTORY_ABI, this.provider);
        this.arbExecutor = arbExecutor;
        this.isMonitoring = false;
    }

    async getV2Price(tokenA: string, tokenB: string): Promise<PriceQuote | null> {
        try {
            const pairAddress = await this.v2Factory.getPair(tokenA, tokenB);
            if (pairAddress === ethers.constants.AddressZero) return null;

            // Create pool contract instance
            const pool = new ethers.Contract(pairAddress, UNISWAP_V2_POOL_ABI, this.provider) as IUniswapV2Pool;
            
            // Get token ordering
            const token0 = await pool.token0();
            const token1 = await pool.token1();
            const [reserve0, reserve1] = await pool.getReserves();

            // Calculate price based on reserves
            const [baseReserve, quoteReserve] = tokenA.toLowerCase() === token0.toLowerCase() 
                ? [reserve0, reserve1] 
                : [reserve1, reserve0];

            if (baseReserve.isZero() || quoteReserve.isZero()) return null;

            // Price = (quoteReserve * PRICE_DENOMINATOR) / baseReserve
            const price = quoteReserve.mul(PRICE_DENOMINATOR).div(baseReserve);
            
            // Calculate USD liquidity using price
            const liquidity = baseReserve.mul(price).div(PRICE_DENOMINATOR).mul(2);

            return {
                dexRouter: CONFIG.UNISWAP_V2_ROUTER,
                price,
                liquidity
            };
        } catch (error) {
            console.error('Error getting V2 price:', error);
            return null;
        }
    }

    async getV3Price(tokenA: string, tokenB: string): Promise<PriceQuote | null> {
        try {
            const poolAddress = await this.v3Factory.getPool(tokenA, tokenB, 3000); // 0.3% fee tier
            if (poolAddress === ethers.constants.AddressZero) return null;

            // Create pool contract instance
            const pool = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, this.provider) as IUniswapV3Pool;
            
            // Get current price sqrt and tick
            const { sqrtPriceX96 } = await pool.slot0();
            
            // Get token ordering
            const token0 = await pool.token0();
            const token1 = await pool.token1();
            
            // Calculate price from sqrtPriceX96
            const priceX96 = sqrtPriceX96.mul(sqrtPriceX96).div(Q96);
            
            // Adjust price based on token ordering
            const price = tokenA.toLowerCase() === token0.toLowerCase()
                ? priceX96.mul(PRICE_DENOMINATOR).div(Q96)
                : Q96.mul(PRICE_DENOMINATOR).div(priceX96);

            // For V3, we'll estimate liquidity based on price and typical range
            // This is a simplified calculation and should be improved
            const estimatedLiquidity = price.mul(ethers.utils.parseEther('10')); // Assume 10 ETH equivalent

            return {
                dexRouter: CONFIG.UNISWAP_V3_ROUTER,
                price,
                liquidity: estimatedLiquidity
            };
        } catch (error) {
            console.error('Error getting V3 price:', error);
            return null;
        }
    }

    async checkArbitrageProfitability(
        tokenA: string,
        tokenB: string,
        amount: ethers.BigNumber
    ): Promise<void> {
        const v2Price = await this.getV2Price(tokenA, tokenB);
        const v3Price = await this.getV3Price(tokenA, tokenB);

        if (!v2Price || !v3Price) return;

        // Calculate potential profit
        const priceDiff = v2Price.price.sub(v3Price.price).abs();
        const profitPercentage = priceDiff.mul(10000).div(v2Price.price);

        if (profitPercentage.gt(CONFIG.MIN_PROFIT_THRESHOLD)) {
            // Check liquidity
            if (v2Price.liquidity.lt(CONFIG.MIN_LIQUIDITY_USD) || 
                v3Price.liquidity.lt(CONFIG.MIN_LIQUIDITY_USD)) {
                return;
            }

            // Determine direction (which DEX to buy from/sell to)
            const [sourceRouter, targetRouter] = v2Price.price.gt(v3Price.price) 
                ? [v3Price.dexRouter, v2Price.dexRouter]
                : [v2Price.dexRouter, v3Price.dexRouter];

            // Execute arbitrage
            await this.arbExecutor.executeArbitrage({
                tokenIn: tokenA,
                tokenOut: tokenB,
                amountIn: amount.toString(),
                minAmountOut: '0', // Calculate based on expected profit
                dexRouters: [sourceRouter, targetRouter],
                swapData: [], // TODO: Implement swap data encoding
                deadline: Math.floor(Date.now() / 1000) + 300 // 5 minutes
            });
        }
    }

    async startMonitoring(): Promise<void> {
        this.isMonitoring = true;
        
        while (this.isMonitoring) {
            for (const [tokenA, tokenB] of CONFIG.TRADING_PAIRS) {
                const tokenAConfig = CONFIG.TOKENS[tokenA];
                const tokenBConfig = CONFIG.TOKENS[tokenB];
                
                if (!tokenAConfig || !tokenBConfig) continue;

                const amount = ethers.utils.parseUnits(
                    tokenAConfig.minTradeAmount,
                    tokenAConfig.decimals
                );

                await this.checkArbitrageProfitability(
                    tokenAConfig.address,
                    tokenBConfig.address,
                    amount
                );
            }

            // Wait for next polling interval
            await new Promise(resolve => setTimeout(resolve, CONFIG.POLLING_INTERVAL));
        }
    }

    stopMonitoring(): void {
        this.isMonitoring = false;
    }
}
