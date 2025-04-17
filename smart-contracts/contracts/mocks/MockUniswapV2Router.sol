// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockUniswapV2Router
 * @dev Mocks Uniswap V2 Router for testing swapExactTokensForTokens and getAmountsOut
 */
contract MockUniswapV2Router {
    uint256 public exchangeRate = 105; // 1.05x rate (5% profit)
    uint256 public constant RATE_DENOMINATOR = 100;

    event SwapExactTokensForTokensCalled(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] path,
        address to,
        uint256 deadline
    );

    function setExchangeRate(uint256 _rate) external {
        exchangeRate = _rate;
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        emit SwapExactTokensForTokensCalled(amountIn, amountOutMin, path, to, deadline);
        uint output = (amountIn * exchangeRate) / RATE_DENOMINATOR;
        require(output >= amountOutMin, "Insufficient output amount");
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        amounts[1] = output;
        return amounts;
    }

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts) {
        uint output = (amountIn * exchangeRate) / RATE_DENOMINATOR;
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        amounts[1] = output;
        return amounts;
    }
}
