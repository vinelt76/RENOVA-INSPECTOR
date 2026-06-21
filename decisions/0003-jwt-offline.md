# ADR-0003: Estrategia JWT en modo offline

## Decisión

- **Access token:** expiración corta (15 minutos).
- **Refresh token:** expiración larga (30 días), almacenado en `FlutterSecureStorage`.
- El sync service renueva el access token automáticamente usando el refresh token
  antes de cada intento de sync.
- Si el refresh token también expiró (inspector offline > 30 días):
  la app muestra banner "Sesión expirada — reconectar para sincronizar"
  pero NO borra los datos locales. El inspector sigue capturando offline.
  Al hacer login, el sync pendiente se procesa.

## Contexto

Los inspectores trabajan en campo con conectividad intermitente. Un inspector puede
estar offline por horas (turno en ruta) o días (zona rural sin señal). La app debe
funcionar completamente offline durante ese tiempo sin perder datos.

## Flujo de sync

```
Al detectar red disponible:
  1. ¿access_token válido?
     → SÍ: intentar sync
     → NO: usar refresh_token para obtener nuevo access_token
         → SÍ: intentar sync
         → NO (refresh expirado): mostrar banner, no sincronizar
                                   pero NO borrar cola de sync
  2. Sync: POST /sync/inspecciones con UUID de cada registro
  3. Si 401: repetir paso 1 (no reintentar infinito — max 3 intentos)
```

## Expiración del refresh token en campo

30 días es el límite razonable para el caso de uso. Si el inspector necesita más:
- La empresa puede configurar refresh tokens más largos (hasta 90 días).
- El inspector siempre puede hacer login offline si la app cachea un token
  de larga duración — pero esto requiere evaluación de seguridad posterior.

A la fecha de este ADR, 30 días cubre el 99% de los escenarios de campo de RENOVA.
