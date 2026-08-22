# Escala (dónde se enchufa)

El MVP no implementa esto. Cada ítem indica el archivo, no un rediseño.

| Qué | Dónde |
|---|---|
| Quinto frigorífico (p. ej. Sasula) | Fila en `data/seed.json` (`locations` + `aliases`). La tabla de stock recorre `kind = bodega`. |
| Más lotes / variedades | `data/seed.json` → `lots` (y saldos en `stock`). |
| Ajuste de inventario | Nuevo valor en el enum de `lib/stock.ts` (`applyMovement`) y una frase en `lib/parse.ts`. Misma transacción. |
| Clientes (62 nombres de entregas) | Tabla `clients` + `to_id` de egreso; hoy el destino de egreso es `externo` y el nombre puede ir en `notes`. |
| Remito, DTV, transporte, calibre | Hoy `remito` + `notes`. Cuando se filtren, columnas nuevas en `movements` (migración SQL en `lib/db.ts`). |
| Kg como unidad de piso | `applyMovement` valida `bags`; agregar `unit` o convertir con `kg_per_bag` en el mismo archivo. |
| Importar el .xls histórico | Script one-shot que inserte filas en `movements` y recorra `applyMovement`. No parsear Excel en el request. |
| Usuarios / quién cargó | Columna `user` en `movements`. Auth después; el motor no depende de ella. |
| STT aparte de Web Speech | El micrófono solo llena el campo (`app/page.tsx`, pestaña Movimientos). Cualquier STT que devuelva texto entra al mismo `POST /api/parse`. |
| Otro parser / LLM gratis | Sustituir el cuerpo de `parseMovement` en `lib/parse.ts`. `applyMovement` no se toca. |
| Postgres / otra DB | Conservar `applyMovement`. El adaptador está en `lib/db.ts` (hoy: archivo local o Turso). |

Atajos actuales (`ponytail:` en código): parser por reglas incompleto frente a remitos narrados; saldo denormalizado en `stock` (el historial alcanza para reconstruir si hace falta un recálculo).
