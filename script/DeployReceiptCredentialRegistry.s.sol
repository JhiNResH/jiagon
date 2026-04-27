// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26 <0.9.0;

import {ReceiptCredentialRegistry} from "contracts/ReceiptCredentialRegistry.sol";

error DeployReceiptCredentialRegistry__WrongChain(uint256 actualChainId);

interface Vm {
    function envAddress(string calldata name) external returns (address value);
    function startBroadcast() external;
    function stopBroadcast() external;
}

/**
 * @notice Deploys the Jiagon receipt credential registry with an explicit admin owner.
 * @dev The deployer key pays gas. BNB_TESTNET_ADMIN becomes owner and initial minter.
 */
contract DeployReceiptCredentialRegistry {
    uint256 private constant BNB_TESTNET_CHAIN_ID = 97;
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (ReceiptCredentialRegistry registry) {
        _assertBnbTestnet();

        address admin = vm.envAddress("BNB_TESTNET_ADMIN");

        vm.startBroadcast();
        registry = _deploy(admin);
        vm.stopBroadcast();
    }

    function _deploy(address admin) internal returns (ReceiptCredentialRegistry registry) {
        registry = new ReceiptCredentialRegistry(admin);
    }

    function _assertBnbTestnet() internal view {
        if (block.chainid != BNB_TESTNET_CHAIN_ID) {
            revert DeployReceiptCredentialRegistry__WrongChain(block.chainid);
        }
    }
}
