// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "../src/Escrow.sol";

contract TestToken {
    string public name = "Test Token";
    string public symbol = "TTK";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor() {
        totalSupply = 10000 ether;
        balanceOf[msg.sender] = totalSupply;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract EscrowTest is Test {
    Escrow public escrow;
    TestToken public token;

    address seller = address(1);
    address buyer = address(2);
    uint256 amount = 1000 ether;
    uint256 timeoutHours = 24;

    function setUp() public {
        token = new TestToken();
        token.transfer(buyer, amount * 2); // Give buyer some tokens for testing
        escrow = new Escrow(seller, buyer, address(token), amount, timeoutHours);
    }

    function test_Setup() public {
        assertEq(escrow.seller(), seller);
        assertEq(escrow.buyer(), buyer);
        assertEq(address(escrow.token()), address(token));
        assertEq(escrow.amount(), amount);
    }

    function test_Fund() public {
        vm.startPrank(buyer);
        token.approve(address(escrow), amount);
        escrow.fund();
        assertEq(uint(Escrow.Status.Funded), uint(escrow.status()));
    }

    function test_Confirm() public {
        vm.startPrank(buyer);
        token.approve(address(escrow), amount);
        escrow.fund();

        vm.stopPrank();
        vm.prank(seller);
        escrow.confirm();

        assertEq(uint(Escrow.Status.Confirmed), uint(escrow.status()));
    }

    function test_WithdrawConfirmed() public {
        vm.startPrank(buyer);
        token.approve(address(escrow), amount);
        escrow.fund();

        vm.stopPrank();
        vm.prank(seller);
        escrow.confirm();

        vm.startPrank(seller);
        escrow.withdraw();
        assertEq(token.balanceOf(seller), amount);
        vm.stopPrank();
    }
}
