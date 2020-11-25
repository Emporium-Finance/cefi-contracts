const { expectRevert, time } = require('@openzeppelin/test-helpers');
const ethers = require('ethers');
const CefiToken = artifacts.require('CEFIToken');
const CefiStaker = artifacts.require('CEFIStaker');
const MockERC20 = artifacts.require('MockERC20');
const Timelock = artifacts.require('Timelock');

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract('Timelock', ([alice, bob, carol, dev, minter, bounty, cashback]) => {
    beforeEach(async () => {
        const lpProgramm = web3.utils.toBN('88800000000000000000000'); //88800 * 1e18;
        const lpProgrammExtra = web3.utils.toBN('26640000000000000000000'); //26640 * 1e18;
        const startLPBlock = 11269746;
        const endLPBlock = 11639746;
        this.timelock = await Timelock.new(bob, '259200', { from: alice });

        this.cefi = await CefiToken.new(
          alice, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
          { from: alice }
        );
    });

    it('should not allow non-owner to do operation', async () => {
        await this.cefi.transferOwnership(this.timelock.address, { from: alice });
        await expectRevert(
            this.cefi.transferOwnership(carol, { from: alice }),
            'Ownable: caller is not the owner',
        );
        await expectRevert(
            this.cefi.transferOwnership(carol, { from: bob }),
            'Ownable: caller is not the owner',
        );
        await expectRevert(
            this.timelock.queueTransaction(
                this.cefi.address, '0', 'transferOwnership(address)',
                encodeParameters(['address'], [carol]),
                (await time.latest()).add(time.duration.days(4)),
                { from: alice },
            ),
            'Timelock::queueTransaction: Call must come from admin.',
        );
    });

    it('should do the timelock thing', async () => {
        await this.cefi.transferOwnership(this.timelock.address, { from: alice });
        const eta = (await time.latest()).add(time.duration.days(4));
        await this.timelock.queueTransaction(
            this.cefi.address, '0', 'transferOwnership(address)',
            encodeParameters(['address'], [carol]), eta, { from: bob },
        );
        await time.increase(time.duration.days(1));
        await expectRevert(
            this.timelock.executeTransaction(
                this.cefi.address, '0', 'transferOwnership(address)',
                encodeParameters(['address'], [carol]), eta, { from: bob },
            ),
            "Timelock::executeTransaction: Transaction hasn't surpassed time lock.",
        );
        await time.increase(time.duration.days(4));
        await this.timelock.executeTransaction(
            this.cefi.address, '0', 'transferOwnership(address)',
            encodeParameters(['address'], [carol]), eta, { from: bob },
        );
        assert.equal((await this.cefi.owner()).valueOf(), carol);
    });

    it('should also work with CefiStaker', async () => {
        this.lp1 = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
        this.lp2 = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
        
        this.staker = await CefiStaker.at(await this.cefi.staker());
        await this.staker.add('100', this.lp1.address, true);
        await this.staker.transferOwnership(this.timelock.address, { from: alice });

        const eta = (await time.latest()).add(time.duration.days(4));
        await this.timelock.queueTransaction(
            this.staker.address, '0', 'set(uint256,uint256,bool)',
            encodeParameters(['uint256', 'uint256', 'bool'], ['0', '200', false]), eta, { from: bob },
        );
        await this.timelock.queueTransaction(
            this.staker.address, '0', 'add(uint256,address,bool)',
            encodeParameters(['uint256', 'address', 'bool'], ['100', this.lp2.address, false]), eta, { from: bob },
        );
        await time.increase(time.duration.days(4));
        await this.timelock.executeTransaction(
            this.staker.address, '0', 'set(uint256,uint256,bool)',
            encodeParameters(['uint256', 'uint256', 'bool'], ['0', '200', false]), eta, { from: bob },
        );
        await this.timelock.executeTransaction(
            this.staker.address, '0', 'add(uint256,address,bool)',
            encodeParameters(['uint256', 'address', 'bool'], ['100', this.lp2.address, false]), eta, { from: bob },
        );
        assert.equal((await this.staker.poolInfo('0')).valueOf().allocPoint, '200');
        assert.equal((await this.staker.totalAllocPoint()).valueOf(), '300');
        assert.equal((await this.staker.poolLength()).valueOf(), '2');
    });
});
