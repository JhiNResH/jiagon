// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReceiptCredentialRegistry} from "contracts/ReceiptCredentialRegistry.sol";

interface Vm {
    function prank(address msgSender) external;
    function expectRevert(bytes calldata revertData) external;
}

contract ReceiptCredentialRegistryTest {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant OWNER = address(0xA11CE);
    address private constant MINTER = address(0xB0B);
    address private constant USER = address(0xCAFE);
    bytes32 private constant SOURCE_RECEIPT_HASH = bytes32(uint256(0x61b4));
    bytes32 private constant DATA_HASH = keccak256("greenfield object");
    string private constant STORAGE_URI = "greenfield-testnet://jiagon/receipts/bnb-testnet-1.json";
    uint8 private constant PROOF_B = 2;

    ReceiptCredentialRegistry private s_registry;

    error AssertionFailed();
    error ReceiptCredentialRegistry__NotPendingOwner(address caller);

    function setUp() external {
        s_registry = new ReceiptCredentialRegistry(OWNER);
        VM.prank(OWNER);
        s_registry.setMinter(MINTER, true);
    }

    function testConstructorSetsOwnerAndInitialMinter() external {
        ReceiptCredentialRegistry registry = new ReceiptCredentialRegistry(OWNER);

        _assertEq(registry.owner(), OWNER);
        _assertTrue(registry.isMinter(OWNER));
        _assertEq(registry.nextCredentialId(), 1);
    }

    function testOwnerCanSetMinter() external {
        address newMinter = address(0xD00D);

        VM.prank(OWNER);
        s_registry.setMinter(newMinter, true);

        _assertTrue(s_registry.isMinter(newMinter));
    }

    function testNonOwnerCannotSetMinter() external {
        VM.prank(USER);
        VM.expectRevert(abi.encodeWithSelector(ReceiptCredentialRegistry.ReceiptCredentialRegistry__NotOwner.selector, USER));
        s_registry.setMinter(USER, true);
    }

    function testTransferOwnershipSetsNewOwnerAsMinter() external {
        address newOwner = address(0xDAD);

        VM.prank(OWNER);
        s_registry.transferOwnership(newOwner);

        _assertEq(s_registry.owner(), OWNER);
        _assertEq(s_registry.pendingOwner(), newOwner);
        _assertTrue(!s_registry.isMinter(newOwner));

        VM.prank(newOwner);
        s_registry.acceptOwnership();

        _assertEq(s_registry.owner(), newOwner);
        _assertEq(s_registry.pendingOwner(), address(0));
        _assertTrue(s_registry.isMinter(newOwner));
        _assertTrue(!s_registry.isMinter(OWNER));
    }

    function testOnlyPendingOwnerCanAcceptOwnership() external {
        address newOwner = address(0xDAD);

        VM.prank(OWNER);
        s_registry.transferOwnership(newOwner);

        VM.prank(USER);
        VM.expectRevert(abi.encodeWithSelector(ReceiptCredentialRegistry__NotPendingOwner.selector, USER));
        s_registry.acceptOwnership();
    }

    function testPreviousOwnerCannotMintAfterOwnershipTransfer() external {
        address newOwner = address(0xDAD);

        VM.prank(OWNER);
        s_registry.transferOwnership(newOwner);

        VM.prank(newOwner);
        s_registry.acceptOwnership();

        VM.prank(OWNER);
        VM.expectRevert(abi.encodeWithSelector(ReceiptCredentialRegistry.ReceiptCredentialRegistry__NotMinter.selector, OWNER));
        s_registry.mintCredential(USER, SOURCE_RECEIPT_HASH, DATA_HASH, STORAGE_URI, PROOF_B);
    }

    function testMinterCanMintCredential() external {
        uint256 credentialId = _mintDefault();

        _assertEq(credentialId, 1);
        _assertEq(s_registry.nextCredentialId(), 2);
        _assertEq(s_registry.credentialIdBySourceReceiptHash(SOURCE_RECEIPT_HASH), credentialId);
        _assertEq(s_registry.credentialIdByDataHash(DATA_HASH), credentialId);

        ReceiptCredentialRegistry.ReceiptCredential memory credential = s_registry.getCredential(credentialId);
        _assertEq(credential.owner, USER);
        _assertEq(credential.sourceReceiptHash, SOURCE_RECEIPT_HASH);
        _assertEq(credential.dataHash, DATA_HASH);
        _assertEq(credential.storageUri, STORAGE_URI);
        _assertEq(credential.proofLevel, PROOF_B);
        _assertEq(credential.issuer, MINTER);
    }

    function testNonMinterCannotMintCredential() external {
        VM.prank(USER);
        VM.expectRevert(abi.encodeWithSelector(ReceiptCredentialRegistry.ReceiptCredentialRegistry__NotMinter.selector, USER));
        s_registry.mintCredential(USER, SOURCE_RECEIPT_HASH, DATA_HASH, STORAGE_URI, PROOF_B);
    }

    function testCannotMintDuplicateSourceReceipt() external {
        _mintDefault();

        VM.prank(MINTER);
        VM.expectRevert(
            abi.encodeWithSelector(
                ReceiptCredentialRegistry.ReceiptCredentialRegistry__DuplicateSourceReceipt.selector, SOURCE_RECEIPT_HASH
            )
        );
        s_registry.mintCredential(USER, SOURCE_RECEIPT_HASH, keccak256("new data"), STORAGE_URI, PROOF_B);
    }

    function testCannotMintDuplicateDataHash() external {
        _mintDefault();

        bytes32 secondSourceReceiptHash = keccak256("new source receipt");
        VM.prank(MINTER);
        VM.expectRevert(
            abi.encodeWithSelector(ReceiptCredentialRegistry.ReceiptCredentialRegistry__DuplicateDataHash.selector, DATA_HASH)
        );
        s_registry.mintCredential(USER, secondSourceReceiptHash, DATA_HASH, STORAGE_URI, PROOF_B);
    }

    function testCannotReadUnknownCredential() external {
        VM.expectRevert(abi.encodeWithSelector(ReceiptCredentialRegistry.ReceiptCredentialRegistry__UnknownCredential.selector, 99));
        s_registry.getCredential(99);
    }

    function testFuzz_MinterCanMintValidCredential(
        address receiptOwner,
        bytes32 sourceReceiptHash,
        bytes32 dataHash,
        uint8 proofLevelSeed
    ) external {
        if (receiptOwner == address(0) || sourceReceiptHash == bytes32(0) || dataHash == bytes32(0)) {
            return;
        }

        uint8 proofLevel = uint8((proofLevelSeed % 4) + 1);
        VM.prank(MINTER);
        uint256 credentialId = s_registry.mintCredential(receiptOwner, sourceReceiptHash, dataHash, STORAGE_URI, proofLevel);

        ReceiptCredentialRegistry.ReceiptCredential memory credential = s_registry.getCredential(credentialId);
        _assertEq(credential.owner, receiptOwner);
        _assertEq(credential.sourceReceiptHash, sourceReceiptHash);
        _assertEq(credential.dataHash, dataHash);
        _assertEq(credential.proofLevel, proofLevel);
        _assertEq(s_registry.credentialIdBySourceReceiptHash(sourceReceiptHash), credentialId);
        _assertEq(s_registry.credentialIdByDataHash(dataHash), credentialId);
    }

    function testFuzz_DuplicateSourceReceiptAlwaysReverts(bytes32 sourceReceiptHash, bytes32 firstDataHash, bytes32 secondDataHash)
        external
    {
        if (sourceReceiptHash == bytes32(0) || firstDataHash == bytes32(0) || secondDataHash == bytes32(0)) {
            return;
        }

        VM.prank(MINTER);
        s_registry.mintCredential(USER, sourceReceiptHash, firstDataHash, STORAGE_URI, PROOF_B);

        VM.prank(MINTER);
        VM.expectRevert(
            abi.encodeWithSelector(ReceiptCredentialRegistry.ReceiptCredentialRegistry__DuplicateSourceReceipt.selector, sourceReceiptHash)
        );
        s_registry.mintCredential(USER, sourceReceiptHash, secondDataHash, STORAGE_URI, PROOF_B);
    }

    function testFuzz_DuplicateDataHashAlwaysReverts(bytes32 firstSourceReceiptHash, bytes32 secondSourceReceiptHash, bytes32 dataHash)
        external
    {
        if (
            firstSourceReceiptHash == bytes32(0) || secondSourceReceiptHash == bytes32(0) || dataHash == bytes32(0)
                || firstSourceReceiptHash == secondSourceReceiptHash
        ) {
            return;
        }

        VM.prank(MINTER);
        s_registry.mintCredential(USER, firstSourceReceiptHash, dataHash, STORAGE_URI, PROOF_B);

        VM.prank(MINTER);
        VM.expectRevert(
            abi.encodeWithSelector(ReceiptCredentialRegistry.ReceiptCredentialRegistry__DuplicateDataHash.selector, dataHash)
        );
        s_registry.mintCredential(USER, secondSourceReceiptHash, dataHash, STORAGE_URI, PROOF_B);
    }

    function _mintDefault() internal returns (uint256 credentialId) {
        VM.prank(MINTER);
        credentialId =
            s_registry.mintCredential(USER, SOURCE_RECEIPT_HASH, DATA_HASH, STORAGE_URI, PROOF_B);
    }

    function _assertTrue(bool value) internal pure {
        if (!value) revert AssertionFailed();
    }

    function _assertEq(address actual, address expected) internal pure {
        if (actual != expected) revert AssertionFailed();
    }

    function _assertEq(uint256 actual, uint256 expected) internal pure {
        if (actual != expected) revert AssertionFailed();
    }

    function _assertEq(bytes32 actual, bytes32 expected) internal pure {
        if (actual != expected) revert AssertionFailed();
    }

    function _assertEq(string memory actual, string memory expected) internal pure {
        if (keccak256(bytes(actual)) != keccak256(bytes(expected))) revert AssertionFailed();
    }
}
