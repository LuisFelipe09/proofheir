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

    event AssetsClaimed(address indexed claimer, address indexed recipient, address indexed token, uint256 amount);

    constructor(address _verifier) {
        verifier = IVerifier(_verifier);
    }

    /// @notice Claim assets by providing a valid proof of death.
    /// @dev This function is intended to be executed in the context of the Testator's EOA (via EIP-7702).
    ///      The Heir (or anyone) calls this function on the Testator's address.
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
