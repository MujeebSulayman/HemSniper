// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockAcrossSpokePool
 * @dev Mock Across Protocol SpokePool for testing cross-chain bridging
 */
contract MockAcrossSpokePool {
    // Event to track deposit calls
    event DepositCalled(
        uint256 amount,
        address token,
        uint256 destinationChainId,
        address recipient,
        uint64 relayerFeePct,
        uint32 quoteTimestamp,
        bytes message
    );
    
    // Counter for deposit IDs
    uint64 private _nextDepositId = 1;
    
    /**
     * @dev Mock deposit function that mimics Across Protocol's interface
     */
    function deposit(
        uint256 amount,
        address token,
        uint256 destinationChainId,
        address recipient,
        uint64 relayerFeePct,
        uint32 quoteTimestamp,
        bytes memory message
    ) external payable returns (uint64 depositId) {
        // Emit event for testing
        emit DepositCalled(
            amount,
            token,
            destinationChainId,
            recipient,
            relayerFeePct,
            quoteTimestamp,
            message
        );
        
        // In a real test, we'd transfer tokens here
        // For now, we'll just return a deposit ID
        
        depositId = _nextDepositId++;
        return depositId;
    }
}
