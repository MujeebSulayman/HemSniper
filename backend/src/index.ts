import { PriceMonitor } from './dex/PriceMonitor';
import { ArbitrageExecutor } from './core/ArbitrageExecutor';
import { CONFIG } from './config/config';

class ArbitrageBot {
    private priceMonitor: PriceMonitor;
    private executor: ArbitrageExecutor;

    constructor() {
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY not found in environment variables');
        }

        this.priceMonitor = new PriceMonitor();
        this.executor = new ArbitrageExecutor(process.env.PRIVATE_KEY);
    }

    async start() {
        console.log('Initializing arbitrage bot...');
        
        // Initialize price monitor
        await this.priceMonitor.init();
        console.log('Price monitor initialized');

        // Start monitoring prices
        setInterval(async () => {
            try {
                await this.priceMonitor.monitorPrices();
            } catch (error) {
                console.error('Error monitoring prices:', error);
            }
        }, CONFIG.POLLING_INTERVAL);

        console.log('Bot started successfully');
    }
}

// Start the bot
const bot = new ArbitrageBot();
bot.start().catch(console.error);
