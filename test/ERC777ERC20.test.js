import shouldFail from 'openzeppelin-solidity/test/helpers/shouldFail.js';

const ERC777ERC20 = artifacts.require('ERC777ERC20Mock');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTE = '0x';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const VALID_CERTIFICATE = '0x1000000000000000000000000000000000000000000000000000000000000000';

const initialSupply = 1000000000;

contract('ERC777ERC20', function ([owner, operator, controller, tokenHolder, recipient, unknown]) {
  // ERC20 RETROCOMPATIBILITY

  describe('ERC20 retrocompatibility', function () {
    beforeEach(async function () {
      this.token = await ERC777ERC20.new('ERC777ERC20Token', 'DAU20', 1, [controller], CERTIFICATE_SIGNER);
      await this.token.setERC20compatibility(true, { from: owner });
    });

    // MINT

    describe('mint', function () {
      describe('when the caller is a minter', function () {
        describe('when the amount is a multiple of the granularity', function () {
          describe('when the recipient is not the zero address', function () {
            it('mints the requested amount', async function () {
              await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
            });
            it('emits a sent event [with ERC20 retrocompatibility]', async function () {
              const { logs } = await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });

              assert.equal(logs.length, 3);

              assert.equal(logs[0].event, 'Checked');
              assert.equal(logs[0].args.sender, owner);

              assert.equal(logs[1].event, 'Minted');
              assert.equal(logs[1].args.operator, owner);
              assert.equal(logs[1].args.to, tokenHolder);
              assert(logs[1].args.value.eq(initialSupply));
              assert.equal(logs[1].args.data, VALID_CERTIFICATE);
              assert.equal(logs[1].args.operatorData, ZERO_BYTE);

              assert.equal(logs[2].event, 'Transfer');
              assert.equal(logs[2].args.from, ZERO_ADDRESS);
              assert.equal(logs[2].args.to, tokenHolder);
              assert(logs[2].args.value.eq(initialSupply));
            });
            it('emits a sent event [without ERC20 retrocompatibility]', async function () {
              await this.token.setERC20compatibility(false, { from: owner });
              const { logs } = await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });

              assert.equal(logs.length, 2);

              assert.equal(logs[0].event, 'Checked');
              assert.equal(logs[0].args.sender, owner);

              assert.equal(logs[1].event, 'Minted');
              assert.equal(logs[1].args.operator, owner);
              assert.equal(logs[1].args.to, tokenHolder);
              assert(logs[1].args.value.eq(initialSupply));
              assert.equal(logs[1].args.data, VALID_CERTIFICATE);
              assert.equal(logs[1].args.operatorData, ZERO_BYTE);
            });
          });
        });
      });
    });

    // TRANSFERWITHDATA

    describe('transferWithData', function () {
      const to = recipient;
      beforeEach(async function () {
        await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
      });
      describe('when the amount is a multiple of the granularity', function () {
        describe('when the recipient is not the zero address', function () {
          describe('when the sender has enough balance', function () {
            const amount = initialSupply;
            describe('when the recipient is a regular address', function () {
              it('transfers the requested amount', async function () {
                await this.token.transferWithData(to, amount, VALID_CERTIFICATE, { from: tokenHolder });
                const senderBalance = await this.token.balanceOf(tokenHolder);
                assert.equal(senderBalance, initialSupply - amount);

                const recipientBalance = await this.token.balanceOf(to);
                assert.equal(recipientBalance, amount);
              });

              it('emits a sent event [with ERC20 retrocompatibility]', async function () {
                const { logs } = await this.token.transferWithData(to, amount, VALID_CERTIFICATE, { from: tokenHolder });

                assert.equal(logs.length, 3);

                assert.equal(logs[0].event, 'Checked');
                assert.equal(logs[0].args.sender, tokenHolder);

                assert.equal(logs[1].event, 'TransferWithData');
                assert.equal(logs[1].args.operator, tokenHolder);
                assert.equal(logs[1].args.from, tokenHolder);
                assert.equal(logs[1].args.to, to);
                assert(logs[1].args.value.eq(amount));
                assert.equal(logs[1].args.data, VALID_CERTIFICATE);
                assert.equal(logs[1].args.operatorData, ZERO_BYTE);

                assert.equal(logs[2].event, 'Transfer');
                assert.equal(logs[2].args.from, tokenHolder);
                assert.equal(logs[2].args.to, to);
                assert(logs[2].args.value.eq(amount));
              });

              it('emits a sent event [without ERC20 retrocompatibility]', async function () {
                await this.token.setERC20compatibility(false, { from: owner });
                const { logs } = await this.token.transferWithData(to, amount, VALID_CERTIFICATE, { from: tokenHolder });

                assert.equal(logs.length, 2);

                assert.equal(logs[0].event, 'Checked');
                assert.equal(logs[0].args.sender, tokenHolder);

                assert.equal(logs[1].event, 'TransferWithData');
                assert.equal(logs[1].args.operator, tokenHolder);
                assert.equal(logs[1].args.from, tokenHolder);
                assert.equal(logs[1].args.to, to);
                assert(logs[1].args.value.eq(amount));
                assert.equal(logs[1].args.data, VALID_CERTIFICATE);
                assert.equal(logs[1].args.operatorData, ZERO_BYTE);
              });
            });
          });
        });
      });
    });

    // BURN

    describe('burn', function () {
      beforeEach(async function () {
        await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
      });

      describe('when the amount is a multiple of the granularity', function () {
        describe('when the burner has enough balance', function () {
          const amount = initialSupply;

          it('burns the requested amount', async function () {
            await this.token.burn(amount, VALID_CERTIFICATE, { from: tokenHolder });
            const senderBalance = await this.token.balanceOf(tokenHolder);
            assert.equal(senderBalance, initialSupply - amount);
          });

          it('emits a burned event [with ERC20 retrocompatibility]', async function () {
            const { logs } = await this.token.burn(amount, VALID_CERTIFICATE, { from: tokenHolder });

            assert.equal(logs.length, 3);

            assert.equal(logs[0].event, 'Checked');
            assert.equal(logs[0].args.sender, tokenHolder);

            assert.equal(logs[1].event, 'Burned');
            assert.equal(logs[1].args.operator, tokenHolder);
            assert.equal(logs[1].args.from, tokenHolder);
            assert(logs[1].args.value.eq(amount));
            assert.equal(logs[1].args.data, VALID_CERTIFICATE);
            assert.equal(logs[1].args.operatorData, ZERO_BYTE);

            assert.equal(logs[2].event, 'Transfer');
            assert.equal(logs[2].args.from, tokenHolder);
            assert.equal(logs[2].args.to, ZERO_ADDRESS);
            assert(logs[2].args.value.eq(amount));
          });
          it('emits a burned event [without ERC20 retrocompatibility]', async function () {
            await this.token.setERC20compatibility(false, { from: owner });
            const { logs } = await this.token.burn(amount, VALID_CERTIFICATE, { from: tokenHolder });

            assert.equal(logs.length, 2);

            assert.equal(logs[0].event, 'Checked');
            assert.equal(logs[0].args.sender, tokenHolder);

            assert.equal(logs[1].event, 'Burned');
            assert.equal(logs[1].args.operator, tokenHolder);
            assert.equal(logs[1].args.from, tokenHolder);
            assert(logs[1].args.value.eq(amount));
            assert.equal(logs[1].args.data, VALID_CERTIFICATE);
            assert.equal(logs[1].args.operatorData, ZERO_BYTE);
          });
        });
      });
    });

    // DECIMALS

    describe('decimals', function () {
      describe('when the ERC20 retrocompatibility is activated', function () {
        it('returns the decimals the token', async function () {
          const decimals = await this.token.decimals();

          assert.equal(decimals, 18);
        });
      });
      describe('when the ERC20 retrocompatibility is not activated', function () {
        it('reverts', async function () {
          await this.token.setERC20compatibility(false, { from: owner });
          await shouldFail.reverting(this.token.decimals());
        });
      });
    });

    // APPROVE

    describe('approve', function () {
      const amount = 100;
      describe('when the ERC20 retrocompatibility is activated', function () {
        describe('when sender approves an operator', function () {
          it('approves the operator', async function () {
            assert.equal(await this.token.allowance(tokenHolder, operator), 0);

            await this.token.approve(operator, amount, { from: tokenHolder });

            assert.equal(await this.token.allowance(tokenHolder, operator), amount);
          });
          it('emits an approval event', async function () {
            const { logs } = await this.token.approve(operator, amount, { from: tokenHolder });

            assert.equal(logs.length, 1);
            assert.equal(logs[0].event, 'Approval');
            assert.equal(logs[0].args.owner, tokenHolder);
            assert.equal(logs[0].args.spender, operator);
            assert(logs[0].args.value.eq(amount));
          });
        });
        describe('when the operator to approve is the zero address', function () {
          it('reverts', async function () {
            await shouldFail.reverting(this.token.approve(ZERO_ADDRESS, amount, { from: tokenHolder }));
          });
        });
      });
      describe('when the ERC20 retrocompatibility is not activated', function () {
        it('reverts', async function () {
          await this.token.setERC20compatibility(false, { from: owner });
          await shouldFail.reverting(this.token.approve(operator, amount, { from: tokenHolder }));
        });
        it('reverts', async function () {
          await this.token.setERC20compatibility(false, { from: owner });
          await shouldFail.reverting(this.token.allowance(tokenHolder, operator), amount);
        });
      });
    });

    // TRANSFER

    describe('transfer', function () {
      const to = recipient;
      beforeEach(async function () {
        await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
      });

      describe('when the ERC20 retrocompatibility is activated', function () {
        describe('when the amount is a multiple of the granularity', function () {
          describe('when the recipient is not the zero address', function () {
            describe('when the sender does not have enough balance', function () {
              const amount = initialSupply + 1;

              it('reverts', async function () {
                await shouldFail.reverting(this.token.transfer(to, amount, { from: tokenHolder }));
              });
            });

            describe('when the sender has enough balance', function () {
              const amount = initialSupply;

              it('transfers the requested amount', async function () {
                await this.token.transfer(to, amount, { from: tokenHolder });
                const senderBalance = await this.token.balanceOf(tokenHolder);
                assert.equal(senderBalance, initialSupply - amount);

                const recipientBalance = await this.token.balanceOf(to);
                assert.equal(recipientBalance, amount);
              });

              it('emits a sent + a transfer event', async function () {
                const { logs } = await this.token.transfer(to, amount, { from: tokenHolder });

                assert.equal(logs.length, 2);
                assert.equal(logs[0].event, 'TransferWithData');
                assert.equal(logs[0].args.operator, tokenHolder);
                assert.equal(logs[0].args.from, tokenHolder);
                assert.equal(logs[0].args.to, to);
                assert(logs[0].args.value.eq(amount));
                assert.equal(logs[0].args.data, ZERO_BYTE);
                assert.equal(logs[0].args.operatorData, ZERO_BYTE);

                assert.equal(logs[1].event, 'Transfer');
                assert.equal(logs[1].args.from, tokenHolder);
                assert.equal(logs[1].args.to, to);
                assert(logs[1].args.value.eq(amount));
              });
            });
          });

          describe('when the recipient is the zero address', function () {
            const amount = initialSupply;
            const to = ZERO_ADDRESS;

            it('reverts', async function () {
              await shouldFail.reverting(this.token.transfer(to, amount, { from: tokenHolder }));
            });
          });
        });
        describe('when the amount is not a multiple of the granularity', function () {
          it('reverts', async function () {
            this.token = await ERC777ERC20.new('ERC777Token', 'DAU', 2, [], CERTIFICATE_SIGNER);
            await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
            await shouldFail.reverting(this.token.transfer(to, 3, { from: tokenHolder }));
          });
        });
      });
      describe('when the ERC20 retrocompatibility is not activated', function () {
        const amount = initialSupply;

        it('reverts', async function () {
          await this.token.setERC20compatibility(false, { from: owner });
          await shouldFail.reverting(this.token.transfer(to, amount, { from: tokenHolder }));
        });
      });
    });

    // TRANSFERFROM

    describe('transferFrom', function () {
      const to = recipient;
      const approvedAmount = 10000;
      beforeEach(async function () {
        await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
      });

      describe('when the ERC20 retrocompatibility is activated', function () {
        describe('when the operator is approved', function () {
          beforeEach(async function () {
            // await this.token.authorizeOperator(operator, { from: tokenHolder});
            await this.token.approve(operator, approvedAmount, { from: tokenHolder });
          });
          describe('when the amount is a multiple of the granularity', function () {
            describe('when the recipient is not the zero address', function () {
              describe('when the sender does not have enough balance', function () {
                const amount = approvedAmount + 1;

                it('reverts', async function () {
                  await shouldFail.reverting(this.token.transferFrom(tokenHolder, to, amount, { from: operator }));
                });
              });

              describe('when the sender has enough balance + the sender is not specified', function () {
                const amount = 500;

                it('transfers the requested amount from operator address', async function () {
                  await this.token.transfer(operator, approvedAmount, { from: tokenHolder });

                  await this.token.transferFrom(ZERO_ADDRESS, to, amount, { from: operator });
                  const senderBalance = await this.token.balanceOf(operator);
                  assert.equal(senderBalance, approvedAmount - amount);

                  const recipientBalance = await this.token.balanceOf(to);
                  assert.equal(recipientBalance, amount);
                });
              });

              describe('when the sender has enough balance', function () {
                const amount = 500;

                it('transfers the requested amount', async function () {
                  await this.token.transferFrom(tokenHolder, to, amount, { from: operator });
                  const senderBalance = await this.token.balanceOf(tokenHolder);
                  assert.equal(senderBalance, initialSupply - amount);

                  const recipientBalance = await this.token.balanceOf(to);
                  assert.equal(recipientBalance, amount);

                  assert.equal(await this.token.allowance(tokenHolder, operator), approvedAmount - amount);
                });

                it('emits a sent + a transfer event', async function () {
                  const { logs } = await this.token.transferFrom(tokenHolder, to, amount, { from: operator });
                  // await this.token.transferFrom(tokenHolder, to, amount, { from: operator });

                  assert.equal(logs.length, 2);
                  assert.equal(logs[0].event, 'TransferWithData');
                  assert.equal(logs[0].args.operator, operator);
                  assert.equal(logs[0].args.from, tokenHolder);
                  assert.equal(logs[0].args.to, to);
                  assert(logs[0].args.value.eq(amount));
                  assert.equal(logs[0].args.data, ZERO_BYTE);
                  assert.equal(logs[0].args.operatorData, ZERO_BYTE);

                  assert.equal(logs[1].event, 'Transfer');
                  assert.equal(logs[1].args.from, tokenHolder);
                  assert.equal(logs[1].args.to, to);
                  assert(logs[1].args.value.eq(amount));

                  assert(true);
                });
              });
            });

            describe('when the recipient is the zero address', function () {
              const amount = initialSupply;
              const to = ZERO_ADDRESS;

              it('reverts', async function () {
                await shouldFail.reverting(this.token.transferFrom(tokenHolder, to, amount, { from: operator }));
              });
            });
          });
          describe('when the amount is not a multiple of the granularity', function () {
            it('reverts', async function () {
              this.token = await ERC777ERC20.new('ERC777Token', 'DAU', 2, [], CERTIFICATE_SIGNER);
              await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
              await shouldFail.reverting(this.token.transferFrom(tokenHolder, to, 3, { from: operator }));
            });
          });
        });
        describe('when the operator is not approved', function () {
          const amount = approvedAmount;
          describe('when the operator is not approved but authorized', function () {
            it('transfers the requested amount', async function () {
              await this.token.authorizeOperator(operator, { from: tokenHolder });
              assert.equal(await this.token.allowance(tokenHolder, operator), 0);

              await this.token.transferFrom(tokenHolder, to, amount, { from: operator });
              const senderBalance = await this.token.balanceOf(tokenHolder);
              assert.equal(senderBalance, initialSupply - amount);

              const recipientBalance = await this.token.balanceOf(to);
              assert.equal(recipientBalance, amount);
            });
          });
          describe('when the operator is not approved and not authorized', function () {
            it('reverts', async function () {
              await shouldFail.reverting(this.token.transferFrom(tokenHolder, to, amount, { from: operator }));
            });
          });
        });
      });
      describe('when the ERC20 retrocompatibility is not activated', function () {
        const amount = approvedAmount;
        it('reverts', async function () {
          await this.token.setERC20compatibility(false, { from: owner });
          await shouldFail.reverting(this.token.transferFrom(tokenHolder, to, amount, { from: operator }));
        });
      });
    });
  });
});
