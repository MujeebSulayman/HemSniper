import { ethers } from 'ethers';
import { CONFIG } from '../config/config';
import { ArbitrageExecutor } from '../core/ArbitrageExecutor';
import { PriceMonitor } from '../core/PriceMonitor';

export class ArbitrageBot {
    private executor: ArbitrageExecutor;
    private priceMonitor: PriceMonitor;

    constructor() {
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY not found in environment variables');
        }

        // Initialize components
        this.executor = new ArbitrageExecutor(process.env.PRIVATE_KEY);
        this.priceMonitor = new PriceMonitor(this.executor);
    }

    async init() {
        try {
            console.log('Initializing arbitrage bot...');
            console.log(`Network: ${CONFIG.NETWORK}`);
            console.log(`Chain ID: ${CONFIG.CHAIN_ID}`);

            // Validate token configurations
            for (const [symbol, token] of Object.entries(CONFIG.TOKENS)) {
                if (!ethers.utils.isAddress(token.address)) {
                    throw new Error(`Invalid ${symbol} address: ${token.address}`);
                }
                console.log(`✓ ${symbol}: ${token.address}`);
            }

            // Validate DEX configurations
            const requiredDexes = [
                { name: 'Uniswap V2 Router', address: CONFIG.UNISWAP_V2_ROUTER },
                { name: 'Uniswap V3 Router', address: CONFIG.UNISWAP_V3_ROUTER }
            ];

            for (const dex of requiredDexes) {
                if (!ethers.utils.isAddress(dex.address)) {
                    throw new Error(`Invalid ${dex.name} address: ${dex.address}`);
                }
                console.log(`✓ ${dex.name}: ${dex.address}`);
            }

            console.log('\nBot initialized successfully! ✨');
            console.log('\nTrading Parameters:');
            console.log(`- Minimum profit threshold: ${CONFIG.MIN_PROFIT_THRESHOLD}%`);
            console.log(`- Minimum pool liquidity: $${CONFIG.MIN_LIQUIDITY_USD}`);
            console.log(`- Maximum slippage: ${CONFIG.MAX_SLIPPAGE}%`);
            console.log(`- Gas limit: ${CONFIG.GAS_LIMIT}`);
            console.log(`- Priority fee: ${ethers.utils.formatUnits(CONFIG.PRIORITY_FEE, 'gwei')} gwei`);
            console.log(`- Max fee per gas: ${ethers.utils.formatUnits(CONFIG.MAX_FEE_PER_GAS, 'gwei')} gwei`);

            return true;
        } catch (error) {
            console.error('Error initializing bot:', error);
            return false;
        }
    }

    async start() {
        try {
            if (!await this.init()) {
                throw new Error('Bot initialization failed');
            }

            console.log('\nStarting price monitoring...');
            console.log('Monitoring trading pairs:', CONFIG.TRADING_PAIRS);
            
            await this.priceMonitor.startMonitoring();
        } catch (error) {
            console.error('Error starting bot:', error);
            this.stop();
        }
    }

    stop() {
        console.log('\nStopping bot...');
        this.priceMonitor.stopMonitoring();
    }
}
