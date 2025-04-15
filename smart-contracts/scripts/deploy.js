require('dotenv').config();
const { ethers } = require('hardhat');

// Utility function to validate and format Ethereum addresses
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
      address: "0xE592427A0AEce92De3Edee1F18E0157C05861564" // Uniswap V3 Router
    },
    {
      name: "Uniswap V2",
      type: DexType.UniswapV2,
      address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" // Uniswap V2 Router
    },
    {
      name: "SushiSwap",
      type: DexType.UniswapV2,
      address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F" // SushiSwap Router
    },
    {
      name: "Curve 3Pool",
      type: DexType.Curve,
      address: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7" // Curve 3Pool
    }
  ];
  
  // Sepolia testnet DEX addresses
  const sepoliaDexes = [
    {
      name: "Uniswap V3",
      type: DexType.UniswapV3,
      address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" // Uniswap V3 Router on Sepolia
    },
    {
      name: "Uniswap V2",
      type: DexType.UniswapV2,
      address: process.env.UNISWAP_V2_ROUTER_SEPOLIA || "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" // Placeholder
    }
  ];
  
  // Arbitrum DEX addresses
  const arbitrumDexes = [
    {
      name: "Uniswap V3",
      type: DexType.UniswapV3,
      address: "0xE592427A0AEce92De3Edee1F18E0157C05861564" // Uniswap V3 Router on Arbitrum
    },
    {
      name: "SushiSwap",
      type: DexType.UniswapV2,
      address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506" // SushiSwap Router on Arbitrum
    },
    {
      name: "Camelot",
      type: DexType.UniswapV2,
      address: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d" // Camelot Router on Arbitrum
    }
  ];
  
  // Base network DEX addresses
  const baseDexes = [
    {
      name: "Uniswap V3",
      type: DexType.UniswapV3,
      address: "0x2626664c2603336E57B271c5C0b26F421741e481" // Uniswap V3 Router on Base
    },
    {
      name: "BaseSwap",
      type: DexType.UniswapV2,
      address: "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86" // BaseSwap Router
    },
    {
      name: "Aerodrome",
      type: DexType.UniswapV2,
      address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" // Aerodrome Router
    }
  ];
  
  // Return the appropriate DEX configuration based on the network
  switch (networkName) {
    case 'mainnet':
      return mainnetDexes;
    case 'sepolia':
      return sepoliaDexes;
    case 'arbitrum':
    case 'arbitrumOne':
      return arbitrumDexes;
    case 'arbitrumSepolia':
      return arbitrumDexes.map(dex => ({
        ...dex,
        address: process.env[`${dex.name.toUpperCase().replace(' ', '_')}_ROUTER_ARBITRUM_SEPOLIA`] || dex.address
      }));
    case 'base':
      return baseDexes;
    case 'baseSepolia':
      return baseDexes.map(dex => ({
        ...dex,
        address: process.env[`${dex.name.toUpperCase().replace(' ', '_')}_ROUTER_BASE_SEPOLIA`] || dex.address
      }));
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
    const lendingPoolAddress = process.env.AAVE_LENDING_POOL_ADDRESS;
    const acrossSpokePoolAddress = process.env.ACROSS_SPOKE_POOL_ADDRESS;

    // Validate environment variables
    if (!lendingPoolAddress || !acrossSpokePoolAddress) {
      throw new Error(
        'Required environment variables missing. Please check AAVE_LENDING_POOL_ADDRESS and ACROSS_SPOKE_POOL_ADDRESS'
      );
    }

    // Format addresses
    const formattedLendingPoolAddress = validateAndFormatAddress(lendingPoolAddress);
    const formattedAcrossSpokePoolAddress = validateAndFormatAddress(acrossSpokePoolAddress);

    // Deploy ArbExecutor contract
    console.log('Deploying ArbExecutor Contract...');
    const ArbExecutor = await ethers.getContractFactory('ArbExecutor');
    const arbExecutor = await ArbExecutor.deploy(
      formattedLendingPoolAddress,
      formattedAcrossSpokePoolAddress
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
      AcrossSpokePool: formattedAcrossSpokePoolAddress,
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
