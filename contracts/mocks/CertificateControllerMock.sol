pragma solidity ^0.4.24;


contract CertificateControllerMock {

  function _checkCertificate(bytes data, uint256 /*amount*/, bytes4 /*functionID*/) internal view returns(bool) { // Comments to avoid compilation warnings for unused variables.
    if(data.length > 0 && (data[0] == hex"10" || data[0] == hex"11" || data[0] == hex"22")) {
      return true;
    } else {
      return false;
    }
  }
}
