// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProofHeir} from "../src/ProofHeir.sol";
import {MockVerifier} from "../src/MockVerifier.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract DeployProofHeir is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address targetWallet = 0xC7617F5aC47db5b237bCc7Eb1B2C3E1Da0Bac3f8;
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Verifier (using Mock for now)
        MockVerifier verifier = new MockVerifier();
        console.log("MockVerifier deployed at:", address(verifier));

        // 2. Deploy ProofHeir
        string memory trustedServerDomain = "civil-registry-mock.onrender.com        "; // 40 chars
        ProofHeir proofHeir = new ProofHeir(address(verifier), trustedServerDomain);
        console.log("ProofHeir deployed at:", address(proofHeir));

        // 3. Deploy MockERC20
        MockERC20 token = new MockERC20();
        console.log("MockERC20 deployed at:", address(token));

        // 4. Mint tokens to target wallet for testing
        token.mint(targetWallet, 1000 * 10**18);
        console.log("Minted 1000 tokens to:", targetWallet);

        vm.stopBroadcast();
    }
}
