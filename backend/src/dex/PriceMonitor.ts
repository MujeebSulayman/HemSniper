import { ethers } from 'ethers';
import { CONFIG } from '../config/config';
import { IUniswapV2Pool, IUniswapV3Pool } from './interfaces';
import { UNISWAP_V2_FACTORY, UNISWAP_V3_FACTORY, UNISWAP_V2_FACTORY_ABI, UNISWAP_V3_FACTORY_ABI } from './constants';
import { UNISWAP_V2_POOL_ABI, UNISWAP_V3_POOL_ABI } from './pool-abis';

export class PriceMonitor {
    private provider: ethers.providers.JsonRpcProvider;
    private v2Pools: Map<string, IUniswapV2Pool>;
    private v3Pools: Map<string, IUniswapV3Pool>;
    private v2Factory: ethers.Contract;
    private v3Factory: ethers.Contract;

    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
        this.v2Pools = new Map();
        this.v3Pools = new Map();
        
        // Initialize factory contracts
        this.v2Factory = new ethers.Contract(UNISWAP_V2_FACTORY, UNISWAP_V2_FACTORY_ABI, this.provider);
        this.v3Factory = new ethers.Contract(UNISWAP_V3_FACTORY, UNISWAP_V3_FACTORY_ABI, this.provider);
    }

    async init() {
        console.log('Initializing pools for trading pairs...');
        const initializedPairs: string[] = [];

        for (const [token0Symbol, token1Symbol] of CONFIG.TRADING_PAIRS) {
            try {
                const token0 = CONFIG.TOKENS[token0Symbol].address;
                const token1 = CONFIG.TOKENS[token1Symbol].address;

                if (!token0 || !token1) {
                    console.error(`Missing token address for ${token0Symbol} or ${token1Symbol}`);
                    continue;
                }

                // Initialize V2 pools with retry
                const v2PoolAddress = await this.retryOperation(
                    () => this.getV2PoolAddress(token0, token1),
                    3
                );

                if (v2PoolAddress && v2PoolAddress !== ethers.constants.AddressZero) {
                    try {
                        const v2Pool = new ethers.Contract(v2PoolAddress, UNISWAP_V2_POOL_ABI, this.provider) as unknown as IUniswapV2Pool;
                        // Verify pool is valid by checking reserves
                        const [reserve0, reserve1] = await v2Pool.getReserves();
                        if (reserve0.gt(0) || reserve1.gt(0)) {
                            this.v2Pools.set(`${token0Symbol}-${token1Symbol}`, v2Pool);
                            console.log(`✅ Initialized Uniswap V2 pool for ${token0Symbol}-${token1Symbol}`);
                        } else {
                            console.log(`⚠️ Skipping V2 pool ${token0Symbol}-${token1Symbol} (no liquidity)`);
                        }
                    } catch (error) {
                        console.error(`Error initializing V2 pool for ${token0Symbol}-${token1Symbol}:`, error);
                    }
                }

                // Initialize V3 pools with retry
                const v3PoolAddress = await this.retryOperation(
                    () => this.getV3PoolAddress(token0, token1),
                    3
                );

                if (v3PoolAddress && v3PoolAddress !== ethers.constants.AddressZero) {
                    try {
                        const v3Pool = new ethers.Contract(v3PoolAddress, UNISWAP_V3_POOL_ABI, this.provider) as unknown as IUniswapV3Pool;
                        // Verify pool is valid by checking slot0
                        const slot0 = await v3Pool.slot0();
                        if (slot0.sqrtPriceX96.gt(0)) {
                            this.v3Pools.set(`${token0Symbol}-${token1Symbol}`, v3Pool);
                            console.log(`✅ Initialized Uniswap V3 pool for ${token0Symbol}-${token1Symbol}`);
                        } else {
                            console.log(`⚠️ Skipping V3 pool ${token0Symbol}-${token1Symbol} (no liquidity)`);
                        }
                    } catch (error) {
                        console.error(`Error initializing V3 pool for ${token0Symbol}-${token1Symbol}:`, error);
                    }
                }

                // Track successfully initialized pairs
                if (this.v2Pools.has(`${token0Symbol}-${token1Symbol}`) || 
                    this.v3Pools.has(`${token0Symbol}-${token1Symbol}`)) {
                    initializedPairs.push(`${token0Symbol}-${token1Symbol}`);
                }

            } catch (error) {
                console.error(`Failed to initialize ${token0Symbol}-${token1Symbol}:`, error);
            }
        }

        console.log('\nInitialization complete:');
        console.log(`- Total pairs initialized: ${initializedPairs.length}`);
        console.log(`- V2 pools: ${this.v2Pools.size}`);
        console.log(`- V3 pools: ${this.v3Pools.size}`);
        console.log('- Active pairs:', initializedPairs.join(', '));
    }

    async monitorPrices() {
        for (const [pairSymbol, v2Pool] of this.v2Pools) {
            try {
                const v3Pool = this.v3Pools.get(pairSymbol);
                if (!v3Pool) continue;

                // Get prices from both pools with timeout protection
                const [v2Price, v3Price] = await Promise.all([
                    this.getV2PriceWithTimeout(v2Pool, 5000),
                    this.getV3PriceWithTimeout(v3Pool, 5000)
                ]);

                if (!v2Price || !v3Price) {
                    console.warn(`Skipping ${pairSymbol} due to timeout`);
                    continue;
                }

                // Calculate slippage
                const slippage = this.calculateSlippage(v2Price, v3Price);
                
                if (this.isProfitableSlippage(slippage)) {
                    const opportunity = {
                        pair: pairSymbol,
                        v2Price,
                        v3Price,
                        slippage,
                        timestamp: Date.now(),
                        estimatedProfit: this.calculateEstimatedProfit(v2Price, v3Price)
                    };

                    this.emitArbitrageOpportunity(opportunity);
                }
            } catch (error) {
                console.error(`Error monitoring ${pairSymbol}:`, error);
            }
        }
    }

    private calculateSlippage(price1: number, price2: number): number {
        return Math.abs(price1 - price2) / Math.min(price1, price2) * 100;
    }

    private isProfitableSlippage(slippage: number): boolean {
        return slippage > CONFIG.MIN_PROFIT_THRESHOLD;
    }

    private async getV2Price(pool: ethers.Contract): Promise<number> {
        const [reserve0, reserve1] = await pool.getReserves();
        return reserve0.div(reserve1).toNumber();
    }

    private async getV3Price(pool: ethers.Contract): Promise<number> {
        const slot0 = await pool.slot0();
        return this.sqrtPriceX96ToPrice(slot0.sqrtPriceX96);
    }

    private sqrtPriceX96ToPrice(sqrtPriceX96: ethers.BigNumber): number {
        const Q96 = ethers.BigNumber.from('2').pow(96);
        return sqrtPriceX96.mul(sqrtPriceX96).div(Q96).div(Q96).toNumber();
    }

    private async retryOperation<T>(operation: () => Promise<T>, maxRetries: number): Promise<T | null> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        return null;
    }

    private async getV2PriceWithTimeout(pool: IUniswapV2Pool, timeout: number): Promise<number | null> {
        try {
            const result = await Promise.race([
                this.getV2Price(pool),
                new Promise<null>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), timeout)
                )
            ]);
            return result as number;
        } catch (error) {
            console.warn('V2 price fetch timeout');
            return null;
        }
    }

    private async getV3PriceWithTimeout(pool: IUniswapV3Pool, timeout: number): Promise<number | null> {
        try {
            const result = await Promise.race([
                this.getV3Price(pool),
                new Promise<null>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), timeout)
                )
            ]);
            return result as number;
        } catch (error) {
            console.warn('V3 price fetch timeout');
            return null;
        }
    }

    private calculateEstimatedProfit(price1: number, price2: number): number {
        const priceDiff = Math.abs(price1 - price2);
        const basePrice = Math.min(price1, price2);
        return (priceDiff / basePrice) * 100; // Return as percentage
    }

    private emitArbitrageOpportunity(opportunity: {
        pair: string;
        v2Price: number;
        v3Price: number;
        slippage: number;
        timestamp: number;
        estimatedProfit: number;
    }) {
        console.log('\n🔥 Arbitrage Opportunity Detected!');
        console.log(`Pair: ${opportunity.pair}`);
        console.log(`V2 Price: ${opportunity.v2Price}`);
        console.log(`V3 Price: ${opportunity.v3Price}`);
        console.log(`Slippage: ${opportunity.slippage.toFixed(2)}%`);
        console.log(`Estimated Profit: ${opportunity.estimatedProfit.toFixed(2)}%`);
        console.log(`Timestamp: ${new Date(opportunity.timestamp).toISOString()}\n`);
    }

    // Helper methods to get pool addresses
    private async getV2PoolAddress(token0: string, token1: string): Promise<string> {
        return await this.v2Factory.getPair(token0, token1);
    }

    private async getV3PoolAddress(token0: string, token1: string): Promise<string> {
        const fee = 3000; // 0.3% fee tier
        return await this.v3Factory.getPool(token0, token1, fee);
    }
}
