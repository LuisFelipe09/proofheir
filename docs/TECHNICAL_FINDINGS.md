# Technical Findings: ZK Verification on Mantle Sepolia

**Date**: 2026-01-11  
**Authors**: ProofHeir Development Team  
**Status**: Investigation Complete

## Executive Summary

During deployment of ProofHeir to Mantle Sepolia testnet, we discovered a critical issue with ZK proof verification gas costs. The UltraHonk verifier consumes approximately **480x more gas** on Mantle Sepolia compared to local Anvil execution.

## Key Findings

### Gas Consumption Comparison

| Environment | Gas Used | Status |
|-------------|----------|--------|
| **Anvil (Local)** | 3,297,789 (~3.3M) | ✅ Success |
| **Mantle Sepolia** | 1,587,171,368 (~1.58B) | ❌ Out of Gas |

### Root Cause Analysis

The issue stems from **elliptic curve precompile pricing** on Mantle Sepolia. The ZK verifier (HonkVerifier) relies heavily on:

- `ecpairing` (0x08) - Pairing check
- `ecmul` (0x07) - Elliptic curve scalar multiplication  
- `ecadd` (0x06) - Elliptic curve point addition

These precompiles have dramatically different gas costs on Mantle compared to standard EVM implementations.

#### Evidence from Transaction Trace

```
Error Message: out of gas
Opcode: [ISZERO]
in 0x7c7aa1B77cF8f104ee5038681efDe7a3796ADE02 (HonkVerifier)
```

The transaction failed during the final verification step inside the HonkVerifier contract, after consuming 1.58B gas.

### Transaction Hashes

| Network | Transaction Hash | Result |
|---------|-----------------|--------|
| Mantle Sepolia #1 | `0x51e43c527bdee999314d3c1ba84fcf23f6ce6b6cbf580d90ff4ba9a7364c66e3` | ❌ Reverted |
| Mantle Sepolia #2 | `0xe5661af28983b5b9984758963e2d868d707ddb7d64f77bbab1ea3678d6f75576` | ❌ Reverted |
| Anvil Local | `0x396155b5b23809e981728d40c23133a1920b58553dabb492411b7572a1092415` | ✅ Success |

## Technical Details

### Contract Addresses (Mantle Sepolia)

| Contract | Address |
|----------|---------|
| ProofHeir | `0x3E38Fb14EAA65dEF65C858c8666286A944931f4C` |
| HonkVerifier | `0x7c7aa1B77cF8f104ee5038681efDe7a3796ADE02` |
| MockERC20 | `0x10b641eA3A65cA5FBcdf3685a2baCE100ddA6aeB` |

### Gas Limit Configuration

```rust
// packages/notary/src/verifier.rs
let gas_limit: u64 = env::var("GAS_LIMIT")
    .ok()
    .and_then(|v| v.parse().ok())
    .unwrap_or(2_500_000_000); // Increased from 1.6B to 2.5B
```

### Cast Run vs Actual Execution

Interestingly, `cast run` (which simulates the transaction) reported success:
```
Transaction successfully executed.
Gas used: 3297669
emit HeirRegistered(...)
```

But the actual on-chain execution failed with out of gas. This suggests the simulation doesn't accurately reflect Mantle's precompile gas costs.

## Future Recommendations

1. **Contact Mantle Team**: Request information about precompile gas pricing
2. **Monitor Mantle Updates**: They may optimize precompile costs in future releases
3. **Alternative L2**: Consider deployment on networks with standard precompile pricing
4. **Native SP1 Integration**: When Mantle's SP1 integration matures, migrate to native verification

## Appendix: Proof Statistics

| Metric | Value |
|--------|-------|
| Proof Size | 19,968 bytes |
| VK Size | 1,816 bytes |
| Public Inputs | 116 fields |
| Circuit Size | 65,536 gates |

## Appendix: Files Modified

- `packages/contracts/script/DeployProofHeir.s.sol` - Deploy script with MockVerifier option
- `packages/contracts/src/ProofHeir.sol` - Added custom errors
- `packages/notary/src/verifier.rs` - Increased gas limit, added debug logging
- `apps/web/src/app/api/delegate/route.ts` - Dynamic chain selection

---

*This document serves as a technical record of the investigation conducted during the Mantle hackathon.*
