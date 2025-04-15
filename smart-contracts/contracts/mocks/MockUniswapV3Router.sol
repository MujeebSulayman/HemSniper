// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ISwapRouter.sol";

/**
 * @title MockUniswapV3Router
 * @dev Mock Uniswap V3 router for testing token swaps
 */
contract MockUniswapV3Router {
    // Event to track swap calls
    event ExactInputSingleCalled(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        address recipient,
        uint256 deadline,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    );
    
    event ExactInputCalled(
        bytes path,
        address recipient,
        uint256 deadline,
        uint256 amountIn,
        uint256 amountOutMinimum
    );
    
    // Mock exchange rate (1.05 = 5% profit)
    uint256 public exchangeRate = 105;
    uint256 public constant RATE_DENOMINATOR = 100;
    
    // Set exchange rate for testing different scenarios
    function setExchangeRate(uint256 _rate) external {
        exchangeRate = _rate;
    }
    
    // Mock exactInputSingle function that mimics Uniswap V3's interface
    function exactInputSingle(ISwapRouter.ExactInputSingleParams calldata params) 
        external 
        payable 
        returns (uint256 amountOut) 
    {
        // Emit event for testing
        emit ExactInputSingleCalled(
            params.tokenIn,
            params.tokenOut,
            params.fee,
            params.recipient,
            params.deadline,
            params.amountIn,
            params.amountOutMinimum,
            params.sqrtPriceLimitX96
        );
        
        // Calculate output amount based on exchange rate
        amountOut = (params.amountIn * exchangeRate) / RATE_DENOMINATOR;
        
        // Ensure minimum output amount is met
        require(amountOut >= params.amountOutMinimum, "Insufficient output amount");
        
        // In a real test, we'd transfer tokens here
        // For now, we'll just return the calculated amount
        
        return amountOut;
    }
    
    // Mock exactInput function for multi-hop swaps
    function exactInput(ISwapRouter.ExactInputParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        // Emit event for testing
        emit ExactInputCalled(
            params.path,
            params.recipient,
            params.deadline,
            params.amountIn,
            params.amountOutMinimum
        );
        
        // Calculate output amount based on exchange rate
        // For multi-hop, we'll use a slightly higher rate to simulate better routing
        amountOut = (params.amountIn * (exchangeRate + 2)) / RATE_DENOMINATOR;
        
        // Ensure minimum output amount is met
        require(amountOut >= params.amountOutMinimum, "Insufficient output amount");
        
        return amountOut;
    }
}
