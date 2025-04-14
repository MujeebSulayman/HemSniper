// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IAcrossSpokePool {
    function deposit(
        uint256 amount,
        address token,
        uint256 destinationChainId,
        address recipient,
        uint64 relayerFeePct,
        uint32 quoteTimestamp,
        bytes memory message
    ) external payable returns (uint64 depositId);
}

contract ArbExecutor is Ownable {
    using SafeERC20 for IERC20;
    address public swapRouter;
    address public acrossSpokePool;
    uint256 public destinationChainId;
    uint256 public feePercentage = 50;
    mapping(address => bool) public supportedTokens;
    event ArbitrageExecuted(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 profit, uint256 timestamp);
    event BridgeInitiated(address indexed token, uint256 amount, uint256 destinationChainId, address recipient, uint64 depositId);
    constructor(address _swapRouter, address _acrossSpokePool, uint256 _destinationChainId) Ownable(msg.sender) {
        swapRouter = _swapRouter;
        acrossSpokePool = _acrossSpokePool;
        destinationChainId = _destinationChainId;
    }
    function addSupportedToken(address token) external onlyOwner { supportedTokens[token] = true; }
    function removeSupportedToken(address token) external onlyOwner { supportedTokens[token] = false; }
    function setFeePercentage(uint256 _feePercentage) external onlyOwner { require(_feePercentage <= 500, "Fee too high"); feePercentage = _feePercentage; }
    function executeArbitrage(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, uint24 fee, uint256 deadline) external {
        require(supportedTokens[tokenIn], "Unsupported input token");
        require(supportedTokens[tokenOut], "Unsupported output token");
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(swapRouter, amountIn);
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        });
        uint256 amountOut = ISwapRouter(swapRouter).exactInputSingle(params);
        uint256 feeAmount = (amountOut * feePercentage) / 10000;
        uint256 amountAfterFee = amountOut - feeAmount;
        IERC20(tokenOut).safeTransfer(msg.sender, amountAfterFee);
        emit ArbitrageExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountAfterFee, amountAfterFee > amountIn ? amountAfterFee - amountIn : 0, block.timestamp);
    }
    function bridgeTokens(address token, uint256 amount, address recipient, uint64 relayerFeePct, uint32 quoteTimestamp) external {
        require(supportedTokens[token], "Unsupported token");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).approve(acrossSpokePool, amount);
        uint64 depositId = IAcrossSpokePool(acrossSpokePool).deposit(amount, token, destinationChainId, recipient, relayerFeePct, quoteTimestamp, "");
        emit BridgeInitiated(token, amount, destinationChainId, recipient, depositId);
    }
    function executeCrossChainArbitrage(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, uint24 fee, uint256 deadline, address recipient, uint64 relayerFeePct, uint32 quoteTimestamp) external {
        executeArbitrage(tokenIn, tokenOut, amountIn, amountOutMin, fee, deadline);
        uint256 balance = IERC20(tokenOut).balanceOf(address(this));
        bridgeTokens(tokenOut, balance, recipient, relayerFeePct, quoteTimestamp);
    }
    function withdrawTokens(address token, uint256 amount) external onlyOwner { IERC20(token).safeTransfer(owner(), amount); }
}
