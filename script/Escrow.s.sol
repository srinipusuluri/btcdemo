// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Escrow} from "../src/Escrow.sol";

contract EscrowScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Example deployment - adjust parameters as needed
        // new Escrow(seller, buyer, token, amount, timeoutHours);

        vm.stopBroadcast();
    }
}
