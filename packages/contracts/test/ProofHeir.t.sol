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
    address payable BOB_ADDRESS;
    uint256 BOB_PK = 0xB0B;
    
    // Alice is the Heir (she wants to claim)
    address ALICE_ADDRESS;

    // Constants for circuit compatibility
    string constant TRUSTED_SERVER_DOMAIN = "civil-registry-mock.onrender.com        "; // 40 chars padded
    bytes32 constant SERVER_HASH = 0x5ddeed97a3950919f49ab7e413eeb1272467a129b6a75b59ac81da0516bdfb92;
    bytes32 IDENTITY_COMMITMENT;

    function setUp() public {
        BOB_ADDRESS = payable(vm.addr(BOB_PK));
        ALICE_ADDRESS = vm.addr(0xA11CE);
        IDENTITY_COMMITMENT = keccak256("bob_identity_salt");

        tokenA = new MockERC20();
        verifier = new MockVerifier();
        
        // Deploy ProofHeir implementation with trusted server domain
        proofHeir = new ProofHeir(address(verifier), TRUSTED_SERVER_DOMAIN);

        // Mint tokens to Bob
        tokenA.mint(BOB_ADDRESS, 1000);
    }

    /**
     * @dev Builds 116-field public inputs matching circuit serialization format.
     */
    function _buildPublicInputs(
        address recipient,
        bytes32 serverHash,
        bytes32 idCommitment,
        bytes32 statusCommitment
    ) internal pure returns (bytes32[] memory) {
        bytes32[] memory inputs = new bytes32[](116);
        
        // Recipient (20 bytes → fields 0-19)
        bytes20 recipientBytes = bytes20(recipient);
        for (uint i = 0; i < 20; i++) {
            inputs[i] = bytes32(uint256(uint8(recipientBytes[i])));
        }
        
        // Server hash (32 bytes → fields 20-51)
        for (uint i = 0; i < 32; i++) {
            inputs[20 + i] = bytes32(uint256(uint8(serverHash[i])));
        }
        
        // ID commitment (32 bytes → fields 52-83)
        for (uint i = 0; i < 32; i++) {
            inputs[52 + i] = bytes32(uint256(uint8(idCommitment[i])));
        }
        
        // Status commitment (32 bytes → fields 84-115)
        for (uint i = 0; i < 32; i++) {
            inputs[84 + i] = bytes32(uint256(uint8(statusCommitment[i])));
        }
        
        return inputs;
    }

    function testClaimInheritance() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(tokenA);

        address recipient = ALICE_ADDRESS; 
        
        // Build 116-field public inputs
        bytes memory proof = hex"1234";
        bytes32[] memory publicInputs = _buildPublicInputs(
            recipient,
            SERVER_HASH,
            IDENTITY_COMMITMENT,
            bytes32(uint256(0x999)) // Dummy status commitment
        );

        // Bob signs delegation to ProofHeir
        vm.signAndAttachDelegation(address(proofHeir), BOB_PK);

        // Register Bob's identity on his delegated account
        vm.prank(BOB_ADDRESS);
        ProofHeir(BOB_ADDRESS).register(IDENTITY_COMMITMENT);

        // Alice claims inheritance
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
        
        // Build public inputs with Alice as recipient
        bytes memory proof = hex"1234";
        bytes32[] memory publicInputs = _buildPublicInputs(
            intendedRecipient,
            SERVER_HASH,
            IDENTITY_COMMITMENT,
            bytes32(uint256(0x999))
        );

        vm.signAndAttachDelegation(address(proofHeir), BOB_PK);
        
        vm.prank(BOB_ADDRESS);
        ProofHeir(BOB_ADDRESS).register(IDENTITY_COMMITMENT);

        // Attacker tries to claim using Alice's proof but redirecting to Attacker
        vm.startPrank(attacker);
        vm.expectRevert("Recipient does not match proof");
        ProofHeir(BOB_ADDRESS).claim(proof, publicInputs, tokens, attacker);
        vm.stopPrank();
    }
}
