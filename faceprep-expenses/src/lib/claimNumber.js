/**
 * Claim number display logic
 *
 * New claims:      RCLAIM-00001, RCLAIM-00002, ...
 * Resubmissions:   RCLAIM-00001/RS1, RCLAIM-00001/RS2, ...
 *
 * The DB stores the raw claim_number on every claim.
 * We track the root (parent_claim_id chain) and count resubmissions.
 */

/**
 * Given a claim object and an optional list of all claims,
 * returns the display number with /RS suffix if applicable.
 */
export function displayClaimNumber(claim, allClaims = []) {
  if (!claim) return '—'

  // If this claim has a parent, it's a resubmission
  if (claim.parent_claim_id) {
    // Find the root claim (the original)
    const root = findRoot(claim, allClaims)
    const rootNumber = root?.claim_number ?? claim.claim_number

    // Count how many resubmissions exist for this root
    const rsIndex = getResubmissionIndex(claim, allClaims)
    return `${rootNumber}/RS${rsIndex}`
  }

  return claim.claim_number
}

/**
 * Walk up the parent chain to find the original claim
 */
function findRoot(claim, allClaims) {
  if (!claim.parent_claim_id) return claim
  const parent = allClaims.find(c => c.id === claim.parent_claim_id)
  if (!parent) return claim
  return findRoot(parent, allClaims)
}

/**
 * Find what RS index this resubmission is (RS1, RS2, ...)
 * by sorting all resubmissions for the same root by submitted_at
 */
function getResubmissionIndex(claim, allClaims) {
  const root = findRoot(claim, allClaims)
  if (!root) return 1

  // All claims that are resubmissions of this root
  const resubmissions = allClaims
    .filter(c => c.parent_claim_id && findRoot(c, allClaims)?.id === root.id)
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))

  const idx = resubmissions.findIndex(c => c.id === claim.id)
  return idx >= 0 ? idx + 1 : 1
}

/**
 * Simple version — just append /RS suffix based on parent_claim_id
 * Use this when you don't have allClaims available (e.g. single claim view)
 */
export function simpleDisplayNumber(claim, parentClaimNumber, rsIndex = 1) {
  if (!claim?.parent_claim_id) return claim?.claim_number ?? '—'
  const root = parentClaimNumber ?? claim.claim_number
  return `${root}/RS${rsIndex}`
}
