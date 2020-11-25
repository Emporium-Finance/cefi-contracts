pragma solidity 0.6.12;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CEFIToken.sol";



contract CEFIStaker is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of CEFIs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accCefiPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accCefiPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. CEFIs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that CEFIs distribution occurs.
        uint256 accCefiPerShare; // Accumulated CEFI's per share, times 1e12. See below.
    }

    // The CEFI TOKEN
    CEFIToken public cefi;
    // Dev address.
    address public devaddr;
    // CEFI tokens created per block.
    uint256 public cefiPerBlock;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when CEFI mining starts.
    uint256 public startBlock;
    // Block number when CEFI mining ends.
    uint256 public targetEndBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);



    constructor(
        CEFIToken _cefi,
        address _devaddr,
        uint256 _startBlock,
        uint256 _targetEndBlock,
        uint256 _lp_program,
        uint256 _lp_program_extra
    ) public {
        cefi = _cefi;
        devaddr = _devaddr;
        targetEndBlock = _targetEndBlock;
        startBlock = _startBlock;

        cefiPerBlock = _lp_program.add(_lp_program_extra).div(targetEndBlock.sub(startBlock));
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accCefiPerShare: 0
        }));
    }

    // Update the given pool's CEFI allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // Return the number of active blocks over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_from >= targetEndBlock) {
            return 0;
        } else if (_from >= startBlock && _to >= targetEndBlock) {
            return targetEndBlock.sub(_from);
        } else if (_to >= targetEndBlock) {
            return targetEndBlock.sub(startBlock);
        } else if (_from >= startBlock && _to < targetEndBlock) {
            return _to.sub(_from);
        } else if (_to >= startBlock) {
            return _to.sub(startBlock.sub(1));
        } else {
            return 0;
        }
    }

    // View function to see pending CEFI on frontend.
    function pendingCEFI(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accCefiPerShare = pool.accCefiPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 cefiReward = multiplier.mul(cefiPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accCefiPerShare = accCefiPerShare.add(cefiReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accCefiPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 cefiReward = multiplier.mul(cefiPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        cefi.stakerMint(devaddr, cefiReward.mul(3).div(100));
        cefi.stakerMint(address(this), cefiReward);
        pool.accCefiPerShare = pool.accCefiPerShare.add(cefiReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to CEFIStaker for CEFI allocation.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accCefiPerShare).div(1e12).sub(user.rewardDebt);
            if(pending > 0) {
                safeCefiTransfer(msg.sender, pending);
            }
        }
        if(_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accCefiPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from CEFIStaker.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accCefiPerShare).div(1e12).sub(user.rewardDebt);
        if(pending > 0) {
            safeCefiTransfer(msg.sender, pending);
        }
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accCefiPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    // Safe CEFI transfer function, just in case if rounding error causes pool to not have enough CEFIs.
    function safeCefiTransfer(address _to, uint256 _amount) internal {
        uint256 cefiBal = cefi.balanceOf(address(this));
        if (_amount > cefiBal) {
            cefi.transfer(_to, cefiBal);
        } else {
            cefi.transfer(_to, _amount);
        }
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) public {
        require(msg.sender == devaddr, "dev: wut?");
        devaddr = _devaddr;
    }
}
