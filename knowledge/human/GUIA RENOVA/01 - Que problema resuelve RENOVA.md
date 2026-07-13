---
title: "Qué problema resuelve RENOVA"
updated: 2026-07-12
status: vigente
sources: [PRODUCT.md, specs/flujo_inspeccion.md, implementation_plan.md]
---

# Qué problema resuelve RENOVA

Antes, mucha información termina en Excel y hay que volver a ordenarla: qué bus se revisó, qué neumático estaba en cada lugar, cuánto remanente tenía, si estaba bajo de aire y si había que retirarlo.

RENOVA busca que el dato se escriba **una sola vez, al lado del bus**, y después sirva para todo:

- avisar cuál neumático necesita atención;
- comparar posiciones, marcas, diseños y rutas;
- saber qué está instalado, retirado o esperando reencauche;
- construir reportes sin rehacer cuentas a mano;
- conservar la historia aunque se cambie de teléfono.

## Ejemplo

El inspector mide la posición 3 del bus 5028. Anota tres profundidades, presión y una anomalía. El teléfono calcula el valor más delicado, guarda todo y lo manda cuando puede. El jefe ve la alerta y el taller puede decidir un retiro. Meses después, esa medición ayuda a calcular cuánto rindió la banda.

## Qué no intenta resolver todavía

- No reemplaza todas las tareas administrativas de una empresa.
- No tiene completa la administración de usuarios y catálogos desde una pantalla.
- No tiene cerrada la regla de presión en caliente.
- No significa que todo vehículo posible ya esté validado; la app empezó por buses.

Seguir con [[02 - El viaje de una inspeccion]].

