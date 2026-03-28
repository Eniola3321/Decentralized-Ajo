// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Ajo
 * @dev Foundational Ajo pool contract.
 *
 * Security hardening applied:
 *  - Inherits OpenZeppelin ReentrancyGuard; all ETH-sending functions carry
 *    the `nonReentrant` modifier.
 *  - Follows Checks-Effects-Interactions (CEI) throughout: every state write
 *    is committed before any external call or ETH transfer.
 *  - `withdraw()` zeroes the caller's balance (effect) before transferring
 *    ETH (interaction), preventing reentrancy-based double-withdrawal.
 *  - `deposit()` validates input, updates state, then emits — no external
 *    calls, so no reentrancy surface.
 *  - Member registration is owner-gated to prevent arbitrary address injection.
 */
contract Ajo is Ownable, ReentrancyGuard {
    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Required contribution per cycle (in wei)
    uint256 public contributionAmount;

    /// @notice Duration of each cycle in seconds
    uint256 public cycleDuration;

    /// @notice Maximum number of members allowed
    uint256 public maxMembers;

    /// @notice Ordered member list (index → address)
    mapping(uint256 => address) public members;
    uint256 public membersCount;

    /// @notice Per-member balance tracked inside the contract
    mapping(address => uint256) public balances;

    /// @notice Running total of all pooled funds
    uint256 public totalPool;

    /// @notice Timestamp of each member's last deposit
    mapping(address => uint256) public lastDepositAt;

    /// @notice Whether an address is a registered member
    mapping(address => bool) public isMember;

    // ─── Events ───────────────────────────────────────────────────────────────

    event MemberAdded(address indexed member, uint256 memberIndex);
    event DepositMade(address indexed member, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed member, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotMember();
    error PoolFull();
    error IncorrectAmount();
    error NothingToWithdraw();
    error TransferFailed();

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct MemberInfo {
        address addr;
        bool hasContributed;
        uint256 totalContributed;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _contributionAmount Wei required per contribution
     * @param _cycleDuration      Seconds per cycle
     * @param _maxMembers         Maximum pool capacity
     */
    constructor(
        uint256 _contributionAmount,
        uint256 _cycleDuration,
        uint256 _maxMembers
    ) Ownable(msg.sender) {
        require(_contributionAmount > 0, "Ajo: contribution must be > 0");
        require(_cycleDuration > 0,      "Ajo: cycle duration must be > 0");
        require(_maxMembers > 0,         "Ajo: max members must be > 0");

        contributionAmount = _contributionAmount;
        cycleDuration      = _cycleDuration;
        maxMembers         = _maxMembers;
    }

    // ─── Member Management ────────────────────────────────────────────────────

    /**
     * @notice Register a new member. Owner-only.
     * @dev    Prevents arbitrary addresses from depositing or withdrawing.
     */
    function addMember(address _member) external onlyOwner {
        if (isMember[_member])          revert("Ajo: already a member");
        if (membersCount >= maxMembers) revert PoolFull();

        // EFFECTS before any external interaction
        isMember[_member]          = true;
        members[membersCount]      = _member;
        membersCount++;

        emit MemberAdded(_member, membersCount - 1);
    }

    // ─── Deposit ──────────────────────────────────────────────────────────────

    /**
     * @notice Deposit exactly `contributionAmount` wei into the pool.
     *
     * CEI order:
     *   Checks  — msg.value == contributionAmount, caller is member
     *   Effects — update balances, totalPool, lastDepositAt
     *   Interactions — emit event (no external call)
     */
    function deposit() external payable nonReentrant {
        // ── CHECKS ──────────────────────────────────────────────────────────
        if (!isMember[msg.sender])              revert NotMember();
        if (msg.value != contributionAmount)    revert IncorrectAmount();

        // ── EFFECTS ─────────────────────────────────────────────────────────
        lastDepositAt[msg.sender]  = block.timestamp;
        balances[msg.sender]      += msg.value;
        totalPool                 += msg.value;

        // ── INTERACTIONS (event only — no external call) ─────────────────────
        emit DepositMade(msg.sender, msg.value, block.timestamp);
    }

    // ─── Withdraw ─────────────────────────────────────────────────────────────

    /**
     * @notice Withdraw the caller's entire balance from the pool.
     *
     * CEI order:
     *   Checks  — caller is member, balance > 0
     *   Effects — zero balance and totalPool BEFORE the ETH transfer
     *   Interactions — low-level `.call` to transfer ETH
     *
     * The `nonReentrant` modifier provides a second layer of defence: even if
     * a malicious contract re-enters `withdraw()` during the `.call`, the
     * mutex will revert the nested call before any state is read again.
     */
    function withdraw() external nonReentrant {
        // ── CHECKS ──────────────────────────────────────────────────────────
        if (!isMember[msg.sender])      revert NotMember();
        uint256 amount = balances[msg.sender];
        if (amount == 0)                revert NothingToWithdraw();

        // ── EFFECTS ─────────────────────────────────────────────────────────
        balances[msg.sender]  = 0;
        totalPool            -= amount;

        // ── INTERACTIONS ────────────────────────────────────────────────────
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawal(msg.sender, amount);
    }

    // ─── View Helpers ─────────────────────────────────────────────────────────

    /// @notice Returns the contract's current ETH balance.
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
