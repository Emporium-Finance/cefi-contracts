pragma solidity 0.6.12;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CEFIStaker.sol";


// CEFIToken
contract CEFIToken is ERC20("Emporium.Finance", "CEFI"), Ownable {

    uint256 public constant MINT_LIMIT =  888000 * 1e18;
    // CEFI tokens for bounty program
    uint256 public constant BOUNTY_PROGRAM  =  17760 * 1e18;
    // CEFI tokens for cashback 
    uint256 public constant CASHBACK_PROGRAM  =  17760 * 1e18;

    // Staker (ruled by CEFIStaker contract)
    address public staker;

    /**
     * @dev Throws if called by any account other than the staker.
     */
    modifier onlyStaker() {
        require(staker == _msgSender(), "CEFI: caller is not the staker");
        _;
    }

    // Constructor code is only run when the contract
    // is created
    constructor(
      address _stakerOwner, 
      address _devaddr, 
      address _bountyaddr, 
      address _cashbackaddr,
      uint256 _lpProgram,
      uint256 _lpProgramExtra,
      uint _startLPBlock,
      uint _endLPBlock
      ) public {
	      staker = address(new CEFIStaker(this, _devaddr, _startLPBlock, _endLPBlock, _lpProgram, _lpProgramExtra));
        CEFIStaker(staker).transferOwnership(_stakerOwner);

        _mint(_bountyaddr, BOUNTY_PROGRAM);
        _mint(_cashbackaddr, CASHBACK_PROGRAM);
    }

    /// @notice Creates `_amount` token to `_to`. Must only be called by the owner.
    function mint(address _to, uint256 _amount) public onlyOwner {
        require(totalSupply() + _amount < MINT_LIMIT, 'Mint amount exceeds max supply');
        _mint(_to, _amount);
    }

    /// @notice Creates `_amount` token to `_to`. Must only be called by the staker.
    function stakerMint(address _to, uint256 _amount) public onlyStaker {
        require(totalSupply() + _amount < MINT_LIMIT, 'Mint amount exceeds max supply');
        _mint(_to, _amount);
    }

}