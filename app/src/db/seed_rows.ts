// Módulo puro: no accede a la DB. Devuelve todas las filas a sembrar.
// Usado por seed.ts (para insertar) y por scripts/verify-db.ts (para auditar sin DB).
import catalogoPatron from './seed_data/catalogo_patron.json';
import catalogoFlota from './seed_data/catalogo_flota.json';
import { slugify } from './slugify';

const EMPRESAS = [
  { id: 'movil', nombre: 'MÓVIL BUS',    flota: null },
  { id: 'cruz',  nombre: 'CRUZ DEL SUR', flota: null },
  { id: 'civa',  nombre: 'CIVA',         flota: null },
  { id: 'ittsa', nombre: 'ITTSABUS',     flota: null },
  { id: 'cta',   nombre: 'CTA',          flota: null },
];

const POS_LADO_MAP: Record<number, 'Izq' | 'Der'> = {
  1: 'Izq', 2: 'Der',
  3: 'Izq', 4: 'Izq', 5: 'Der', 6: 'Der',
  7: 'Izq', 8: 'Der',
};

const ALL_CONDICIONES = [
  { codigo: 'N',  nombre: 'Nuevo' },
  { codigo: 'R1', nombre: 'Primer reencauche' },
  { codigo: 'R2', nombre: 'Segundo reencauche' },
  { codigo: 'R3', nombre: 'Tercer reencauche' },
  { codigo: 'R4', nombre: 'Cuarto reencauche' },
];

export interface SeedRows {
  catValvulas:        Array<{ id: string; nombre: string }>;
  catAnomalias:       Array<{ id: string; nombre: string; posible_causa: string | null; desecho: number }>;
  catConfiguraciones: Array<{ tipo_vehiculo: string; notacion: string; posicion: number; tipo_eje: string; lado: string | null; piso: number; mvp: number }>;
  catCondiciones:     Array<{ codigo: string; nombre: string }>;
  catMarcas:          Array<{ id: string; nombre: string }>;
  catModelos:         Array<{ id: string; marca_id: string; nombre: string }>;
  catMedidas:         Array<{ id: string; nombre: string }>;
  catReencauches:     Array<{ id: string; nombre: string }>;
  empresas:           Array<{ id: string; nombre: string; flota: string | null }>;
}

export function buildSeedRows(): SeedRows {
  // ── Catálogos del patrón ──────────────────────────────────────────────────

  const catValvulas = (catalogoPatron.tapas_valvula as Array<{ nombre: string }>).map(v => ({
    id: slugify(v.nombre), nombre: v.nombre,
  }));

  const catAnomalias = (catalogoPatron.anomalia_neumatico as Array<{ nombre: string; posible_causa: string | null; desecho: boolean }>).map(a => ({
    id: slugify(a.nombre), nombre: a.nombre,
    posible_causa: a.posible_causa ?? null,
    desecho: a.desecho ? 1 : 0,
  }));

  const catConfiguraciones = (catalogoPatron.configuracion_vehiculo as Array<{
    tipo_vehiculo: string; configuracion: string; mvp: boolean;
    posiciones: Array<{ posicion: number; tipo_eje: string; piso: boolean }>;
  }>).flatMap(config =>
    config.posiciones.map(pos => ({
      tipo_vehiculo: config.tipo_vehiculo,
      notacion: config.configuracion,
      posicion: pos.posicion,
      tipo_eje: pos.tipo_eje,
      lado: POS_LADO_MAP[pos.posicion] ?? null,
      piso: pos.piso ? 1 : 0,
      mvp: config.mvp ? 1 : 0,
    }))
  );

  const catCondiciones = ALL_CONDICIONES;

  // ── Catálogos de flota (marcas, modelos, medidas, reencauches) ────────────

  const catMarcas = (catalogoFlota.marcas as string[]).map(m => ({
    id: slugify(m), nombre: m,
  }));

  const marcaIdMap = new Map(catMarcas.map(m => [m.nombre, m.id]));

  const catModelos = (catalogoFlota.modelos as Array<{ marca: string; nombre: string }>)
    .map(({ marca, nombre }) => {
      const marcaId = marcaIdMap.get(marca);
      if (!marcaId) return null;
      return { id: slugify(`${marca}_${nombre}`), marca_id: marcaId, nombre };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const catMedidas = (catalogoFlota.medidas as string[]).map(m => ({
    id: slugify(m), nombre: m,
  }));

  const catReencauches = (catalogoFlota.reencauches as string[]).map(r => ({
    id: slugify(r), nombre: r,
  }));

  // ── Empresas ──────────────────────────────────────────────────────────────

  const empresas = EMPRESAS.map(e => ({ id: e.id, nombre: e.nombre, flota: e.flota }));

  return {
    catValvulas, catAnomalias, catConfiguraciones, catCondiciones,
    catMarcas, catModelos, catMedidas, catReencauches,
    empresas,
  };
}
