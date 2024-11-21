require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    manta: {
      url: "https://pacific-rpc.manta.network/http",
      chainId: 169,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
    },
  },
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY,
  // },
  // gasReporter: {
  //   enabled: true,
  //   currency: "USD",
  //   coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  // },
};
