import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLoadsStore } from '@/stores/loadsStore'
import { useStructureStore } from '@/stores/structureStore'
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import type { DistributedLoad } from '@/types/loads'

describe('generateSelfWeight', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function setupMemberWithProfile() {
    const structure = useStructureStore()
    const profileStore = useSteelProfileStore()

    const n1 = structure.addNode({ x: 0, y: 0, support: 'pinned' })
    const n2 = structure.addNode({ x: 5, y: 0, support: 'free' })

    // Use first available profile (H 100×100, mass = 17.2 kg/m)
    const profile = profileStore.profiles[0]
    const member = structure.addMember({
      startNodeId: n1.id,
      endNodeId: n2.id,
      steelProfileId: profile.id,
      E: 200000,
      A: profile.A,
      I: profile.Ix,
      isTruss: false,
    })
    return { member, profile, n1, n2 }
  }

  it('creates a distributed load for each member with a profile', () => {
    setupMemberWithProfile()
    const loads = useLoadsStore()
    const count = loads.generateSelfWeight()

    expect(count).toBe(1)
    expect(loads.distributedLoads).toHaveLength(1)
  })

  it('load has correct type and attributes', () => {
    const { profile } = setupMemberWithProfile()
    const loads = useLoadsStore()
    loads.generateSelfWeight()

    const dl = loads.distributedLoads[0]
    const expectedW = -(profile.mass * 9.81 / 1000)
    expect(dl.w1).toBeCloseTo(expectedW, 5)
    expect(dl.w2).toBeCloseTo(expectedW, 5)
    expect(dl.direction).toBe('global_y')
    expect(dl.loadCase).toBe('D')
    expect((dl as DistributedLoad).isSelfWeight).toBe(true)
  })

  it('label is SW-{member label}', () => {
    setupMemberWithProfile()
    const loads = useLoadsStore()
    loads.generateSelfWeight()

    const dl = loads.distributedLoads[0]
    expect(dl.label).toMatch(/^SW-M/)
  })

  it('skips members without steel profiles', () => {
    const structure = useStructureStore()
    const n1 = structure.addNode({ x: 0, y: 0, support: 'pinned' })
    const n2 = structure.addNode({ x: 5, y: 0, support: 'free' })
    structure.addMember({
      startNodeId: n1.id,
      endNodeId: n2.id,
      E: 200000,
      A: 5000,
      I: 10000000,
      isTruss: false,
    })

    const loads = useLoadsStore()
    const count = loads.generateSelfWeight()
    expect(count).toBe(0)
    expect(loads.distributedLoads).toHaveLength(0)
  })

  it('removes existing self-weight loads before regenerating', () => {
    setupMemberWithProfile()
    const loads = useLoadsStore()
    loads.generateSelfWeight()
    expect(loads.distributedLoads).toHaveLength(1)

    // Call again — should replace, not stack
    loads.generateSelfWeight()
    expect(loads.distributedLoads).toHaveLength(1)
  })

  it('does not remove user-added distributed loads', () => {
    const { member } = setupMemberWithProfile()
    const loads = useLoadsStore()

    // User adds their own distributed load
    loads.addDistributedLoad({ memberId: member.id, w1: -5, w2: -5, direction: 'global_y' })
    expect(loads.distributedLoads).toHaveLength(1)

    loads.generateSelfWeight()
    // Both user load and SW load should exist
    expect(loads.distributedLoads).toHaveLength(2)

    // SW load is the one with isSelfWeight
    const swLoads = loads.distributedLoads.filter(l => (l as DistributedLoad).isSelfWeight)
    expect(swLoads).toHaveLength(1)
  })

  it('regeneration updates SW loads, not user loads', () => {
    const { member } = setupMemberWithProfile()
    const loads = useLoadsStore()

    loads.addDistributedLoad({ memberId: member.id, w1: -5, w2: -5, direction: 'global_y' })
    loads.generateSelfWeight()
    loads.generateSelfWeight()  // second call

    const userLoads = loads.distributedLoads.filter(l => !(l as DistributedLoad).isSelfWeight)
    const swLoads = loads.distributedLoads.filter(l => (l as DistributedLoad).isSelfWeight)
    expect(userLoads).toHaveLength(1)
    expect(swLoads).toHaveLength(1)
  })

  it('handles multiple members — one SW load per profile-assigned member', () => {
    const structure = useStructureStore()
    const profileStore = useSteelProfileStore()
    const profile = profileStore.profiles[0]

    const n1 = structure.addNode({ x: 0, y: 0, support: 'pinned' })
    const n2 = structure.addNode({ x: 5, y: 0, support: 'free' })
    const n3 = structure.addNode({ x: 10, y: 0, support: 'roller' })

    structure.addMember({ startNodeId: n1.id, endNodeId: n2.id, steelProfileId: profile.id, E: 200000, A: profile.A, I: profile.Ix, isTruss: false })
    structure.addMember({ startNodeId: n2.id, endNodeId: n3.id, steelProfileId: profile.id, E: 200000, A: profile.A, I: profile.Ix, isTruss: false })

    const loads = useLoadsStore()
    const count = loads.generateSelfWeight()
    expect(count).toBe(2)
    expect(loads.distributedLoads).toHaveLength(2)
  })
})
