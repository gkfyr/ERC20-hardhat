const hre = require("hardhat");

async function main() {
  try {
    // Get deployment account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    // Check deployer account balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Token configuration
    const TOKEN_NAME = "Test Token";
    const TOKEN_SYMBOL = "TEST";

    // Deploy Token contract
    console.log(`Starting ${TOKEN_NAME} deployment...`);
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy(deployer.address, TOKEN_NAME, TOKEN_SYMBOL);
    await token.waitForDeployment();

    const contractAddress = await token.getAddress();
    console.log("Token contract address:", contractAddress);

    // Initial contract setup
    console.log("Initializing contract settings...");

    // Set whitelist status for test addresses (optional)
    // const testAddresses = ["0x...", "0x..."];
    // await token.setWhitelist(testAddresses, true);

    console.log("Deployment completed!");

    // Print deployment information
    console.log("\nDeployment Information:");
    console.log("-------------------");
    console.log("Contract Address:", contractAddress);
    console.log("Owner Address:", deployer.address);
    console.log("Token Name:", TOKEN_NAME);
    console.log("Token Symbol:", TOKEN_SYMBOL);
    console.log("Total Supply:", "1,000,000,000");
    console.log("Team Supply:", "450,000,000");

    // Print contract verification information
    console.log("\nContract Verification Information:");
    console.log("-------------------");
    console.log(
      `npx hardhat verify --network ${network.name} ${contractAddress} "${deployer.address}" "${TOKEN_NAME}" "${TOKEN_SYMBOL}"`
    );
  } catch (error) {
    console.error("Error during deployment:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
