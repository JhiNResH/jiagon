// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReceiptCredentialRegistry} from "contracts/ReceiptCredentialRegistry.sol";
import {
    DeployReceiptCredentialRegistry,
    DeployReceiptCredentialRegistry__WrongChain
} from "script/DeployReceiptCredentialRegistry.s.sol";

interface DeployScriptVm {
    function chainId(uint256 newChainId) external;
    function expectRevert(bytes calldata revertData) external;
}

contract DeployReceiptCredentialRegistryHarness is DeployReceiptCredentialRegistry {
    function deployForTest(address admin) external returns (ReceiptCredentialRegistry registry) {
        _assertBnbTestnet();
        registry = _deploy(admin);
    }
}

contract DeployReceiptCredentialRegistryTest {
    DeployScriptVm private constant VM = DeployScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant ADMIN = 0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9;

    error AssertionFailed();

    function testDeployForTestUsesAdminAsOwnerAndMinter() external {
        VM.chainId(97);
        DeployReceiptCredentialRegistryHarness deployer = new DeployReceiptCredentialRegistryHarness();

        ReceiptCredentialRegistry registry = deployer.deployForTest(ADMIN);

        _assertEq(registry.owner(), ADMIN);
        _assertTrue(registry.isMinter(ADMIN));
    }

    function testDeployForTestRevertsOffBnbTestnet() external {
        VM.chainId(1);
        DeployReceiptCredentialRegistryHarness deployer = new DeployReceiptCredentialRegistryHarness();

        VM.expectRevert(abi.encodeWithSelector(DeployReceiptCredentialRegistry__WrongChain.selector, 1));
        deployer.deployForTest(ADMIN);
    }

    function _assertTrue(bool value) internal pure {
        if (!value) revert AssertionFailed();
    }

    function _assertEq(address actual, address expected) internal pure {
        if (actual != expected) revert AssertionFailed();
    }
}
