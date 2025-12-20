// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {ProofHeir} from "../src/ProofHeir.sol";
import {MockVerifier} from "../src/MockVerifier.sol";

contract ProofHeirTest is Test {
    MockERC20 public tokenA;
    ProofHeir public proofHeir;
    MockVerifier public verifier;

    // Bob is the Testator (he has assets)
    address BOB_ADDRESS = vm.addr(0xB0B);
    uint256 BOB_PK = 0xB0B;
    
    // Alice is the Heir (she wants to claim)
    address ALICE_ADDRESS = vm.addr(0xA11CE);

    function setUp() public {
        tokenA = new MockERC20();
        verifier = new MockVerifier();
        proofHeir = new ProofHeir(address(verifier));

        tokenA.mint(BOB_ADDRESS, 1000);
    }

     function testClaimInheritance() public {
         address[] memory tokens = new address[](1);
         tokens[0] = address(tokenA);

         address recipient = ALICE_ADDRESS; 
         
         // Mock proof data
         bytes memory proof = hex"1234";
         bytes32[] memory publicInputs = new bytes32[](1);
         // Correctly encode the recipient as public input
         publicInputs[0] = bytes32(uint256(uint160(recipient)));

         // Bob signs delegation to ProofHeir
         vm.signAndAttachDelegation(address(proofHeir), BOB_PK);

         vm.startPrank(ALICE_ADDRESS);
         ProofHeir(BOB_ADDRESS).claim(proof, publicInputs, tokens, recipient);
         vm.stopPrank();

         assertEq(tokenA.balanceOf(ALICE_ADDRESS), 1000);
         assertEq(tokenA.balanceOf(BOB_ADDRESS), 0);
    }

    function testFrontRunningProtection() public {
         address[] memory tokens = new address[](1);
         tokens[0] = address(tokenA);

         address intendedRecipient = ALICE_ADDRESS;
         address attacker = vm.addr(0x666);
         
         bytes memory proof = hex"1234";
         bytes32[] memory publicInputs = new bytes32[](1);
         // Proof is for Alice
         publicInputs[0] = bytes32(uint256(uint160(intendedRecipient)));

         vm.signAndAttachDelegation(address(proofHeir), BOB_PK);

         vm.startPrank(attacker);
         // Attacker tries to claim using Alice's proof but redirecting to Attacker
         vm.expectRevert("Recipient does not match proof");
         ProofHeir(BOB_ADDRESS).claim(proof, publicInputs, tokens, attacker);
         vm.stopPrank();
    }
}
