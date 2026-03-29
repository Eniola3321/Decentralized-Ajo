// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Ajo {
    address public admin;
    uint256 public contributionAmount;
    uint32 public currentCycle;
    uint32 public maxMembers;

    address[] public members;

    constructor(uint256 _amount, uint32 _maxMembers) {
        admin = msg.sender;
        contributionAmount = _amount;
        maxMembers = _maxMembers;
        currentCycle = 1;
    }
}
