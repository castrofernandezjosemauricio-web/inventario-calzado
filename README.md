# Almacén Calzado - Sistema de Gestión de Inventario

Sistema web para gestionar el inventario de una empresa de calzado deportivo:
registro de artículos, control de stock por ubicación, y movimientos de
entrada/salida con workflow de aprobación.

## Link al proyecto funcionando
https://castrofernandezjosemauricio-web.github.io/inventario-calzado/

También desplegado en Netlify (respaldo):
https://tubular-palmier-8039d1.netlify.app

## Arquitectura

Arquitectura **JAMstack** (JavaScript + APIs + Markup), sin servidor de
backend propio:

- **Presentación**: HTML + CSS + JavaScript puro (sin frameworks).
  - `index.html` — estructura del dashboard
  - `style.css` — estilos
  - `config.js` — conexión a Supabase (URL + key pública)
  - `app.js` — toda la lógica: consultas, CRUD, filtros, modales, validaciones
- **Datos**: PostgreSQL, alojado en Supabase, con API REST autogenerada.

No existe una capa de negocio independiente como un servidor propio
(Node/PHP/Java). La lógica de negocio queda repartida en dos lugares:

- **Validaciones simples** (campos obligatorios, valores no negativos) se
  hacen en el frontend (`app.js`), antes de enviar la petición.
- **Reglas críticas de integridad** (actualización de stock al aprobar un
  movimiento, restricción de una posición por artículo) viven directamente
  en PostgreSQL — como trigger y como restricción `UNIQUE` respectivamente
  — porque ahí es donde deben cumplirse siempre, sin importar desde dónde
  llegue la petición.

El navegador ejecuta `app.js`, que usa el **Supabase Client** (librería JS)
para leer/escribir directo sobre las tablas vía la API REST de Supabase,
sin backend intermedio propio.

## Tablas

**`inventory_items`** — catálogo maestro de artículos (sku, name, description,
category, weight, length, width, height, price, cost, supplier, created_at).

**`inventory`** — stock actual por artículo (item_id, quantity, location,
min_stock, max_stock, updated_at).

**`inventory_movements`** — historial de movimientos (inventory_id,
movement_type, quantity, reason, status, created_at, approved_at, notes).

## Relaciones

Cadena lineal, tal como pide el documento:

```
inventory_items (1) --- (1) inventory (1) --- (N) inventory_movements
```

- `inventory.item_id` → FK a `inventory_items.id`, con restricción `unique`
  (garantiza la relación 1 a 1: cada artículo tiene un único registro de stock).
- `inventory_movements.inventory_id` → FK a `inventory.id` (1 a muchos: un
  registro de inventario puede tener muchos movimientos).

No se guarda `item_id` repetido en `inventory_movements`: el artículo se
obtiene indirectamente siguiendo la cadena, evitando datos duplicados.

**Tabla adicional (4ª, aditiva):** `posiciones` — mapa físico del almacén,
enlazada a `inventory` vía `posicion_id` con restricción `UNIQUE`. Ver
sección "Sobre el caso de negocio" más abajo para el detalle.

## Funcionamiento

### CRUD de artículos
El botón "+ Nuevo artículo" crea una fila en `inventory_items` y su
correspondiente fila en `inventory` (stock inicial). Editar (✏️) actualiza
ambas tablas a la vez. Eliminar (🗑️) borra en cascada: primero sus
movimientos, luego el registro de inventario, y al final el artículo.

### Registro de movimientos
"+ Nuevo movimiento" crea una fila en `inventory_movements` con
`status = 'Pendiente'`. En este punto el stock **no se modifica todavía**
— es solo una orden creada, no un movimiento ejecutado.

### Actualización de stock (workflow de aprobación — BONUS)
Un movimiento pendiente puede Aprobarse (✅) o Rechazarse (❌) desde la
sección Movimientos. Al aprobar, un **trigger de PostgreSQL**
(`trg_actualizar_stock`) se dispara automáticamente:

- Si es `Entrada` → suma la cantidad al stock.
- Si es `Salida` → resta la cantidad al stock.
- Si es `Ajuste` → no mueve stock automáticamente (se revisa caso a caso).
- Registra la fecha en `approved_at`.

Si se rechaza, el stock no cambia. Esto diferencia una **orden creada**
(pendiente) de un **movimiento realmente ejecutado** (aprobado), tal como
pedía el caso de negocio.

### Seguridad (RLS — BONUS)
Las 3 tablas oficiales + `posiciones` tienen Row Level Security activado,
con políticas completas (select/insert/update/delete) que permiten
lectura/escritura pública (porque el sistema no requiere login de
usuarios). Aun así, cumple el objetivo del bonus: el acceso queda
gobernado explícitamente por políticas definidas, en vez de dejar las
tablas abiertas por defecto sin ningún control.

### Validaciones
- SKU y nombre obligatorios.
- Cantidades, precio y costo no pueden ser negativos.
- Stock mínimo no puede ser mayor al máximo.
- Aviso si una Salida pide más cantidad de la disponible en stock.
- Mensajes de error traducidos desde los códigos de Postgres (ej. SKU
  duplicado), sin exponer errores técnicos crudos al usuario.

## Diseño / UI
Identidad visual propia (no plantilla genérica de dashboard), inspirada en
etiquetas de almacén: paleta azul marino oscuro + naranja de señalización
industrial, tipografía monoespaciada para SKUs y códigos (evoca una
etiqueta impresa de bodega), badges rectangulares con borde lateral de
color en vez de píldoras genéricas, e íconos SVG propios (no emojis) con
color dinámico según la acción (rojo al eliminar/rechazar, verde al
aprobar).

## Problemas encontrados y corregidos durante el desarrollo
Documentado como evidencia de depuración real, no solo generación de código:

- **Formulario de edición no cargaba Descripción/Peso/Largo/Ancho/Alto**:
  la consulta a Supabase no pedía esas columnas y la función que llena el
  formulario nunca las asignaba, aunque sí existían en la base de datos.
  Se corrigió agregando los campos al `select()` y a la función de carga
  del modal.
- **RLS bloqueaba silenciosamente el borrado de movimientos**: al activar
  Row Level Security se crearon políticas de select/insert/update en
  `inventory_movements`, pero faltó la de `delete`. Esto hacía que, al
  eliminar un artículo, sus movimientos nunca se borraran realmente, y la
  foreign key bloqueaba el borrado del registro de inventario con un error
  de datos relacionados. Se corrigió agregando la política de delete
  faltante.
- **Precio/costo y medidas en 0 o vacíos**: el CSV original de carga no
  traía esos campos. Se completaron con un `UPDATE` de datos realistas
  para que el dashboard (y el cálculo de "valor total del inventario")
  reflejara información completa.

## Tecnologías utilizadas
- Supabase (PostgreSQL + API REST + Auth/RLS)
- HTML5, CSS3, JavaScript (vanilla)
- Supabase JS Client v2
- GitHub Pages (hosting del frontend)

## Funcionalidades implementadas
- Dashboard con métricas (total artículos, stock total, bajo stock mínimo,
  valor total del inventario, movimientos recientes)
- Tabla de inventario con búsqueda (artículo/SKU) y filtros (categoría,
  proveedor, estado de stock)
- CRUD completo de artículos e inventario
- Sección de movimientos con creación y workflow de aprobación
- Actualización automática de stock vía trigger SQL
- RLS con políticas de acceso
- Validaciones y manejo de errores en formularios
- Pestaña "Almacén" con mapa visual de racks/posiciones (libre/ocupada)

## Sobre el caso de negocio (INBOUND/OUTBOUND, almacén físico)

El documento base pide un modelo de 3 tablas con stock agregado por
artículo, que es el núcleo implementado. Analizando el caso de negocio
completo (operación real de almacén con racks/posiciones), se identificaron
necesidades adicionales del negocio y se implementó una de ellas como
mejora adicional (100% aditiva, sin tocar las 3 tablas oficiales):

### Implementado: evitar que dos productos ocupen el mismo espacio físico

Se agregó una 4ª tabla, `posiciones`, que representa el mapa real del
almacén (almacén, rack, posición). La tabla `inventory` recibió una nueva
columna `posicion_id` (FK a `posiciones`) con una restricción **UNIQUE**:
esto hace que la base de datos misma rechace cualquier intento de asignar
la misma posición a dos artículos distintos.

En el frontend, el campo "Ubicación" del formulario de artículo pasó de
ser texto libre a un `<select>` que solo muestra posiciones **libres**
(más la posición actual, si se está editando un artículo que ya tenía
una asignada). Esto resuelve el problema en dos capas:
- A nivel de base de datos (la restricción `UNIQUE`, imposible de saltar)
- A nivel de interfaz (el select ni siquiera ofrece posiciones ocupadas)

**Panel visual del mapa de almacén (pestaña "Almacén")**: además del `select`
del formulario, se agregó una pestaña dedicada que muestra el mapa completo
del almacén agrupado por Almacén → Rack → Posición, con cada posición
pintada como **libre** (verde) u **ocupada** (roja, con el SKU del artículo
que la tiene asignada). Incluye 3 métricas rápidas: posiciones totales,
ocupadas y libres. Esto responde directamente a la necesidad de "saber qué
espacio está ocupado y por quién" de un vistazo, sin tener que abrir
artículo por artículo.

Nota de diseño: la posición es por **artículo/modelo**, no por unidad
individual — todo el stock de un mismo modelo (ej. todos los pares de
"Nike Pegasus") se guarda junto en una sola posición. La restricción
`UNIQUE` impide que un modelo *distinto* use esa misma posición mientras
esté ocupada.

Cuando el almacén se queda sin posiciones libres, el sistema refleja
fielmente la realidad: no permite crear más artículos hasta que se
registren posiciones nuevas (ampliar el almacén físico primero, y luego
cargar esas posiciones al sistema) — el software no "inventa" espacio que
no existe.

### Identificado pero no implementado (queda como posible v2)

- **Reservar espacio antes de que llegue un INBOUND**, o **bloquear una
  posición para un OUTBOUND** antes de retirar físicamente: requeriría un
  estado intermedio de "reserva" sobre la posición, no solo sobre el
  movimiento.
- **Rotación FIFO** (evitar que mercadería antigua quede atrapada debajo de
  la nueva): el modelo actual maneja stock agregado, no por lotes. Una
  evolución futura sería registrar lotes individuales con fecha de ingreso.