require("dotenv").config();
const { ethers, network } = require("hardhat");

function validateAndFormatAddress(address) {
  try {
    return ethers.getAddress(address);
  } catch (error) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
}

// DEX Types enum (must match the contract's enum)
const DexType = {
  UniswapV2: 0,
  UniswapV3: 1,
  Curve: 2,
  Balancer: 3,
};

// DEX configurations for different networks
const getDexConfigurations = (network) => {
  // Mainnet DEX addresses
  const mainnetDexes = [
    {
      name: "Uniswap V3",
      type: DexType.UniswapV3,
      address: process.env.UNISWAP_V3_ROUTER_MAINNET,
    },
    {
      name: "Uniswap V2",
      type: DexType.UniswapV2,
      address: process.env.UNISWAP_V2_ROUTER_MAINNET,
    },
    {
      name: "Curve 3Pool",
      type: DexType.Curve,
      address: process.env.CURVE_3POOL_MAINNET,
    },
    {
      name: "Balancer Vault",
      type: DexType.Balancer,
      address: process.env.BALANCER_VAULT_MAINNET,
    },
  ];

  // Sepolia testnet DEX addresses
  const sepoliaDexes = [
    {
      name: "Uniswap V3",
      type: DexType.UniswapV3,
      address: process.env.UNISWAP_V3_ROUTER_SEPOLIA,
    },
    {
      name: "Uniswap V2",
      type: DexType.UniswapV2,
      address: process.env.UNISWAP_V2_ROUTER_SEPOLIA,
    },
  ];

  // Return the appropriate DEX configuration based on the network
  switch (network) {
    case "mainnet":
      return mainnetDexes;
    case "sepolia":
      return sepoliaDexes;

    default:
      // For local development, use mainnet addresses
      return mainnetDexes;
  }
};

async function main() {
  console.log("Starting deployment of HemSniper AI contracts...");
  try {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log(
      "Account balance:",
      (await ethers.provider.getBalance(deployer.address)).toString()
    );

    // Get contract addresses from environment variables
    const lendingPoolAddress = network.name === "mainnet"
      ? process.env.AAVE_LENDING_POOL_ADDRESS_MAINNET
      : process.env.AAVE_LENDING_POOL_ADDRESS;

    // Validate environment variables
    if (!lendingPoolAddress) {
      throw new Error(
        "Required environment variable missing. Please check AAVE_LENDING_POOL_ADDRESS for Sepolia or AAVE_LENDING_POOL_ADDRESS_MAINNET for mainnet"
      );
    }

    // Format addresses
    const formattedLendingPoolAddress =
      validateAndFormatAddress(lendingPoolAddress);

    // Deploy ArbExecutor contract
    console.log("Deploying ArbExecutor Contract...");
    const ArbExecutor = await ethers.getContractFactory("ArbExecutor");
    
    // Proceed with deployment
    const arbExecutor = await ArbExecutor.deploy(formattedLendingPoolAddress);
    
    await arbExecutor.waitForDeployment();
    const arbExecutorAddress = await arbExecutor.getAddress();
    console.log("ArbExecutor Contract deployed to:", arbExecutorAddress);

    console.log("Registering DEXes...");
    const dexConfigurations = getDexConfigurations(network.name);

    // Register each DEX
    for (const dex of dexConfigurations) {
      const formattedAddress = validateAndFormatAddress(dex.address);
      console.log(
        `Registering ${dex.name} (${formattedAddress}) as DEX type ${dex.type}...`
      );

      try {
        const tx = await arbExecutor.addDex(
          formattedAddress,
          dex.type,
          dex.name
        );
        await tx.wait();
        console.log(`${dex.name} registered successfully`);
      } catch (error) {
        console.error(`Error registering ${dex.name}:`, error.message);
      }
    }

    // Add supported tokens (example tokens - adjust as needed)
    console.log("Adding supported tokens...");

    // Common tokens to support (addresses for mainnet - adjust for your target network)
    const supportedTokens = {
      WETH: process.env.WETH_ADDRESS,
      USDC: process.env.USDC_ADDRESS,
      USDT: process.env.USDT_ADDRESS,
      DAI: process.env.DAI_ADDRESS,
      UNI: process.env.UNI_ADDRESS,
      WBTC: process.env.WBTC_ADDRESS,
      LINK: process.env.LINK_ADDRESS,
      AAVE: process.env.AAVE_ADDRESS,
    };

    // Add each token
    for (const [name, address] of Object.entries(supportedTokens)) {
      const formattedAddress = validateAndFormatAddress(address);
      console.log(`Adding ${name} (${formattedAddress}) as supported token...`);

      try {
        const tx = await arbExecutor.addSupportedToken(formattedAddress);
        await tx.wait();
        console.log(`${name} added successfully`);
      } catch (error) {
        console.error(`Error adding ${name}:`, error.message);
      }
    }

    // Save deployed addresses
    const fs = require("fs");
    const deploymentDir = "./deployments";

    // Create deployments directory if it doesn't exist
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir);
    }

    // Use the network name from earlier
    const deployedAddresses = {
      network: network.name,
      ArbExecutor: arbExecutorAddress,
      AaveLendingPool: formattedLendingPoolAddress,

      supportedTokens,
      registeredDexes: dexConfigurations.map((dex) => ({
        name: dex.name,
        type: dex.type,
        address: dex.address,
      })),
    };

    fs.writeFileSync(
      `${deploymentDir}/${network.name}-addresses.json`,
      JSON.stringify(deployedAddresses, null, 2)
    );
    console.log(
      `Contract addresses saved to ${deploymentDir}/${network.name}-addresses.json`
    );

    console.log("Deployment completed successfully");
  } catch (error) {
    console.error("Error in deployment process:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
