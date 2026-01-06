// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IVerifier} from "./Verifier.sol";

/**
 * @title ProofHeir
 * @notice A decentralized inheritance protocol using EIP-7702 delegation and Zero-Knowledge proofs.
 * @dev This contract enables users to set up inheritance plans that can be claimed by designated heirs
 *      upon proof of death, verified through ZK proofs from a trusted civil registry.
 * 
 * @dev Architecture:
 *      - Uses EIP-7702 delegation pattern where each user's EOA delegates to this implementation
 *      - Employs ZK proofs to verify death certificates without revealing personal information
 *      - Implements a two-step claim process: proof verification + asset transfer
 * 
 * @dev Security Features:
 *      - Identity Binding: Prevents using death certificates of random people
 *      - Source Binding: Ensures data comes from trusted civil registry
 *      - Recipient Binding: Prevents front-running attacks by binding proof to specific heir
 *      - ZK Proof Verification: Cryptographically validates death certificate authenticity
 */
contract ProofHeir {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice The ZK proof verifier contract
    IVerifier public immutable verifier;
    
    /// @notice Hash of the trusted server's domain (e.g., sha256("civil-registry-mock.onrender.com        "))
    /// @dev Domain must be padded to exactly 40 characters for circuit compatibility
    bytes32 public immutable trustedServerHash;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @custom:storage-location erc7201:proofheir.storage.main
    struct ProofHeirStorage {
        /// @dev Commitment of the owner's identity: keccak256(RealID || Salt)
        bytes32 identityCommitment;
        /// @dev Address of the registered heir who can claim assets
        address heir;
    }

    /// @dev ERC-7201 namespaced storage location
    /// @dev keccak256(abi.encode(uint256(keccak256("proofheir.storage.main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant PROOFHEIR_STORAGE_LOCATION = 
        0x8d0a5b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e00;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when assets are successfully claimed by an heir
    /// @param caller The address that initiated the claim transaction
    /// @param heir The address that received the assets
    /// @param token The token contract address that was transferred
    /// @param amount The amount of tokens transferred
    event AssetsClaimed(address indexed caller, address indexed heir, address indexed token, uint256 amount);
    
    /// @notice Emitted when a user registers their identity commitment
    /// @param owner The address of the account owner
    /// @param commitment The identity commitment hash
    event IdentityRegistered(address indexed owner, bytes32 commitment);
    
    /// @notice Emitted when an heir is registered via valid death proof
    /// @param owner The address of the deceased account owner
    /// @param heir The address of the registered heir
    event HeirRegistered(address indexed owner, address indexed heir);

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Restricts function access to the delegated account itself.
     * @dev In EIP-7702 delegation pattern, each delegating account (address(this)) is its own owner.
     *      This allows Bob to delegate to this implementation and Bob becomes the "owner" of his account.
     */
    modifier onlyOwner() {
        require(msg.sender == address(this), "Only self can call");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initializes the ProofHeir contract with verifier and trusted server configuration.
     * @param _verifier Address of the ZK proof verifier contract
     * @param _trustedServerDomain Domain name of the trusted civil registry (must be exactly 40 chars)
     * @dev The server domain is hashed using SHA-256 to create a commitment that will be verified in proofs
     */
    constructor(address _verifier, string memory _trustedServerDomain) {
        verifier = IVerifier(_verifier);
        trustedServerHash = sha256(abi.encodePacked(_trustedServerDomain));
    }

    /*//////////////////////////////////////////////////////////////
                          EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Registers the identity commitment for the account owner (Step 1 of inheritance setup).
     * @param _identityCommitment The keccak256 hash of (user's real ID || salt)
     * 
     * @dev Requirements:
     *      - Can only be called by the account owner (via EIP-7702 delegation)
     *      - Identity can only be registered once
     * 
     * @dev Security Note:
     *      Ideally this should also require a ZK proof of life at registration time to ensure
     *      the person is alive and owns the identity being committed.
     * 
     * @dev Example:
     *      If Bob's ID is "123456789" and salt is "mysecret", then:
     *      _identityCommitment = keccak256(abi.encodePacked("123456789", "mysecret"))
     */
    function registerIdentity(bytes32 _identityCommitment) external onlyOwner {
        ProofHeirStorage storage $ = _getProofHeirStorage();
        require($.identityCommitment == bytes32(0), "Identity already registered");
        $.identityCommitment = _identityCommitment;
        emit IdentityRegistered(msg.sender, _identityCommitment);
    }

    /**
     * @notice Verifies a death proof and registers the heir (Step 2 of inheritance claim).
     * @param proof The ZK proof bytes generated by the Noir circuit
     * @param publicInputs Array of 116 field elements representing the public inputs
     * 
     * @dev Public Inputs Format (116 fields total, each byte serialized as a 32-byte field element):
     *      - [0-19]:    recipient address (20 bytes)
     *      - [20-51]:   server_hash (32 bytes) - SHA-256 hash of trusted server domain
     *      - [52-83]:   id_commitment (32 bytes) - keccak256(realID || salt)
     *      - [84-115]:  status_commitment (32 bytes) - keccak256(status || blinder)
     * 
     * @dev Security Checks Performed:
     *      1. Recipient Binding: Extracts and validates the heir address from the proof
     *      2. Identity Binding: Ensures the proof is for the registered identity (prevents using random death certificates)
     *      3. Source Binding: Verifies the data comes from the trusted civil registry (prevents MITM attacks)
     *      4. ZK Proof Verification: Cryptographically validates the proof authenticity
     * 
     * @dev Requirements:
     *      - Identity must be registered first via registerIdentity()
     *      - publicInputs must contain exactly 116 field elements
     *      - The proof must be valid according to the verifier contract
     * 
     * @dev Access Control:
     *      Anyone can call this function with a valid proof. This is intentional as the proof itself
     *      provides all necessary security guarantees.
     */
    function proveDeathAndRegisterHeir(bytes calldata proof, bytes32[] calldata publicInputs) external {
        ProofHeirStorage storage $ = _getProofHeirStorage();
        require($.identityCommitment != bytes32(0), "Identity not registered");
        
        // Circuit serializes each byte as a 32-byte field element
        // Total: 20 (recipient) + 32 (server_hash) + 32 (id_commitment) + 32 (status_commitment) = 116 fields
        require(publicInputs.length >= 116, "Invalid public inputs length");
        

        // --- 1. Security Check: Recipient Binding ---
        // Extract the heir address from the proof to prevent front-running
        address proofHeir = _extractAddress(publicInputs, 0);

        // --- 2. Security Check: Identity Binding ---
        // Prevents using a death certificate of a random person
        bytes32 proofIdCommitment = _extractBytes32(publicInputs, 52);
        require(proofIdCommitment == $.identityCommitment, "Proof identity mismatch");

        // --- 3. Security Check: Source Binding ---
        // Prevents using a fake server (Man-in-the-Middle with valid TLS but wrong host)
        bytes32 proofServerHash = _extractBytes32(publicInputs, 20);
        require(proofServerHash == trustedServerHash, "Invalid data source (server domain)");

        // --- 4. Verify ZK Proof ---
        require(verifier.verify(proof, publicInputs), "Invalid ZK proof");

        $.heir = proofHeir;
        emit HeirRegistered(msg.sender, proofHeir);
    }

    /**
     * @notice Transfers all specified tokens to the registered heir (Step 3 of inheritance claim).
     * @param tokens Array of ERC20 token addresses to transfer
     * 
     * @dev Requirements:
     *      - An heir must be registered via proveDeathAndRegisterHeir()
     * 
     * @dev Behavior:
     *      - Transfers the entire balance of each token to the registered heir
     *      - Skips tokens with zero balance (no revert)
     *      - Emits AssetsClaimed event for each successful transfer
     * 
     * @dev Access Control:
     *      Anyone can call this function once an heir is registered. This is safe because:
     *      - The heir address is already validated via ZK proof in proveDeathAndRegisterHeir()
     *      - Assets can only go to the heir stored in contract storage
     * 
     * @dev Gas Optimization:
     *      Consider batching token transfers if claiming many tokens to avoid hitting gas limits
     */
    function claimInheritance(address[] calldata tokens) external {
        ProofHeirStorage storage $ = _getProofHeirStorage();
        address heir = $.heir;
        require(heir != address(0), "No heir registered");

        for (uint256 i = 0; i < tokens.length; ++i) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(tokens[i]).safeTransfer(heir, balance);
                emit AssetsClaimed(msg.sender, heir, tokens[i], balance);
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Returns the stored identity commitment for this account.
     * @return The identity commitment hash, or bytes32(0) if not registered
     * 
     * @dev This can be used to verify if an account has completed Step 1 of the inheritance setup
     */
    function getIdentityCommitment() external view returns (bytes32) {
        ProofHeirStorage storage $ = _getProofHeirStorage();
        return $.identityCommitment;
    }

    /**
     * @notice Returns the registered heir address for this account.
     * @return The heir address, or address(0) if no heir is registered
     * 
     * @dev This can be used to verify if an account has a registered heir (Step 2 completed)
     */
    function getRegisteredHeir() external view returns (address) {
        ProofHeirStorage storage $ = _getProofHeirStorage();
        return $.heir;
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Retrieves the ERC-7201 namespaced storage for this contract.
     * @return $ The storage struct pointer
     */
    function _getProofHeirStorage() private pure returns (ProofHeirStorage storage $) {
        assembly {
            $.slot := PROOFHEIR_STORAGE_LOCATION
        }
    }

    /**
     * @dev Extracts an Ethereum address from 20 consecutive byte-fields in publicInputs.
     * @param publicInputs The array of field elements (each representing 1 byte as a 32-byte field)
     * @param startIndex The starting index of the 20-byte address
     * @return The extracted Ethereum address
     * 
     * @dev The Noir circuit serializes addresses as 20 separate field elements, where each field
     *      contains a single byte value. This function reconstructs the address by combining them.
     */
    function _extractAddress(bytes32[] calldata publicInputs, uint256 startIndex) internal pure returns (address) {
        bytes20 result;
        for (uint256 i = 0; i < 20; i++) {
            result |= bytes20(bytes1(uint8(uint256(publicInputs[startIndex + i])))) >> (i * 8);
        }
        return address(result);
    }

    /**
     * @dev Extracts a bytes32 value from 32 consecutive byte-fields in publicInputs.
     * @param publicInputs The array of field elements (each representing 1 byte as a 32-byte field)
     * @param startIndex The starting index of the 32-byte value
     * @return The extracted bytes32 value
     * 
     * @dev The Noir circuit serializes bytes32 values as 32 separate field elements, where each field
     *      contains a single byte value. This function reconstructs the bytes32 by combining them.
     */
    function _extractBytes32(bytes32[] calldata publicInputs, uint256 startIndex) internal pure returns (bytes32) {
        bytes32 result;
        for (uint256 i = 0; i < 32; i++) {
            result |= bytes32(bytes1(uint8(uint256(publicInputs[startIndex + i])))) >> (i * 8);
        }
        return result;
    }

    /*//////////////////////////////////////////////////////////////
                          RECEIVE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Allows the delegated account to receive native ETH transfers.
     */
    receive() external payable {}

    /**
     * @dev Fallback function to handle calls with data or no matching function.
     */
    fallback() external payable {}
}
