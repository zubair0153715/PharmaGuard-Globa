# Security Specification - PharmaGuard Global

## Data Invariants
1. **Relational Sync**: Sub-resources (Submissions, Signatures, Rules) MUST correctly map to a `tenantId`.
2. **Tenant Isolation**: Users and Admins can only access data belonging to their specific `tenantId`.
3. **Identity Integrity**: Document IDs and `uid` fields must be validated to prevent ID poisoning and spoofing.
4. **Temporal Consistency**: `createdAt` and `updatedAt` timestamps must strictly match `request.time`.
5. **Role Hierarchy**: `Reviewer` (Own data only), `QA_Manager` (Tenant history), `Regulatory_Officer` (Tenant rules), `Admin` (Tenant management).

## The "Dirty Dozen" Payload Tests

| # | Test Scenario | Expected Result | Logic Gate |
|---|---------------|-----------------|------------|
| 1 | **Cross-Tenant Create** | `PERMISSION_DENIED` | `request.resource.data.tenantId == getTenantId()` |
| 2 | **Identity Spoofing** | `PERMISSION_DENIED` | `request.resource.data.uid == request.auth.uid` |
| 3 | **Bypass isValid helper** | `PERMISSION_DENIED` | `isValid[Entity]()` mandatory on write |
| 4 | **Shadow Field Injection** | `PERMISSION_DENIED` | `hasOnlyAllowedFields()` strict keys |
| 5 | **Status Skipping** | `PERMISSION_DENIED` | Terminal State Locking |
| 6 | **ID Poisoning** | `PERMISSION_DENIED` | `isValidId(id)` regex check |
| 7 | **Admin Claim Spoofing** | `PERMISSION_DENIED` | `get()` based role verification |
| 8 | **Submission Modification** | `PERMISSION_DENIED` | `affectedKeys().hasOnly()` on updates |
| 9 | **Audit Log Tampering** | `PERMISSION_DENIED` | `allow update, delete: if false` |
| 10 | **Future Timestamp** | `PERMISSION_DENIED` | `request.resource.data.timestamp == request.time` |
| 11 | **Orphaned Registration** | `PERMISSION_DENIED` | `exists()` check for tenant on creation |
| 12 | **Blanket Query Scraping** | `PERMISSION_DENIED` | `allow list: if resource.data.tenantId == getTenantId()` |

## Implementation Traceability
- **Pillar 1**: `isSameTenant()` gate on all resources.
- **Pillar 2**: `isValid[Entity]()` helpers enforcing `hasOnlyAllowedFields()`.
- **Pillar 3**: `isValidId()` regex on path variables.
- **Pillar 4**: Tiered `update` logic using `affectedKeys()`.
- **Pillar 6**: PII isolation within `users` collection.
- **Pillar 7**: Atomic `existsAfter()` for relational linking.
- **Pillar 8**: Relational enforcer in `allow list` blocks.
