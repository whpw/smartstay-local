// Hotres rounds to grosze; anything below half a grosz is noise.
const TOLERANCE = 0.005

/**
 * True when the reservation (including addons) is not fully paid yet.
 * Unknown or malformed amounts count as settled so a Hotres hiccup never
 * locks guests out. Overpayment is settled too.
 */
export function hasBalanceDue(total: unknown, paid: unknown): boolean {
  if (total == null || paid == null) {
    return false
  }
  const totalAmount = Number(total)
  const paidAmount = Number(paid)
  if (!Number.isFinite(totalAmount) || !Number.isFinite(paidAmount)) {
    return false
  }
  return totalAmount - paidAmount > TOLERANCE
}
