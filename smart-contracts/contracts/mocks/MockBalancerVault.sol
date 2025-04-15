// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockBalancerVault
 * @dev Mock Balancer Vault for testing token swaps
 */
contract MockBalancerVault {
    // Struct to represent a single swap
    struct SingleSwap {
        bytes32 poolId;
        uint8 kind;
        address assetIn;
        address assetOut;
        uint256 amount;
        bytes userData;
    }
    
    // Struct to represent swap funds
    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address payable recipient;
        bool toInternalBalance;
    }
    
    // Event to track swap calls
    event SwapCalled(
        bytes32 poolId,
        uint8 kind,
        address assetIn,
        address assetOut,
        uint256 amount,
        address sender,
        address recipient
    );
    
    // Mock exchange rate (1.03 = 3% profit)
    uint256 public exchangeRate = 103;
    uint256 public constant RATE_DENOMINATOR = 100;
    
    // Set exchange rate for testing different scenarios
    function setExchangeRate(uint256 _rate) external {
        exchangeRate = _rate;
    }
    
    // Mock swap function that mimics Balancer's interface
    function swap(
        SingleSwap memory singleSwap,
        FundManagement memory funds,
        uint256 limit,
        uint256 deadline
    ) external payable returns (uint256 amountOut) {
        // Emit event for testing
        emit SwapCalled(
            singleSwap.poolId,
            singleSwap.kind,
            singleSwap.assetIn,
            singleSwap.assetOut,
            singleSwap.amount,
            funds.sender,
            funds.recipient
        );
        
        // Calculate output amount based on exchange rate
        amountOut = (singleSwap.amount * exchangeRate) / RATE_DENOMINATOR;
        
        // Ensure limit is respected (limit is min for exact input, max for exact output)
        if (singleSwap.kind == 0) { // GIVEN_IN
            require(amountOut >= limit, "Insufficient output amount");
        } else { // GIVEN_OUT
            require(amountOut <= limit, "Excessive input amount");
        }
        
        // Check deadline
        require(block.timestamp <= deadline, "Deadline expired");
        
        // In a real test, we'd transfer tokens here
        // For now, we'll just return the calculated amount
        
        return amountOut;
    }
    
    // Mock batchSwap function for multiple swaps
    function batchSwap(
        uint8 kind,
        SingleSwap[] memory swaps,
        address[] memory assets,
        FundManagement memory funds,
        int256[] memory limits,
        uint256 deadline
    ) external payable returns (int256[] memory assetDeltas) {
        // For simplicity, we'll just process the first swap in the batch
        // In a real implementation, we would loop through all swaps
        
        if (swaps.length > 0) {
            SingleSwap memory firstSwap = swaps[0];
            
            // Emit event for the first swap
            emit SwapCalled(
                firstSwap.poolId,
                kind,
                firstSwap.assetIn,
                firstSwap.assetOut,
                firstSwap.amount,
                funds.sender,
                funds.recipient
            );
        }
        
        // Return dummy asset deltas
        assetDeltas = new int256[](assets.length);
        
        // First asset (input token) has negative delta
        if (assets.length > 0) {
            assetDeltas[0] = -100;
        }
        
        // Second asset (output token) has positive delta
        if (assets.length > 1) {
            assetDeltas[1] = int256((100 * exchangeRate) / RATE_DENOMINATOR);
        }
        
        return assetDeltas;
    }
}
