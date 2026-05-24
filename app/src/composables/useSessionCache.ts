import { useStructureStore } from '@/stores/structureStore'
import { useLoadsStore } from '@/stores/loadsStore'
import { useLoadCasesStore } from '@/stores/loadCasesStore'
import type { StructureNode, Member, StructureType } from '@/types/structure'
import type { Load } from '@/types/loads'

const STORAGE_KEY = 'structcalc_session'

export interface SessionSnapshot {
  nodes: StructureNode[]
  members: Member[]
  structureType: StructureType
  loads: Load[]
  savedAt: string
}

export function useSessionCache() {
  function getSavedSession(): SessionSnapshot | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const data = JSON.parse(raw) as SessionSnapshot
      if (!data.nodes?.length && !data.members?.length) return null
      return data
    } catch {
      return null
    }
  }

  function saveSession() {
    const structure = useStructureStore()
    const loads = useLoadsStore()
    const loadCases = useLoadCasesStore()
    try {
      const snapshot: SessionSnapshot = {
        nodes: structure.nodes,
        members: structure.members,
        structureType: structure.structureType,
        loads: loads.loads,
        savedAt: new Date().toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
      loadCases.save()
    } catch {
      // localStorage unavailable (e.g. private browsing with full storage)
    }
  }

  function restoreSession() {
    const snapshot = getSavedSession()
    if (!snapshot) return
    const structure = useStructureStore()
    const loads = useLoadsStore()
    const loadCases = useLoadCasesStore()
    structure.loadSnapshot({
      nodes: snapshot.nodes,
      members: snapshot.members,
      structureType: snapshot.structureType,
    })
    loads.loadSnapshot(snapshot.loads)
    loadCases.load()
  }

  function clearSavedSession() {
    localStorage.removeItem(STORAGE_KEY)
  }

  return { getSavedSession, saveSession, restoreSession, clearSavedSession }
}
