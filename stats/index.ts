import { CLAMM, Invariant } from '../artifacts/ts'

console.log('Invariant bytecode length: ', Invariant.contract.bytecode.length / 2)
console.log('CLAMM bytecode length: ', CLAMM.contract.bytecode.length / 2)
