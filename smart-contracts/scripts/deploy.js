require('dotenv').config();
const { ethers } = require('hardhat');

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
  Custom: 4
};

// DEX configurations for different networks
const getDexConfigurations = (networkName) => {
  // Mainnet DEX addresses
  const mainnetDexes = [
    {
      name: "Uniswap V3",
      type: DexType.UniswapV3,
      address: process.env.UNISWAP_V3_ROUTER_MAINNET
    },
    {
      name: "Uniswap V2",
      type: DexType.UniswapV2,
      address: process.env.UNISWAP_V2_ROUTER_MAINNET
    },
    {
      name: "SushiSwap",
      type: DexType.UniswapV2,
      address: process.env.SUSHISWAP_ROUTER_MAINNET
    },
    {
      name: "Curve 3Pool",
      type: DexType.Curve,
      address: process.env.CURVE_3POOL_MAINNET
    }
  ];
  
  // Sepolia testnet DEX addresses
  const sepoliaDexes = [
    {
      name: "Uniswap V3",
      type: DexType.UniswapV3,
      address: process.env.UNISWAP_V3_ROUTER_SEPOLIA
    },
    {
      name: "Uniswap V2",
      type: DexType.UniswapV2,
      address: process.env.UNISWAP_V2_ROUTER_SEPOLIA
    }
  ];
  

  
  // Return the appropriate DEX configuration based on the network
  switch (networkName) {
    case 'mainnet':
      return mainnetDexes;
    case 'sepolia':
      return sepoliaDexes;

    default:
      // For local development, use mainnet addresses
      return mainnetDexes;
  }
};

async function main() {
  console.log('Starting deployment of HemSniper AI contracts...');
  try {
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with account:', deployer.address);
    console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());

    // Get contract addresses from environment variables
    const lendingPoolAddress = networkName === 'mainnet' 
      ? process.env.AAVE_LENDING_POOL_ADDRESS_MAINNET 
      : process.env.AAVE_LENDING_POOL_ADDRESS;

    // Validate environment variables
    if (!lendingPoolAddress) {
      throw new Error(
        'Required environment variable missing. Please check AAVE_LENDING_POOL_ADDRESS for Sepolia or AAVE_LENDING_POOL_ADDRESS_MAINNET for mainnet'
      );
    }

    // Format addresses
    const formattedLendingPoolAddress = validateAndFormatAddress(lendingPoolAddress);

    // Deploy ArbExecutor contract
    console.log('Deploying ArbExecutor Contract...');
    const ArbExecutor = await ethers.getContractFactory('ArbExecutor');
    const arbExecutor = await ArbExecutor.deploy(
      formattedLendingPoolAddress
    );
    
    await arbExecutor.waitForDeployment();
    const arbExecutorAddress = await arbExecutor.getAddress();
    console.log('ArbExecutor Contract deployed to:', arbExecutorAddress);

    // Get current network name
    const networkName = process.env.HARDHAT_NETWORK || 'localhost';
    console.log(`Registering DEXs for network: ${networkName}...`);
    
    const dexConfigurations = getDexConfigurations(networkName);
    
    // Register each DEX
    for (const dex of dexConfigurations) {
      const formattedAddress = validateAndFormatAddress(dex.address);
      console.log(`Registering ${dex.name} (${formattedAddress}) as DEX type ${dex.type}...`);
      
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
    console.log('Adding supported tokens...');
    
    // Common tokens to support (addresses for mainnet - adjust for your target network)
    const supportedTokens = {
      WETH: process.env.WETH_ADDRESS || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      USDC: process.env.USDC_ADDRESS || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: process.env.USDT_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      DAI: process.env.DAI_ADDRESS || '0x6B175474E89094C44Da98b954EedeAC495271d0F'
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
    const fs = require('fs');
    const deploymentDir = './deployments';
    
    // Create deployments directory if it doesn't exist
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir);
    }
    
    // Use the network name from earlier
    const deployedAddresses = {
      network: networkName,
      ArbExecutor: arbExecutorAddress,
      AaveLendingPool: formattedLendingPoolAddress,

      supportedTokens,
      registeredDexes: dexConfigurations.map(dex => ({
        name: dex.name,
        type: dex.type,
        address: dex.address
      }))
    };

    fs.writeFileSync(
      `${deploymentDir}/${networkName}-addresses.json`,
      JSON.stringify(deployedAddresses, null, 2)
    );
    console.log(`Contract addresses saved to ${deploymentDir}/${networkName}-addresses.json`);

    console.log('Deployment completed successfully');
  } catch (error) {
    console.error('Error in deployment process:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
