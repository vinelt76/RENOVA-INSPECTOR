export type ProfileRole =
  | 'inspector'
  | 'operator'
  | 'tire_supervisor'
  | 'workshop_manager'
  | 'fleet_manager'
  | 'admin';

export interface OperatorProfile {
  id: string;
  company_id: string;
  full_name: string;
  role: ProfileRole;
  active: boolean;
  company_name: string;
}

export type OrderStatus = 'issued' | 'in_progress' | 'completed' | 'cancelled';
export type MovementDirection = 'exit' | 'entry';
export type MovementReason =
  | 'repair'
  | 'retention'
  | 'claim'
  | 'rotation'
  | 'discard'
  | 'retread'
  | 'balancing';
export type TireCondition = 'N' | 'R1' | 'R2' | 'R3' | 'R4';

export interface RequestedMovement {
  direction: MovementDirection;
  position: number;
  reason?: MovementReason;
  notes?: string;
}

export interface MovementOrder {
  id: string;
  company_id: string;
  company_name: string;
  unit_id: string;
  plate: string;
  last_odometer: number | null;
  vehicle_config: string;
  requested_by: string;
  requested_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  status: OrderStatus;
  scheduled_for: string;
  instructions: string | null;
  request_items: RequestedMovement[];
  requested_items_count: number;
  issued_at: string;
  started_at: string | null;
  completed_at: string | null;
  odometer_km: number | null;
}

export interface ExecutionItem {
  id: string;
  direction: MovementDirection;
  position: number;
  reason: MovementReason | '';
  code: string;
  code_unreadable: boolean;
  brand: string;
  size: string;
  design: string;
  rtd_min_mm: string;
  condition: TireCondition;
  retread_design: string;
  observations: string;
}

export interface MovementDraft {
  version: 1;
  orderId: string;
  odometer: string;
  items: ExecutionItem[];
  updatedAt: string;
}
