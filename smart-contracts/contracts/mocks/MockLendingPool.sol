// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../ArbExecutor.sol";

/**
 * @title MockLendingPool
 * @dev Mock Aave lending pool for testing flash loans
 */
contract MockLendingPool {
    // Event to track flash loan calls
    event FlashLoanCalled(
        address receiverAddress,
        address[] assets,
        uint256[] amounts,
        uint256[] modes,
        address onBehalfOf,
        bytes params,
        uint16 referralCode
    );

    // Flash loan function that mimics Aave's interface
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external {
        // Emit event for testing
        emit FlashLoanCalled(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );

        // For each asset, transfer tokens to the receiver, call executeOperation, then transfer back
        for (uint256 i = 0; i < assets.length; i++) {
            // Calculate the premium (0.09% is typical for Aave)
            uint256 premium = (amounts[i] * 9) / 10000;
            
            // Mock token transfer to the receiver
            // In a real test, we'd need to mint these tokens to this contract first
            
            // Create the arrays needed for the callback
            address[] memory assetArray = new address[](1);
            assetArray[0] = assets[i];
            
            uint256[] memory amountArray = new uint256[](1);
            amountArray[0] = amounts[i];
            
            uint256[] memory premiumArray = new uint256[](1);
            premiumArray[0] = premium;
            
            // Call executeOperation on the receiver
            IFlashLoanReceiver(receiverAddress).executeOperation(
                assetArray,
                amountArray,
                premiumArray,
                msg.sender,
                params
            );
            
            // In a real test, we'd verify that the tokens were returned with premium
        }
    }
}
