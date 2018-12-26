pragma solidity ^0.4.24;

import "../token/ERC777/IERC777TokensRecipient.sol";
import "./ERC820ImplementerMock.sol";


contract ERC777TokensRecipientMock is IERC777TokensRecipient, ERC820ImplementerMock {

  constructor(string interfaceLabel)
    public
    ERC820ImplementerMock(interfaceLabel)
  {

  }

  function canReceive(
    bytes32 /*partition*/,
    address from,
    address to,
    uint value,
    bytes data,
    bytes /*operatorData*/
  ) // Comments to avoid compilation warnings for unused variables.
    external
    view
    returns(bool)
  {
    return(_canReceive(from, to, value, data));
  }

  function tokensReceived(
    address /*operator*/,
    address from,
    address to,
    uint value,
    bytes data,
    bytes /*operatorData*/
  ) // Comments to avoid compilation warnings for unused variables.
    external
  {
    require(_canReceive(from, to, value, data), "A6: Transfer Blocked - Receiver not eligible");
  }

  function _canReceive(
    address /*from*/,
    address /*to*/,
    uint /*value*/,
    bytes data
  ) // Comments to avoid compilation warnings for unused variables.
    internal
    pure
    returns(bool)
  {
    bytes32 receiveRevert = 0x2200000000000000000000000000000000000000000000000000000000000000; // Default recipient hook failure data for the mock only
    bytes32 data32;
    assembly {
        data32 := mload(add(data, 32))
    }
    if (data32 == receiveRevert) {
      return false;
    } else {
      return true;
    }
  }

}
