export interface PointLoad {
  id: string
  type: 'point_load'
  nodeId: string
  fx: number
  fy: number
  label?: string
}

export interface DistributedLoad {
  id: string
  type: 'distributed_load'
  memberId: string
  w1: number
  w2: number
  direction: 'local_y' | 'global_y'
  label?: string
}

export interface MomentLoad {
  id: string
  type: 'moment'
  nodeId: string
  mz: number
  label?: string
}

export type Load = PointLoad | DistributedLoad | MomentLoad
