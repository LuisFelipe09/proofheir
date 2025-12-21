// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

contract ProofHeir {
    using SafeERC20 for IERC20;

    IVerifier public immutable verifier;

    event AssetsClaimed(address indexed heir, address indexed recipient, address token, uint256 amount);

    constructor(address _verifier) {
        verifier = IVerifier(_verifier);
    }

    /**
     * @notice Claims assets from the testator's account and transfers them to the recipient.
     * @dev This function is intended to be called via EIP-7702 delegation.
     * @param proof The ZK proof of the testator's condition (e.g., proof of death).
     * @param publicInputs Public inputs for the ZK proof, publicInputs[0] MUST be the recipient address.
     * @param tokens List of ERC20 tokens to transfer.
     * @param recipient The address to receive the tokens.
     */
    function claim(
        bytes calldata proof,
        bytes32[] calldata publicInputs,
        address[] calldata tokens,
        address recipient
    ) external {
        require(recipient != address(0), "Invalid recipient");
        
        // Security: Ensure the recipient matches the one encoded in the proof (publicInputs[0])
        // This prevents front-running where an attacker changes the recipient address.
        require(publicInputs.length > 0, "Missing public inputs");
        address proofRecipient = address(uint160(uint256(publicInputs[0])));
        require(recipient == proofRecipient, "Recipient does not match proof");

        require(verifier.verify(proof, publicInputs), "Invalid proof");

        for (uint256 i = 0; i < tokens.length; ++i) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(tokens[i]).safeTransfer(recipient, balance);
                emit AssetsClaimed(msg.sender, recipient, tokens[i], balance);
            }
        }
    }
}
