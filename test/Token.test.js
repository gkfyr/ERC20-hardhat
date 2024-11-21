const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Token", function () {
  let token;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  const TOTAL_SUPPLY = ethers.parseEther("1000000000");
  const TEAM_SUPPLY = ethers.parseEther("450000000");
  const MINT_PRICE = ethers.parseEther("0.1");
  const TOKEN_NAME = "Test Token";
  const TOKEN_SYMBOL = "TEST";

  beforeEach(async function () {
    // Get accounts for contract deployment
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy contract with custom name and symbol
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy(owner.address, TOKEN_NAME, TOKEN_SYMBOL);
  });

  describe("Basic Token Settings", function () {
    it("Should set the correct token name and symbol", async function () {
      expect(await token.name()).to.equal(TOKEN_NAME);
      expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("Should set the correct initial team supply", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(TEAM_SUPPLY);
    });

    it("Should set the correct total supply", async function () {
      expect(await token.TOTAL_SUPPLY()).to.equal(TOTAL_SUPPLY);
    });
  });

  describe("Lock-up Functionality", function () {
    it("Owner should be able to lock tokens", async function () {
      const lockAmount = ethers.parseEther("1000");
      const duration = 3600;

      await token.transfer(addr1.address, lockAmount);
      await token.lock(addr1.address, lockAmount, duration);

      await expect(token.connect(addr1).transfer(addr2.address, lockAmount)).to.be.revertedWith("Token is locked");
    });

    it("Should allow transfer after lock period ends", async function () {
      const lockAmount = ethers.parseEther("1000");
      const duration = 3600;

      await token.transfer(addr1.address, lockAmount);
      await token.lock(addr1.address, lockAmount, duration);

      await time.increase(3601);

      await expect(token.connect(addr1).transfer(addr2.address, lockAmount)).to.not.be.reverted;
    });

    it("Should lock tokens until specific timestamp", async function () {
      const lockAmount = ethers.parseEther("1000");
      const currentTime = await time.latest();
      const unlockTime = currentTime + 3600;

      await token.transfer(addr1.address, lockAmount);
      await token.lockUntil(addr1.address, lockAmount, unlockTime);

      // 전송 시도 시 실패해야 함
      await expect(token.connect(addr1).transfer(addr2.address, lockAmount)).to.be.revertedWith("Token is locked");
    });

    it("Should reject lock with past timestamp", async function () {
      const lockAmount = ethers.parseEther("1000");
      const currentTime = await time.latest();
      const pastTime = currentTime - 3600;

      await token.transfer(addr1.address, lockAmount);

      await expect(token.lockUntil(addr1.address, lockAmount, pastTime)).to.be.revertedWith(
        "Unlock time must be in the future"
      );
    });

    it("Should allow partial transfers when partially locked", async function () {
      const totalAmount = ethers.parseEther("1000");
      const lockAmount = ethers.parseEther("600");
      const transferAmount = ethers.parseEther("300");
      const currentTime = await time.latest();
      const unlockTime = currentTime + 3600;

      // 1000 토큰을 addr1에게 전송
      await token.transfer(addr1.address, totalAmount);
      // 600 토큰을 락업
      await token.lockUntil(addr1.address, lockAmount, unlockTime);

      // 300 토큰은 전송 가능해야 함 (1000 - 600 = 400 > 300)
      await expect(token.connect(addr1).transfer(addr2.address, transferAmount)).to.not.be.reverted;

      // 잔액 확인
      expect(await token.balanceOf(addr1.address)).to.equal(totalAmount - transferAmount);
    });

    it("Should update lock amount and time correctly", async function () {
      const lockAmount = ethers.parseEther("1000");
      const newLockAmount = ethers.parseEther("500");
      const currentTime = await time.latest();
      const unlockTime = currentTime + 3600;
      const newUnlockTime = currentTime + 7200;

      await token.transfer(addr1.address, lockAmount);

      // 첫 번째 락업
      await token.lockUntil(addr1.address, lockAmount, unlockTime);
      expect(await token.lockedAmount(addr1.address)).to.equal(lockAmount);
      expect(await token.lockedUntil(addr1.address)).to.equal(unlockTime);

      // 락업 조건 변경
      await token.lockUntil(addr1.address, newLockAmount, newUnlockTime);
      expect(await token.lockedAmount(addr1.address)).to.equal(newLockAmount);
      expect(await token.lockedUntil(addr1.address)).to.equal(newUnlockTime);
    });

    it("Should allow transfer after specific unlock time", async function () {
      const lockAmount = ethers.parseEther("1000");
      const currentTime = await time.latest();
      const unlockTime = currentTime + 3600;

      await token.transfer(addr1.address, lockAmount);
      await token.lockUntil(addr1.address, lockAmount, unlockTime);

      // 시간을 unlock time 이후로 이동
      await time.increaseTo(unlockTime + 1);

      // 이제 전송이 가능해야 함
      await expect(token.connect(addr1).transfer(addr2.address, lockAmount)).to.not.be.reverted;
    });
  });

  describe("Whitelist Minting", function () {
    beforeEach(async function () {
      await token.setWhitelist([addr1.address], true);
    });

    it("Only whitelisted addresses should be able to mint", async function () {
      const mintAmount = 100;
      const mintValue = MINT_PRICE * BigInt(mintAmount);

      await expect(token.connect(addr1).whitelistMint(mintAmount, { value: mintValue })).to.not.be.reverted;

      await expect(token.connect(addr2).whitelistMint(mintAmount, { value: mintValue })).to.be.revertedWith(
        "Not whitelisted"
      );
    });

    it("Should not exceed maximum minting amount", async function () {
      const maxMint = await token.maxMintPerWallet();
      const exceedAmount = maxMint + 1n;
      const mintValue = MINT_PRICE * exceedAmount;

      await expect(token.connect(addr1).whitelistMint(exceedAmount, { value: mintValue })).to.be.revertedWith(
        "Exceeds max mint per wallet"
      );
    });
  });

  describe("Owner Functions", function () {
    it("Only owner should be able to mint", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(token.connect(addr1).mint(addr1.address, mintAmount)).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );

      await expect(token.mint(addr1.address, mintAmount)).to.not.be.reverted;
    });

    it("Should not mint more than total supply", async function () {
      const remainingSupply = TOTAL_SUPPLY - TEAM_SUPPLY;
      await expect(token.mint(addr1.address, remainingSupply + 1n)).to.be.revertedWith("Cannot exceed total supply");
    });
  });

  describe("Minted Amount Management", function () {
    beforeEach(async function () {
      // Set up whitelist and mint some tokens
      await token.setWhitelist([addr1.address, addr2.address], true);
      const mintAmount = 500;
      const mintValue = MINT_PRICE * BigInt(mintAmount);
      await token.connect(addr1).whitelistMint(mintAmount, { value: mintValue });
      await token.connect(addr2).whitelistMint(mintAmount, { value: mintValue });
    });

    it("Should set minted amount for single address", async function () {
      // Check initial minted amount
      expect(await token.mintedAmount(addr1.address)).to.equal(500);

      // Set minted amount for addr1 to zero
      await token.setMintedAmount(addr1.address, 0);

      // Verify reset
      expect(await token.mintedAmount(addr1.address)).to.equal(0);
      // Verify other address not affected
      expect(await token.mintedAmount(addr2.address)).to.equal(500);
    });

    it("Should be able to set custom minted amount", async function () {
      // Set custom minted amount
      const customAmount = 750;
      await token.setMintedAmount(addr1.address, customAmount);

      // Verify the new amount
      expect(await token.mintedAmount(addr1.address)).to.equal(customAmount);
    });

    it("Should reset minted amounts for multiple addresses", async function () {
      // Check initial minted amounts
      expect(await token.mintedAmount(addr1.address)).to.equal(500);
      expect(await token.mintedAmount(addr2.address)).to.equal(500);

      // Reset minted amounts for both addresses
      await token.resetAllMintedAmounts([addr1.address, addr2.address]);

      // Verify both addresses reset
      expect(await token.mintedAmount(addr1.address)).to.equal(0);
      expect(await token.mintedAmount(addr2.address)).to.equal(0);
    });

    it("Should allow minting again after setting amount to zero", async function () {
      // Set minted amount to zero
      await token.setMintedAmount(addr1.address, 0);

      // Try minting again
      const mintAmount = 500;
      const mintValue = MINT_PRICE * BigInt(mintAmount);
      await expect(token.connect(addr1).whitelistMint(mintAmount, { value: mintValue })).to.not.be.reverted;

      // Verify new minted amount
      expect(await token.mintedAmount(addr1.address)).to.equal(500);
    });

    it("Only owner should be able to manage minted amounts", async function () {
      // Try setting amount with non-owner account
      await expect(token.connect(addr1).setMintedAmount(addr2.address, 0)).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );

      await expect(token.connect(addr1).resetAllMintedAmounts([addr2.address])).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should handle empty array for resetAllMintedAmounts", async function () {
      // Should not revert with empty array
      await expect(token.resetAllMintedAmounts([])).to.not.be.reverted;
    });

    it("Should reset minted amounts for partial list of addresses", async function () {
      // Reset only addr1's minted amount
      await token.resetAllMintedAmounts([addr1.address]);

      // Verify addr1 reset but addr2 unchanged
      expect(await token.mintedAmount(addr1.address)).to.equal(0);
      expect(await token.mintedAmount(addr2.address)).to.equal(500);
    });

    it("Should prevent minting when amount would exceed max per wallet", async function () {
      // Set current minted amount close to max
      const currentAmount = 900;
      await token.setMintedAmount(addr1.address, currentAmount);

      // Try to mint more than remaining allowed amount
      const mintAmount = 200; // This would exceed the max of 1000
      const mintValue = MINT_PRICE * BigInt(mintAmount);

      await expect(token.connect(addr1).whitelistMint(mintAmount, { value: mintValue })).to.be.revertedWith(
        "Exceeds max mint per wallet"
      );
    });
  });
});
