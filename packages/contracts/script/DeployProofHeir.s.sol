// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProofHeir} from "../src/ProofHeir.sol";
import {HonkVerifier} from "../src/Verifier.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract DeployProofHeir is Script {
    function setUp() public {}

    function run() public {
        // Use the private key from --private-key flag or PRIVATE_KEY env var
        vm.startBroadcast();

        address targetWallet = 0xC7617F5aC47db5b237bCc7Eb1B2C3E1Da0Bac3f8;
        
        // 1. Deploy Verifier
        HonkVerifier verifier = new HonkVerifier();
        console.log("HonkVerifier deployed at:", address(verifier));

        // 2. Deploy ProofHeir
        // Read trusted server domain from environment and pad to 40 characters
        string memory baseDomain = vm.envString("CIVIL_REGISTRY_DOMAIN");
        
        // Pad domain to exactly 40 characters with spaces
        bytes memory domainBytes = bytes(baseDomain);
        require(domainBytes.length <= 40, "Domain too long (max 40 chars)");
        
        bytes memory paddedBytes = new bytes(40);
        for (uint i = 0; i < domainBytes.length; i++) {
            paddedBytes[i] = domainBytes[i];
        }
        for (uint i = domainBytes.length; i < 40; i++) {
            paddedBytes[i] = bytes1(' '); // Pad with spaces
        }
        string memory trustedServerDomain = string(paddedBytes);
        
        console.log("Domain length:", bytes(trustedServerDomain).length);
        console.log("Domain value:", trustedServerDomain);
        
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
