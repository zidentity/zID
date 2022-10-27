// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

/* solhint-disable reason-string */

import "./lib/account-abstraction/contracts/samples/SimpleWallet.sol";
import "./lib/contracts/contracts/verifiers/ZKPVerifier.sol";

contract zkWallet is ZKPVerifier, SimpleWallet {
    using UserOperationLib for UserOperation;
    
    uint64 public constant OWNER_REQUEST_ID = 1;

    constructor(
        IEntryPoint anEntryPoint, 
        address anOwner,
        uint64 requestId,
        ICircuitValidator validator,
        ICircuitValidator.CircuitQuery memory query
    ) SimpleWallet(anEntryPoint, anOwner) {
        bool zkRequestSet = _setZKPRequest(requestId, validator, query);
        require(zkRequestSet, "zkRequest not set");
    }

    function _validateSignature(UserOperation calldata userOp, bytes32 requestId, address) internal virtual override {
        (   
            uint64 requestId,
            uint256[] memory inputs,
            uint256[2] memory a,
            uint256[2][2] memory b,
            uint256[2] memory c
        ) = abi.decode(userOp.signature, uint64, uint256[], uint256[2], uint256[2][2], uint256[2]);
        
        bool validProof = submitZKPResponse(
            requestId,
            inputs,
            a,
            b,
            c
        );
        
        require(validProof, "Proof not valid");
    }

    function _setZKPRequest(
        uint64 requestId,
        ICircuitValidator validator,
        ICircuitValidator.CircuitQuery memory query
    ) internal returns (bool) {
        if (requestValidators[requestId] == ICircuitValidator(address(0x00))) {
            supportedRequests.push(requestId);
        }
        requestQueries[requestId].value = query.value;
        requestQueries[requestId].operator = query.operator;
        requestQueries[requestId].circuitId = query.circuitId;
        requestQueries[requestId].slotIndex = query.slotIndex;
        requestQueries[requestId].schema = query.schema;

        requestQueries[requestId].circuitId = query.circuitId;

        requestValidators[requestId] = validator;
        return true;
    }
}
