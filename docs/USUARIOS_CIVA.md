# Usuarios de prueba — CIVA

Cuentas entregadas para probar el flujo web y de movimientos de RENOVA.

| Correo | Estado informado | Rol actual informado | Alcance |
|---|---|---|---|
| `alejo@civa.com` | OK | `tire_supervisor` | CIVA: emisión de órdenes, empresas e inspecciones |
| `miguelciva@civa.com` | OK | `operator` | CIVA |
| `inspectorciva@civa.com` | OK | `inspector` | CIVA |

## Rol requerido para emitir órdenes

La cuenta `alejo@civa.com` quedó con un perfil activo de rol `tire_supervisor` para emitir órdenes de movimientos de neumáticos desde la web.

El rol `supervisor` legado permitía consultar algunas pantallas, pero no estaba autorizado por el contrato actual de movimientos para emitir órdenes.

Las contraseñas no se almacenan en este repositorio. Deben mantenerse en el gestor de credenciales o canal seguro acordado.

## Prueba esperada

1. Iniciar sesión en la web con `alejo@civa.com`.
2. Abrir una unidad y entrar a **Servicios**.
3. Seleccionar una posición y emitir una orden.
4. Iniciar la app de operario con `miguelciva@civa.com`.
5. Confirmar que el operario de CIVA puede tomar y completar la orden.
