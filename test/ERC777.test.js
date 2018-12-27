import shouldFail from 'openzeppelin-solidity/test/helpers/shouldFail.js';

const ERC777 = artifacts.require('ERC777Mock');
const ERC820Registry = artifacts.require('ERC820Registry');
const ERC777TokensSender = artifacts.require('ERC777TokensSenderMock');
const ERC777TokensRecipient = artifacts.require('ERC777TokensRecipientMock');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTE = '0x';

const VALID_CERTIFICATE = '0x1000000000000000000000000000000000000000000000000000000000000000';

const INVALID_CERTIFICATE_SENDER = '0x1100000000000000000000000000000000000000000000000000000000000000';
const INVALID_CERTIFICATE_RECIPIENT = '0x2200000000000000000000000000000000000000000000000000000000000000';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const initialSupply = 1000000000;

contract('ERC777 without hooks', function ([owner, operator, controller, tokenHolder, recipient, unknown]) {
  // ADDITIONNAL MOCK TESTS

  describe('Additionnal mock tests', function () {
    beforeEach(async function () {
      this.token = await ERC777.new('ERC777Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER);
    });

    describe('contract creation', function () {
      it('fails deploying the contract if granularity is lower than 1', async function () {
        await shouldFail.reverting(ERC777.new('ERC777Token', 'DAU', 0, [controller], CERTIFICATE_SIGNER));
      });
    });

    describe('_isRegularAddress', function () {
      it('returns true when address is correct', async function () {
        assert(await this.token.isRegularAddress(owner));
      });
      it('returns true when address is non zero', async function () {
        assert(await this.token.isRegularAddress(owner));
      });
      it('returns false when address is ZERO_ADDRESS', async function () {
        assert(!(await this.token.isRegularAddress(ZERO_ADDRESS)));
      });
    });
  });

  // BASIC FUNCTIONNALITIES

  describe('parameters', function () {
    beforeEach(async function () {
      this.token = await ERC777.new('ERC777Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER);
    });

    describe('name', function () {
      it('returns the name of the token', async function () {
        const name = await this.token.name();

        assert.equal(name, 'ERC777Token');
      });
    });

    describe('symbol', function () {
      it('returns the symbol of the token', async function () {
        const symbol = await this.token.symbol();

        assert.equal(symbol, 'DAU');
      });
    });

    describe('total supply', function () {
      it('returns the total amount of tokens', async function () {
        await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
        const totalSupply = await this.token.totalSupply();

        assert.equal(totalSupply, initialSupply);
      });
    });

    describe('balanceOf', function () {
      describe('when the requested account has no tokens', function () {
        it('returns zero', async function () {
          const balance = await this.token.balanceOf(unknown);

          assert.equal(balance, 0);
        });
      });

      describe('when the requested account has some tokens', function () {
        it('returns the total amount of tokens', async function () {
          await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
          const balance = await this.token.balanceOf(tokenHolder);

          assert.equal(balance, initialSupply);
        });
      });
    });

    describe('granularity', function () {
      it('returns the granularity of tokens', async function () {
        const granularity = await this.token.granularity();

        assert.equal(granularity, 1);
      });
    });

    describe('controllers', function () {
      it('returns the list of controllers', async function () {
        const controllers = await this.token.controllers();

        assert.equal(controllers.length, 1);
        assert.equal(controllers[0], controller);
      });
    });

    describe('authorizeOperator', function () {
      describe('when sender authorizes an operator', function () {
        it('authorizes the operator', async function () {
          assert(!(await this.token.isOperatorFor(operator, tokenHolder)));
          await this.token.authorizeOperator(operator, { from: tokenHolder });
          assert(await this.token.isOperatorFor(operator, tokenHolder));
        });
        it('emits a authorized event', async function () {
          const { logs } = await this.token.authorizeOperator(operator, { from: tokenHolder });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'AuthorizedOperator');
          assert.equal(logs[0].args.operator, operator);
          assert.equal(logs[0].args.tokenHolder, tokenHolder);
        });
      });
    });

    describe('revokeOperator', function () {
      describe('when sender revokes an operator', function () {
        it('revokes the operator (when operator is not the controller)', async function () {
          assert(!(await this.token.isOperatorFor(operator, tokenHolder)));
          await this.token.authorizeOperator(operator, { from: tokenHolder });
          assert(await this.token.isOperatorFor(operator, tokenHolder));

          await this.token.revokeOperator(operator, { from: tokenHolder });

          assert(!(await this.token.isOperatorFor(operator, tokenHolder)));
        });
        it('emits a revoked event', async function () {
          const { logs } = await this.token.revokeOperator(controller, { from: tokenHolder });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'RevokedOperator');
          assert.equal(logs[0].args.operator, controller);
          assert.equal(logs[0].args.tokenHolder, tokenHolder);
        });
      });
    });

    describe('isOperatorFor', function () {
      it('when operator is tokenHolder', async function () {
        assert(await this.token.isOperatorFor(tokenHolder, tokenHolder));
      });
      it('when operator is authorized by tokenHolder', async function () {
        await this.token.authorizeOperator(operator, { from: tokenHolder });
        assert(await this.token.isOperatorFor(operator, tokenHolder));
      });
      it('when is a revoked operator', async function () {
        await this.token.revokeOperator(controller, { from: tokenHolder });
        assert(!(await this.token.isOperatorFor(controller, tokenHolder)));
      });
    });

    // CONTROLLER

    describe('addController', function () {
      describe('when the caller is the contract owner', function () {
        describe('when the operator is not already a controller', function () {
          it('adds the operator to controllers', async function () {
            const controllers1 = await this.token.controllers();
            assert.equal(controllers1.length, 1);
            assert.equal(controllers1[0], controller);
            await this.token.addController(operator, { from: owner });
            const controllers2 = await this.token.controllers();
            assert.equal(controllers2.length, 2);
            assert.equal(controllers2[0], controller);
            assert.equal(controllers2[1], operator);
          });
        });
        describe('when the operator is already a controller', function () {
          it('reverts', async function () {
            await this.token.addController(operator, { from: owner });
            const controllers = await this.token.controllers();
            assert.equal(controllers.length, 2);
            assert.equal(controllers[0], controller);
            assert.equal(controllers[1], operator);
            await shouldFail.reverting(this.token.addController(operator, { from: owner }));
          });
        });
      });
      describe('when the caller is not the contract owner', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.token.addController(operator, { from: unknown }));
        });
      });
    });

    describe('removeController', function () {
      describe('when the caller is the contract owner', function () {
        describe('when the operator is already a controller', function () {
          it('removes the operator from controllers (initial controller)', async function () {
            const controllers1 = await this.token.controllers();
            assert.equal(controllers1.length, 1);
            assert.equal(controllers1[0], controller);
            await this.token.removeController(controller, { from: owner });
            const controllers2 = await this.token.controllers();
            assert.equal(controllers2.length, 0);
          });
          it('removes the operator from controllers (new controller)', async function () {
            await this.token.addController(operator, { from: owner });
            const controllers1 = await this.token.controllers();
            assert.equal(controllers1.length, 2);
            assert.equal(controllers1[0], controller);
            assert.equal(controllers1[1], operator);
            await this.token.removeController(operator, { from: owner });
            const controllers2 = await this.token.controllers();
            assert.equal(controllers2.length, 1);
            assert.equal(controllers1[0], controller);
          });
        });
        describe('when the operator is not already a controller', function () {
          it('reverts', async function () {
            const controllers = await this.token.controllers();
            assert.equal(controllers.length, 1);
            assert.equal(controllers[0], controller);
            await shouldFail.reverting(this.token.removeController(operator, { from: owner }));
          });
        });
      });
      describe('when the caller is not the contract owner', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.token.removeController(controller, { from: unknown }));
        });
      });
    });

    // MINT

    describe('mint', function () {
      describe('when the caller is a minter', function () {
        describe('when the amount is a multiple of the granularity', function () {
          describe('when the recipient is not the zero address', function () {
            it('mints the requested amount', async function () {
              await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });

              const totalSupply = await this.token.totalSupply();
              const balance = await this.token.balanceOf(tokenHolder);

              assert.equal(totalSupply, initialSupply);
              assert.equal(balance, initialSupply);
            });
            it('emits a sent event', async function () {
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
          describe('when the recipient is the zero address', function () {
            it('reverts', async function () {
              await shouldFail.reverting(this.token.mint(ZERO_ADDRESS, initialSupply, VALID_CERTIFICATE, { from: owner }));
            });
          });
        });
        describe('when the amount is not a multiple of the granularity', function () {
          it('reverts', async function () {
            this.token = await ERC777.new('ERC777Token', 'DAU', 2, [], CERTIFICATE_SIGNER);
            await shouldFail.reverting(this.token.mint(tokenHolder, 3, VALID_CERTIFICATE, { from: owner }));
          });
        });
      });
      describe('when the caller is not a minter', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: unknown }));
        });
      });
    });

    // OPERATORMINT

    describe('operatorMint', function () {
      describe('when the caller is a minter', function () {
        describe('when the amount is a multiple of the granularity', function () {
          describe('when the recipient is not the zero address', function () {
            it('mints the requested amount', async function () {
              await this.token.operatorMint(tokenHolder, initialSupply, '', VALID_CERTIFICATE, { from: owner });
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

              it('emits a sent event', async function () {
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
            describe('when the recipient is not a regular address', function () {
              it('reverts', async function () {
                await shouldFail.reverting(this.token.transferWithData(this.token.address, amount, VALID_CERTIFICATE, { from: tokenHolder }));
              });
            });
          });
          describe('when the sender does not have enough balance', function () {
            const amount = initialSupply + 1;

            it('reverts', async function () {
              await shouldFail.reverting(this.token.transferWithData(to, amount, VALID_CERTIFICATE, { from: tokenHolder }));
            });
          });
        });

        describe('when the recipient is the zero address', function () {
          const amount = initialSupply;
          const to = ZERO_ADDRESS;

          it('reverts', async function () {
            await shouldFail.reverting(this.token.transferWithData(to, amount, VALID_CERTIFICATE, { from: tokenHolder }));
          });
        });
      });
      describe('when the amount is not a multiple of the granularity', function () {
        it('reverts', async function () {
          this.token = await ERC777.new('ERC777Token', 'DAU', 2, [], CERTIFICATE_SIGNER);
          await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
          await shouldFail.reverting(this.token.transferWithData(to, 3, VALID_CERTIFICATE, { from: tokenHolder }));
        });
      });
    });

    // TRANSFERFROMWITHDATA

    describe('transferFromWithData', function () {
      const to = recipient;
      beforeEach(async function () {
        await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
      });
      describe('when the operator is approved', function () {
        beforeEach(async function () {
          await this.token.authorizeOperator(operator, { from: tokenHolder });
        });
        describe('when the amount is a multiple of the granularity', function () {
          describe('when the recipient is not the zero address', function () {
            describe('when the sender does not have enough balance', function () {
              const amount = initialSupply + 1;

              it('reverts', async function () {
                await shouldFail.reverting(this.token.transferFromWithData(tokenHolder, to, amount, '', VALID_CERTIFICATE, { from: operator }));
              });
            });

            describe('when the sender has enough balance + the sender is not specified', function () {
              const amount = initialSupply;

              it('transfers the requested amount from operator address', async function () {
                await this.token.transferWithData(operator, amount, VALID_CERTIFICATE, { from: tokenHolder });

                await this.token.transferFromWithData(ZERO_ADDRESS, to, amount, '', VALID_CERTIFICATE, { from: operator });
                const senderBalance = await this.token.balanceOf(operator);
                assert.equal(senderBalance, initialSupply - amount);

                const recipientBalance = await this.token.balanceOf(to);
                assert.equal(recipientBalance, amount);
              });
            });

            describe('when the sender has enough balance', function () {
              const amount = initialSupply;

              it('transfers the requested amount', async function () {
                await this.token.transferFromWithData(tokenHolder, to, amount, '', VALID_CERTIFICATE, { from: operator });
                const senderBalance = await this.token.balanceOf(tokenHolder);
                assert.equal(senderBalance, initialSupply - amount);

                const recipientBalance = await this.token.balanceOf(to);
                assert.equal(recipientBalance, amount);
              });

              it('emits a sent event [with ERC20 retrocompatibility]', async function () {
                const { logs } = await this.token.transferFromWithData(tokenHolder, to, amount, '', VALID_CERTIFICATE, { from: operator });

                assert.equal(logs.length, 2);

                assert.equal(logs[0].event, 'Checked');
                assert.equal(logs[0].args.sender, operator);

                assert.equal(logs[1].event, 'TransferWithData');
                assert.equal(logs[1].args.operator, operator);
                assert.equal(logs[1].args.from, tokenHolder);
                assert.equal(logs[1].args.to, to);
                assert(logs[1].args.value.eq(amount));
                assert.equal(logs[1].args.data, ZERO_BYTE);
                assert.equal(logs[1].args.operatorData, VALID_CERTIFICATE);
              });
            });
          });

          describe('when the recipient is the zero address', function () {
            const amount = initialSupply;
            const to = ZERO_ADDRESS;

            it('reverts', async function () {
              await shouldFail.reverting(this.token.transferFromWithData(tokenHolder, to, amount, '', VALID_CERTIFICATE, { from: operator }));
            });
          });
        });
        describe('when the amount is not a multiple of the granularity', function () {
          it('reverts', async function () {
            this.token = await ERC777.new('ERC777Token', 'DAU', 2, [], CERTIFICATE_SIGNER);
            await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
            await shouldFail.reverting(this.token.transferFromWithData(tokenHolder, to, 3, '', VALID_CERTIFICATE, { from: operator }));
          });
        });
      });
      describe('when the operator is not approved', function () {
        it('reverts', async function () {
          const amount = initialSupply;
          await shouldFail.reverting(this.token.transferFromWithData(tokenHolder, to, amount, '', VALID_CERTIFICATE, { from: operator }));
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
        describe('when the burner does not have enough balance', function () {
          const amount = initialSupply + 1;

          it('reverts', async function () {
            await shouldFail.reverting(this.token.burn(amount, VALID_CERTIFICATE, { from: tokenHolder }));
          });
        });
      });
      describe('when the amount is not a multiple of the granularity', function () {
        it('reverts', async function () {
          this.token = await ERC777.new('ERC777Token', 'DAU', 2, [], CERTIFICATE_SIGNER);
          await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
          await shouldFail.reverting(this.token.burn(3, VALID_CERTIFICATE, { from: tokenHolder }));
        });
      });
    });

    // OPERATORBURN

    describe('operatorBurn', function () {
      beforeEach(async function () {
        await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
      });

      beforeEach(async function () {
        await this.token.authorizeOperator(operator, { from: tokenHolder });
      });
      describe('when the amount is a multiple of the granularity', function () {
        describe('when the burner is not the zero address', function () {
          describe('when the burner does not have enough balance', function () {
            const amount = initialSupply + 1;

            it('reverts', async function () {
              await shouldFail.reverting(this.token.operatorBurn(tokenHolder, amount, '', VALID_CERTIFICATE, { from: operator }));
            });
          });

          describe('when the burner has enough balance + the burner is not specified', function () {
            const amount = initialSupply;

            it('burns the requested amount from operator address', async function () {
              await this.token.transferWithData(operator, amount, VALID_CERTIFICATE, { from: tokenHolder });

              await this.token.operatorBurn(ZERO_ADDRESS, amount, '', VALID_CERTIFICATE, { from: operator });
              const senderBalance = await this.token.balanceOf(operator);
              assert.equal(senderBalance, initialSupply - amount);
            });
          });

          describe('when the burner has enough balance', function () {
            const amount = initialSupply;

            it('burns the requested amount', async function () {
              await this.token.operatorBurn(tokenHolder, amount, '', VALID_CERTIFICATE, { from: operator });
              const senderBalance = await this.token.balanceOf(tokenHolder);
              assert.equal(senderBalance, initialSupply - amount);
            });

            it('emits a burned event [with ERC20 retrocompatibility]', async function () {
              const { logs } = await this.token.operatorBurn(tokenHolder, amount, '', VALID_CERTIFICATE, { from: operator });

              assert.equal(logs.length, 2);

              assert.equal(logs[0].event, 'Checked');
              assert.equal(logs[0].args.sender, operator);

              assert.equal(logs[1].event, 'Burned');
              assert.equal(logs[1].args.operator, operator);
              assert.equal(logs[1].args.from, tokenHolder);
              assert(logs[1].args.value.eq(amount));
              assert.equal(logs[1].args.data, ZERO_BYTE);
              assert.equal(logs[1].args.operatorData, VALID_CERTIFICATE);
            });
          });
        });

        describe('when the burner is the zero address', function () {
          it('reverts', async function () {
            const amount = initialSupply;
            await shouldFail.reverting(this.token.operatorBurnMock(ZERO_ADDRESS, amount, '', '', { from: operator }));
          });
        });
      });
      describe('when the amount is not a multiple of the granularity', function () {
        it('reverts', async function () {
          this.token = await ERC777.new('ERC777Token', 'DAU', 2, [], CERTIFICATE_SIGNER);
          await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
          await shouldFail.reverting(this.token.operatorBurn(tokenHolder, 3, '', VALID_CERTIFICATE, { from: operator }));
        });
      });
    });
  });
});

contract('ERC777 with hooks', function ([owner, operator, controller, tokenHolder, recipient, unknown]) {
  // HOOKS

  describe('hooks', function () {
    const amount = initialSupply;
    const to = recipient;

    beforeEach(async function () {
      this.token = await ERC777.new('ERC777Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER);
      this.registry = await ERC820Registry.at('0x820b586C8C28125366C998641B09DCbE7d4cBF06');

      this.senderContract = await ERC777TokensSender.new('ERC777TokensSender', { from: tokenHolder });
      await this.registry.setManager(tokenHolder, this.senderContract.address, { from: tokenHolder });
      await this.senderContract.setERC820Implementer({ from: tokenHolder });

      this.recipientContract = await ERC777TokensRecipient.new('ERC777TokensRecipient', { from: recipient });
      await this.registry.setManager(recipient, this.recipientContract.address, { from: recipient });
      await this.recipientContract.setERC820Implementer({ from: recipient });

      await this.token.mint(tokenHolder, initialSupply, VALID_CERTIFICATE, { from: owner });
    });
    describe('when the transfer is successfull', function () {
      it('transfers the requested amount', async function () {
        await this.token.transferWithData(to, amount, VALID_CERTIFICATE, { from: tokenHolder });
        const senderBalance = await this.token.balanceOf(tokenHolder);
        assert.equal(senderBalance, initialSupply - amount);

        const recipientBalance = await this.token.balanceOf(to);
        assert.equal(recipientBalance, amount);
      });
    });
    describe('when the transfer fails', function () {
      it('sender hook reverts', async function () {
        // Default sender hook failure data for the mock only: 0x1100000000000000000000000000000000000000000000000000000000000000
        await shouldFail.reverting(this.token.transferWithData(to, amount, INVALID_CERTIFICATE_SENDER, { from: tokenHolder }));
      });
      it('recipient hook reverts', async function () {
        // Default recipient hook failure data for the mock only: 0x2200000000000000000000000000000000000000000000000000000000000000
        await shouldFail.reverting(this.token.transferWithData(to, amount, INVALID_CERTIFICATE_RECIPIENT, { from: tokenHolder }));
      });
    });
  });
});
