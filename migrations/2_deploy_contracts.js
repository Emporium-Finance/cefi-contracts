  var cefiToken = artifacts.require("./CEFIToken.sol");
  module.exports = async function(deployer, network, accounts) {
    const owneraddr = "0x8D19A9E06e905eE96eE1F91fFf43455CAaD38fC2"; //deployer initially, after adding pools transfer ownership to owner timelock address
    const teamaddr = "0xf030663C84Bdf73eb57eC1580963Ffdc56406029"; //address where a portion of CEFI would be minted along with LP program users
    const bountyaddr = "0x1EDB002C061C0020452DC17e3bd4d84d14C6cBb5"; //wallet to hold CEFI tokens for Bounty Program
    const cashbackaddr = "0xf1680Bc743A7625Fe3d5070D4BD787251c464A2D"; //wallet to hold CEFI tokens for Cashback Program
    const lpProgramm = web3.utils.toBN('88800000000000000000000'); //88800 * 1e18; //total amount of tokens to be distributed through LP program
    const lpProgrammExtra = web3.utils.toBN('26640000000000000000000'); //26640 * 1e18; //total amount of tokens to be minted to team address along with LP program
    const startLPBlock = 11334470;
    const endLPBlock = 11703800;
    let res = await Promise.all([
      deployer.deploy(cefiToken, 
        owneraddr, teamaddr, bountyaddr, cashbackaddr, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
        {gas: 10000000}),
    ]);
    console.log(res);
  };