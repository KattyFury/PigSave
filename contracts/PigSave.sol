// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PigSave {

    // ── Reentrancy Guard ──────────────────────────────────
    // Prevents a hacker from calling withdraw() repeatedly
    // before the first call finishes (classic reentrancy attack)
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "Reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ── Storage ───────────────────────────────────────────
    struct UserData {
        uint256 balance;
        uint256 depositCount;
        uint256 lastDepositTime;
        uint256 streak;
        uint256 lastStreakDay;
    }

    mapping(address => UserData) private users;

    // ── Events ────────────────────────────────────────────
    event Deposited(address indexed user, uint256 amount, uint256 depositCount, uint256 streak);
    event Withdrawn(address indexed user, uint256 amount);

    // ── Reject accidental sends (no deposit() call) ───────
    // If someone sends USDC directly to the contract address,
    // it will revert instead of locking funds forever.
    receive() external payable {
        revert("Use deposit()");
    }

    // ── Core Functions ────────────────────────────────────
    function deposit() external payable nonReentrant {
        require(msg.value > 0, "Amount must be > 0");

        UserData storage u = users[msg.sender];
        u.balance += msg.value;
        u.depositCount += 1;

        uint256 today = block.timestamp / 1 days;
        if (u.lastStreakDay == 0) {
            u.streak = 1;
        } else if (today == u.lastStreakDay + 1) {
            u.streak += 1;
        } else if (today > u.lastStreakDay + 1) {
            u.streak = 1;
        }
        // Same day deposit: streak unchanged

        u.lastStreakDay = today;
        u.lastDepositTime = block.timestamp;

        emit Deposited(msg.sender, msg.value, u.depositCount, u.streak);
    }

    function withdraw() external nonReentrant {
        UserData storage u = users[msg.sender];
        uint256 amount = u.balance;
        require(amount > 0, "Nothing to withdraw");

        // Zero out BEFORE sending (Checks-Effects-Interactions pattern)
        u.balance = 0;
        u.depositCount = 0;
        u.lastDepositTime = 0;
        u.streak = 0;
        u.lastStreakDay = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    function getUserData(address addr) external view returns (
        uint256 balance,
        uint256 depositCount,
        uint256 lastDepositTime,
        uint256 streak
    ) {
        UserData storage u = users[addr];
        return (u.balance, u.depositCount, u.lastDepositTime, u.streak);
    }
}
