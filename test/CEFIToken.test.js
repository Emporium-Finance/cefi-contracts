const { expectRevert } = require('@openzeppelin/test-helpers');
const CefiToken = artifacts.require('CEFIToken');

contract('CEFIToken', ([alice, bob, carol, owner, dev, bounty, cashback]) => {
    beforeEach(async () => {
      const lpProgramm = web3.utils.toBN('88800000000000000000000'); //88800 * 1e18;
      const lpProgrammExtra = web3.utils.toBN('26640000000000000000000'); //26640 * 1e18;
      const startLPBlock = 11269746;
      const endLPBlock = 11639746;
        this.cefi = await CefiToken.new(
          owner, dev, bounty, cashback, lpProgramm, lpProgrammExtra, startLPBlock, endLPBlock, 
          { from: owner });
    });

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.cefi.name();
        const symbol = await this.cefi.symbol();
        const decimals = await this.cefi.decimals();
        assert.equal(name.valueOf(), 'Emporium.Finance');
        assert.equal(symbol.valueOf(), 'CEFI');
        assert.equal(decimals.valueOf(), '18');
    });

    it('should only allow owner or staker to mint token', async () => {
        await this.cefi.mint(alice, '100', { from: owner });
        await this.cefi.mint(bob, '1000', { from: owner });
        await expectRevert(
            this.cefi.mint(carol, '1000', { from: carol }),
            'Ownable: caller is not the owner',
        );
        await expectRevert(
            this.cefi.stakerMint(carol, '1000', { from: carol }),
            'CEFI: caller is not the staker',
        );
        await expectRevert(
          this.cefi.stakerMint(carol, '1000', { from: owner }),
          'CEFI: caller is not the staker',
      );
        const aliceBal = await this.cefi.balanceOf(alice);
        const bobBal = await this.cefi.balanceOf(bob);
        const carolBal = await this.cefi.balanceOf(carol);
        assert.equal(aliceBal.valueOf(), '100');
        assert.equal(bobBal.valueOf(), '1000');
        assert.equal(carolBal.valueOf(), '0');
    });

    it('should supply token transfers properly', async () => {
        await this.cefi.mint(alice, '100', { from: owner });
        await this.cefi.mint(bob, '1000', { from: owner });
        await this.cefi.transfer(carol, '10', { from: alice });
        await this.cefi.transfer(carol, '100', { from: bob });
        const aliceBal = await this.cefi.balanceOf(alice);
        const bobBal = await this.cefi.balanceOf(bob);
        const carolBal = await this.cefi.balanceOf(carol);
        assert.equal(aliceBal.valueOf(), '90');
        assert.equal(bobBal.valueOf(), '900');
        assert.equal(carolBal.valueOf(), '110');
    });

    it('should fail if you try to do bad transfers', async () => {
        await this.cefi.mint(alice, '100', { from: owner });
        await expectRevert(
            this.cefi.transfer(carol, '110', { from: alice }),
            'ERC20: transfer amount exceeds balance',
        );
        await expectRevert(
            this.cefi.transfer(carol, '1', { from: bob }),
            'ERC20: transfer amount exceeds balance',
        );
    });

    it('should have totalSupply equal 3552*1e18from start (bounty + cashback)', async () => {
      // 35520000000000000000000 - cashback + bounty
      assert.equal((await this.cefi.totalSupply()).valueOf(), '35520000000000000000000');
    });

    it('should doesnt allow to mint more than MINT_LIMIT', async () => {
        // 35520000000000000000000 - cashback + bounty
        await expectRevert(
          this.cefi.mint(alice, '888000000000000000000000', { from: owner }),
            'Mint amount exceeds max supply',
        );

        // 888000 - 35520 = 852480 
        await expectRevert(
          this.cefi.mint(alice, '852480000000000000000000', { from: owner }),
            'Mint amount exceeds max supply',
        );
    });

    it('should allows to mint MINT_LIMIT-1 token', async () => {
      await this.cefi.mint(alice, '852479999999999999999999', { from: owner })
    });
});
