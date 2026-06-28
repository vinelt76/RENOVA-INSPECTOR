export interface Empresa {
  id: string;
  nombre: string;
  flota: string | null;
}

export interface Unidad {
  numero: string;
  empresa_id: string;
  tipo_vehiculo: string;
  configuracion: string;
  odometro_ultimo: number | null;
  ultima_fecha: string | null;
}

export interface InspeccionCabecera {
  id: string;
  empresa_id: string;
  numero_unidad: string;
  fecha: string;
  km_odometro: number;
  foto_unidad: string | null;
  created_at: string;
  updated_at: string;
  sincronizado: number;
}

export interface InspeccionNeumatico {
  id: string;
  cabecera_id: string;
  posicion: number;
  codigo: string | null;
  marca: string | null;
  modelo: string | null;
  condicion: string | null;
  reencauche: string | null;
  medida: string | null;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  presion: number | null;
  tapa_valvula: string | null;
  anomalia: string | null;
  rtd_movi: number | null;
  idi: number | null;
  estado_rtd: string | null;
  desecho: number;
  updated_at: string;
}

export interface CatMarca {
  id: string;
  nombre: string;
}

export interface CatModelo {
  id: string;
  marca_id: string;
  nombre: string;
}

export interface CatMedida {
  id: string;
  nombre: string;
}

export interface CatReencauche {
  id: string;
  nombre: string;
}

export interface CatAnomalia {
  id: string;
  nombre: string;
  posible_causa: string | null;
  desecho: number;
}

export interface CatValvula {
  id: string;
  nombre: string;
}

export interface CatConfiguracion {
  tipo_vehiculo: string;
  notacion: string;
  posicion: number;
  tipo_eje: string;
  lado: string | null;
  piso: number;
  mvp: number;
}

export interface CatCondicion {
  codigo: string;
  nombre: string;
}

export interface SyncQueue {
  id: string;
  tabla: string;
  registro_id: string;
  op: string;
  created_at: string;
  enviado: number;
}
