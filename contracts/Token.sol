// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    uint256 public constant TOTAL_SUPPLY = 1000000000 * 10**18;
    uint256 public constant TEAM_SUPPLY = 450000000 * 10**18;

    mapping(address => uint256) public lockedUntil;
    mapping(address => uint256) public lockedAmount;

      
    uint256 public maxMintPerWallet = 1000;         
    mapping(address => uint256) public mintedAmount;
    mapping(address => bool) public whitelist;


    constructor(
        address initialOwner,
        string memory name,
        string memory symbol
    )
        ERC20(name, symbol)
        Ownable(initialOwner)
        ERC20Permit(name)
    {
        _mint(initialOwner, TEAM_SUPPLY);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= TOTAL_SUPPLY, "Cannot exceed total supply");
        _mint(to, amount);
    }

    function lock(address account, uint256 amount, uint256 lockDuration) public onlyOwner {
        require(amount <= balanceOf(account), "Lock amount exceeds balance");
        lockedAmount[account] = amount;
        lockedUntil[account] = block.timestamp + lockDuration;
    }

    function lockUntil(address account, uint256 amount, uint256 unlockTime) public onlyOwner {
        require(amount <= balanceOf(account), "Lock amount exceeds balance");
        require(unlockTime > block.timestamp, "Unlock time must be in the future");
        lockedAmount[account] = amount;
        lockedUntil[account] = unlockTime;
    }

    function _update(address from, address to, uint256 amount) internal virtual override {
        if (from != address(0)) {
            uint256 lockedTime = lockedUntil[from];
            uint256 locked = lockedAmount[from];
            require(
                block.timestamp >= lockedTime || 
                balanceOf(from) - amount >= locked,
                "Token is locked"
            );
        }
        super._update(from, to, amount);
    }

    function setMintedAmount(address account, uint256 amount) public onlyOwner {
        mintedAmount[account] = amount;
    }

    function resetAllMintedAmounts(address[] calldata accounts) public onlyOwner {
        for(uint i = 0; i < accounts.length; i++) {
            mintedAmount[accounts[i]] = 0;
        }
    }

    function setWhitelist(address[] calldata addresses, bool status) public onlyOwner {
        for(uint i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = status;
        }
    }

    function whitelistMint(uint256 amount) public payable {
        require(totalSupply() + amount <= TOTAL_SUPPLY, "Cannot exceed total supply");
        require(whitelist[msg.sender], "Not whitelisted");
        require(mintedAmount[msg.sender] + amount <= maxMintPerWallet, "Exceeds max mint per wallet");
        
        mintedAmount[msg.sender] += amount;
        _mint(msg.sender, amount);
    }
}
