// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title ReceiptCredentialRegistry
 * @notice Registry for Jiagon receipt credentials minted from verified crypto card payments.
 * @dev MVP attestation registry for BNB Smart Chain testnet. It intentionally avoids ERC721
 *      transfer semantics until the product decides whether receipts should be collectible NFTs.
 * @custom:security-contact security@jiagon.xyz
 */
contract ReceiptCredentialRegistry {
    struct ReceiptCredential {
        address owner;
        bytes32 sourceReceiptHash;
        bytes32 dataHash;
        string storageUri;
        uint8 proofLevel;
        uint64 issuedAt;
        address issuer;
    }

    uint8 public constant PROOF_LEVEL_A = 1;
    uint8 public constant PROOF_LEVEL_B = 2;
    uint8 public constant PROOF_LEVEL_C = 3;
    uint8 public constant PROOF_LEVEL_D = 4;
    uint256 public constant MAX_STORAGE_URI_LENGTH = 512;

    address private s_owner;
    address private s_pendingOwner;
    uint256 private s_nextCredentialId = 1;
    mapping(address minter => bool enabled) private s_minters;
    mapping(bytes32 sourceReceiptHash => uint256 credentialId) private s_credentialIdBySourceReceiptHash;
    mapping(bytes32 dataHash => uint256 credentialId) private s_credentialIdByDataHash;
    mapping(uint256 credentialId => ReceiptCredential credential) private s_credentials;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed pendingOwner);
    event MinterSet(address indexed minter, bool enabled);
    event ReceiptCredentialMinted(
        uint256 indexed credentialId,
        address indexed owner,
        bytes32 indexed sourceReceiptHash,
        bytes32 dataHash,
        string storageUri,
        uint8 proofLevel,
        address issuer
    );

    error ReceiptCredentialRegistry__DuplicateSourceReceipt(bytes32 sourceReceiptHash);
    error ReceiptCredentialRegistry__DuplicateDataHash(bytes32 dataHash);
    error ReceiptCredentialRegistry__InvalidProofLevel(uint8 proofLevel);
    error ReceiptCredentialRegistry__InvalidStorageUri();
    error ReceiptCredentialRegistry__NotMinter(address caller);
    error ReceiptCredentialRegistry__NotOwner(address caller);
    error ReceiptCredentialRegistry__NotPendingOwner(address caller);
    error ReceiptCredentialRegistry__UnknownCredential(uint256 credentialId);
    error ReceiptCredentialRegistry__ZeroAddress();
    error ReceiptCredentialRegistry__ZeroHash();

    modifier onlyOwner() {
        if (msg.sender != s_owner) {
            revert ReceiptCredentialRegistry__NotOwner(msg.sender);
        }
        _;
    }

    modifier onlyMinter() {
        if (!s_minters[msg.sender]) {
            revert ReceiptCredentialRegistry__NotMinter(msg.sender);
        }
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert ReceiptCredentialRegistry__ZeroAddress();
        }

        s_owner = initialOwner;
        s_minters[initialOwner] = true;

        emit OwnershipTransferred(address(0), initialOwner);
        emit MinterSet(initialOwner, true);
    }

    /*//////////////////////////////////////////////////////////////
                  USER-FACING STATE-CHANGING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert ReceiptCredentialRegistry__ZeroAddress();
        }

        s_pendingOwner = newOwner;

        emit OwnershipTransferStarted(s_owner, newOwner);
    }

    function acceptOwnership() external {
        address nextOwner = s_pendingOwner;
        if (msg.sender != nextOwner) {
            revert ReceiptCredentialRegistry__NotPendingOwner(msg.sender);
        }

        address previousOwner = s_owner;
        s_owner = nextOwner;
        s_pendingOwner = address(0);
        s_minters[previousOwner] = false;
        s_minters[nextOwner] = true;

        emit OwnershipTransferred(previousOwner, nextOwner);
        emit MinterSet(previousOwner, false);
        emit MinterSet(nextOwner, true);
    }

    function setMinter(address minter, bool enabled) external onlyOwner {
        if (minter == address(0)) {
            revert ReceiptCredentialRegistry__ZeroAddress();
        }

        s_minters[minter] = enabled;

        emit MinterSet(minter, enabled);
    }

    function mintCredential(
        address receiptOwner,
        bytes32 sourceReceiptHash,
        bytes32 dataHash,
        string calldata storageUri,
        uint8 proofLevel
    ) external onlyMinter returns (uint256 credentialId) {
        _validateMint(receiptOwner, sourceReceiptHash, dataHash, storageUri, proofLevel);

        credentialId = s_nextCredentialId;
        s_nextCredentialId = credentialId + 1;

        s_credentialIdBySourceReceiptHash[sourceReceiptHash] = credentialId;
        s_credentialIdByDataHash[dataHash] = credentialId;
        s_credentials[credentialId] = ReceiptCredential({
            owner: receiptOwner,
            sourceReceiptHash: sourceReceiptHash,
            dataHash: dataHash,
            storageUri: storageUri,
            proofLevel: proofLevel,
            issuedAt: uint64(block.timestamp),
            issuer: msg.sender
        });

        emit ReceiptCredentialMinted(credentialId, receiptOwner, sourceReceiptHash, dataHash, storageUri, proofLevel, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                    USER-FACING READ-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function owner() external view returns (address) {
        return s_owner;
    }

    function pendingOwner() external view returns (address) {
        return s_pendingOwner;
    }

    function isMinter(address account) external view returns (bool) {
        return s_minters[account];
    }

    function nextCredentialId() external view returns (uint256) {
        return s_nextCredentialId;
    }

    function credentialIdBySourceReceiptHash(bytes32 sourceReceiptHash) external view returns (uint256) {
        return s_credentialIdBySourceReceiptHash[sourceReceiptHash];
    }

    function credentialIdByDataHash(bytes32 dataHash) external view returns (uint256) {
        return s_credentialIdByDataHash[dataHash];
    }

    function getCredential(uint256 credentialId) external view returns (ReceiptCredential memory credential) {
        credential = s_credentials[credentialId];
        if (credential.owner == address(0)) {
            revert ReceiptCredentialRegistry__UnknownCredential(credentialId);
        }
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL READ-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _validateMint(
        address receiptOwner,
        bytes32 sourceReceiptHash,
        bytes32 dataHash,
        string calldata storageUri,
        uint8 proofLevel
    ) internal view {
        if (receiptOwner == address(0)) {
            revert ReceiptCredentialRegistry__ZeroAddress();
        }
        if (sourceReceiptHash == bytes32(0) || dataHash == bytes32(0)) {
            revert ReceiptCredentialRegistry__ZeroHash();
        }
        if (s_credentialIdBySourceReceiptHash[sourceReceiptHash] != 0) {
            revert ReceiptCredentialRegistry__DuplicateSourceReceipt(sourceReceiptHash);
        }
        if (s_credentialIdByDataHash[dataHash] != 0) {
            revert ReceiptCredentialRegistry__DuplicateDataHash(dataHash);
        }
        if (proofLevel < PROOF_LEVEL_A || proofLevel > PROOF_LEVEL_D) {
            revert ReceiptCredentialRegistry__InvalidProofLevel(proofLevel);
        }

        uint256 storageUriLength = bytes(storageUri).length;
        if (storageUriLength == 0 || storageUriLength > MAX_STORAGE_URI_LENGTH) {
            revert ReceiptCredentialRegistry__InvalidStorageUri();
        }
    }
}
