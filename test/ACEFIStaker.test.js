const { expectRevert, time } = require('@openzeppelin/test-helpers');
const CefiToken = artifacts.require('CEFIToken');
const CefiStaker = artifacts.require('CEFIStaker');
const MockERC20 = artifacts.require('MockERC20');

contract('CefiStaker', ([alice, bob, carol, dev, minter, bounty, cashback]) => {

    it('should return correct multiplier', async () => {
        const lpProgramm = web3.utils.toBN('88800000000000000000000'); //88800 * 1e18;
        const lpProgrammExtra = web3.utils.toBN('26640000000000000000000'); //26640 * 1e18;
        const startLPBlock = 100;
        const endLPBlock = 200;


        this.cefi = await CefiToken.new(
          alice, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
          { from: alice }
        );
        this.staker = await CefiStaker.at(await this.cefi.staker());

        // interval is before the LP program
        assert.equal(await this.staker.getMultiplier(startLPBlock-10,startLPBlock-1), '0');
         // interval started before the LP program but has an intersection
        assert.equal(await this.staker.getMultiplier(startLPBlock-10,startLPBlock), '1');
        assert.equal(await this.staker.getMultiplier(startLPBlock-10,startLPBlock+5), '6');
        // interval started after the LP program
        assert.equal(await this.staker.getMultiplier(endLPBlock,endLPBlock+10), '0');
        assert.equal(await this.staker.getMultiplier(endLPBlock+1,endLPBlock+30), '0');
        // interval started inside the LP program and ended after
        assert.equal(await this.staker.getMultiplier(endLPBlock-1,endLPBlock+5), '1');
        assert.equal(await this.staker.getMultiplier(endLPBlock-5,endLPBlock+5), '5');
        assert.equal(await this.staker.getMultiplier(endLPBlock-10,endLPBlock+100), '10');
        // interval started before the LP program and ended after
        assert.equal(await this.staker.getMultiplier(startLPBlock-5,endLPBlock+5), endLPBlock-startLPBlock);
        assert.equal(await this.staker.getMultiplier(startLPBlock-100,endLPBlock+100), endLPBlock-startLPBlock);
        // zero length interval
        assert.equal(await this.staker.getMultiplier('1','1'), '0');
        assert.equal(await this.staker.getMultiplier(startLPBlock,startLPBlock), '0');
        assert.equal(await this.staker.getMultiplier(startLPBlock+10,startLPBlock+10), '0');
        assert.equal(await this.staker.getMultiplier(endLPBlock,endLPBlock), '0');
        assert.equal(await this.staker.getMultiplier('25','25'), '0');
    });

    it('should set correct state variables', async () => {
        const lpProgramm = web3.utils.toBN('88800000000000000000000'); //88800 * 1e18;
        const lpProgrammExtra = web3.utils.toBN('26640000000000000000000'); //26640 * 1e18;
        const startLPBlock = 100;
        const endLPBlock = 200;

        this.cefi = await CefiToken.new(
          alice, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
          { from: alice }
        );
        this.staker = await CefiStaker.at(await this.cefi.staker());

        const cefi = await this.staker.cefi();
        const devaddr = await this.staker.devaddr();
        const stakerAddr = await this.cefi.staker();
        assert.equal(cefi.valueOf(), this.cefi.address);
        assert.equal(devaddr.valueOf(), dev);
        assert.equal(stakerAddr.valueOf(), this.staker.address);
    });

    it('should allow dev and only dev to update dev', async () => {
        const lpProgramm = web3.utils.toBN('88800000000000000000000'); //88800 * 1e18;
        const lpProgrammExtra = web3.utils.toBN('26640000000000000000000'); //26640 * 1e18;
        const startLPBlock = 100;
        const endLPBlock = 200;

        this.cefi = await CefiToken.new(
          alice, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
          { from: alice }
        );
        this.staker = await CefiStaker.at(await this.cefi.staker());

        assert.equal((await this.staker.devaddr()).valueOf(), dev);
        await expectRevert(this.staker.dev(bob, { from: bob }), 'dev: wut?');
        await this.staker.dev(bob, { from: dev });
        assert.equal((await this.staker.devaddr()).valueOf(), bob);
        await this.staker.dev(alice, { from: bob });
        assert.equal((await this.staker.devaddr()).valueOf(), alice);
    })

    context('With ERC/LP token added to the field', () => {
        beforeEach(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
            await this.lp2.transfer(alice, '1000', { from: minter });
            await this.lp2.transfer(bob, '1000', { from: minter });
            await this.lp2.transfer(carol, '1000', { from: minter });
        });

        it('should allow emergency withdraw', async () => {
            const lpProgramm = web3.utils.toBN('88800000000000000000000'); //88800 * 1e18;
            const lpProgrammExtra = web3.utils.toBN('26640000000000000000000'); //26640 * 1e18;
            const startLPBlock = 100;
            const endLPBlock = 200;
    
            this.cefi = await CefiToken.new(
              alice, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
              { from: alice }
            );
            this.staker = await CefiStaker.at(await this.cefi.staker());
  

            await this.staker.add('100', this.lp.address, true);
            await this.lp.approve(this.staker.address, '1000', { from: bob });
            await this.staker.deposit(0, '100', { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '900');
            await this.staker.emergencyWithdraw(0, { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
        });

        it('should give out CEFIs only after farming time', async () => {
            const lpProgramm = web3.utils.toBN('10000'); 
            const lpProgrammExtra = web3.utils.toBN('0');
            const startLPBlock = 100;
            const endLPBlock = 200;
    
            this.cefi = await CefiToken.new(
              alice, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
              { from: alice }
            );
            this.staker = await CefiStaker.at(await this.cefi.staker());
  
            await this.staker.add('100', this.lp.address, true);
            await this.lp.approve(this.staker.address, '1000', { from: bob });
            await this.staker.deposit(0, '100', { from: bob });
            await time.advanceBlockTo('89');
            await this.staker.deposit(0, '0', { from: bob }); // block 90
            assert.equal((await this.cefi.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('94');
            await this.staker.deposit(0, '0', { from: bob }); // block 95
            assert.equal((await this.cefi.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('99');
            await this.staker.deposit(0, '0', { from: bob }); // block 100
            assert.equal((await this.cefi.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('100');
            await this.staker.deposit(0, '0', { from: bob }); // block 101
            // CEFIperBlock = (10000+0)/(200-100)= 100;
            assert.equal((await this.cefi.balanceOf(bob)).valueOf(), '100');  
            await time.advanceBlockTo('104');
            await this.staker.deposit(0, '0', { from: bob }); // block 105
            assert.equal((await this.cefi.balanceOf(bob)).valueOf(), '500');
            assert.equal((await this.cefi.balanceOf(dev)).valueOf(), '15');
            // 500 (from bob) + 15 (from dev) + 1776000000000000000000 (from bounty)
            // + 1776000000000000000000 (from cashback) = 35520000000000000000515
            assert.equal((await this.cefi.totalSupply()).valueOf(), '35520000000000000000515');
        });

        it('should not distribute CEFIs if no one deposit', async () => {
            const lpProgramm = web3.utils.toBN('10000'); 
            const lpProgrammExtra = web3.utils.toBN('0');
            const startLPBlock = 200;
            const endLPBlock = 300;
    
            this.cefi = await CefiToken.new(
              alice, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
              { from: alice }
            );
            this.staker = await CefiStaker.at(await this.cefi.staker());

            await this.staker.add('100', this.lp.address, true);
            await this.lp.approve(this.staker.address, '1000', { from: bob });
            await time.advanceBlockTo('199');
            // 35520000000000000000000 - cashback + bounty
            assert.equal((await this.cefi.totalSupply()).valueOf(), '35520000000000000000000');
            await time.advanceBlockTo('204');
            assert.equal((await this.cefi.totalSupply()).valueOf(), '35520000000000000000000');
            await time.advanceBlockTo('209');
            await this.staker.deposit(0, '10', { from: bob }); // block 210
            assert.equal((await this.cefi.totalSupply()).valueOf(), '35520000000000000000000');
            assert.equal((await this.cefi.balanceOf(bob)).valueOf(), '0');
            assert.equal((await this.cefi.balanceOf(dev)).valueOf(), '0');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '990');
            await time.advanceBlockTo('219');
            await this.staker.withdraw(0, '10', { from: bob }); // block 220
            assert.equal((await this.cefi.balanceOf(bob)).valueOf(), '1000');
            assert.equal((await this.cefi.balanceOf(dev)).valueOf(), '30');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
        });



        it('should distribute CEFIs properly for each staker', async () => {
            const lpProgramm = web3.utils.toBN('100000'); 
            const lpProgrammExtra = web3.utils.toBN('0');
            const startLPBlock = 300;
            const endLPBlock = 400;
    
            this.cefi = await CefiToken.new(
              alice, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
              { from: alice }
            );
            this.staker = await CefiStaker.at(await this.cefi.staker());

            await this.staker.add('100', this.lp.address, true);
            await this.lp.approve(this.staker.address, '1000', { from: alice });
            await this.lp.approve(this.staker.address, '1000', { from: bob });
            await this.lp.approve(this.staker.address, '1000', { from: carol });
            // Alice deposits 10 LPs at block 310
            await time.advanceBlockTo('309');
            await this.staker.deposit(0, '10', { from: alice });
            // Bob deposits 20 LPs at block 314
            await time.advanceBlockTo('313');
            await this.staker.deposit(0, '20', { from: bob });
            // Carol deposits 30 LPs at block 318
            await time.advanceBlockTo('317');
            await this.staker.deposit(0, '30', { from: carol });
            // Alice deposits 10 more LPs at block 320. At this point:
            //   Alice should have: 4*1000 + 4*1/3*1000 + 2*1/6*1000 = 5666
            //   CefiStaker should have the remaining: 10000 - 5666 = 4334
            await time.advanceBlockTo('319')
            await this.staker.deposit(0, '10', { from: alice });
            assert.equal((await this.cefi.balanceOf(alice)).valueOf(), '5666');
            assert.equal((await this.cefi.balanceOf(bob)).valueOf(), '0');
            assert.equal((await this.cefi.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.cefi.balanceOf(this.staker.address)).valueOf(), '4334');
            assert.equal((await this.cefi.balanceOf(dev)).valueOf(), '300');
            // Bob withdraws 5 LPs at block 330. At this point:
            //   Bob should have: 4*2/3*1000 + 2*2/6*1000 + 10*2/7*1000 = 6190
            await time.advanceBlockTo('329')
            await this.staker.withdraw(0, '5', { from: bob });
            assert.equal((await this.cefi.balanceOf(alice)).valueOf(), '5666');
            assert.equal((await this.cefi.balanceOf(bob)).valueOf(), '6190');
            assert.equal((await this.cefi.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.cefi.balanceOf(this.staker.address)).valueOf(), '8144');
            assert.equal((await this.cefi.balanceOf(dev)).valueOf(), '600');
            // Alice withdraws 20 LPs at block 340.
            // Bob withdraws 15 LPs at block 350.
            // Carol withdraws 30 LPs at block 360.
            await time.advanceBlockTo('339')
            await this.staker.withdraw(0, '20', { from: alice });
            await time.advanceBlockTo('349')
            await this.staker.withdraw(0, '15', { from: bob });
            await time.advanceBlockTo('359')
            await this.staker.withdraw(0, '30', { from: carol });
            assert.equal((await this.cefi.balanceOf(dev)).valueOf(), '1500');
            // Alice should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
            assert.equal((await this.cefi.balanceOf(alice)).valueOf(), '11600');
            // Bob should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
            assert.equal((await this.cefi.balanceOf(bob)).valueOf(), '11831');
            // Carol should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
            assert.equal((await this.cefi.balanceOf(carol)).valueOf(), '26568');
            // All of them should have 1000 LPs back.
            assert.equal((await this.lp.balanceOf(alice)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(carol)).valueOf(), '1000');
        });

        it('should give proper CEFIs allocation to each pool', async () => {
            const lpProgramm = web3.utils.toBN('100000'); 
            const lpProgrammExtra = web3.utils.toBN('0');
            const startLPBlock = 400;
            const endLPBlock = 500;
    
            this.cefi = await CefiToken.new(
              alice, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
              { from: alice }
            );
            this.staker = await CefiStaker.at(await this.cefi.staker());

            await this.lp.approve(this.staker.address, '1000', { from: alice });
            await this.lp2.approve(this.staker.address, '1000', { from: bob });
            // Add first LP to the pool with allocation 1
            await this.staker.add('10', this.lp.address, true);
            // Alice deposits 10 LPs at block 410
            await time.advanceBlockTo('409');
            await this.staker.deposit(0, '10', { from: alice });
            // Add LP2 to the pool with allocation 2 at block 420
            await time.advanceBlockTo('419');
            await this.staker.add('20', this.lp2.address, true);
            // Alice should have 10*1000 pending reward
            assert.equal((await this.staker.pendingCEFI(0, alice)).valueOf(), '10000');
            // Bob deposits 10 LP2s at block 425
            await time.advanceBlockTo('424');
            await this.staker.deposit(1, '5', { from: bob });
            // Alice should have 10000 + 5*1/3*1000 = 11666 pending reward
            assert.equal((await this.staker.pendingCEFI(0, alice)).valueOf(), '11666');
            await time.advanceBlockTo('430');
            // At block 430. Bob should get 5*2/3*1000 = 3333. Alice should get ~1666 more.
            assert.equal((await this.staker.pendingCEFI(0, alice)).valueOf(), '13333');
            assert.equal((await this.staker.pendingCEFI(1, bob)).valueOf(), '3333');
        });

        it('should stop giving CEFIs after end block', async () => {
            const lpProgramm = web3.utils.toBN('10000'); 
            const lpProgrammExtra = web3.utils.toBN('0');
            const startLPBlock = 500;
            const endLPBlock = 600;
    
            this.cefi = await CefiToken.new(
              alice, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
              { from: alice }
            );
            this.staker = await CefiStaker.at(await this.cefi.staker());

            await this.lp.approve(this.staker.address, '1000', { from: alice });
            await this.staker.add('1', this.lp.address, true);
            // Alice deposits 10 LPs at block 590
            await time.advanceBlockTo('589');
            await this.staker.deposit(0, '10', { from: alice });
            // At block 605, she should have 100*10 + 0 = 1000 pending.
            await time.advanceBlockTo('605');
            assert.equal((await this.staker.pendingCEFI(0, alice)).valueOf(), '1000');
            // At block 606, Alice withdraws all pending rewards and should get 10000.
            await this.staker.deposit(0, '0', { from: alice });
            assert.equal((await this.staker.pendingCEFI(0, alice)).valueOf(), '0');
            assert.equal((await this.cefi.balanceOf(alice)).valueOf(), '1000');
        });
        
    });
});
