// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IVerifier} from "./Verifier.sol";

contract ProofHeir {
    using SafeERC20 for IERC20;

    IVerifier public immutable verifier;
    
    // Hash of the Trusted Server's Domain/Host (e.g. sha256("civil-registry-mock.onrender.com        "))
    // must be padded to 40
    bytes32 public immutable trustedServerHash;

    // Commitment of the owner's identity: Hash(RealID + Salt)
    bytes32 public identityCommitment;

    event AssetsClaimed(address indexed heir, address indexed recipient, address token, uint256 amount);
    event IdentityRegistered(address indexed user, bytes32 commitment);

    /**
     * @dev In EIP-7702 delegation pattern, each delegating account (address(this)) is its own owner.
     * This allows Bob to delegate to this implementation and Bob becomes the "owner" of his account.
     */
    modifier onlyOwner() {
        require(msg.sender == address(this), "Only self can call");
        _;
    }

    constructor(address _verifier, string memory _trustedServerDomain) {
        verifier = IVerifier(_verifier);
        trustedServerHash = sha256(abi.encodePacked(_trustedServerDomain));
    }

    /**
     * @notice Registers the identity commitment for the owner.
     * @param _identityCommitment The hash of the user's ID + Salt.
     * @dev Ideally this should also require a ZK proof of ownership/life at the moment of registration.
     */
    function register(bytes32 _identityCommitment) external onlyOwner {
        require(identityCommitment == bytes32(0), "Identity already registered");
        identityCommitment = _identityCommitment;
        emit IdentityRegistered(msg.sender, _identityCommitment);
    }

    /**
     * @notice Claims assets based on a Proof of Death.
     * @param proof The ZK proof.
     * @param publicInputs Public inputs [Recipient, IdentityCommitment, ServerNameHash].
     * @param tokens List of tokens to transfer.
     * @param recipient The address to receive funds.
     * @dev Public inputs format (116 fields, each byte expanded to 32-byte field):
     *      [0-19]: recipient (20 bytes)
     *      [20-51]: server_hash (32 bytes)
     *      [52-83]: id_commitment (32 bytes)
     *      [84-115]: status_commitment (32 bytes)
     */
    function claim(
        bytes calldata proof,
        bytes32[] calldata publicInputs,
        address[] calldata tokens,
        address recipient
    ) external {
        require(identityCommitment != bytes32(0), "Identity not registered");
        require(recipient != address(0), "Invalid recipient");
        
        // Circuit serializes each byte as a 32-byte field element
        // Total: 20 + 32 + 32 + 32 = 116 fields
        require(publicInputs.length >= 116, "Invalid public inputs length");
        
        // --- 1. Security Check: Recipient Binding ---
        // Prevents Front-Running. The proof must be generated specifically for this recipient.
        address proofRecipient = _extractAddress(publicInputs, 0);
        require(recipient == proofRecipient, "Recipient does not match proof");

        // --- 2. Security Check: Identity Binding ---
        // Prevents using a death certificate of a random person.
        bytes32 proofIdCommitment = _extractBytes32(publicInputs, 52);
        require(proofIdCommitment == identityCommitment, "Proof identity mismatch");

        // --- 3. Security Check: Source Binding ---
        // Prevents using a fake server (Man-in-the-Middle with valid TLS but wrong host).
        bytes32 proofServerHash = _extractBytes32(publicInputs, 20);
        require(proofServerHash == trustedServerHash, "Invalid data source (server domain)");

        // --- 4. Verify ZK Proof ---
        require(verifier.verify(proof, publicInputs), "Invalid ZK proof");

        // --- 5. Execute Inheritance ---
        for (uint256 i = 0; i < tokens.length; ++i) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(tokens[i]).safeTransfer(recipient, balance);
                emit AssetsClaimed(msg.sender, recipient, tokens[i], balance);
            }
        }
    }

    /**
     * @dev Extracts an address from 20 consecutive byte-fields in publicInputs.
     * @param publicInputs The array of field elements (each representing 1 byte).
     * @param startIndex The starting index of the 20-byte address.
     */
    function _extractAddress(bytes32[] calldata publicInputs, uint256 startIndex) internal pure returns (address) {
        bytes20 result;
        for (uint256 i = 0; i < 20; i++) {
            result |= bytes20(bytes1(uint8(uint256(publicInputs[startIndex + i])))) >> (i * 8);
        }
        return address(result);
    }

    /**
     * @dev Extracts a bytes32 from 32 consecutive byte-fields in publicInputs.
     * @param publicInputs The array of field elements (each representing 1 byte).
     * @param startIndex The starting index of the 32-byte value.
     */
    function _extractBytes32(bytes32[] calldata publicInputs, uint256 startIndex) internal pure returns (bytes32) {
        bytes32 result;
        for (uint256 i = 0; i < 32; i++) {
            result |= bytes32(bytes1(uint8(uint256(publicInputs[startIndex + i])))) >> (i * 8);
        }
        return result;
    }

    /**
     * @dev Allows the delegated account to receive native ETH.
     */
    receive() external payable {}

    /**
     * @dev Fallback function to handle calls with no matching function or data.
     */
    fallback() external payable {}
}
