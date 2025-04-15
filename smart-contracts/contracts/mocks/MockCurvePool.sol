// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockCurvePool
 * @dev Mock Curve pool for testing token swaps
 */
contract MockCurvePool {
    // Event to track swap calls
    event ExchangeCalled(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    );
    
    event ExchangeUnderlyingCalled(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    );
    
    // Mock exchange rate (1.04 = 4% profit)
    uint256 public exchangeRate = 104;
    uint256 public constant RATE_DENOMINATOR = 100;
    
    // Set exchange rate for testing different scenarios
    function setExchangeRate(uint256 _rate) external {
        exchangeRate = _rate;
    }
    
    // Mock exchange function that mimics Curve's interface
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256 dy) {
        // Emit event for testing
        emit ExchangeCalled(i, j, dx, min_dy);
        
        // Calculate output amount based on exchange rate
        dy = (dx * exchangeRate) / RATE_DENOMINATOR;
        
        // Ensure minimum output amount is met
        require(dy >= min_dy, "Insufficient output amount");
        
        // In a real test, we'd transfer tokens here
        // For now, we'll just return the calculated amount
        
        return dy;
    }
    
    // Mock exchange_underlying function for underlying assets
    function exchange_underlying(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256 dy) {
        // Emit event for testing
        emit ExchangeUnderlyingCalled(i, j, dx, min_dy);
        
        // Calculate output amount based on exchange rate
        dy = (dx * exchangeRate) / RATE_DENOMINATOR;
        
        // Ensure minimum output amount is met
        require(dy >= min_dy, "Insufficient output amount");
        
        return dy;
    }
}
