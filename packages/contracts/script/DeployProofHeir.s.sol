// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProofHeir} from "../src/ProofHeir.sol";
import {MockVerifier} from "../src/MockVerifier.sol";

contract DeployProofHeir is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Verifier (using Mock for now)
        MockVerifier verifier = new MockVerifier();
        console.log("MockVerifier deployed at:", address(verifier));

        // 2. Deploy ProofHeir
        ProofHeir proofHeir = new ProofHeir(address(verifier));
        console.log("ProofHeir deployed at:", address(proofHeir));

        vm.stopBroadcast();
    }
}
