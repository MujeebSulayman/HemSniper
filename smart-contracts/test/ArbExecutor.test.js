const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArbExecutor Contract", function () {
  // Test variables
  let ArbExecutor;
  let arbExecutor;
  let owner;
  let user;
  let mockLendingPool;
  let mockSwapRouter;
  let mockSwapRouterV3;
  let mockCurvePool;
  let mockAcrossSpokePool;
  let mockToken;

  // Constants
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  // DEX Types enum (must match the contract's enum)
  const DexType = {
    UniswapV2: 0,
    UniswapV3: 1,
    Curve: 2,
    Balancer: 3,
    Custom: 4
  };
  
  // Mock contract factories
  let MockToken;
  let MockLendingPool;
  let MockSwapRouter;
  let MockSwapRouterV3;
  let MockCurvePool;
  let MockASpokePool;

  beforeEach(async function () {
    // Get signers
    [owner, user, ...addrs] = await ethers.getSigners();
    
    // Deploy mock contracts
    MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    
    MockLendingPool = await ethers.getContractFactory("MockLendingPool");
    mockLendingPool = await MockLendingPool.deploy();
    
    // Deploy mock DEX routers
    MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    mockSwapRouter = await MockSwapRouter.deploy();
    
    MockSwapRouterV3 = await ethers.getContractFactory("MockSwapRouter");
    mockSwapRouterV3 = await MockSwapRouterV3.deploy();
    
    MockCurvePool = await ethers.getContractFactory("MockSwapRouter");
    mockCurvePool = await MockCurvePool.deploy();
    
    MockAcrossSpokePool = await ethers.getContractFactory("MockAcrossSpokePool");
    mockAcrossSpokePool = await MockAcrossSpokePool.deploy();
    
    // Deploy ArbExecutor contract
    ArbExecutor = await ethers.getContractFactory("ArbExecutor");
    arbExecutor = await ArbExecutor.deploy(
      await mockLendingPool.getAddress(),
      await mockAcrossSpokePool.getAddress()
    );
    
    // Register DEXs
    await arbExecutor.addDex(
      await mockSwapRouter.getAddress(),
      DexType.UniswapV2,
      "Uniswap V2"
    );
    
    await arbExecutor.addDex(
      await mockSwapRouterV3.getAddress(),
      DexType.UniswapV3,
      "Uniswap V3"
    );
    
    await arbExecutor.addDex(
      await mockCurvePool.getAddress(),
      DexType.Curve,
      "Curve 3Pool"
    );
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await arbExecutor.owner()).to.equal(owner.address);
    });

    it("Should set the correct contract addresses", async function () {
      expect(await arbExecutor.lendingPool()).to.equal(await mockLendingPool.getAddress());
      expect(await arbExecutor.acrossSpokePool()).to.equal(await mockAcrossSpokePool.getAddress());
    });
    
    it("Should register DEXs correctly", async function () {
      // Check that DEXs were registered
      const dexCount = await arbExecutor.getDexCount();
      expect(dexCount).to.equal(3);
      
      // Check Uniswap V2 registration
      const uniswapV2 = await arbExecutor.dexRegistry(0);
      expect(uniswapV2.router).to.equal(await mockSwapRouter.getAddress());
      expect(uniswapV2.dexType).to.equal(DexType.UniswapV2);
      expect(uniswapV2.name).to.equal("Uniswap V2");
      
      // Check Uniswap V3 registration
      const uniswapV3 = await arbExecutor.dexRegistry(1);
      expect(uniswapV3.router).to.equal(await mockSwapRouterV3.getAddress());
      expect(uniswapV3.dexType).to.equal(DexType.UniswapV3);
      expect(uniswapV3.name).to.equal("Uniswap V3");
      
      // Check Curve registration
      const curve = await arbExecutor.dexRegistry(2);
      expect(curve.router).to.equal(await mockCurvePool.getAddress());
      expect(curve.dexType).to.equal(DexType.Curve);
      expect(curve.name).to.equal("Curve 3Pool");
    });

    it("Should set the default protocol fee percent", async function () {
      expect(await arbExecutor.protocolFeePercent()).to.equal(100); // 1% in basis points
    });

    it("Should set the default minimum profit threshold", async function () {
      expect(await arbExecutor.minProfitThreshold()).to.equal(ethers.parseEther("10"));
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to add supported tokens", async function () {
      await arbExecutor.addSupportedToken(await mockToken.getAddress());
      expect(await arbExecutor.supportedTokens(await mockToken.getAddress())).to.equal(true);
    });

    it("Should allow owner to remove supported tokens", async function () {
      await arbExecutor.addSupportedToken(await mockToken.getAddress());
      await arbExecutor.removeSupportedToken(await mockToken.getAddress());
      expect(await arbExecutor.supportedTokens(await mockToken.getAddress())).to.equal(false);
    });
    
    it("Should allow owner to add a new DEX", async function () {
      const newMockDex = await MockSwapRouter.deploy();
      await arbExecutor.addDex(
        await newMockDex.getAddress(),
        DexType.Balancer,
        "Balancer V2"
      );
      
      const dexCount = await arbExecutor.getDexCount();
      expect(dexCount).to.equal(4); // 3 initial + 1 new
      
      const balancer = await arbExecutor.dexRegistry(3);
      expect(balancer.router).to.equal(await newMockDex.getAddress());
      expect(balancer.dexType).to.equal(DexType.Balancer);
      expect(balancer.name).to.equal("Balancer V2");
    });
    
    it("Should allow owner to update a DEX", async function () {
      const newMockDex = await MockSwapRouter.deploy();
      await arbExecutor.updateDex(
        0, // Update the first DEX (Uniswap V2)
        await newMockDex.getAddress(),
        DexType.UniswapV2,
        "Updated Uniswap V2"
      );
      
      const updatedDex = await arbExecutor.dexRegistry(0);
      expect(updatedDex.router).to.equal(await newMockDex.getAddress());
      expect(updatedDex.name).to.equal("Updated Uniswap V2");
    });
    
    it("Should allow owner to remove a DEX", async function () {
      // Get initial DEX count
      const initialDexCount = await arbExecutor.getDexCount();
      
      // Remove the last DEX
      await arbExecutor.removeDex(initialDexCount - 1);
      
      // Check that DEX count decreased
      const newDexCount = await arbExecutor.getDexCount();
      expect(newDexCount).to.equal(initialDexCount - 1);
    });

    it("Should allow owner to set protocol fee percentage", async function () {
      await arbExecutor.setProtocolFeePercent(200); // 2%
      expect(await arbExecutor.protocolFeePercent()).to.equal(200);
    });

    it("Should not allow setting fee percentage above maximum", async function () {
      await expect(arbExecutor.setProtocolFeePercent(501)).to.be.revertedWith("Fee too high");
    });

    it("Should allow owner to set minimum profit threshold", async function () {
      await arbExecutor.setMinProfitThreshold(ethers.parseEther("20"));
      expect(await arbExecutor.minProfitThreshold()).to.equal(ethers.parseEther("20"));
    });

    it("Should allow owner to update contract addresses", async function () {
      const newAddress = addrs[0].address;
      await arbExecutor.updateAddresses(newAddress, newAddress);
      expect(await arbExecutor.lendingPool()).to.equal(newAddress);
      expect(await arbExecutor.acrossSpokePool()).to.equal(newAddress);
    });

    it("Should not allow non-owner to call admin functions", async function () {
      await expect(
        arbExecutor.connect(user).addSupportedToken(await mockToken.getAddress())
      ).to.be.revertedWithCustomError(arbExecutor, "OwnableUnauthorizedAccount");
      
      await expect(
        arbExecutor.connect(user).setProtocolFeePercent(200)
      ).to.be.revertedWithCustomError(arbExecutor, "OwnableUnauthorizedAccount");
      
      await expect(
        arbExecutor.connect(user).addDex(ZERO_ADDRESS, DexType.UniswapV2, "Test")
      ).to.be.revertedWithCustomError(arbExecutor, "OwnableUnauthorizedAccount");
    });
  });

  describe("Cross-Chain Arbitrage", function () {
    // These tests require more complex mocking of the flash loan process
    // For simplicity, we'll focus on input validation and event emission
    
    it("Should revert if token is not supported", async function () {
      const params = {
        tokenIn: await mockToken.getAddress(),
        tokenOut: await mockToken.getAddress(),
        amountIn: ethers.parseEther("1"),
        minAmountOut: ethers.parseEther("0.9"),
        destinationChainId: 42161, // Arbitrum
        recipient: user.address,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000),
        dexRouters: [await mockSwapRouter.getAddress()],
        swapData: ["0x"] // Empty swap data for testing
      };
      
      await expect(
        arbExecutor.executeCrossChainArbitrage(params)
      ).to.be.revertedWith("Unsupported input token");
    });
    
    it("Should revert if amount is zero", async function () {
      await arbExecutor.addSupportedToken(await mockToken.getAddress());
      
      const params = {
        tokenIn: await mockToken.getAddress(),
        tokenOut: await mockToken.getAddress(),
        amountIn: 0,
        minAmountOut: ethers.parseEther("0.9"),
        destinationChainId: 42161,
        recipient: user.address,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000),
        dexRouters: [await mockSwapRouter.getAddress()],
        swapData: ["0x"]
      };
      
      await expect(
        arbExecutor.executeCrossChainArbitrage(params)
      ).to.be.revertedWith("Amount must be > 0");
    });
    
    it("Should revert if no DEXs are specified", async function () {
      await arbExecutor.addSupportedToken(await mockToken.getAddress());
      
      const params = {
        tokenIn: await mockToken.getAddress(),
        tokenOut: await mockToken.getAddress(),
        amountIn: ethers.parseEther("1"),
        minAmountOut: ethers.parseEther("0.9"),
        destinationChainId: 42161,
        recipient: user.address,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000),
        dexRouters: [],
        swapData: []
      };
      
      await expect(
        arbExecutor.executeCrossChainArbitrage(params)
      ).to.be.revertedWith("No DEXs specified");
    });
    
    it("Should revert if DEX and swap data length mismatch", async function () {
      await arbExecutor.addSupportedToken(await mockToken.getAddress());
      
      const params = {
        tokenIn: await mockToken.getAddress(),
        tokenOut: await mockToken.getAddress(),
        amountIn: ethers.parseEther("1"),
        minAmountOut: ethers.parseEther("0.9"),
        destinationChainId: 42161,
        recipient: user.address,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000),
        dexRouters: [await mockSwapRouter.getAddress(), await mockSwapRouterV3.getAddress()],
        swapData: ["0x"] // Only one swap data for two DEXs
      };
      
      await expect(
        arbExecutor.executeCrossChainArbitrage(params)
      ).to.be.revertedWith("DEX and swap data length mismatch");
    });
    
    it("Should revert if destination chain is the same as current chain", async function () {
      await arbExecutor.addSupportedToken(await mockToken.getAddress());
      
      const params = {
        tokenIn: await mockToken.getAddress(),
        tokenOut: await mockToken.getAddress(),
        amountIn: ethers.parseEther("1"),
        minAmountOut: ethers.parseEther("0.9"),
        destinationChainId: 31337, // Hardhat's chainId
        recipient: user.address,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000),
        dexRouters: [await mockSwapRouter.getAddress()],
        swapData: ["0x"]
      };
      
      await expect(
        arbExecutor.executeCrossChainArbitrage(params)
      ).to.be.revertedWith("Destination must be different chain");
    });
    
    it("Should revert if recipient is zero address", async function () {
      await arbExecutor.addSupportedToken(await mockToken.getAddress());
      
      const params = {
        tokenIn: await mockToken.getAddress(),
        tokenOut: await mockToken.getAddress(),
        amountIn: ethers.parseEther("1"),
        minAmountOut: ethers.parseEther("0.9"),
        destinationChainId: 42161,
        recipient: ZERO_ADDRESS,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000),
        dexRouters: [await mockSwapRouter.getAddress()],
        swapData: ["0x"]
      };
      
      await expect(
        arbExecutor.executeCrossChainArbitrage(params)
      ).to.be.revertedWith("Invalid recipient");
    });
    
    it("Should emit events when executing cross-chain arbitrage", async function () {
      // This test would normally require more complex mocking of the flash loan process
      // For now, we'll just check that the correct events are emitted
      
      // Add token support
      await arbExecutor.addSupportedToken(await mockToken.getAddress());
      
      // Create params for multi-DEX arbitrage
      const params = {
        tokenIn: await mockToken.getAddress(),
        tokenOut: await mockToken.getAddress(),
        amountIn: ethers.parseEther("1"),
        minAmountOut: ethers.parseEther("0.9"),
        destinationChainId: 42161,
        recipient: user.address,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000),
        dexRouters: [
          await mockSwapRouter.getAddress(),
          await mockSwapRouterV3.getAddress()
        ],
        swapData: [
          "0x1234", // Mock swap data for first DEX
          "0x5678"  // Mock swap data for second DEX
        ]
      };
      
      // We can't fully test the execution without mocking the flash loan callback,
      // but we can check that the ArbitrageInitiated event is emitted with correct parameters
      await expect(arbExecutor.executeCrossChainArbitrage(params))
        .to.emit(arbExecutor, "ArbitrageInitiated")
        .withArgs(
          await mockToken.getAddress(),
          await mockToken.getAddress(),
          ethers.parseEther("1"),
          ethers.parseEther("0.9")
        );
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to withdraw tokens in emergency", async function () {
      // First mint some tokens to the contract
      await mockToken.mint(await arbExecutor.getAddress(), ethers.parseEther("10"));
      
      // Verify balance
      expect(await mockToken.balanceOf(await arbExecutor.getAddress())).to.equal(ethers.parseEther("10"));
      
      // Emergency withdraw
      await arbExecutor.emergencyWithdraw(await mockToken.getAddress(), ethers.parseEther("10"));
      
      // Verify tokens were withdrawn
      expect(await mockToken.balanceOf(await arbExecutor.getAddress())).to.equal(0);
      expect(await mockToken.balanceOf(owner.address)).to.equal(ethers.parseEther("10"));
    });
    
    it("Should not allow non-owner to use emergency functions", async function () {
      await expect(
        arbExecutor.connect(user).emergencyWithdraw(await mockToken.getAddress(), ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(arbExecutor, "OwnableUnauthorizedAccount");
    });
  });
});
