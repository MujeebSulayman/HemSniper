import { ethers } from 'ethers';

export interface IUniswapV2Pool extends ethers.Contract {
    getReserves(): Promise<[ethers.BigNumber, ethers.BigNumber, number]>;
    token0(): Promise<string>;
    token1(): Promise<string>;
}

export interface IUniswapV3Pool extends ethers.Contract {
    slot0(): Promise<{
        sqrtPriceX96: ethers.BigNumber;
        tick: number;
        observationIndex: number;
        observationCardinality: number;
        observationCardinalityNext: number;
        feeProtocol: number;
        unlocked: boolean;
    }>;
    token0(): Promise<string>;
    token1(): Promise<string>;
    fee(): Promise<number>;
}

export interface ArbitrageParams {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    minAmountOut: string;
    dexRouters: string[];
    swapData: string[];
    deadline: number;
}
