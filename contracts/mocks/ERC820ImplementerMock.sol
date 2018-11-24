pragma solidity ^0.4.24;

/* import "erc820/contracts/ERC820ImplementerInterface.sol"; */


contract ERC820Registry {
    function setInterfaceImplementer(address _addr, bytes32 _interfaceHash, address _implementer) external;
    function getInterfaceImplementer(address _addr, bytes32 _interfaceHash) external view returns (address);
    function setManager(address _addr, address _newManager) external;
    function getManager(address _addr) public view returns(address);
}


contract ERC820ImplementerMock {
  bytes32 internal ERC820_ACCEPT_MAGIC = keccak256(abi.encodePacked("ERC820_ACCEPT_MAGIC"));

  ERC820Registry constant ERC820REGISTRY = ERC820Registry(0x820b586C8C28125366C998641B09DCbE7d4cBF06);

  bytes32 internal _interfaceHash;

  constructor(string interfaceLabel) public {
    _interfaceHash = keccak256(abi.encodePacked(interfaceLabel));
  }

  function setERC820Implementer() external {
    require(ERC820REGISTRY.getManager(msg.sender) == address(this), "Manager rights neeed to be transferred to this contract first.");
    ERC820REGISTRY.setInterfaceImplementer(msg.sender, _interfaceHash, this);
    ERC820REGISTRY.setManager(msg.sender, msg.sender);
  }

  function canImplementInterfaceForAddress(bytes32 interfaceHash, address addr) external view returns(bytes32) {
    return ERC820_ACCEPT_MAGIC;
  }

}
