---
title: "Producto y alcance"
updated: 2026-07-12
status: vigente
sources: [PRODUCT.md, CLAUDE.md, specs/flujo_inspeccion.md, implementation_plan.md]
---

# Producto y alcance

## Problema

RENOVA inspecciona neumáticos de buses y hoy reemplaza un proceso basado en Excel. El dato central es: **un inspector midió una posición de una unidad, para una empresa, en una fecha y con un odómetro**. El sistema debe evitar recaptura, errores de fórmula, pérdida de trabajo sin señal y reportes manuales inconsistentes.

## Usuarios

- **Inspector de campo:** selecciona empresa/unidad, registra odómetro, identidad del neumático, RTD, presión, válvula y anomalías.
- **Jefe de flota:** consulta cobertura, alertas, estado por unidad/fecha y rendimiento.
- **Taller:** instala, retira, transfiere y registra la salida de cascos a reencauche.
- **Administrador/supervisor:** configura empresas, usuarios, umbrales y catálogos; esta operación aún no tiene una consola completa.

## Alcance que existe

- App React/Vite/TypeScript empaquetable como Android con Capacitor.
- Captura local en SQLite y fallback web con `jeep-sqlite`/sql.js.
- Buses con configuraciones MVP 2-4 y 2-4-2 en la app de inspección.
- Sincronización durable de inspecciones a Supabase.
- Umbrales RTD por empresa/medida y snapshot histórico por medición.
- Dashboards HTML autenticados para inspecciones, flota, rendimiento e historial.
- Operaciones web de taller (instalar, retirar y trasladar) y atribución de rutas incorporadas el 2026-07-12.

## Fuera o incompleto

- La app móvil todavía usa acceso `anon`; no hay login de inspector implementado extremo a extremo.
- No hay pantalla separada de Inventario ni Comparativo; fueron retiradas por decisión de producto el 2026-07-12.
- Pull/versionado completo de todos los catálogos no está cerrado.
- Presión CALIENTE no tiene regla confirmada.
- Reporte Excel final por empresa y automatizaciones externas siguen siendo evolución futura.
- iOS no es prioridad; Android es el primer destino.
- La existencia de una migración o pantalla no equivale a validación completa en campo.

## Criterios del producto

1. Cero pérdida silenciosa de inspecciones.
2. Captura operable sin internet.
3. Fórmulas reproducibles con los umbrales vigentes al capturar.
4. Separación estricta de empresas en superficies autenticadas.
5. Datos derivados calculados en una fuente compartida, no copiados entre HTMLs.
6. Interfaz industrial, legible al sol, con objetivos táctiles grandes.

Ver [[09 - Diseno y UX]] y [[10 - Roadmap deuda y riesgos]].
