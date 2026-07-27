---
title: "Qué problema resuelve RENOVA"
updated: 2026-07-26
status: vigente
sources: [PRODUCT.md, specs/flujo_inspeccion.md, CLAUDE.md, knowledge/ai/01, repository audit 2026-07-26]
---

# Qué problema resuelve RENOVA

Antes, mucha información termina en Excel y hay que volver a ordenarla: qué bus se revisó, qué neumático estaba en cada lugar, cuánto remanente tenía, si estaba bajo de aire y si había que retirarlo.

RENOVA busca que el dato se escriba **una sola vez, al lado del bus**, y después sirva para todo:

- avisar cuál neumático necesita atención;
- comparar posiciones, marcas, diseños y rutas;
- saber qué está instalado, retirado o esperando reencauche;
- construir reportes sin rehacer cuentas a mano;
- conservar la historia aunque se cambie de teléfono.
- separar lo que el supervisor ordenó de lo que el operario realmente ejecutó;
- explicar de dónde salió cada número importante.

## A quién ayuda

- **Inspector:** captura aunque no tenga señal.
- **Supervisor de neumáticos:** revisa una unidad y emite órdenes por posición.
- **Operario:** recibe la orden y confirma lo que salió y entró.
- **Jefe de flota o taller:** consulta inspecciones, alertas, rendimiento, historial, inventario y
  servicios.
- **Administrador:** debería manejar empresas, usuarios, umbrales y catálogos; esta consola todavía
  no está completa.

## Ejemplo

El inspector mide la posición 3 del bus 5028. Anota tres profundidades, presión y una anomalía. El teléfono calcula el valor más delicado, guarda todo y lo manda cuando puede. El jefe ve la alerta y el taller puede decidir un retiro. Meses después, esa medición ayuda a calcular cuánto rindió la banda.

## Qué no intenta resolver todavía

- No reemplaza todas las tareas administrativas de una empresa.
- No tiene completa la administración de usuarios y catálogos desde una pantalla.
- No tiene cerrada la regla de presión en caliente.
- No crea automáticamente R1/R2 después de retirar para reencauche.
- No reconcilia todavía toda ejecución del operario con casco, ciclo e instalación.
- No puede atribuir una inspección a un inspector identificado porque la app de inspección aún no
  tiene login.
- No calcula consumo real en ventanas de 30/60 días porque faltan mediciones enlazadas suficientes.
- No significa que todo vehículo posible ya esté validado; la app empezó por buses.
- No significa que el APK ya esté probado en todas las condiciones reales de patio.

Seguir con [[02 - El viaje de una inspeccion]].
