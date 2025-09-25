
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
});
