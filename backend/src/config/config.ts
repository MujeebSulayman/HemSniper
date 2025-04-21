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
    ARB_EXECUTOR: '0x195DdB753f72f020eE677324FF4F26Da4c2E472d',
    UNISWAP_V2_ROUTER: process.env.UNISWAP_V2_ROUTER_SEPOLIA || '',
    UNISWAP_V3_ROUTER: process.env.UNISWAP_V3_ROUTER_SEPOLIA || '',
    
    // Tokens to monitor
    TOKENS: {
        WETH: {
            address: process.env.WETH_ADDRESS || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
            decimals: 18,
            minTradeAmount: '100000000000000000', // 0.1 ETH
            maxTradeAmount: '1000000000000000000'  // 1 ETH
        },
        USDC: {
            address: process.env.USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
            decimals: 6,
            minTradeAmount: '100000000', // 100 USDC
            maxTradeAmount: '1000000000' // 1000 USDC
        },
        USDT: {
            address: process.env.USDT_ADDRESS || '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
            decimals: 6,
            minTradeAmount: '100000000', // 100 USDT
            maxTradeAmount: '1000000000' // 1000 USDT
        },
        DAI: {
            address: process.env.DAI_ADDRESS || '0x68194a729C2450ad26072b3D33ADaCbcef39D574',
            decimals: 18,
            minTradeAmount: '100000000000000000000', // 100 DAI
            maxTradeAmount: '1000000000000000000000' // 1000 DAI
        },
        UNI: {
            address: process.env.UNI_ADDRESS || '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
            decimals: 18,
            minTradeAmount: '10000000000000000000', // 10 UNI
            maxTradeAmount: '100000000000000000000' // 100 UNI
        },
        WBTC: {
            address: process.env.WBTC_ADDRESS || '0x29f2D40B0605204364af54EC677bD022dA425d03',
            decimals: 8,
            minTradeAmount: '1000000', // 0.01 WBTC
            maxTradeAmount: '10000000' // 0.1 WBTC
        },
        LINK: {
            address: process.env.LINK_ADDRESS || '0x779877A7B0D9E8603169DdbD7836e478b4624789',
            decimals: 18,
            minTradeAmount: '10000000000000000000', // 10 LINK
            maxTradeAmount: '100000000000000000000' // 100 LINK
        },
        AAVE: {
            address: process.env.AAVE_ADDRESS || '0x88541670E55cC00bEEFD87eB59EDd1b7C511AC9a',
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
    POLLING_INTERVAL: 1000, // 1 second
    PRICE_FETCH_TIMEOUT: 5000, // 5 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second
    
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
