import dotenv from 'dotenv';
dotenv.config();

export interface TokenConfig {
    address: string;
    decimals: number;
    minTradeAmount: string;
    maxTradeAmount: string;
}

export const CONFIG = {
    // Network
    RPC_URL: process.env.INFURA_API_KEY ? 
        `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}` : '',
    NETWORK: 'sepolia',
    CHAIN_ID: 11155111, // Sepolia
    
    // Contract Addresses
    ARB_EXECUTOR: process.env.ARB_EXECUTOR || '',
    UNISWAP_V2_ROUTER: process.env.UNISWAP_V2_ROUTER_SEPOLIA || '',
    UNISWAP_V3_ROUTER: process.env.UNISWAP_V3_ROUTER_SEPOLIA || '',
    UNISWAP_V2_FACTORY: process.env.UNISWAP_V2_FACTORY_SEPOLIA || '',
    UNISWAP_V3_FACTORY: process.env.UNISWAP_V3_FACTORY_SEPOLIA || '',
    
    // Tokens to monitor
    TOKENS: {
        WETH: {
            address: process.env.WETH_ADDRESS,
            decimals: 18,
            minTradeAmount: '100000000000000000', // 0.1 ETH
            maxTradeAmount: '1000000000000000000'  // 1 ETH
        },
        USDC: {
            address: process.env.USDC_ADDRESS,
            decimals: 6,
            minTradeAmount: '100000000', // 100 USDC
            maxTradeAmount: '1000000000' // 1000 USDC
        },
        USDT: {
            address: process.env.USDT_ADDRESS,
            decimals: 6,
            minTradeAmount: '100000000', // 100 USDT
            maxTradeAmount: '1000000000' // 1000 USDT
        },
        DAI: {
            address: process.env.DAI_ADDRESS,
            decimals: 18,
            minTradeAmount: '100000000000000000000', // 100 DAI
            maxTradeAmount: '1000000000000000000000' // 1000 DAI
        },
        UNI: {
            address: process.env.UNI_ADDRESS,
            decimals: 18,
            minTradeAmount: '10000000000000000000', // 10 UNI
            maxTradeAmount: '100000000000000000000' // 100 UNI
        },
        WBTC: {
            address: process.env.WBTC_ADDRESS,
            decimals: 8,
            minTradeAmount: '1000000', // 0.01 WBTC
            maxTradeAmount: '10000000' // 0.1 WBTC
        },
        LINK: {
            address: process.env.LINK_ADDRESS,
            decimals: 18,
            minTradeAmount: '10000000000000000000', // 10 LINK
            maxTradeAmount: '100000000000000000000' // 100 LINK
        },
        AAVE: {
            address: process.env.AAVE_ADDRESS,
            decimals: 18,
            minTradeAmount: '1000000000000000000', // 1 AAVE
            maxTradeAmount: '10000000000000000000' // 10 AAVE
        }
    } as Record<string, TokenConfig>,
    
    // Trading parameters
    MIN_PROFIT_THRESHOLD: 0.5, // 0.5%
    MIN_LIQUIDITY_USD: 10000, // Minimum pool liquidity in USD
    GAS_LIMIT: 500000,
    MAX_SLIPPAGE: 1, // 1%
    PRIORITY_FEE: '2000000000', // 2 gwei
    MAX_FEE_PER_GAS: '100000000000', // 100 gwei
    
    // Monitoring
    POLLING_INTERVAL: 1000, 
    PRICE_FETCH_TIMEOUT: 5000, 
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, 
    
    // Pairs to monitor - ordered by priority
    TRADING_PAIRS: [
        // Stablecoin pairs (highest priority)
        ['WETH', 'USDC'],
        ['WETH', 'USDT'],
        ['WETH', 'DAI'],
        ['USDC', 'USDT'],
        ['USDC', 'DAI'],
        ['USDT', 'DAI'],
        
        // Major token pairs
        ['WETH', 'WBTC'],
        ['WETH', 'UNI'],
        ['WETH', 'LINK'],
        ['WETH', 'AAVE'],
        
        // Secondary pairs
        ['WBTC', 'USDC'],
        ['UNI', 'USDC'],
        ['LINK', 'USDC'],
        ['AAVE', 'USDC']
    ]
};
