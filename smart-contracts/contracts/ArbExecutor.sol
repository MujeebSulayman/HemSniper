// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title IFlashLoanReceiver
 * @dev Interface for Aave V3 flash loan receiver
 */
interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/**
 * @title ILendingPool
 * @dev Interface for Aave V3 lending pool
 */
interface ILendingPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

/**
 * @title IUniswapV3Router
 * @dev Interface for Uniswap V3 router
 */
interface IUniswapV3Router {
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

    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);
}

/**
 * @title IUniswapV2Router
 * @dev Interface for Uniswap V2, SushiSwap, PancakeSwap, etc.
 */
interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
}

/**
 * @title ICurvePool
 * @dev Interface for Curve Finance pools
 */
interface ICurvePool {
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
    function exchange_underlying(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
}

/**
 * @title IAcrossSpokePool
 * @dev Interface for Across Protocol bridge
 */
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

/**
 * @title ArbExecutor
 * @dev Smart contract for executing cross-chain arbitrage using flash loans across multiple DEXs
 */
contract ArbExecutor is Ownable, ReentrancyGuard, IFlashLoanReceiver {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // Constants
    uint256 private constant BASIS_POINTS = 10000;

    // DEX types
    enum DexType {
        UniswapV2, // Uniswap V2, SushiSwap, PancakeSwap, etc.
        UniswapV3, // Uniswap V3
        Curve, // Curve Finance
        Balancer, // Balancer
        Custom // Custom DEX implementation
    }

    // DEX information
    struct DexInfo {
        address routerAddress;
        DexType dexType;
        string name;
        bool active;
    }

    // Contract addresses
    address public lendingPool;
    address public acrossSpokePool;

    // Fee settings
    uint256 public protocolFeePercent = 100; 
    uint256 public minProfitThreshold = 10 * 10 ** 18; 

    // Supported tokens and DEXs
    mapping(address => bool) public supportedTokens;
    mapping(address => DexInfo) public dexRegistry;
    EnumerableSet.AddressSet private dexAddresses;

    // Arbitrage parameters
    struct ArbitrageParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address[] dexRouters;
        bytes[] swapData;
        uint256 deadline;
        uint256 destinationChainId;
        address recipient;
        uint64 relayerFeePct;
        uint32 quoteTimestamp;
    }

    // Events
    event ArbitrageExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 fee,
        uint256 timestamp
    );

    event BridgeInitiated(
        address indexed token,
        uint256 amount,
        uint256 destinationChainId,
        address recipient,
        uint64 depositId
    );

    event FlashLoanExecuted(
        address indexed token,
        uint256 amount,
        uint256 fee,
        bool success
    );

    /**
     * @dev Constructor
     * @param _lendingPool Aave lending pool address
     * @param _acrossSpokePool Across Protocol bridge address
     */
    constructor(
        address _lendingPool,
        address _acrossSpokePool
    ) Ownable(msg.sender) {
        lendingPool = _lendingPool;
        acrossSpokePool = _acrossSpokePool;
    }

    /**
     * @dev Add a DEX to the registry
     * @param _routerAddress DEX router address
     * @param _dexType Type of DEX (UniswapV2, UniswapV3, Curve, etc.)
     * @param _name Name of the DEX (e.g., "Uniswap V3", "SushiSwap")
     */
    function addDex(
        address _routerAddress,
        DexType _dexType,
        string calldata _name
    ) external onlyOwner {
        require(_routerAddress != address(0), "Invalid router address");
        require(
            !dexAddresses.contains(_routerAddress),
            "DEX already registered"
        );

        DexInfo memory dexInfo = DexInfo({
            routerAddress: _routerAddress,
            dexType: _dexType,
            name: _name,
            active: true
        });

        dexRegistry[_routerAddress] = dexInfo;
        dexAddresses.add(_routerAddress);
    }

    /**
     * @dev Update a DEX in the registry
     * @param _routerAddress DEX router address
     * @param _active Whether the DEX is active
     */
    function updateDex(
        address _routerAddress,
        bool _active
    ) external onlyOwner {
        require(dexAddresses.contains(_routerAddress), "DEX not registered");

        DexInfo storage dexInfo = dexRegistry[_routerAddress];
        dexInfo.active = _active;
    }

    /**
     * @dev Remove a DEX from the registry
     * @param _routerAddress DEX router address
     */
    function removeDex(address _routerAddress) external onlyOwner {
        require(dexAddresses.contains(_routerAddress), "DEX not registered");

        delete dexRegistry[_routerAddress];
        dexAddresses.remove(_routerAddress);
    }

    /**
     * @dev Get all registered DEXs
     * @return Array of DEX addresses
     */
    function getAllDexes() external view returns (address[] memory) {
        uint256 length = dexAddresses.length();
        address[] memory dexes = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            dexes[i] = dexAddresses.at(i);
        }

        return dexes;
    }

    // ============ Admin Functions ============

    /**
     * @dev Add supported token
     * @param token Token address
     */
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }

    /**
     * @dev Remove supported token
     * @param token Token address
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    /**
     * @dev Set protocol fee percentage (in basis points)
     * @param _feePercent New fee percentage
     */
    function setProtocolFeePercent(uint256 _feePercent) external onlyOwner {
        require(_feePercent <= 500, "Fee too high"); // Max 5%
        protocolFeePercent = _feePercent;
    }

    /**
     * @dev Set minimum profit threshold
     * @param _minProfitThreshold New minimum profit threshold
     */
    function setMinProfitThreshold(
        uint256 _minProfitThreshold
    ) external onlyOwner {
        minProfitThreshold = _minProfitThreshold;
    }

    /**
     * @dev Update contract addresses
     * @param _lendingPool New lending pool address
     * @param _swapRouter New swap router address
     * @param _acrossSpokePool New Across Protocol bridge address
     */
    function updateAddresses(
        address _lendingPool,
        address _swapRouter,
        address _acrossSpokePool
    ) external onlyOwner {
        if (_lendingPool != address(0)) lendingPool = _lendingPool;
        if (_swapRouter != address(0)) swapRouter = _swapRouter;
        if (_acrossSpokePool != address(0)) acrossSpokePool = _acrossSpokePool;
    }

    // ============ Arbitrage Functions ============

    /**
     * @dev Execute cross-chain arbitrage using flash loan
     * @param params Arbitrage parameters
     */
    function executeCrossChainArbitrage(
        ArbitrageParams calldata params
    ) external nonReentrant {
        require(supportedTokens[params.tokenIn], "Unsupported input token");
        require(supportedTokens[params.tokenOut], "Unsupported output token");
        require(params.amountIn > 0, "Amount must be > 0");
        require(params.dexRouters.length > 0, "No DEXs specified");
        require(
            params.dexRouters.length == params.swapData.length,
            "DEX and swap data length mismatch"
        );
        require(
            params.destinationChainId != block.chainid,
            "Destination must be different chain"
        );
        require(params.recipient != address(0), "Invalid recipient");

        // Validate DEXs
        for (uint256 i = 0; i < params.dexRouters.length; i++) {
            require(
                dexAddresses.contains(params.dexRouters[i]),
                "Unregistered DEX"
            );
            require(dexRegistry[params.dexRouters[i]].active, "Inactive DEX");
        }

        // Prepare flash loan
        address[] memory assets = new address[](1);
        assets[0] = params.tokenIn;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = params.amountIn;

        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // no debt, just flash loan

        // Execute flash loan
        ILendingPool(lendingPool).flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            abi.encode(params, msg.sender),
            0 // referral code
        );
    }

    /**
     * @dev Flash loan callback function
     * @param assets Asset addresses
     * @param amounts Asset amounts
     * @param premiums Asset premiums
     * @param initiator Flash loan initiator
     * @param params Encoded parameters
     * @return success Whether the operation was successful
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == lendingPool, "Caller must be lending pool");
        require(initiator == address(this), "Initiator must be this contract");

        // Decode parameters
        (ArbitrageParams memory arbParams, address user) = abi.decode(
            params,
            (ArbitrageParams, address)
        );

        // Track current token and amount through the swap path
        address currentToken = assets[0];
        uint256 currentAmount = amounts[0];

        // Step 1: Execute swaps through multiple DEXs
        for (uint256 i = 0; i < arbParams.dexRouters.length; i++) {
            address dexRouter = arbParams.dexRouters[i];
            bytes memory swapData = arbParams.swapData[i];
            DexInfo memory dexInfo = dexRegistry[dexRouter];

            // Approve router to spend tokens
            IERC20(currentToken).approve(dexRouter, currentAmount);

            // Execute swap based on DEX type
            if (dexInfo.dexType == DexType.UniswapV3) {
                // Decode Uniswap V3 swap parameters
                (address tokenOut, uint24 fee, uint256 amountOutMinimum) = abi
                    .decode(swapData, (address, uint24, uint256));

                IUniswapV3Router.ExactInputSingleParams
                    memory swapParams = IUniswapV3Router
                        .ExactInputSingleParams({
                            tokenIn: currentToken,
                            tokenOut: tokenOut,
                            fee: fee,
                            recipient: address(this),
                            deadline: arbParams.deadline,
                            amountIn: currentAmount,
                            amountOutMinimum: amountOutMinimum,
                            sqrtPriceLimitX96: 0
                        });

                currentAmount = IUniswapV3Router(dexRouter).exactInputSingle(
                    swapParams
                );
                currentToken = tokenOut;
            } else if (dexInfo.dexType == DexType.UniswapV2) {
                // Decode Uniswap V2 swap parameters
                (address tokenOut, uint256 amountOutMin) = abi.decode(
                    swapData,
                    (address, uint256)
                );

                address[] memory path = new address[](2);
                path[0] = currentToken;
                path[1] = tokenOut;

                uint[] memory amounts = IUniswapV2Router(dexRouter)
                    .swapExactTokensForTokens(
                        currentAmount,
                        amountOutMin,
                        path,
                        address(this),
                        arbParams.deadline
                    );

                currentAmount = amounts[amounts.length - 1];
                currentToken = tokenOut;
            } else if (dexInfo.dexType == DexType.Curve) {
                // Decode Curve swap parameters
                (int128 i, int128 j, uint256 minDy, bool useUnderlying) = abi
                    .decode(swapData, (int128, int128, uint256, bool));

                if (useUnderlying) {
                    currentAmount = ICurvePool(dexRouter).exchange_underlying(
                        i,
                        j,
                        currentAmount,
                        minDy
                    );
                } else {
                    currentAmount = ICurvePool(dexRouter).exchange(
                        i,
                        j,
                        currentAmount,
                        minDy
                    );
                }

                currentToken = arbParams.tokenOut;
            }
        }

        // Step 2: Calculate flash loan repayment amount
        uint256 totalRepayment = amounts[0] + premiums[0];

        // Step 3: Calculate protocol fee
        uint256 protocolFee = (currentAmount * protocolFeePercent) /
            BASIS_POINTS;

        // Step 4: Verify profit
        uint256 remainingAmount = currentAmount - protocolFee;
        require(remainingAmount > totalRepayment, "Insufficient profit");

        // Step 5: Bridge tokens to destination chain
        IERC20(arbParams.tokenOut).approve(acrossSpokePool, remainingAmount);

        uint64 depositId = IAcrossSpokePool(acrossSpokePool).deposit(
            remainingAmount,
            arbParams.tokenOut,
            arbParams.destinationChainId,
            arbParams.recipient,
            arbParams.relayerFeePct,
            arbParams.quoteTimestamp,
            ""
        );

        emit BridgeInitiated(
            arbParams.tokenOut,
            remainingAmount,
            arbParams.destinationChainId,
            arbParams.recipient,
            depositId
        );

        // Step 6: Repay flash loan
        IERC20(assets[0]).approve(lendingPool, totalRepayment);

        // Step 7: Transfer protocol fee to contract owner
        IERC20(arbParams.tokenOut).safeTransfer(owner(), protocolFee);

        // Step 8: Log arbitrage execution
        emit ArbitrageExecuted(
            user,
            assets[0],
            arbParams.tokenOut,
            amounts[0],
            currentAmount,
            currentAmount - totalRepayment,
            protocolFee,
            block.timestamp
        );

        return true;
    }

    /**
     * @dev Execute single-chain arbitrage using flash loan
     * @param params Arbitrage parameters
     */
    function executeSingleChainArbitrage(
        ArbitrageParams calldata params
    ) external nonReentrant {
        require(supportedTokens[params.tokenIn], "Unsupported input token");
        require(supportedTokens[params.tokenOut], "Unsupported output token");
        require(params.amountIn > 0, "Amount must be > 0");

        // Prepare flash loan
        address[] memory assets = new address[](1);
        assets[0] = params.tokenIn;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = params.amountIn;

        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // no debt, just flash loan

        // Execute flash loan
        ILendingPool(lendingPool).flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            abi.encode(params, msg.sender, true),
            0
        );
    }

    /**
     * @dev Emergency withdraw function
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}
}
