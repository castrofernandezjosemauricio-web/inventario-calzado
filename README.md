# Sistema de Gestión de Inventario - Almacén de Calzado

## Descripción

Aplicación web para la gestión de inventario de un almacén de calzado.

El sistema permite consultar y administrar artículos, controlar el stock y registrar movimientos de inventario mediante una interfaz web conectada a una base de datos en Supabase.

## Objetivo

Desarrollar una solución web que permita llevar un control organizado del inventario, facilitando la consulta de productos, el control de existencias y el registro de entradas, salidas y ajustes de inventario.

## Tecnologías utilizadas

* HTML5
* CSS3
* JavaScript
* Supabase
* Supabase JavaScript Client

## Arquitectura

La aplicación utiliza una arquitectura web cliente-servidor:

* **Frontend:** HTML, CSS y JavaScript.
* **Backend y base de datos:** Supabase.
* **Comunicación:** Supabase JavaScript Client mediante la API de Supabase.

El frontend se comunica directamente con Supabase para realizar las operaciones de consulta, creación, modificación y eliminación de información.

## Base de datos

El sistema utiliza tres tablas principales:

### 1. inventory_items

Almacena la información de los artículos.

Principales campos:

* `id`
* `sku`
* `name`
* `description`
* `category`
* `weight`
* `length`
* `width`
* `height`
* `price`
* `cost`
* `supplier`
* `created_at`

### 2. inventory

Almacena la información relacionada con el stock de cada artículo.

Principales campos:

* `id`
* `item_id`
* `quantity`
* `location`
* `min_stock`
* `max_stock`
* `updated_at`

### 3. inventory_movements

Registra los movimientos realizados sobre el inventario.

Principales campos:

* `id`
* `item_id`
* `inventory_id`
* `movement_type`
* `quantity`
* `reason`
* `status`
* `created_at`
* `approved_at`
* `notes`

## Relaciones

Las tablas están relacionadas mediante claves foráneas.

La relación principal es:

```text
inventory_items
       │
       │ item_id
       ▼
   inventory
       │
       │ inventory_id
       ▼
inventory_movements
```

Un artículo tiene un registro de inventario y puede tener múltiples movimientos registrados.

## Funcionalidades

### Dashboard

El sistema presenta información general del inventario:

* Total de artículos.
* Stock total.
* Artículos por debajo del stock mínimo.
* Valor total del inventario.
* Movimientos recientes.

### Gestión de artículos

El sistema permite:

* Crear artículos.
* Consultar artículos.
* Editar artículos.
* Eliminar artículos.
* Registrar información de inventario asociada.

### Filtros de inventario

La tabla principal permite filtrar la información por:

* Artículo o SKU.
* Categoría.
* Proveedor.
* Estado del stock.

### Gestión de movimientos

Se pueden registrar movimientos de:

* Entrada.
* Salida.
* Ajuste.

Cada movimiento registra información como cantidad, motivo, notas y estado.

### Aprobación de movimientos

Los movimientos pueden permanecer inicialmente en estado `Pendiente`.

Cuando un movimiento es aprobado, se actualiza automáticamente el stock correspondiente mediante un trigger de base de datos.

Si un movimiento es rechazado, no se realiza el cambio de stock.

## Validaciones

La aplicación incorpora validaciones en los formularios para evitar datos incorrectos.

Entre ellas:

* SKU obligatorio.
* Nombre del artículo obligatorio.
* Cantidades válidas.
* Cantidades de movimiento mayores que cero.
* Validación de precio y costo.
* Validación de stock mínimo y máximo.
* Control de salidas que superen el stock disponible.

También se muestran mensajes de error cuando una operación no puede realizarse.

## Seguridad

La base de datos utiliza **Row Level Security (RLS)** de Supabase para controlar el acceso a los datos.

Además, las operaciones realizadas desde el frontend utilizan la conexión proporcionada por Supabase.

## Datos de prueba

El sistema cuenta con datos de prueba correspondientes a artículos de calzado y movimientos de inventario.

Los datos fueron limpiados y cargados en Supabase para realizar las pruebas de funcionamiento del sistema.

## Ejecución del proyecto

El proyecto está desarrollado como una aplicación web estática.

Para ejecutarlo localmente:

1. Descargar o clonar el proyecto.
2. Abrir la carpeta del proyecto.
3. Abrir `index.html` mediante un servidor local.
4. Verificar que `config.js` contenga la configuración correspondiente de Supabase.
5. Acceder a la aplicación desde el navegador.

## Estructura del proyecto

```text
inventario-calzado/
│
├── index.html
├── style.css
├── app.js
├── config.js
└── README.md
```

## Funcionalidades adicionales implementadas

Como funcionalidades adicionales se implementaron:

* Flujo de aprobación de movimientos.
* Actualización automática del stock al aprobar movimientos.
* Seguridad mediante Row Level Security (RLS).

## Estado del proyecto

Proyecto funcional de gestión de inventario para almacén de calzado, conectado a Supabase y con las principales operaciones de consulta, administración de artículos, control de inventario y registro de movimientos.
