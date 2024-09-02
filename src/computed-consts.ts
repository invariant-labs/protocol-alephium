import { toPercentage } from './math'
import { FeeTier, Percentage } from './types'
import { newFeeTier } from './utils'

const calculateFeeTierWithLinearRatio = (tickCount: bigint): FeeTier => {
  return newFeeTier((tickCount * toPercentage(1n, 4n)) as Percentage, tickCount)
}
export const FEE_TIERS: FeeTier[] = [
  calculateFeeTierWithLinearRatio(1n),
  calculateFeeTierWithLinearRatio(2n),
  calculateFeeTierWithLinearRatio(5n),
  calculateFeeTierWithLinearRatio(10n),
  calculateFeeTierWithLinearRatio(30n),
  calculateFeeTierWithLinearRatio(100n)
]
