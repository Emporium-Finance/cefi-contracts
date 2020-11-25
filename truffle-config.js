const mnemonic = "{deployer wallet seed}";
const HDWalletProvider = require("@truffle/hdwallet-provider");


module.exports = {
  // Uncommenting the defaults below
  // provides for an easier quick-start with Ganache.
  // You can also follow this format for other networks;
  // see <http://truffleframework.com/docs/advanced/configuration>
  // for more details on how to specify configuration options!
  //
  networks: {
    live: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://mainnet.infura.io/v3/{infura_key}")
      },
      network_id: 1,
      gasPrice: 30000000000,  // 295 gwei (in wei) (default: 100 gwei)
    },
    develop: {
      gas: 15000000,
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
      gasPrice: 28000000000
    },   
    test: {
      gas: 15000000,
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    },
    ganache: {
      gas: 15000000,
      host: "127.0.0.1", // Localhost (default: none)
      port: 7545, // Standard Ethereum port (default: none)
      network_id: "5777", // Any network (default: none)
},
  },
  //
  compilers: {
    solc: {
      version: "0.6.12"
    }
  }
};
