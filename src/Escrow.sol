// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Escrow is Ownable {
    using SafeERC20 for IERC20;

    address public immutable seller;
    address public immutable buyer;
    IERC20 public immutable token;
    uint256 public immutable amount;
    uint256 public immutable timeout; // Block timestamp after which buyer can get funds back

    enum Status { Pending, Funded, Confirmed, Cancelled, TimedOut }
    Status public status;

    event Funded(address funder, uint256 amount);
    event ConfirmedBySeller();
    event CancelledBySeller();
    event CancelledByBuyer();
    event Withdrawal(address to, uint256 amount);
    event TimedOut(address receiver, uint256 amount);

    modifier onlyBuyer() {
        require(msg.sender == buyer, "Only buyer");
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, "Only seller");
        _;
    }

    modifier inStatus(Status _status) {
        require(status == _status, "Invalid status");
        _;
    }

    constructor(
        address _seller,
        address _buyer,
        address _token,
        uint256 _amount,
        uint256 _timeoutHours
    ) Ownable(msg.sender) {
        require(_seller != address(0), "Invalid seller");
        require(_buyer != address(0), "Invalid buyer");
        require(_token != address(0), "Invalid token");
        require(_amount > 0, "Invalid amount");

        seller = _seller;
        buyer = _buyer;
        token = IERC20(_token);
        amount = _amount;
        timeout = block.timestamp + (_timeoutHours * 1 hours);
        status = Status.Pending;
    }

    function fund() external onlyBuyer inStatus(Status.Pending) {
        token.safeTransferFrom(msg.sender, address(this), amount);
        status = Status.Funded;
        emit Funded(msg.sender, amount);
    }

    function confirm() external onlySeller inStatus(Status.Funded) {
        status = Status.Confirmed;
        emit ConfirmedBySeller();
    }

    function cancel() external onlySeller inStatus(Status.Funded) {
        status = Status.Cancelled;
        emit CancelledBySeller();
    }

    function cancelByBuyer() external onlyBuyer inStatus(Status.Funded) {
        require(block.timestamp >= timeout, "Timeout not reached");
        status = Status.TimedOut;
        emit CancelledByBuyer();
    }

    function withdraw() external inStatus(Status.Confirmed) {
        address receiver = (msg.sender == seller) ? seller : buyer;
        require(receiver == msg.sender, "Invalid withdrawer");
        status = Status.Confirmed;
        token.safeTransfer(receiver, amount);
        emit Withdrawal(receiver, amount);
    }

    function withdrawCancelled() external inStatus(Status.Cancelled) {
        require(msg.sender == buyer, "Only buyer can withdraw cancelled");
        status = Status.Cancelled;
        token.safeTransfer(buyer, amount);
        emit Withdrawal(buyer, amount);
    }

    function withdrawTimedOut() external inStatus(Status.TimedOut) {
        status = Status.TimedOut;
        token.safeTransfer(buyer, amount);
        emit TimedOut(buyer, amount);
    }
}
