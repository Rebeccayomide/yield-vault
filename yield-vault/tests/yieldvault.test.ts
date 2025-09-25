
import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;
const wallet_2 = accounts.get("wallet_2")!;

describe("YieldVault Contract - Basic Setup and Initialization", () => {
  beforeEach(() => {
    simnet.deployContract(
      "yieldvault",
      "contracts/yieldvault.clar",
      null,
      deployer
    );
  });

  describe("Contract Initialization", () => {
    it("should initialize with correct default values", () => {
      const stats = simnet.callReadOnlyFn(
        "yieldvault",
        "get-platform-stats",
        [],
        deployer
      );
      
      expect(stats.result).toBeOk(
        Cl.tuple({
          "total-value-locked": Cl.uint(0),
          "total-vaults": Cl.uint(0),
          "total-strategies": Cl.uint(3),
          "platform-fee-rate": Cl.uint(50),
          "emergency-pause": Cl.bool(false),
        })
      );
    });

    it("should have deployer as contract owner and admin", () => {
      const isAdmin = simnet.callReadOnlyFn(
        "yieldvault",
        "is-user-admin",
        [Cl.principal(deployer)],
        deployer
      );
      
      expect(isAdmin.result).toBeBool(true);
    });

    it("should initialize with default yield strategies", () => {
      // Check strategy 1 (STX-Staking-Strategy)
      const strategy1 = simnet.callReadOnlyFn(
        "yieldvault",
        "get-strategy-info",
        [Cl.uint(1)],
        deployer
      );
      
      expect(strategy1.result).toBeOk(
        Cl.tuple({
          name: Cl.stringAscii("STX-Staking-Strategy"),
          protocol: Cl.stringAscii("stx-vault"),
          apy: Cl.uint(1200),
          "tvl-capacity": Cl.uint(100000000000),
          "current-tvl": Cl.uint(0),
          "risk-score": Cl.uint(3),
          "is-active": Cl.bool(true),
          "contract-address": Cl.principal(deployer),
          "last-updated": Cl.uint(simnet.blockHeight),
        })
      );

      // Check strategy 2 (Lending-Protocol-Strategy)
      const strategy2 = simnet.callReadOnlyFn(
        "yieldvault",
        "get-strategy-info",
        [Cl.uint(2)],
        deployer
      );
      
      expect(strategy2.result).toBeOk(
        Cl.tuple({
          name: Cl.stringAscii("Lending-Protocol-Strategy"),
          protocol: Cl.stringAscii("arkadiko"),
          apy: Cl.uint(800),
          "tvl-capacity": Cl.uint(50000000000),
          "current-tvl": Cl.uint(0),
          "risk-score": Cl.uint(5),
          "is-active": Cl.bool(true),
          "contract-address": Cl.principal(deployer),
          "last-updated": Cl.uint(simnet.blockHeight),
        })
      );

      // Check strategy 3 (LP-Farming-Strategy)
      const strategy3 = simnet.callReadOnlyFn(
        "yieldvault",
        "get-strategy-info",
        [Cl.uint(3)],
        deployer
      );
      
      expect(strategy3.result).toBeOk(
        Cl.tuple({
          name: Cl.stringAscii("LP-Farming-Strategy"),
          protocol: Cl.stringAscii("alex"),
          apy: Cl.uint(1500),
          "tvl-capacity": Cl.uint(25000000000),
          "current-tvl": Cl.uint(0),
          "risk-score": Cl.uint(7),
          "is-active": Cl.bool(true),
          "contract-address": Cl.principal(deployer),
          "last-updated": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("should return the correct best APY", () => {
      const bestApy = simnet.callReadOnlyFn(
        "yieldvault",
        "get-best-apy",
        [],
        deployer
      );
      
      expect(bestApy.result).toBeUint(1500); // LP-Farming-Strategy has highest APY
    });
  });

  describe("Admin Role Management", () => {
    it("should allow contract owner to add new admin", () => {
      const addAdmin = simnet.callPublicFn(
        "yieldvault",
        "add-admin",
        [Cl.principal(wallet_1)],
        deployer
      );
      
      expect(addAdmin.result).toBeOk(Cl.bool(true));
      
      // Verify wallet_1 is now admin
      const isAdmin = simnet.callReadOnlyFn(
        "yieldvault",
        "is-user-admin",
        [Cl.principal(wallet_1)],
        deployer
      );
      
      expect(isAdmin.result).toBeBool(true);
    });

    it("should prevent non-owner from adding admin", () => {
      const addAdmin = simnet.callPublicFn(
        "yieldvault",
        "add-admin",
        [Cl.principal(wallet_2)],
        wallet_1
      );
      
      expect(addAdmin.result).toBeErr(Cl.uint(200)); // ERR_NOT_AUTHORIZED
    });
  });

  describe("Emergency Pause Functionality", () => {
    it("should allow admin to toggle emergency pause", () => {
      // Initially not paused
      let stats = simnet.callReadOnlyFn(
        "yieldvault",
        "get-platform-stats",
        [],
        deployer
      );
      expect(stats.result).toBeOk(
        Cl.tuple({
          "total-value-locked": Cl.uint(0),
          "total-vaults": Cl.uint(0),
          "total-strategies": Cl.uint(3),
          "platform-fee-rate": Cl.uint(50),
          "emergency-pause": Cl.bool(false),
        })
      );

      // Toggle pause
      const togglePause = simnet.callPublicFn(
        "yieldvault",
        "toggle-emergency-pause",
        [],
        deployer
      );
      expect(togglePause.result).toBeOk(Cl.bool(true));

      // Check it's now paused
      stats = simnet.callReadOnlyFn(
        "yieldvault",
        "get-platform-stats",
        [],
        deployer
      );
      expect(stats.result).toBeOk(
        Cl.tuple({
          "total-value-locked": Cl.uint(0),
          "total-vaults": Cl.uint(0),
          "total-strategies": Cl.uint(3),
          "platform-fee-rate": Cl.uint(50),
          "emergency-pause": Cl.bool(true),
        })
      );
    });

    it("should prevent non-admin from toggling pause", () => {
      const togglePause = simnet.callPublicFn(
        "yieldvault",
        "toggle-emergency-pause",
        [],
        wallet_1
      );
      
      expect(togglePause.result).toBeErr(Cl.uint(200)); // ERR_NOT_AUTHORIZED
    });
  });

  describe("Platform Fee Management", () => {
    it("should allow admin to set platform fee", () => {
      const setFee = simnet.callPublicFn(
        "yieldvault",
        "set-platform-fee",
        [Cl.uint(100)], // 1% fee
        deployer
      );
      
      expect(setFee.result).toBeOk(Cl.uint(100));
      
      // Verify fee was updated
      const stats = simnet.callReadOnlyFn(
        "yieldvault",
        "get-platform-stats",
        [],
        deployer
      );
      expect(stats.result).toBeOk(
        Cl.tuple({
          "total-value-locked": Cl.uint(0),
          "total-vaults": Cl.uint(0),
          "total-strategies": Cl.uint(3),
          "platform-fee-rate": Cl.uint(100),
          "emergency-pause": Cl.bool(false),
        })
      );
    });

    it("should reject platform fee above 10%", () => {
      const setFee = simnet.callPublicFn(
        "yieldvault",
        "set-platform-fee",
        [Cl.uint(1001)], // 10.01% fee - should fail
        deployer
      );
      
      expect(setFee.result).toBeErr(Cl.uint(202)); // ERR_INVALID_AMOUNT
    });

    it("should prevent non-admin from setting platform fee", () => {
      const setFee = simnet.callPublicFn(
        "yieldvault",
        "set-platform-fee",
        [Cl.uint(100)],
        wallet_1
      );
      
      expect(setFee.result).toBeErr(Cl.uint(200)); // ERR_NOT_AUTHORIZED
    });
  });

  describe("Vault Creation", () => {
    it("should allow admin to create a new vault", () => {
      const createVault = simnet.callPublicFn(
        "yieldvault",
        "create-vault",
        [
          Cl.stringAscii("Conservative STX Vault"),
          Cl.uint(1), // Conservative risk level
          Cl.uint(1000000), // 1 STX minimum deposit
        ],
        deployer
      );
      
      expect(createVault.result).toBeOk(Cl.uint(1));
      
      // Verify vault was created correctly
      const vaultInfo = simnet.callReadOnlyFn(
        "yieldvault",
        "get-vault-info",
        [Cl.uint(1)],
        deployer
      );
      
      expect(vaultInfo.result).toBeOk(
        Cl.tuple({
          name: Cl.stringAscii("Conservative STX Vault"),
          asset: Cl.principal(`${deployer}.stx-token`),
          "total-shares": Cl.uint(0),
          "total-assets": Cl.uint(0),
          "strategy-id": Cl.uint(2), // Conservative should use lending strategy
          "risk-level": Cl.uint(1),
          "min-deposit": Cl.uint(1000000),
          "is-active": Cl.bool(true),
          "created-at": Cl.uint(simnet.blockHeight),
          "last-harvest": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("should create vault with appropriate strategy for risk level", () => {
      // Test balanced vault
      const createBalanced = simnet.callPublicFn(
        "yieldvault",
        "create-vault",
        [
          Cl.stringAscii("Balanced Vault"),
          Cl.uint(2), // Balanced risk level
          Cl.uint(500000),
        ],
        deployer
      );
      expect(createBalanced.result).toBeOk(Cl.uint(1));

      // Test aggressive vault
      const createAggressive = simnet.callPublicFn(
        "yieldvault",
        "create-vault",
        [
          Cl.stringAscii("Aggressive Vault"),
          Cl.uint(3), // Aggressive risk level
          Cl.uint(2000000),
        ],
        deployer
      );
      expect(createAggressive.result).toBeOk(Cl.uint(2));
    });

    it("should prevent non-admin from creating vault", () => {
      const createVault = simnet.callPublicFn(
        "yieldvault",
        "create-vault",
        [
          Cl.stringAscii("Unauthorized Vault"),
          Cl.uint(1),
          Cl.uint(1000000),
        ],
        wallet_1
      );
      
      expect(createVault.result).toBeErr(Cl.uint(200)); // ERR_NOT_AUTHORIZED
    });

    it("should reject invalid risk levels", () => {
      const createVault = simnet.callPublicFn(
        "yieldvault",
        "create-vault",
        [
          Cl.stringAscii("Invalid Risk Vault"),
          Cl.uint(4), // Invalid risk level
          Cl.uint(1000000),
        ],
        deployer
      );
      
      expect(createVault.result).toBeErr(Cl.uint(202)); // ERR_INVALID_AMOUNT
    });

    it("should prevent vault creation when paused", () => {
      // Pause the contract
      simnet.callPublicFn(
        "yieldvault",
        "toggle-emergency-pause",
        [],
        deployer
      );
      
      const createVault = simnet.callPublicFn(
        "yieldvault",
        "create-vault",
        [
          Cl.stringAscii("Paused Vault"),
          Cl.uint(1),
          Cl.uint(1000000),
        ],
        deployer
      );
      
      expect(createVault.result).toBeErr(Cl.uint(205)); // ERR_VAULT_PAUSED
    });
  });

  describe("Deposit Operations", () => {
    beforeEach(() => {
      // Create a test vault before each deposit test
      simnet.callPublicFn(
        "yieldvault",
        "create-vault",
        [
          Cl.stringAscii("Test Vault"),
          Cl.uint(2), // Balanced risk
          Cl.uint(1000000), // 1 STX minimum
        ],
        deployer
      );
    });

    it("should allow user to deposit into vault", () => {
      const depositAmount = 5000000; // 5 STX
      
      const deposit = simnet.callPublicFn(
        "yieldvault",
        "deposit",
        [Cl.uint(1), Cl.uint(depositAmount)],
        wallet_1
      );
      
      expect(deposit.result).toBeOk(Cl.uint(depositAmount)); // Should get 1:1 shares for first deposit
      
      // Check user position
      const userPosition = simnet.callReadOnlyFn(
        "yieldvault",
        "get-user-position",
        [Cl.uint(1), Cl.principal(wallet_1)],
        deployer
      );
      
      expect(userPosition.result).toBeOk(
        Cl.tuple({
          shares: Cl.uint(depositAmount),
          "deposited-at": Cl.uint(simnet.blockHeight),
          "last-compound": Cl.uint(simnet.blockHeight),
          "total-deposited": Cl.uint(depositAmount),
          "total-withdrawn": Cl.uint(0),
        })
      );
      
      // Check vault was updated
      const vaultInfo = simnet.callReadOnlyFn(
        "yieldvault",
        "get-vault-info",
        [Cl.uint(1)],
        deployer
      );
      
      const vaultData = vaultInfo.result as any;
      expect(vaultData).toBeOk(
        Cl.tuple({
          name: Cl.stringAscii("Test Vault"),
          asset: Cl.principal(`${deployer}.stx-token`),
          "total-shares": Cl.uint(depositAmount),
          "total-assets": Cl.uint(depositAmount),
          "strategy-id": Cl.uint(1),
          "risk-level": Cl.uint(2),
          "min-deposit": Cl.uint(1000000),
          "is-active": Cl.bool(true),
          "created-at": Cl.uint(simnet.blockHeight - 1),
          "last-harvest": Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("should reject deposits below minimum", () => {
      const deposit = simnet.callPublicFn(
        "yieldvault",
        "deposit",
        [Cl.uint(1), Cl.uint(500000)], // 0.5 STX - below 1 STX minimum
        wallet_1
      );
      
      expect(deposit.result).toBeErr(Cl.uint(206)); // ERR_MINIMUM_DEPOSIT_NOT_MET
    });

    it("should handle multiple deposits correctly", () => {
      // First deposit
      simnet.callPublicFn(
        "yieldvault",
        "deposit",
        [Cl.uint(1), Cl.uint(2000000)], // 2 STX
        wallet_1
      );
      
      // Second deposit by same user
      const secondDeposit = simnet.callPublicFn(
        "yieldvault",
        "deposit",
        [Cl.uint(1), Cl.uint(3000000)], // 3 STX
        wallet_1
      );
      
      expect(secondDeposit.result).toBeOk(Cl.uint(3000000)); // Should get 1:1 shares still
      
      // Check total position
      const userPosition = simnet.callReadOnlyFn(
        "yieldvault",
        "get-user-position",
        [Cl.uint(1), Cl.principal(wallet_1)],
        deployer
      );
      
      expect(userPosition.result).toBeOk(
        Cl.tuple({
          shares: Cl.uint(5000000), // Total shares
          "deposited-at": Cl.uint(simnet.blockHeight - 1), // Original deposit time
          "last-compound": Cl.uint(simnet.blockHeight),
          "total-deposited": Cl.uint(5000000), // Total deposited
          "total-withdrawn": Cl.uint(0),
        })
      );
    });

    it("should prevent deposits when paused", () => {
      // Pause the contract
      simnet.callPublicFn(
        "yieldvault",
        "toggle-emergency-pause",
        [],
        deployer
      );
      
      const deposit = simnet.callPublicFn(
        "yieldvault",
        "deposit",
        [Cl.uint(1), Cl.uint(2000000)],
        wallet_1
      );
      
      expect(deposit.result).toBeErr(Cl.uint(205)); // ERR_VAULT_PAUSED
    });

    it("should update user vault list on first deposit", () => {
      simnet.callPublicFn(
        "yieldvault",
        "deposit",
        [Cl.uint(1), Cl.uint(2000000)],
        wallet_1
      );
      
      const userVaults = simnet.callReadOnlyFn(
        "yieldvault",
        "get-user-vaults",
        [Cl.principal(wallet_1)],
        deployer
      );
      
      expect(userVaults.result).toBeList([Cl.uint(1)]);
    });
  });

  describe("Withdrawal Operations", () => {
    beforeEach(() => {
      // Create vault and make deposit
      simnet.callPublicFn(
        "yieldvault",
        "create-vault",
        [
          Cl.stringAscii("Test Vault"),
          Cl.uint(2),
          Cl.uint(1000000),
        ],
        deployer
      );
      
      simnet.callPublicFn(
        "yieldvault",
        "deposit",
        [Cl.uint(1), Cl.uint(10000000)], // 10 STX
        wallet_1
      );
    });

    it("should allow user to withdraw shares", () => {
      const sharesToWithdraw = 3000000; // 3 shares
      const expectedFee = Math.floor((sharesToWithdraw * 50) / 10000); // 0.5% platform fee
      const expectedWithdrawal = sharesToWithdraw - expectedFee;
      
      const withdraw = simnet.callPublicFn(
        "yieldvault",
        "withdraw",
        [Cl.uint(1), Cl.uint(sharesToWithdraw)],
        wallet_1
      );
      
      expect(withdraw.result).toBeOk(Cl.uint(expectedWithdrawal));
      
      // Check remaining user position
      const userPosition = simnet.callReadOnlyFn(
        "yieldvault",
        "get-user-position",
        [Cl.uint(1), Cl.principal(wallet_1)],
        deployer
      );
      
      expect(userPosition.result).toBeOk(
        Cl.tuple({
          shares: Cl.uint(7000000), // 10M - 3M withdrawn
          "deposited-at": Cl.uint(simnet.blockHeight - 1),
          "last-compound": Cl.uint(simnet.blockHeight - 1),
          "total-deposited": Cl.uint(10000000),
          "total-withdrawn": Cl.uint(expectedWithdrawal),
        })
      );
    });

    it("should handle full withdrawal correctly", () => {
      const allShares = 10000000;
      const expectedFee = Math.floor((allShares * 50) / 10000);
      const expectedWithdrawal = allShares - expectedFee;
      
      const withdraw = simnet.callPublicFn(
        "yieldvault",
        "withdraw",
        [Cl.uint(1), Cl.uint(allShares)],
        wallet_1
      );
      
      expect(withdraw.result).toBeOk(Cl.uint(expectedWithdrawal));
      
      // Position should be deleted after full withdrawal
      const userPosition = simnet.callReadOnlyFn(
        "yieldvault",
        "get-user-position",
        [Cl.uint(1), Cl.principal(wallet_1)],
        deployer
      );
      
      expect(userPosition.result).toBeNone();
    });

    it("should prevent withdrawal of more shares than owned", () => {
      const withdraw = simnet.callPublicFn(
        "yieldvault",
        "withdraw",
        [Cl.uint(1), Cl.uint(15000000)], // More than 10M deposited
        wallet_1
      );
      
      expect(withdraw.result).toBeErr(Cl.uint(207)); // ERR_WITHDRAWAL_TOO_LARGE
    });

    it("should prevent withdrawal when paused", () => {
      // Pause the contract
      simnet.callPublicFn(
        "yieldvault",
        "toggle-emergency-pause",
        [],
        deployer
      );
      
      const withdraw = simnet.callPublicFn(
        "yieldvault",
        "withdraw",
        [Cl.uint(1), Cl.uint(1000000)],
        wallet_1
      );
      
      expect(withdraw.result).toBeErr(Cl.uint(205)); // ERR_VAULT_PAUSED
    });

    it("should reject zero withdrawal amount", () => {
      const withdraw = simnet.callPublicFn(
        "yieldvault",
        "withdraw",
        [Cl.uint(1), Cl.uint(0)],
        wallet_1
      );
      
      expect(withdraw.result).toBeErr(Cl.uint(202)); // ERR_INVALID_AMOUNT
    });
  });

  describe("Vault Harvesting", () => {
    beforeEach(() => {
      // Create vault with deposits
      simnet.callPublicFn(
        "yieldvault",
        "create-vault",
        [
          Cl.stringAscii("Test Vault"),
          Cl.uint(3), // Aggressive for higher yield
          Cl.uint(1000000),
        ],
        deployer
      );
      
      simnet.callPublicFn(
        "yieldvault",
        "deposit",
        [Cl.uint(1), Cl.uint(10000000)], // 10 STX
        wallet_1
      );
    });

    it("should allow harvesting vault earnings", () => {
      // Advance some blocks to simulate time passing
      simnet.mineEmptyBlocks(100);
      
      const harvest = simnet.callPublicFn(
        "yieldvault",
        "harvest-vault",
        [Cl.uint(1)],
        deployer
      );
      
      expect(harvest.result).toBeOk(Cl.bool(true));
      
      // Check if vault assets increased (yield was added)
      const vaultInfo = simnet.callReadOnlyFn(
        "yieldvault",
        "get-vault-info",
        [Cl.uint(1)],
        deployer
      );
      
      // Should have some yield added (exact amount depends on strategy APY and blocks)
      const vaultData = vaultInfo.result as any;
      expect(vaultData).toBeOk(expect.objectContaining({
        "last-harvest": Cl.uint(simnet.blockHeight),
      }));
    });

    it("should prevent harvesting when paused", () => {
      // Pause the contract
      simnet.callPublicFn(
        "yieldvault",
        "toggle-emergency-pause",
        [],
        deployer
      );
      
      const harvest = simnet.callPublicFn(
        "yieldvault",
        "harvest-vault",
        [Cl.uint(1)],
        deployer
      );
      
      expect(harvest.result).toBeErr(Cl.uint(205)); // ERR_VAULT_PAUSED
    });

    it("should handle harvesting non-existent vault", () => {
      const harvest = simnet.callPublicFn(
        "yieldvault",
        "harvest-vault",
        [Cl.uint(999)], // Non-existent vault
        deployer
      );
      
      expect(harvest.result).toBeErr(Cl.uint(203)); // ERR_VAULT_NOT_FOUND
    });
  });

  describe("Read-Only Functions", () => {
    beforeEach(() => {
      // Setup test data
      simnet.callPublicFn(
        "yieldvault",
        "create-vault",
        [Cl.stringAscii("Read Test Vault"), Cl.uint(2), Cl.uint(1000000)],
        deployer
      );
      
      simnet.callPublicFn(
        "yieldvault",
        "deposit",
        [Cl.uint(1), Cl.uint(5000000)],
        wallet_1
      );
    });

    it("should return correct user vault value", () => {
      const userValue = simnet.callReadOnlyFn(
        "yieldvault",
        "get-user-vault-value",
        [Cl.uint(1), Cl.principal(wallet_1)],
        deployer
      );
      
      expect(userValue.result).toBeUint(5000000); // Should equal deposit amount initially
    });

    it("should return empty list for user with no vaults", () => {
      const userVaults = simnet.callReadOnlyFn(
        "yieldvault",
        "get-user-vaults",
        [Cl.principal(wallet_2)], // wallet_2 has no deposits
        deployer
      );
      
      expect(userVaults.result).toBeList([]);
    });

    it("should return 0 value for non-existent user position", () => {
      const userValue = simnet.callReadOnlyFn(
        "yieldvault",
        "get-user-vault-value",
        [Cl.uint(1), Cl.principal(wallet_2)], // wallet_2 has no position
        deployer
      );
      
      expect(userValue.result).toBeUint(0);
    });
  });
});

