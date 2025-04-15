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
  let mockAcrossSpokePool;
  let mockToken;

  // Constants
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  // Mock contract factories
  let MockToken;
  let MockLendingPool;
  let MockSwapRouter;
  let MockAcrossSpokePool;

  beforeEach(async function () {
    // Get signers
    [owner, user, ...addrs] = await ethers.getSigners();
    
    // Deploy mock contracts
    MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    
    MockLendingPool = await ethers.getContractFactory("MockLendingPool");
    mockLendingPool = await MockLendingPool.deploy();
    
    MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    mockSwapRouter = await MockSwapRouter.deploy();
    
    MockAcrossSpokePool = await ethers.getContractFactory("MockAcrossSpokePool");
    mockAcrossSpokePool = await MockAcrossSpokePool.deploy();
    
    // Deploy ArbExecutor contract
    ArbExecutor = await ethers.getContractFactory("ArbExecutor");
    arbExecutor = await ArbExecutor.deploy(
      await mockLendingPool.getAddress(),
      await mockSwapRouter.getAddress(),
      await mockAcrossSpokePool.getAddress()
    );
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await arbExecutor.owner()).to.equal(owner.address);
    });

    it("Should set the correct contract addresses", async function () {
      expect(await arbExecutor.lendingPool()).to.equal(await mockLendingPool.getAddress());
      expect(await arbExecutor.swapRouter()).to.equal(await mockSwapRouter.getAddress());
      expect(await arbExecutor.acrossSpokePool()).to.equal(await mockAcrossSpokePool.getAddress());
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
      await arbExecutor.updateAddresses(newAddress, newAddress, newAddress);
      expect(await arbExecutor.lendingPool()).to.equal(newAddress);
      expect(await arbExecutor.swapRouter()).to.equal(newAddress);
      expect(await arbExecutor.acrossSpokePool()).to.equal(newAddress);
    });

    it("Should not allow non-owner to call admin functions", async function () {
      await expect(
        arbExecutor.connect(user).addSupportedToken(await mockToken.getAddress())
      ).to.be.revertedWithCustomError(arbExecutor, "OwnableUnauthorizedAccount");
      
      await expect(
        arbExecutor.connect(user).setProtocolFeePercent(200)
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
        fee: 3000, // 0.3% fee tier
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        destinationChainId: 42161, // Arbitrum
        recipient: user.address,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000)
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
        fee: 3000,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        destinationChainId: 42161,
        recipient: user.address,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000)
      };
      
      await expect(
        arbExecutor.executeCrossChainArbitrage(params)
      ).to.be.revertedWith("Amount must be > 0");
    });
    
    it("Should revert if destination chain is the same as current chain", async function () {
      await arbExecutor.addSupportedToken(await mockToken.getAddress());
      
      const params = {
        tokenIn: await mockToken.getAddress(),
        tokenOut: await mockToken.getAddress(),
        amountIn: ethers.parseEther("1"),
        minAmountOut: ethers.parseEther("0.9"),
        fee: 3000,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        destinationChainId: 31337, // Hardhat's chainId
        recipient: user.address,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000)
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
        fee: 3000,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        destinationChainId: 42161,
        recipient: ZERO_ADDRESS,
        relayerFeePct: 0,
        quoteTimestamp: Math.floor(Date.now() / 1000)
      };
      
      await expect(
        arbExecutor.executeCrossChainArbitrage(params)
      ).to.be.revertedWith("Invalid recipient");
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
