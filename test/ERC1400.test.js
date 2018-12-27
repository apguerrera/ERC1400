import shouldFail from 'openzeppelin-solidity/test/helpers/shouldFail.js';

const ERC1400 = artifacts.require('ERC1400Mock');
const ERC1410 = artifacts.require('ERC1410Mock');
const ERC820Registry = artifacts.require('ERC820Registry');
const ERC777TokensSender = artifacts.require('ERC777TokensSenderMock');
const ERC777TokensRecipient = artifacts.require('ERC777TokensRecipientMock');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTE = '0x';

const EMPTY_BYTE32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const VALID_CERTIFICATE = '0x1000000000000000000000000000000000000000000000000000000000000000';
const INVALID_CERTIFICATE = '0x0000000000000000000000000000000000000000000000000000000000000000';

const INVALID_CERTIFICATE_SENDER = '0x1100000000000000000000000000000000000000000000000000000000000000';
const INVALID_CERTIFICATE_RECIPIENT = '0x2200000000000000000000000000000000000000000000000000000000000000';

const partition1 = '0x5265736572766564000000000000000000000000000000000000000000000000'; // Reserved in hex
const partition2 = '0x4973737565640000000000000000000000000000000000000000000000000000'; // Issued in hex
const partition3 = '0x4c6f636b65640000000000000000000000000000000000000000000000000000'; // Locked in hex
const partitions = [partition1, partition2, partition3];
const reversedPartitions = [partition3, partition1, partition2];

const documentName = "0x446f63756d656e74204e616d6500000000000000000000000000000000000000";

// const ESC_A1 = '0xa1'; // Transfer Verified - On-Chain approval for restricted token
const ESC_A2 = '0xa2'; // Transfer Verified - Off-Chain approval for restricted token
const ESC_A3 = '0xa3'; // Transfer Blocked - Sender lockup period not ended
const ESC_A4 = '0xa4'; // Transfer Blocked - Sender balance insufficient
const ESC_A5 = '0xa5'; // Transfer Blocked - Sender not eligible
const ESC_A6 = '0xa6'; // Transfer Blocked - Receiver not eligible
const ESC_A7 = '0xa7'; // Transfer Blocked - Identity restriction
// const ESC_A8 = '0xa8'; // Transfer Blocked - Token restriction
const ESC_A9 = '0xa9'; // Transfer Blocked - Token granularity

const issuanceAmount = 1000;

var totalSupply;
var balance;
var balanceByPartition;

var tokenDefaultPartitions;

const assertTransferEvent = (
  _logs,
  _fromPartition,
  _operator,
  _from,
  _to,
  _amount,
  _data,
  _operatorData
) => {
  var i = 0;
  if (_logs.length === 3) {
    assert.equal(_logs[0].event, 'Checked');
    assert.equal(_logs[0].args.sender, _operator);
    i = 1;
  }

  assert.equal(_logs[i].event, 'TransferWithData');
  assert.equal(_logs[i].args.operator, _operator);
  assert.equal(_logs[i].args.from, _from);
  assert.equal(_logs[i].args.to, _to);
  assert(_logs[i].args.value.eq(_amount));
  assert.equal(_logs[i].args.data, _data);
  assert.equal(_logs[i].args.operatorData, _operatorData);

  assert.equal(_logs[i + 1].event, 'TransferByPartition');
  assert.equal(_logs[i + 1].args.fromPartition, _fromPartition);
  assert.equal(_logs[i + 1].args.operator, _operator);
  assert.equal(_logs[i + 1].args.from, _from);
  assert.equal(_logs[i + 1].args.to, _to);
  assert(_logs[i + 1].args.value.eq(_amount));
  assert.equal(_logs[i + 1].args.data, _data);
  assert.equal(_logs[i + 1].args.operatorData, _operatorData);
};

const assertBurnEvent = (
  _logs,
  _fromPartition,
  _operator,
  _from,
  _amount,
  _data,
  _operatorData
) => {
  var i = 0;
  if (_logs.length === 3) {
    assert.equal(_logs[0].event, 'Checked');
    assert.equal(_logs[0].args.sender, _operator);
    i = 1;
  }

  assert.equal(_logs[i].event, 'Redeemed');
  assert.equal(_logs[i].args.operator, _operator);
  assert.equal(_logs[i].args.from, _from);
  assert(_logs[i].args.value.eq(_amount));
  assert.equal(_logs[i].args.data, _data);
  assert.equal(_logs[i].args.operatorData, _operatorData);

  assert.equal(_logs[i + 1].event, 'RedeemedByPartition');
  assert.equal(_logs[i + 1].args.partition, _fromPartition);
  assert.equal(_logs[i + 1].args.operator, _operator);
  assert.equal(_logs[i + 1].args.from, _from);
  assert(_logs[i + 1].args.value.eq(_amount));
  assert.equal(_logs[i + 1].args.data, _data);
  assert.equal(_logs[i + 1].args.operatorData, _operatorData);
};

const assertBalances = async (
  _contract,
  _tokenHolder,
  _partitions,
  _amounts
) => {
  var totalBalance = 0;
  for (var i = 0; i < _partitions.length; i++) {
    totalBalance += _amounts[i];
    await assertBalanceOfByPartition(_contract, _tokenHolder, _partitions[i], _amounts[i]);
  }
  await assertBalance(_contract, _tokenHolder, totalBalance);
};

const assertBalanceOf = async (
  _contract,
  _tokenHolder,
  _partition,
  _amount
) => {
  await assertBalance(_contract, _tokenHolder, _amount);
  await assertBalanceOfByPartition(_contract, _tokenHolder, _partition, _amount);
};

const assertBalanceOfByPartition = async (
  _contract,
  _tokenHolder,
  _partition,
  _amount
) => {
  balanceByPartition = await _contract.balanceOfByPartition(_partition, _tokenHolder);
  assert.equal(balanceByPartition, _amount);
};

const assertBalance = async (
  _contract,
  _tokenHolder,
  _amount
) => {
  balance = await _contract.balanceOf(_tokenHolder);
  assert.equal(balance, _amount);
};

const assertTotalSupply = async (_contract, _amount) => {
  totalSupply = await _contract.totalSupply();
  assert.equal(totalSupply, _amount);
};

const assertEscResponse = async (
  _response,
  _escCode,
  _additionalCode,
  _destinationPartition
) => {
  assert.equal(_response[0], _escCode);
  assert.equal(_response[1], _additionalCode);
  assert.equal(_response[2], _destinationPartition);
};

const authorizeOperatorForPartitions = async (
  _contract,
  _operator,
  _tokenHolder,
  _partitions
) => {
  for (var i = 0; i < _partitions.length; i++) {
    await _contract.authorizeOperatorByPartition(_partitions[i], _operator, { from: _tokenHolder });
  }
};

const issueOnMultiplePartitions = async (
  _contract,
  _owner,
  _recipient,
  _partitions,
  _amounts
) => {
  for (var i = 0; i < _partitions.length; i++) {
    await _contract.issueByPartition(_partitions[i], _recipient, _amounts[i], VALID_CERTIFICATE, { from: _owner });
  }
};

contract('ERC1400', function ([owner, operator, controller, tokenHolder, recipient, unknown]) {
  describe('parameters', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    describe('name', function () {
      it('returns the name of the token', async function () {
        const name = await this.token.name();

        assert.equal(name, 'ERC1400Token');
      });
    });

    describe('symbol', function () {
      it('returns the symbol of the token', async function () {
        const symbol = await this.token.symbol();

        assert.equal(symbol, 'DAU');
      });
    });
  });

  // CANTRANSFER

  describe('canTransferByPartition/canOperatorTransferByPartition', function () {
    var localGranularity = 10;
    const amount = 10 * localGranularity;

    before(async function () {
      this.registry = await ERC820Registry.at('0x820b586C8C28125366C998641B09DCbE7d4cBF06');

      this.senderContract = await ERC777TokensSender.new('ERC777TokensSender', { from: tokenHolder });
      await this.registry.setManager(tokenHolder, this.senderContract.address, { from: tokenHolder });
      await this.senderContract.setERC820Implementer({ from: tokenHolder });

      this.recipientContract = await ERC777TokensRecipient.new('ERC777TokensRecipient', { from: recipient });
      await this.registry.setManager(recipient, this.recipientContract.address, { from: recipient });
      await this.recipientContract.setERC820Implementer({ from: recipient });
    });

    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1410Token', 'DAU', localGranularity, [controller], CERTIFICATE_SIGNER, partitions);
      await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });
    });

    describe('when certificate is valid', function () {
      describe('when the operator is authorized', function () {
        describe('when balance is sufficient', function () {
          describe('when receiver is not the zero address', function () {
            describe('when sender is eligible', function () {
              describe('when receiver is eligible', function () {
                describe('when the amount is a multiple of the granularity', function () {
                  it('returns Ethereum status code A2 (canTransferByPartition)', async function () {
                    const response = await this.token.canTransferByPartition(
                      partition1, recipient, amount, VALID_CERTIFICATE, { from: tokenHolder });
                    await assertEscResponse(response, ESC_A2, EMPTY_BYTE32, partition1);
                  });
                  it('returns Ethereum status code A2 (canOperatorTransferByPartition)', async function () {
                    const response = await this.token.canOperatorTransferByPartition(
                      partition1, tokenHolder, recipient, amount, ZERO_BYTE, VALID_CERTIFICATE, { from: tokenHolder });
                    await assertEscResponse(response, ESC_A2, EMPTY_BYTE32, partition1);
                  });
                });
                describe('when the amount is not a multiple of the granularity', function () {
                  it('returns Ethereum status code A9', async function () {
                    const response = await this.token.canTransferByPartition(
                      partition1, recipient, 1, VALID_CERTIFICATE, { from: tokenHolder });
                    await assertEscResponse(response, ESC_A9, EMPTY_BYTE32, partition1);
                  });
                });
              });
              describe('when receiver is not eligible', function () {
                it('returns Ethereum status code A6', async function () {
                  const response = await this.token.canTransferByPartition(
                    partition1, recipient, amount, INVALID_CERTIFICATE_RECIPIENT, { from: tokenHolder });
                  await assertEscResponse(response, ESC_A6, EMPTY_BYTE32, partition1);
                });
              });
            });
            describe('when sender is not eligible', function () {
              it('returns Ethereum status code A5', async function () {
                const response = await this.token.canTransferByPartition(
                  partition1, recipient, amount, INVALID_CERTIFICATE_SENDER, { from: tokenHolder });
                await assertEscResponse(response, ESC_A5, EMPTY_BYTE32, partition1);
              });
            });
          });
          describe('when receiver is the zero address', function () {
            it('returns Ethereum status code A6', async function () {
              const response = await this.token.canTransferByPartition(
                partition1, ZERO_ADDRESS, amount, VALID_CERTIFICATE, { from: tokenHolder });
              await assertEscResponse(response, ESC_A6, EMPTY_BYTE32, partition1);
            });
          });
        });
        describe('when balance is not sufficient', function () {
          it('returns Ethereum status code A4 (insuficient global balance)', async function () {
            const response = await this.token.canTransferByPartition(
              partition1, recipient, issuanceAmount + localGranularity, VALID_CERTIFICATE, { from: tokenHolder });
            await assertEscResponse(response, ESC_A4, EMPTY_BYTE32, partition1);
          });
          it('returns Ethereum status code A4 (insuficient partition balance)', async function () {
            await this.token.issueByPartition(
              partition2, tokenHolder, localGranularity, VALID_CERTIFICATE, { from: owner });
            const response = await this.token.canTransferByPartition(
              partition2, recipient, amount, VALID_CERTIFICATE, { from: tokenHolder });
            await assertEscResponse(response, ESC_A4, EMPTY_BYTE32, partition2);
          });
        });
      });
      describe('when the operator is not authorized', function () {
        it('returns Ethereum status code A7 (canOperatorTransferByPartition)', async function () {
          const response = await this.token.canOperatorTransferByPartition(
            partition1, operator, recipient, amount, ZERO_BYTE, VALID_CERTIFICATE, { from: tokenHolder });
          await assertEscResponse(response, ESC_A7, EMPTY_BYTE32, partition1);
        });
      });
    });
    describe('when certificate is not valid', function () {
      it('returns Ethereum status code A3 (canTransferByPartition)', async function () {
        const response = await this.token.canTransferByPartition(
          partition1, recipient, amount, INVALID_CERTIFICATE, { from: tokenHolder });
        await assertEscResponse(response, ESC_A3, EMPTY_BYTE32, partition1);
      });
      it('returns Ethereum status code A3 (canOperatorTransferByPartition)', async function () {
        const response = await this.token.canOperatorTransferByPartition(
          partition1, tokenHolder, recipient, amount, ZERO_BYTE, INVALID_CERTIFICATE, { from: tokenHolder });
        await assertEscResponse(response, ESC_A3, EMPTY_BYTE32, partition1);
      });
    });
  });

  // SETDEFAULTPARTITIONS

  describe('setDefaultPartitions', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    it('sets defaults partition', async function () {
      await this.token.setDefaultPartitions([partition1, partition2, partition3], { from: tokenHolder });

      const defaultPartitions = await this.token.getDefaultPartitions(tokenHolder);

      assert.equal(defaultPartitions.length, 3);
      assert.equal(defaultPartitions[0], partition1); // dAuriel1 in hex
      assert.equal(defaultPartitions[1], partition2); // dAuriel2 in hex
      assert.equal(defaultPartitions[2], partition3); // dAuriel3 in hex
    });
  });

  // AUTHORIZE OPERATOR BY PARTITION

  describe('authorizeOperatorByPartition', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    it('authorizes operator for partition', async function () {
      await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
      assert(await this.token.isOperatorForPartition(partition1, operator, tokenHolder));
    });
  });

  // ADD CONTROLLER

  describe('addController', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    describe('when sender is the contract owner', function () {
      describe('when token is controllable', function () {
        it('adds the controller', async function () {
          assert(await this.token.isControllable());
          assert(!(await this.token.isOperatorFor(operator, tokenHolder)));
          await this.token.addController(operator, { from: owner });
          assert(await this.token.isOperatorFor(operator, tokenHolder));
        });
      });
      describe('when token is not controllable', function () {
        it('reverts', async function () {
          await this.token.removeController(controller, { from: owner });
          await this.token.renounceControl({ from: owner });
          assert(!(await this.token.isControllable()));

          await shouldFail.reverting(this.token.addController(operator, { from: owner }));
        });
      });
    });
    describe('when sender is not the contract owner', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.token.addController(operator, { from: unknown }));
      });
    });
  });

  // REMOVE CONTROLLER

  describe('removeController', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    describe('when operator is controller', function () {
      it('removes the controller', async function () {
        assert(!(await this.token.isOperatorFor(operator, tokenHolder)));
        await this.token.addController(operator, { from: owner });
        assert(await this.token.isOperatorFor(operator, tokenHolder));
        await this.token.removeController(operator, { from: owner });
        assert(!(await this.token.isOperatorFor(operator, tokenHolder)));
      });
    });
    describe('when operator is not controller', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.token.removeController(operator, { from: owner }));
      });
    });
  });

  // ADD CONTROLLER BY PARTITION

  describe('addPartitionController', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    describe('when sender is the contract owner', function () {
      describe('when token is controllable', function () {
        describe('when operator has not already been added', function () {
          it('adds the controller', async function () {
            assert(await this.token.isControllable());
            assert(!(await this.token.isOperatorForPartition(partition1, operator, tokenHolder)));
            await this.token.addPartitionController(partition1, operator, { from: owner });
            assert(await this.token.isOperatorForPartition(partition1, operator, tokenHolder));
          });
        });
        describe('when operator has already been added', function () {
          it('reverts', async function () {
            await this.token.addPartitionController(partition1, operator, { from: owner });
            assert(await this.token.isOperatorForPartition(partition1, operator, tokenHolder));

            await shouldFail.reverting(this.token.addPartitionController(partition1, operator, { from: owner }));
          });
        });
      });
      describe('when token is not controllable', function () {
        it('reverts', async function () {
          await this.token.removeController(controller, { from: owner });
          await this.token.renounceControl({ from: owner });
          assert(!(await this.token.isControllable()));

          await shouldFail.reverting(this.token.addPartitionController(partition1, operator, { from: owner }));
        });
      });
    });
    describe('when sender is not the contract owner', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.token.addPartitionController(partition1, operator, { from: unknown }));
      });
    });
  });

  // REMOVE CONTROLLER BY PARTITION

  describe('removePartitionController', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    describe('when operator is the only controller', function () {
      it('removes the controller', async function () {
        assert(!(await this.token.isOperatorForPartition(partition1, operator, tokenHolder)));
        await this.token.addPartitionController(partition1, operator, { from: owner });
        assert(await this.token.isOperatorForPartition(partition1, operator, tokenHolder));
        await this.token.removePartitionController(partition1, operator, { from: owner });
        assert(!(await this.token.isOperatorForPartition(partition1, operator, tokenHolder)));
      });
    });
    describe('when operator is one of the controllers', function () {
      it('removes the controller', async function () {
        assert(!(await this.token.isOperatorForPartition(partition1, operator, tokenHolder)));
        await this.token.addPartitionController(partition1, operator, { from: owner });
        assert(await this.token.isOperatorForPartition(partition1, operator, tokenHolder));
        await this.token.addPartitionController(partition1, unknown, { from: owner });
        assert(await this.token.isOperatorForPartition(partition1, unknown, tokenHolder));
        await this.token.removePartitionController(partition1, unknown, { from: owner });
        assert(!(await this.token.isOperatorForPartition(partition1, unknown, tokenHolder)));
      });
    });
    describe('when operator is not controller', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.token.removePartitionController(partition1, operator, { from: owner }));
      });
    });
  });

  // AUTHORIZE OPERATOR BY PARTITION

  describe('authorizeOperatorByPartition', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    it('authorizes the operator', async function () {
      assert(!(await this.token.isOperatorForPartition(partition1, operator, tokenHolder)));
      await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
      assert(await this.token.isOperatorForPartition(partition1, operator, tokenHolder));
    });
    it('emits an authorized event', async function () {
      const { logs } = await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });

      assert.equal(logs.length, 1);
      assert.equal(logs[0].event, 'AuthorizedOperatorByPartition');
      assert.equal(logs[0].args.partition, partition1);
      assert.equal(logs[0].args.operator, operator);
      assert.equal(logs[0].args.tokenHolder, tokenHolder);
    });
  });

  // REVOKE OPERATOR BY PARTITION

  describe('revokeOperatorByPartition', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    describe('when operator is not controller', function () {
      it('revokes the operator', async function () {
        await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
        assert(await this.token.isOperatorForPartition(partition1, operator, tokenHolder));
        await this.token.revokeOperatorByPartition(partition1, operator, { from: tokenHolder });
        assert(!(await this.token.isOperatorForPartition(partition1, operator, tokenHolder)));
      });
      it('emits a revoked event', async function () {
        await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
        const { logs } = await this.token.revokeOperatorByPartition(partition1, operator, { from: tokenHolder });

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'RevokedOperatorByPartition');
        assert.equal(logs[0].args.partition, partition1);
        assert.equal(logs[0].args.operator, operator);
        assert.equal(logs[0].args.tokenHolder, tokenHolder);
      });
    });
  });

  // CONTROLLERS

  describe('controllers', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    describe('when the token is controllable', function () {
      it('returns the list of controllers', async function () {
        assert(await this.token.isControllable());
        const controllers = await this.token.controllers();

        assert.equal(controllers.length, 1);
        assert.equal(controllers[0], controller);
      });
    });
  });

  // CONTROLLERS

  describe('controllersByPartition', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
      await this.token.addPartitionController(partition3, operator, { from: owner });
    });
    describe('when the token is controllable', function () {
      it('returns the list of controllers', async function () {
        assert(await this.token.isControllable());
        const controllers = await this.token.controllersByPartition(partition3);

        assert.equal(controllers.length, 1);
        assert.equal(controllers[0], operator);
      });
    });
  });

  // SET/GET TOKEN DEFAULT PARTITIONS
  describe('tokenDefaultPartitions', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
      tokenDefaultPartitions = await this.token.getTokenDefaultPartitions();
      assert.equal(tokenDefaultPartitions.length, 3);
      assert.equal(tokenDefaultPartitions[0], partition1);
      assert.equal(tokenDefaultPartitions[1], partition2);
      assert.equal(tokenDefaultPartitions[2], partition3);
    });
    describe('when the sender is the contract owner', function () {
      it('sets the list of token default partitions', async function () {
        await this.token.setTokenDefaultPartitions(reversedPartitions, { from: owner });
        tokenDefaultPartitions = await this.token.getTokenDefaultPartitions();
        assert.equal(tokenDefaultPartitions.length, 3);
        assert.equal(tokenDefaultPartitions[0], partition3);
        assert.equal(tokenDefaultPartitions[1], partition1);
        assert.equal(tokenDefaultPartitions[2], partition2);
      });
    });
    describe('when the sender is not the contract owner', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.token.setTokenDefaultPartitions(reversedPartitions, { from: unknown }));
      });
    });
  });


  // SET/GET DOCUMENT

  describe('set/getDocument', function () {
    const documentURI = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit,sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'; // SHA-256 of documentURI
    const documentHash = '0x1c81c608a616183cc4a38c09ecc944eb77eaff465dd87aae0290177f2b70b6f8'; // SHA-256 of documentURI + '0x'

    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });

    describe('setDocument', function () {
      describe('when sender is the contract owner', function () {
        it('attaches the document to the token', async function () {
          await this.token.setDocument(documentName, documentURI, documentHash, { from: owner });
          const doc = await this.token.getDocument(documentName);
          assert.equal(documentURI, doc[0]);
          assert.equal(documentHash, doc[1]);
        });
        it('emits a docuemnt event', async function () {
          const { logs } = await this.token.setDocument(documentName, documentURI, documentHash, { from: owner });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Document');
          assert.equal(logs[0].args.name, documentName);
          assert.equal(logs[0].args.uri, documentURI);
          assert.equal(logs[0].args.documentHash, documentHash);
        });
      });
      describe('when sender is not the contract owner', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.token.setDocument(documentName, documentURI, documentHash, { from: unknown }));
        });
      });
    });
    describe('getDocument', function () {
      describe('when docuemnt exists', function () {
        it('returns the document', async function () {
          await this.token.setDocument(documentName, documentURI, documentHash, { from: owner });
          const doc = await this.token.getDocument(documentName);
          assert.equal(documentURI, doc[0]);
          assert.equal(documentHash, doc[1]);
        });
      });
      describe('when docuemnt does not exist', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.token.getDocument(documentName));
        });
      });
    });
  });

  // ISSUEBYPARTITION

  describe('issueByPartition', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });

    describe('when sender is the minter', function () {
      describe('when token is issuable', function () {
        it('issues the requested amount', async function () {
          await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });

          await assertTotalSupply(this.token, issuanceAmount);
          await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount);
        });
        it('issues twice the requested amount', async function () {
          await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });
          await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });

          await assertTotalSupply(this.token, 2 * issuanceAmount);
          await assertBalanceOf(this.token, tokenHolder, partition1, 2 * issuanceAmount);
        });
        it('emits a issuedByPartition event', async function () {
          const { logs } = await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });

          assert.equal(logs.length, 3);

          assert.equal(logs[0].event, 'Checked');
          assert.equal(logs[0].args.sender, owner);

          assert.equal(logs[1].event, 'Issued');
          assert.equal(logs[1].args.operator, owner);
          assert.equal(logs[1].args.to, tokenHolder);
          assert(logs[1].args.value.eq(issuanceAmount));
          assert.equal(logs[1].args.data, VALID_CERTIFICATE);
          assert.equal(logs[1].args.operatorData, ZERO_BYTE);

          assert.equal(logs[2].event, 'IssuedByPartition');
          assert.equal(logs[2].args.partition, partition1);
          assert.equal(logs[2].args.operator, owner);
          assert.equal(logs[2].args.to, tokenHolder);
          assert(logs[2].args.value.eq(issuanceAmount));
          assert.equal(logs[2].args.data, VALID_CERTIFICATE);
          assert.equal(logs[2].args.operatorData, ZERO_BYTE);
        });
      });
      describe('when token is not issuable', function () {
        it('reverts', async function () {
          assert(await this.token.isIssuable());
          await this.token.renounceIssuance({ from: owner });
          assert(!(await this.token.isIssuable()));
          await shouldFail.reverting(this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner }));
        });
      });
    });
    describe('when sender is not the minter', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: unknown }));
      });
    });
  });

  // REDEEMBYPARTITION

  describe('redeemByPartition', function () {
    const redeemAmount = 300;

    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
      await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });
    });

    describe('when the redeemer has enough balance for this partition', function () {
      it('redeems the requested amount', async function () {
        await this.token.redeemByPartition(partition1, redeemAmount, VALID_CERTIFICATE, { from: tokenHolder });

        await assertTotalSupply(this.token, issuanceAmount - redeemAmount);
        await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount - redeemAmount);
      });
      it('emits a redeemedByPartition event', async function () {
        const { logs } = await this.token.redeemByPartition(partition1, redeemAmount, VALID_CERTIFICATE, { from: tokenHolder });

        assert.equal(logs.length, 3);

        assertBurnEvent(logs, partition1, tokenHolder, tokenHolder, redeemAmount, VALID_CERTIFICATE, ZERO_BYTE);
      });
    });
    describe('when the redeemer has enough balance for this partition', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.token.redeemByPartition(partition2, redeemAmount, VALID_CERTIFICATE, { from: tokenHolder }));
      });
    });
  });

  // OPERATOREDEEMBYPARTITION

  describe('operatorRedeemByPartition', function () {
    const redeemAmount = 300;

    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
      await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });
    });

    describe('when the sender is an operator for this partition', function () {
      describe('when the redeemer has enough balance for this partition', function () {
        it('redeems the requested amount', async function () {
          await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
          await this.token.operatorRedeemByPartition(partition1, tokenHolder, redeemAmount, '', VALID_CERTIFICATE, { from: operator });

          await assertTotalSupply(this.token, issuanceAmount - redeemAmount);
          await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount - redeemAmount);
        });
        it('emits a redeemedByPartition event', async function () {
          await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
          const { logs } = await this.token.operatorRedeemByPartition(partition1, tokenHolder, redeemAmount, '', VALID_CERTIFICATE, { from: operator });

          assert.equal(logs.length, 3);

          assertBurnEvent(logs, partition1, operator, tokenHolder, redeemAmount, ZERO_BYTE, VALID_CERTIFICATE);
        });
      });
      describe('when the redeemer does not have enough balance for this partition', function () {
        it('reverts', async function () {
          it('redeems the requested amount', async function () {
            await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });

            await shouldFail.reverting(this.token.operatorRedeemByPartition(partition1, tokenHolder, issuanceAmount + 1, '', VALID_CERTIFICATE, { from: operator }));
          });
        });
      });
    });
    describe('when the sender is a global operator', function () {
      it('redeems the requested amount', async function () {
        await this.token.authorizeOperator(operator, { from: tokenHolder });
        await this.token.operatorRedeemByPartition(partition1, tokenHolder, redeemAmount, '', VALID_CERTIFICATE, { from: operator });

        await assertTotalSupply(this.token, issuanceAmount - redeemAmount);
        await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount - redeemAmount);
      });
    });
    describe('when the sender is not an operator', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.token.operatorRedeemByPartition(partition1, tokenHolder, redeemAmount, '', VALID_CERTIFICATE, { from: operator }));
      });
    });
  });

  // TRANSFERBYPARTITION

  describe('transferByPartition', function () {
    const transferAmount = 300;

    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
      await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });
    });

    describe('when the sender has enough balance for this partition', function () {
      it('transfers the requested amount', async function () {
        await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount);
        await assertBalanceOf(this.token, recipient, partition1, 0);

        await this.token.transferByPartition(partition1, recipient, transferAmount, VALID_CERTIFICATE, { from: tokenHolder });
        await this.token.transferByPartition(partition1, recipient, 0, VALID_CERTIFICATE, { from: tokenHolder });

        await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount - transferAmount);
        await assertBalanceOf(this.token, recipient, partition1, transferAmount);
      });
      it('emits a TransferByPartition event', async function () {
        const { logs } = await this.token.transferByPartition(partition1, recipient, transferAmount, VALID_CERTIFICATE, { from: tokenHolder });

        assert.equal(logs.length, 3);

        assertTransferEvent(logs, partition1, tokenHolder, tokenHolder, recipient, transferAmount, VALID_CERTIFICATE, ZERO_BYTE);
      });
    });
    describe('when the sender does not have enough balance for this partition', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.token.transferByPartition(partition2, recipient, transferAmount, VALID_CERTIFICATE, { from: tokenHolder }));
      });
    });
  });

  // OPERATORTRANSFERBYPARTITION

  describe('operatorTransferByPartition', function () {
    const transferAmount = 300;

    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
      await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });
    });

    describe('when the sender is an operator for this partition', function () {
      describe('when the sender has enough balance for this partition', function () {
        describe('when partition does not change', function () {
          it('transfers the requested amount (when sender is specified)', async function () {
            await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount);
            await assertBalanceOf(this.token, recipient, partition1, 0);

            await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
            await this.token.operatorTransferByPartition(partition1, tokenHolder, recipient, transferAmount, '', VALID_CERTIFICATE, { from: operator });

            await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount - transferAmount);
            await assertBalanceOf(this.token, recipient, partition1, transferAmount);
          });
          it('transfers the requested amount (when sender is not specified)', async function () {
            await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount);
            await assertBalanceOf(this.token, recipient, partition1, 0);

            await this.token.operatorTransferByPartition(partition1, ZERO_ADDRESS, recipient, transferAmount, '', VALID_CERTIFICATE, { from: tokenHolder });

            await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount - transferAmount);
            await assertBalanceOf(this.token, recipient, partition1, transferAmount);
          });
          it('emits a TransferByPartition event', async function () {
            await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
            const { logs } = await this.token.operatorTransferByPartition(partition1, tokenHolder, recipient, transferAmount, '', VALID_CERTIFICATE, { from: operator });

            assert.equal(logs.length, 3);

            assertTransferEvent(logs, partition1, operator, tokenHolder, recipient, transferAmount, ZERO_BYTE, VALID_CERTIFICATE);
          });
        });
        describe('when partition changes', function () {
          it('transfers the requested amount', async function () {
            await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount);
            await assertBalanceOf(this.token, recipient, partition2, 0);

            await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
            await this.token.operatorTransferByPartition(partition1, tokenHolder, recipient, transferAmount, partition2, VALID_CERTIFICATE, { from: operator });

            await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount - transferAmount);
            await assertBalanceOf(this.token, recipient, partition2, transferAmount);
          });
          it('converts the requested amount (when sender is specified)', async function () {
            await assertBalance(this.token, tokenHolder, issuanceAmount);
            await assertBalanceOfByPartition(this.token, tokenHolder, partition1, issuanceAmount);
            await assertBalanceOfByPartition(this.token, tokenHolder, partition2, 0);

            await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
            await this.token.operatorTransferByPartition(partition1, tokenHolder, tokenHolder, transferAmount, partition2, VALID_CERTIFICATE, { from: operator });

            await assertBalance(this.token, tokenHolder, issuanceAmount);
            await assertBalanceOfByPartition(this.token, tokenHolder, partition1, issuanceAmount - transferAmount);
            await assertBalanceOfByPartition(this.token, tokenHolder, partition2, transferAmount);
          });
          it('converts the requested amount (when sender is not specified)', async function () {
            await assertBalance(this.token, tokenHolder, issuanceAmount);
            await assertBalanceOfByPartition(this.token, tokenHolder, partition1, issuanceAmount);
            await assertBalanceOfByPartition(this.token, tokenHolder, partition2, 0);

            await this.token.operatorTransferByPartition(partition1, ZERO_ADDRESS, tokenHolder, transferAmount, partition2, VALID_CERTIFICATE, { from: tokenHolder });

            await assertBalance(this.token, tokenHolder, issuanceAmount);
            await assertBalanceOfByPartition(this.token, tokenHolder, partition1, issuanceAmount - transferAmount);
            await assertBalanceOfByPartition(this.token, tokenHolder, partition2, transferAmount);
          });
          it('emits a changedPartition event', async function () {
            await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
            const { logs } = await this.token.operatorTransferByPartition(partition1, tokenHolder, recipient, transferAmount, partition2, VALID_CERTIFICATE, { from: operator });

            assert.equal(logs.length, 4);

            assertTransferEvent([logs[0], logs[1], logs[2]], partition1, operator, tokenHolder, recipient, transferAmount, partition2, VALID_CERTIFICATE);

            assert.equal(logs[3].event, 'ChangedPartition');
            assert.equal(logs[3].args.fromPartition, partition1);
            assert.equal(logs[3].args.toPartition, partition2);
            assert(logs[3].args.value.eq(transferAmount));
          });
        });
      });
      describe('when the sender does not have enough balance for this partition', function () {
        it('reverts', async function () {
          await this.token.authorizeOperatorByPartition(partition1, operator, { from: tokenHolder });
          await shouldFail.reverting(this.token.operatorTransferByPartition(partition1, tokenHolder, recipient, issuanceAmount + 1, '', VALID_CERTIFICATE, { from: operator }));
        });
      });
    });
    describe('when the sender is a global operator', function () {
      it('redeems the requested amount', async function () {
        await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount);
        await assertBalanceOf(this.token, recipient, partition1, 0);

        await this.token.authorizeOperator(operator, { from: tokenHolder });
        await this.token.operatorTransferByPartition(partition1, tokenHolder, recipient, transferAmount, '', VALID_CERTIFICATE, { from: operator });

        await assertBalanceOf(this.token, tokenHolder, partition1, issuanceAmount - transferAmount);
        await assertBalanceOf(this.token, recipient, partition1, transferAmount);
      });
    });
    describe('when the sender is not an operator', function () {
      it('reverts', async function () {
        await shouldFail.reverting(this.token.operatorTransferByPartition(partition1, tokenHolder, recipient, transferAmount, '', VALID_CERTIFICATE, { from: operator }));
      });
    });
  });

  // PARTITIONSOF

  describe('partitionsOf', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    describe('when tokenHolder owes no tokens', function () {
      it('returns empty list', async function () {
        const partitionsOf = await this.token.partitionsOf(tokenHolder);
        assert.equal(partitionsOf.length, 0);
      });
    });
    describe('when tokenHolder owes tokens of 1 partition', function () {
      it('returns partition', async function () {
        await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });
        const partitionsOf = await this.token.partitionsOf(tokenHolder);
        assert.equal(partitionsOf.length, 1);
        assert.equal(partitionsOf[0], partition1);
      });
    });
    describe('when tokenHolder owes tokens of 3 partitions', function () {
      it('returns list of 3 partitions', async function () {
        await issueOnMultiplePartitions(this.token, owner, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);
        const partitionsOf = await this.token.partitionsOf(tokenHolder);
        assert.equal(partitionsOf.length, 3);
        assert.equal(partitionsOf[0], partition1);
        assert.equal(partitionsOf[1], partition2);
        assert.equal(partitionsOf[2], partition3);
      });
    });
  });

  // TOTALPARTITIONS

  describe('totalPartitions', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
    });
    describe('when no tokens are issued', function () {
      it('returns empty list', async function () {
        const partitionsOf = await this.token.totalPartitions();
        assert.equal(partitionsOf.length, 0);
      });
    });
    describe('when tokens are issued for 1 partition', function () {
      it('returns partition', async function () {
        await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });
        const partitionsOf = await this.token.totalPartitions();
        assert.equal(partitionsOf.length, 1);
        assert.equal(partitionsOf[0], partition1);
      });
    });
    describe('when tokens are issued for 3 partitions', function () {
      it('returns list of 3 partitions', async function () {
        await this.token.issueByPartition(partition1, tokenHolder, issuanceAmount, VALID_CERTIFICATE, { from: owner });
        await this.token.issueByPartition(partition2, recipient, issuanceAmount, VALID_CERTIFICATE, { from: owner });
        await this.token.issueByPartition(partition3, unknown, issuanceAmount, VALID_CERTIFICATE, { from: owner });
        const partitionsOf = await this.token.totalPartitions();
        assert.equal(partitionsOf.length, 3);
        assert.equal(partitionsOf[0], partition1);
        assert.equal(partitionsOf[1], partition2);
        assert.equal(partitionsOf[2], partition3);
      });
    });
  });

  // TRANSFERWITHDATA

  describe('transferWithData', function () {
    describe('when tokenDefaultPartitions have been defined', function () {
      beforeEach(async function () {
        this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
        await issueOnMultiplePartitions(this.token, owner, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);
      });
      describe('when the sender has enough balance for those default partitions', function () {
        describe('when the sender has defined custom default partitions', function () {
          it('transfers the requested amount', async function () {
            await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
            await assertBalances(this.token, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);

            await this.token.transferWithData(recipient, 2.5 * issuanceAmount, VALID_CERTIFICATE, { from: tokenHolder });

            await assertBalances(this.token, tokenHolder, partitions, [0, 0.5 * issuanceAmount, 0]);
            await assertBalances(this.token, recipient, partitions, [issuanceAmount, 0.5 * issuanceAmount, issuanceAmount]);
          });
          it('emits a sent event', async function () {
            await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
            const { logs } = await this.token.transferWithData(recipient, 2.5 * issuanceAmount, VALID_CERTIFICATE, { from: tokenHolder });

            assert.equal(logs.length, 1 + 2 * partitions.length);

            assertTransferEvent([logs[0], logs[1], logs[2]], partition3, tokenHolder, tokenHolder, recipient, issuanceAmount, VALID_CERTIFICATE, ZERO_BYTE);
            assertTransferEvent([logs[3], logs[4]], partition1, tokenHolder, tokenHolder, recipient, issuanceAmount, VALID_CERTIFICATE, ZERO_BYTE);
            assertTransferEvent([logs[5], logs[6]], partition2, tokenHolder, tokenHolder, recipient, 0.5 * issuanceAmount, VALID_CERTIFICATE, ZERO_BYTE);
          });
        });
        describe('when the sender has not defined custom default partitions', function () {
          it('transfers the requested amount', async function () {
            await assertBalances(this.token, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);

            await this.token.transferWithData(recipient, 2.5 * issuanceAmount, VALID_CERTIFICATE, { from: tokenHolder });

            await assertBalances(this.token, tokenHolder, partitions, [0, 0, 0.5 * issuanceAmount]);
            await assertBalances(this.token, recipient, partitions, [issuanceAmount, issuanceAmount, 0.5 * issuanceAmount]);
          });
        });
      });
      describe('when the sender does not have enough balance for those default partitions', function () {
        it('reverts', async function () {
          await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
          await shouldFail.reverting(this.token.transferWithData(recipient, 3.5 * issuanceAmount, VALID_CERTIFICATE, { from: tokenHolder }));
        });
      });
    });
    describe('when tokenDefaultPartitions have not been defined', function () {
      it('reverts', async function () {
        this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, []);
        await issueOnMultiplePartitions(this.token, owner, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);
        await shouldFail.reverting(this.token.transferWithData(recipient, 2.5 * issuanceAmount, VALID_CERTIFICATE, { from: tokenHolder }));
      });
    });
  });

  // TRANSFERFROMWITHDATA

  describe('transferFromWithData', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
      await issueOnMultiplePartitions(this.token, owner, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);
    });
    describe('when the operator is approved', function () {
      beforeEach(async function () {
        await this.token.authorizeOperator(operator, { from: tokenHolder });
      });
      describe('when defaultPartitions have been defined', function () {
        describe('when the sender has enough balance for those default partitions', function () {
          it('transfers the requested amount (when sender is specified)', async function () {
            await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
            await assertBalances(this.token, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);

            await this.token.transferFromWithData(tokenHolder, recipient, 2.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: operator });

            await assertBalances(this.token, tokenHolder, partitions, [0, 0.5 * issuanceAmount, 0]);
            await assertBalances(this.token, recipient, partitions, [issuanceAmount, 0.5 * issuanceAmount, issuanceAmount]);
          });
          it('transfers the requested amount (when sender is not specified)', async function () {
            await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
            await assertBalances(this.token, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);

            await this.token.transferFromWithData(ZERO_ADDRESS, recipient, 2.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: tokenHolder });

            await assertBalances(this.token, tokenHolder, partitions, [0, 0.5 * issuanceAmount, 0]);
            await assertBalances(this.token, recipient, partitions, [issuanceAmount, 0.5 * issuanceAmount, issuanceAmount]);
          });
          it('emits a sent event', async function () {
            await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
            const { logs } = await this.token.transferFromWithData(tokenHolder, recipient, 2.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: operator });

            assert.equal(logs.length, 1 + 2 * partitions.length);

            assertTransferEvent([logs[0], logs[1], logs[2]], partition3, operator, tokenHolder, recipient, issuanceAmount, ZERO_BYTE, VALID_CERTIFICATE);
            assertTransferEvent([logs[3], logs[4]], partition1, operator, tokenHolder, recipient, issuanceAmount, ZERO_BYTE, VALID_CERTIFICATE);
            assertTransferEvent([logs[5], logs[6]], partition2, operator, tokenHolder, recipient, 0.5 * issuanceAmount, ZERO_BYTE, VALID_CERTIFICATE);
          });
        });
        describe('when the sender does not have enough balance for those default partitions', function () {
          it('reverts', async function () {
            await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
            await shouldFail.reverting(this.token.transferFromWithData(tokenHolder, recipient, 3.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: operator }));
          });
        });
      });
      describe('when defaultPartitions have not been defined', function () {
        it('reverts', async function () {
          await this.token.setTokenDefaultPartitions([], { from: owner });
          await shouldFail.reverting(this.token.transferFromWithData(tokenHolder, recipient, 2.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: operator }));
        });
      });
    });
    describe('when the operator is not approved', function () {
      it('reverts', async function () {
        await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
        await shouldFail.reverting(this.token.transferFromWithData(tokenHolder, recipient, 2.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: operator }));
      });
    });
  });

  // BURN

  describe('burn', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
      await issueOnMultiplePartitions(this.token, owner, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);
    });
    describe('when defaultPartitions have been defined', function () {
      describe('when the sender has enough balance for those default partitions', function () {
        it('redeeems the requested amount', async function () {
          await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
          await assertBalances(this.token, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);

          await this.token.burn(2.5 * issuanceAmount, VALID_CERTIFICATE, { from: tokenHolder });

          await assertBalances(this.token, tokenHolder, partitions, [0, 0.5 * issuanceAmount, 0]);
        });
        it('emits a redeemedByPartition events', async function () {
          await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
          const { logs } = await this.token.burn(2.5 * issuanceAmount, VALID_CERTIFICATE, { from: tokenHolder });

          assert.equal(logs.length, 1 + 2 * partitions.length);

          assertBurnEvent([logs[0], logs[1], logs[2]], partition3, tokenHolder, tokenHolder, issuanceAmount, VALID_CERTIFICATE, ZERO_BYTE);
          assertBurnEvent([logs[3], logs[4]], partition1, tokenHolder, tokenHolder, issuanceAmount, VALID_CERTIFICATE, ZERO_BYTE);
          assertBurnEvent([logs[5], logs[6]], partition2, tokenHolder, tokenHolder, 0.5 * issuanceAmount, VALID_CERTIFICATE, ZERO_BYTE);
        });
      });
      describe('when the sender does not have enough balance for those default partitions', function () {
        it('reverts', async function () {
          await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
          await shouldFail.reverting(this.token.burn(3.5 * issuanceAmount, VALID_CERTIFICATE, { from: tokenHolder }));
        });
      });
    });
    describe('when defaultPartitions have not been defined', function () {
      it('reverts', async function () {
        await this.token.setTokenDefaultPartitions([], { from: owner });
        await shouldFail.reverting(this.token.burn(2.5 * issuanceAmount, VALID_CERTIFICATE, { from: tokenHolder }));
      });
    });
  });

  // REDEEMFROM

  describe('redeemFrom', function () {
    beforeEach(async function () {
      this.token = await ERC1400.new('ERC1400Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions);
      await issueOnMultiplePartitions(this.token, owner, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);
    });
    describe('when the operator is approved', function () {
      beforeEach(async function () {
        await this.token.authorizeOperator(operator, { from: tokenHolder });
      });
      describe('when defaultPartitions have been defined', function () {
        describe('when the sender has enough balance for those default partitions', function () {
          it('redeems the requested amount (when sender is specified)', async function () {
            await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
            await assertBalances(this.token, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);

            await this.token.redeemFrom(tokenHolder, 2.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: operator });

            await assertBalances(this.token, tokenHolder, partitions, [0, 0.5 * issuanceAmount, 0]);
          });
          it('redeems the requested amount (when sender is not specified)', async function () {
            await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
            await assertBalances(this.token, tokenHolder, partitions, [issuanceAmount, issuanceAmount, issuanceAmount]);

            await this.token.redeemFrom(ZERO_ADDRESS, 2.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: tokenHolder });

            await assertBalances(this.token, tokenHolder, partitions, [0, 0.5 * issuanceAmount, 0]);
          });
          it('emits redeemedByPartition events', async function () {
            await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
            const { logs } = await this.token.redeemFrom(tokenHolder, 2.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: operator });

            assert.equal(logs.length, 1 + 2 * partitions.length);

            assertBurnEvent([logs[0], logs[1], logs[2]], partition3, operator, tokenHolder, issuanceAmount, ZERO_BYTE, VALID_CERTIFICATE);
            assertBurnEvent([logs[3], logs[4]], partition1, operator, tokenHolder, issuanceAmount, ZERO_BYTE, VALID_CERTIFICATE);
            assertBurnEvent([logs[5], logs[6]], partition2, operator, tokenHolder, 0.5 * issuanceAmount, ZERO_BYTE, VALID_CERTIFICATE);
          });
        });
        describe('when the sender does not have enough balance for those default partitions', function () {
          it('reverts', async function () {
            await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
            await shouldFail.reverting(this.token.redeemFrom(tokenHolder, 3.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: operator }));
          });
        });
      });
      describe('when defaultPartitions have not been defined', function () {
        it('reverts', async function () {
          await this.token.setTokenDefaultPartitions([], { from: owner });
          await shouldFail.reverting(this.token.redeemFrom(tokenHolder, 2.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: operator }));
        });
      });
    });
    describe('when the operator is not approved', function () {
      it('reverts', async function () {
        await this.token.setDefaultPartitions(reversedPartitions, { from: tokenHolder });
        await shouldFail.reverting(this.token.redeemFrom(tokenHolder, 2.5 * issuanceAmount, '', VALID_CERTIFICATE, { from: operator }));
      });
    });
  });

  // ERC1410 - BURN

  describe('ERC1410 - burn', function () {
    beforeEach(async function () {
      this.token = await ERC1410.new('ERC1410Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions, tokenHolder, 1000);
    });
    it('burn function is disactivated', async function () {
      await assertBalance(this.token, tokenHolder, 1000);
      await this.token.burn(500, VALID_CERTIFICATE, { from: tokenHolder });
      await assertBalance(this.token, tokenHolder, 1000);
    });
  });

  // ERC1410 - REDEEMFROM

  describe('ERC1410 - redeemFrom', function () {
    beforeEach(async function () {
      this.token = await ERC1410.new('ERC1410Token', 'DAU', 1, [controller], CERTIFICATE_SIGNER, partitions, tokenHolder, 1000);
    });
    it('redeemFrom function is disactivated', async function () {
      await this.token.authorizeOperator(operator, { from: tokenHolder });

      await assertBalance(this.token, tokenHolder, 1000);
      await this.token.redeemFrom(tokenHolder, 500, '', VALID_CERTIFICATE, { from: operator });
      await assertBalance(this.token, tokenHolder, 1000);
    });
  });
});
