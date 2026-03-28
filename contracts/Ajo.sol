// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title Ajo - Decentralized Rotating Savings and Credit Association
/// @notice Secure ETH-based savings circle with member validation
contract Ajo is ReentrancyGuard {
    // ═══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════

    address public admin;
    uint256 public contributionAmount;
    uint256 public cycleDuration;
    uint32 public maxMembers;
    address[] public members;

    mapping(address => uint256) public balances;
    mapping(address => bool) public isMember;
    mapping(address => uint256) public lastContributionCycle;
    uint256 public totalPool;
    uint256 public currentCycle;

    bool private initialized;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event AjoCreated(address indexed admin, uint256 contributionAmount, uint32 maxMembers);
    event DepositMade(address indexed member, uint256 amount, uint256 cycle);
    event Withdrawal(address indexed member, uint256 amount);
    event MemberAdded(address indexed member, uint256 memberCount);

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    error InvalidContribution();
    error AjoIsFull();
    error InitializationFailed();
    error NotMember();
    error NothingToWithdraw();
    error TransferFailed();
    error AlreadyMember();
    error InvalidAmount();
    error AlreadyContributedThisCycle();

    // ═══════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        require(msg.sender == admin, "Ajo: Only admin");
        _;
    }

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════

    function initialize(
        address _admin,
        uint256 _contributionAmount,
        uint256 _cycleDuration,
        uint32 _maxMembers
    ) external {
        if (initialized) revert InitializationFailed();
        require(_admin != address(0), "Ajo: Invalid admin");
        require(_contributionAmount > 0, "Ajo: Invalid contribution amount");
        require(_cycleDuration > 0, "Ajo: Invalid cycle duration");
        require(_maxMembers > 1, "Ajo: Need at least 2 members");

        admin = _admin;
        contributionAmount = _contributionAmount;
        cycleDuration = _cycleDuration;
        maxMembers = _maxMembers;
        currentCycle = 1;
        initialized = true;

        // Admin becomes first member
        _addMember(_admin);

        emit AjoCreated(_admin, _contributionAmount, _maxMembers);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MEMBER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Add a new member to the Ajo circle
    /// @param _member Address to add as a member
    function addMember(address _member) external onlyAdmin {
        if (isMember[_member]) revert AlreadyMember();
        if (members.length >= maxMembers) revert AjoIsFull();
        _addMember(_member);
    }

    function _addMember(address _member) internal {
        members.push(_member);
        isMember[_member] = true;
        emit MemberAdded(_member, members.length);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DEPOSIT - Secure ETH contribution with constructor rule validation
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Deposit ETH into the Ajo circle
    /// @dev Validates against constructor rules:
    ///      1. Exact contribution amount required (from initialization)
    ///      2. Member must be registered (isMember mapping)
    ///      3. Ajo cannot exceed maxMembers
    ///      4. One contribution per cycle per member
    ///      Security: Uses nonReentrant to prevent reentrancy attacks
    function deposit() external payable onlyMember nonReentrant {
        // ── CHECKS: Validate against constructor rules ────────────────────────────
        
        // Rule 1: Exact contribution amount required (from constructor)
        if (msg.value != contributionAmount) revert InvalidContribution();
        
        // Rule 2: Ajo capacity check (though members can't deposit if not added)
        if (members.length > maxMembers) revert AjoIsFull();
        
        // Rule 3: Prevent double contribution in same cycle
        if (lastContributionCycle[msg.sender] == currentCycle) {
            revert AlreadyContributedThisCycle();
        }

        // ── EFFECTS: Update state before any external interactions ─────────────────
        
        balances[msg.sender] += msg.value;
        totalPool += msg.value;
        lastContributionCycle[msg.sender] = currentCycle;

        emit DepositMade(msg.sender, msg.value, currentCycle);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WITHDRAW - Secure ETH withdrawal with CEI pattern
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Withdraw the caller's entire balance from the pool.
    ///
    /// CEI order:
    ///   Checks  — caller is member, balance > 0
    ///   Effects — zero balance and totalPool BEFORE the ETH transfer
    ///   Interactions — low-level `.call` to transfer ETH
    ///
    /// The `nonReentrant` modifier provides a second layer of defence: even if
    /// a malicious contract re-enters `withdraw()` during the `.call`, the
    /// mutex will revert the nested call before any state is read again.
    function withdraw() external onlyMember nonReentrant {
        // ── CHECKS ──────────────────────────────────────────────────────────
        uint256 amount = balances[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        // ── EFFECTS ─────────────────────────────────────────────────────────
        balances[msg.sender] = 0;
        totalPool -= amount;

        // ── INTERACTIONS ────────────────────────────────────────────────────
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawal(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Returns the contract's current ETH balance.
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Get all member addresses
    function getMembers() external view returns (address[] memory) {
        return members;
    }

    /// @notice Get member count
    function memberCount() external view returns (uint256) {
        return members.length;
    }
}
