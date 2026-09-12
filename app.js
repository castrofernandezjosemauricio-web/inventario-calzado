// ============================================================
// APP.JS - Lógica del dashboard de inventario
// Cada función tiene un comentario explicando qué hace.
// ============================================================

// --------------------------------------------------------------
// mostrarToast(mensaje, tipo)
// Muestra un aviso flotante abajo a la derecha (éxito o error),
// y lo oculta solo después de 3 segundos. Se usa para confirmar
// acciones o avisar de errores de conexión con Supabase.
// --------------------------------------------------------------
function mostrarToast(mensaje, tipo = "success") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = mensaje;
  toast.className = `toast active ${tipo}`;
  setTimeout(() => toast.classList.remove("active"), 3000);
}

// --------------------------------------------------------------
// mostrarErrorFormulario(idDiv, mensaje)
// Pinta un mensaje de error dentro del formulario (arriba del
// todo), en vez de usar alert(). Si mensaje es null, lo oculta.
// --------------------------------------------------------------
function mostrarErrorFormulario(idDiv, mensaje) {
  const div = document.getElementById(idDiv);
  if (!mensaje) {
    div.classList.remove("active");
    div.textContent = "";
    return;
  }
  div.textContent = mensaje;
  div.classList.add("active");
}

// --------------------------------------------------------------
// interpretarErrorSupabase(error)
// Traduce los errores técnicos de Postgres/Supabase a mensajes
// que un usuario del dashboard pueda entender.
// --------------------------------------------------------------
function interpretarErrorSupabase(error) {
  if (!error) return "Ocurrió un error inesperado.";
  if (error.code === "23505") return "Ya existe un artículo con ese SKU.";
  if (error.code === "23503") return "No se puede completar: hay datos relacionados (revisa las referencias).";
  if (error.message?.includes("Failed to fetch")) return "No hay conexión con la base de datos. Revisa tu internet.";
  return error.message || "Ocurrió un error inesperado.";
}

// --------------------------------------------------------------
// cambiarTab()
// Controla la navegación entre las vistas "Dashboard" y "Movimientos".
// Oculta todas las vistas y muestra solo la que corresponde al botón
// que se hizo clic (según el atributo data-tab).
// --------------------------------------------------------------
function cambiarTab(nombre) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === nombre);
  });
  document.querySelectorAll(".view").forEach(v => {
    v.classList.toggle("active", v.id === "view-" + nombre);
  });
}
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => cambiarTab(btn.dataset.tab));
});

// --------------------------------------------------------------
// obtenerInventarioCompleto()
// Trae de Supabase el JOIN entre inventory_items e inventory.
// Esta es la consulta base que usan tanto las métricas como la
// tabla principal y los filtros.
// --------------------------------------------------------------
async function obtenerInventarioCompleto() {
  const { data, error } = await supabaseClient
    .from("inventory")
    .select(`
      id, quantity, location, min_stock, max_stock,
      inventory_items ( id, sku, name, description, category, supplier, price, cost, weight, length, width, height )
    `);

  if (error) {
    console.error("Error cargando inventario:", error);
    return [];
  }
  return data;
}

// --------------------------------------------------------------
// calcularMetricas(filas)
// Recibe las filas del inventario y calcula:
// total de artículos, stock total, cuántos están bajo el mínimo,
// y el valor total (cantidad * precio) sumado de todo el inventario.
// --------------------------------------------------------------
function calcularMetricas(filas) {
  const totalArticulos = filas.length;
  const stockTotal = filas.reduce((sum, f) => sum + (f.quantity || 0), 0);
  const bajoStock = filas.filter(f => f.quantity < (f.min_stock || 0)).length;
  const valorTotal = filas.reduce((sum, f) => {
    const precio = f.inventory_items?.price || 0;
    return sum + precio * (f.quantity || 0);
  }, 0);

  document.getElementById("m-total-articulos").textContent = totalArticulos;
  document.getElementById("m-stock-total").textContent = stockTotal;
  document.getElementById("m-bajo-stock").textContent = bajoStock;
  document.getElementById("m-valor-total").textContent =
    "S/ " + valorTotal.toFixed(2);
}

// --------------------------------------------------------------
// renderizarTablaInventario(filas)
// Dibuja la tabla principal de inventario en el HTML, fila por fila.
// Agrega un badge de estado (OK / Bajo) y los botones de Editar/Eliminar.
// --------------------------------------------------------------
function renderizarTablaInventario(filas) {
  const tbody = document.querySelector("#tabla-inventario tbody");
  tbody.innerHTML = "";

  filas.forEach(f => {
    const item = f.inventory_items;
    const bajo = f.quantity < (f.min_stock || 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.sku}</td>
      <td>${item.name}</td>
      <td>${item.category || "-"}</td>
      <td>${f.quantity}</td>
      <td>${(item.cost ?? 0).toFixed(2)}</td>
      <td>${(item.price ?? 0).toFixed(2)}</td>
      <td>${item.supplier || "-"}</td>
      <td><span class="badge ${bajo ? "badge-bajo" : "badge-ok"}">${bajo ? "Bajo mínimo" : "Suficiente"}</span></td>
      <td>
        <button class="btn-icon" data-editar="${f.id}">✏️</button>
        <button class="btn-icon" data-eliminar="${f.id}">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // engancha los botones de editar/eliminar recién creados
  tbody.querySelectorAll("[data-editar]").forEach(btn => {
    btn.addEventListener("click", () => abrirModalArticulo(btn.dataset.editar));
  });
  tbody.querySelectorAll("[data-eliminar]").forEach(btn => {
    btn.addEventListener("click", () => eliminarArticulo(btn.dataset.eliminar));
  });
}

// --------------------------------------------------------------
// poblarFiltros(filas)
// Llena los <select> de categoría y proveedor con los valores
// únicos que existen en la data, para que el usuario filtre por ellos.
// --------------------------------------------------------------
function poblarFiltros(filas) {
  const categorias = [...new Set(filas.map(f => f.inventory_items.category).filter(Boolean))];
  const proveedores = [...new Set(filas.map(f => f.inventory_items.supplier).filter(Boolean))];

  const selCat = document.getElementById("f-categoria");
  const selProv = document.getElementById("f-proveedor");

  selCat.innerHTML = '<option value="">Categoría: Todas</option>' +
    categorias.map(c => `<option value="${c}">${c}</option>`).join("");
  selProv.innerHTML = '<option value="">Proveedor: Todos</option>' +
    proveedores.map(p => `<option value="${p}">${p}</option>`).join("");
}

// --------------------------------------------------------------
// aplicarFiltros(filas)
// Filtra en memoria las filas según lo escrito en el buscador y
// lo seleccionado en los 3 <select>. Se llama cada vez que el
// usuario escribe o cambia un filtro.
// --------------------------------------------------------------
function aplicarFiltros(filas) {
  const texto = document.getElementById("f-buscar").value.toLowerCase();
  const categoria = document.getElementById("f-categoria").value;
  const proveedor = document.getElementById("f-proveedor").value;
  const stock = document.getElementById("f-stock").value;

  return filas.filter(f => {
    const item = f.inventory_items;
    const coincideTexto = !texto ||
      item.name.toLowerCase().includes(texto) ||
      item.sku.toLowerCase().includes(texto);
    const coincideCategoria = !categoria || item.category === categoria;
    const coincideProveedor = !proveedor || item.supplier === proveedor;
    const bajo = f.quantity < (f.min_stock || 0);
    const coincideStock = !stock || (stock === "bajo" ? bajo : !bajo);

    return coincideTexto && coincideCategoria && coincideProveedor && coincideStock;
  });
}

// guarda la última data cargada, para no re-consultar Supabase en cada filtro
let inventarioCache = [];

// --------------------------------------------------------------
// cargarDashboard()
// Función principal que arma todo el dashboard: consulta la data,
// calcula métricas, pinta la tabla y llena los filtros.
// --------------------------------------------------------------
async function cargarDashboard() {
  inventarioCache = await obtenerInventarioCompleto();
  calcularMetricas(inventarioCache);
  poblarFiltros(inventarioCache);
  renderizarTablaInventario(inventarioCache);
  cargarMovimientosRecientes();
}

// vuelve a filtrar y renderizar cada vez que el usuario interactúa con los filtros
["f-buscar", "f-categoria", "f-proveedor", "f-stock"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    renderizarTablaInventario(aplicarFiltros(inventarioCache));
  });
});

// --------------------------------------------------------------
// cargarMovimientosRecientes()
// Trae los últimos 5 movimientos (ordenados por fecha de creación)
// para mostrarlos en la sección "Movimientos recientes" del dashboard.
// --------------------------------------------------------------
async function cargarMovimientosRecientes() {
  const { data, error } = await supabaseClient
    .from("inventory_movements")
    .select(`
      id, movement_type, quantity, status, created_at,
      inventory ( inventory_items ( name ) )
    `)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) { console.error(error); return; }

  const tbody = document.querySelector("#tabla-recientes tbody");
  tbody.innerHTML = data.map(m => `
    <tr>
      <td>${new Date(m.created_at).toLocaleDateString("es-PE")}</td>
      <td>${m.inventory?.inventory_items?.name || "-"}</td>
      <td>${m.movement_type}</td>
      <td>${m.quantity}</td>
      <td><span class="badge badge-${m.status.toLowerCase()}">${m.status}</span></td>
    </tr>
  `).join("");
}

// ============================================================
// MODAL: CREAR / EDITAR ARTÍCULO
// ============================================================

// --------------------------------------------------------------
// abrirModalArticulo(inventoryId)
// Abre el formulario de artículo. Si recibe un inventoryId, lo
// llena con los datos existentes (modo edición); si no, lo deja
// vacío (modo creación).
// --------------------------------------------------------------
async function abrirModalArticulo(inventoryId) {
  const modal = document.getElementById("modal-articulo");
  const form = document.getElementById("form-articulo");
  form.reset();

  if (inventoryId) {
    const fila = inventarioCache.find(f => f.id === inventoryId);
    document.getElementById("modal-articulo-titulo").textContent = "Editar artículo";
    document.getElementById("art-item-id").value = fila.inventory_items.id;
    document.getElementById("art-inventory-id").value = fila.id;
    document.getElementById("art-sku").value = fila.inventory_items.sku;
    document.getElementById("art-name").value = fila.inventory_items.name;
    document.getElementById("art-category").value = fila.inventory_items.category || "";
    document.getElementById("art-supplier").value = fila.inventory_items.supplier || "";
    document.getElementById("art-description").value = fila.inventory_items.description || "";
    document.getElementById("art-weight").value = fila.inventory_items.weight || "";
    document.getElementById("art-length").value = fila.inventory_items.length || "";
    document.getElementById("art-width").value = fila.inventory_items.width || "";
    document.getElementById("art-height").value = fila.inventory_items.height || "";
    document.getElementById("art-price").value = fila.inventory_items.price || "";
    document.getElementById("art-cost").value = fila.inventory_items.cost || "";
    document.getElementById("art-quantity").value = fila.quantity;
    document.getElementById("art-location").value = fila.location || "";
    document.getElementById("art-min-stock").value = fila.min_stock || "";
    document.getElementById("art-max-stock").value = fila.max_stock || "";
  } else {
    document.getElementById("modal-articulo-titulo").textContent = "Nuevo artículo";
    document.getElementById("art-item-id").value = "";
    document.getElementById("art-inventory-id").value = "";
  }

  modal.classList.add("active");
}

document.getElementById("btn-nuevo-articulo").addEventListener("click", () => abrirModalArticulo(null));
document.getElementById("btn-cancelar-articulo").addEventListener("click", () => {
  document.getElementById("modal-articulo").classList.remove("active");
});

// --------------------------------------------------------------
// validarFormularioArticulo()
// Revisa las reglas de negocio que un "required" de HTML no cubre:
// SKU sin espacios vacíos, precio/costo no negativos, cantidad no negativa.
// Devuelve un mensaje de error (string) o null si todo está bien.
// --------------------------------------------------------------
function validarFormularioArticulo() {
  const sku = document.getElementById("art-sku").value.trim();
  const name = document.getElementById("art-name").value.trim();
  const price = document.getElementById("art-price").value;
  const cost = document.getElementById("art-cost").value;
  const quantity = document.getElementById("art-quantity").value;
  const minStock = document.getElementById("art-min-stock").value;
  const maxStock = document.getElementById("art-max-stock").value;

  if (!sku) return "El SKU es obligatorio.";
  if (!name) return "El nombre es obligatorio.";
  if (quantity === "" || Number(quantity) < 0) return "La cantidad no puede ser negativa.";
  if (price !== "" && Number(price) < 0) return "El precio no puede ser negativo.";
  if (cost !== "" && Number(cost) < 0) return "El costo no puede ser negativo.";
  if (minStock !== "" && maxStock !== "" && Number(minStock) > Number(maxStock)) {
    return "El stock mínimo no puede ser mayor que el stock máximo.";
  }
  return null;
}

// --------------------------------------------------------------
// guardarArticulo(event)
// Se dispara al enviar el formulario de artículo.
// - Valida primero (validarFormularioArticulo)
// - Si art-item-id está vacío -> INSERT (crea artículo + registro de inventario)
// - Si tiene valor -> UPDATE (edita ambas tablas)
// - Cualquier error de Supabase se muestra traducido, sin romper la página
// --------------------------------------------------------------
document.getElementById("form-articulo").addEventListener("submit", async (e) => {
  e.preventDefault();
  mostrarErrorFormulario("art-form-error", null);

  const errorValidacion = validarFormularioArticulo();
  if (errorValidacion) {
    mostrarErrorFormulario("art-form-error", errorValidacion);
    return;
  }

  const itemId = document.getElementById("art-item-id").value;
  const inventoryId = document.getElementById("art-inventory-id").value;

  const datosItem = {
    sku: document.getElementById("art-sku").value,
    name: document.getElementById("art-name").value,
    category: document.getElementById("art-category").value,
    supplier: document.getElementById("art-supplier").value,
    description: document.getElementById("art-description").value,
    weight: document.getElementById("art-weight").value || null,
    length: document.getElementById("art-length").value || null,
    width: document.getElementById("art-width").value || null,
    height: document.getElementById("art-height").value || null,
    price: document.getElementById("art-price").value || null,
    cost: document.getElementById("art-cost").value || null,
  };

  const datosInventario = {
    quantity: document.getElementById("art-quantity").value,
    location: document.getElementById("art-location").value,
    min_stock: document.getElementById("art-min-stock").value || null,
    max_stock: document.getElementById("art-max-stock").value || null,
    updated_at: new Date().toISOString(),
  };

  try {
    if (itemId) {
      // modo edición: actualiza las dos tablas
      const { error: e1 } = await supabaseClient.from("inventory_items").update(datosItem).eq("id", itemId);
      if (e1) throw e1;
      const { error: e2 } = await supabaseClient.from("inventory").update(datosInventario).eq("id", inventoryId);
      if (e2) throw e2;
    } else {
      // modo creación: primero el artículo, luego su registro de inventario
      const { data: nuevoItem, error: e1 } = await supabaseClient
        .from("inventory_items").insert(datosItem).select().single();
      if (e1) throw e1;

      const { error: e2 } = await supabaseClient.from("inventory")
        .insert({ ...datosInventario, item_id: nuevoItem.id });
      if (e2) throw e2;
    }

    document.getElementById("modal-articulo").classList.remove("active");
    mostrarToast(itemId ? "Artículo actualizado" : "Artículo creado");
    cargarDashboard();

  } catch (error) {
    mostrarErrorFormulario("art-form-error", interpretarErrorSupabase(error));
  }
});

// --------------------------------------------------------------
// eliminarArticulo(inventoryId)
// Borra un artículo completo: primero sus movimientos (por la FK),
// luego el registro de inventario, y al final el artículo del catálogo.
// --------------------------------------------------------------
async function eliminarArticulo(inventoryId) {
  if (!confirm("¿Eliminar este artículo? Esta acción no se puede deshacer.")) return;

  const fila = inventarioCache.find(f => f.id === inventoryId);

  try {
    const { error: e1 } = await supabaseClient.from("inventory_movements").delete().eq("inventory_id", inventoryId);
    if (e1) throw e1;
    const { error: e2 } = await supabaseClient.from("inventory").delete().eq("id", inventoryId);
    if (e2) throw e2;
    const { error: e3 } = await supabaseClient.from("inventory_items").delete().eq("id", fila.inventory_items.id);
    if (e3) throw e3;

    mostrarToast("Artículo eliminado");
    cargarDashboard();
  } catch (error) {
    mostrarToast(interpretarErrorSupabase(error), "error");
  }
}

// ============================================================
// MOVIMIENTOS
// ============================================================

// --------------------------------------------------------------
// cargarTablaMovimientos()
// Trae TODOS los movimientos (no solo los recientes) para la
// vista "Movimientos", con botones Aprobar/Rechazar si están Pendiente.
// --------------------------------------------------------------
async function cargarTablaMovimientos() {
  const { data, error } = await supabaseClient
    .from("inventory_movements")
    .select(`
      id, movement_type, quantity, reason, status, created_at,
      inventory ( inventory_items ( sku, name ) )
    `)
    .order("created_at", { ascending: false });

  if (error) { console.error(error); return; }

  const tbody = document.querySelector("#tabla-movimientos tbody");
  tbody.innerHTML = data.map(m => `
    <tr>
      <td>${new Date(m.created_at).toLocaleDateString("es-PE")}</td>
      <td>${m.inventory?.inventory_items?.sku || "-"}</td>
      <td>${m.inventory?.inventory_items?.name || "-"}</td>
      <td>${m.movement_type}</td>
      <td>${m.quantity}</td>
      <td>${m.reason || "-"}</td>
      <td><span class="badge badge-${m.status.toLowerCase()}">${m.status}</span></td>
      <td>
        ${m.status === "Pendiente" ? `
          <button class="btn-icon" data-aprobar="${m.id}">✅</button>
          <button class="btn-icon" data-rechazar="${m.id}">❌</button>
        ` : "-"}
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-aprobar]").forEach(btn => {
    btn.addEventListener("click", () => cambiarEstadoMovimiento(btn.dataset.aprobar, "Aprobado"));
  });
  tbody.querySelectorAll("[data-rechazar]").forEach(btn => {
    btn.addEventListener("click", () => cambiarEstadoMovimiento(btn.dataset.rechazar, "Rechazado"));
  });
}

// --------------------------------------------------------------
// cambiarEstadoMovimiento(id, nuevoEstado)
// Actualiza el status del movimiento. El UPDATE dispara el
// trigger trg_actualizar_stock en Supabase, que ya se encarga
// de sumar/restar el stock automáticamente si el estado es Aprobado.
// --------------------------------------------------------------
async function cambiarEstadoMovimiento(id, nuevoEstado) {
  const { error } = await supabaseClient
    .from("inventory_movements")
    .update({ status: nuevoEstado })
    .eq("id", id);

  if (error) {
    mostrarToast(interpretarErrorSupabase(error), "error");
    return;
  }

  mostrarToast(`Movimiento ${nuevoEstado.toLowerCase()}`);
  cargarTablaMovimientos();
  cargarDashboard(); // refresca el stock en el dashboard también
}

// --------------------------------------------------------------
// abrirModalMovimiento()
// Abre el formulario de nuevo movimiento y llena el <select> de
// artículos con todos los disponibles en inventory (para elegir a cuál
// se le hace el movimiento).
// --------------------------------------------------------------
function abrirModalMovimiento() {
  const select = document.getElementById("mov-item");
  select.innerHTML = inventarioCache.map(f =>
    `<option value="${f.id}">${f.inventory_items.sku} - ${f.inventory_items.name}</option>`
  ).join("");

  document.getElementById("form-movimiento").reset();
  document.getElementById("modal-movimiento").classList.add("active");
}

document.getElementById("btn-nuevo-movimiento").addEventListener("click", abrirModalMovimiento);
document.getElementById("btn-cancelar-movimiento").addEventListener("click", () => {
  document.getElementById("modal-movimiento").classList.remove("active");
});

// --------------------------------------------------------------
// guardarMovimiento(event)
// Valida cantidad > 0, y en caso de "Salida" avisa (sin bloquear)
// si la cantidad pedida supera el stock actual del artículo.
// Crea el movimiento en estado "Pendiente" (nunca toca el stock
// directamente - eso solo pasa cuando se aprueba, vía el trigger SQL).
// --------------------------------------------------------------
document.getElementById("form-movimiento").addEventListener("submit", async (e) => {
  e.preventDefault();
  mostrarErrorFormulario("mov-form-error", null);

  const inventoryId = document.getElementById("mov-item").value;
  const tipo = document.querySelector('input[name="mov-tipo"]:checked').value;
  const cantidad = Number(document.getElementById("mov-cantidad").value);

  if (!inventoryId) {
    mostrarErrorFormulario("mov-form-error", "Selecciona un artículo.");
    return;
  }
  if (!cantidad || cantidad <= 0) {
    mostrarErrorFormulario("mov-form-error", "La cantidad debe ser mayor a 0.");
    return;
  }
  if (tipo === "Salida") {
    const fila = inventarioCache.find(f => f.id === inventoryId);
    if (fila && cantidad > fila.quantity) {
      mostrarErrorFormulario(
        "mov-form-error",
        `Aviso: pediste ${cantidad}, pero solo hay ${fila.quantity} en stock. Puedes crearlo igual, pero revisa el motivo antes de aprobarlo.`
      );
    }
  }

  try {
    const { error } = await supabaseClient.from("inventory_movements").insert({
      inventory_id: inventoryId,
      movement_type: tipo,
      quantity: cantidad,
      reason: document.getElementById("mov-motivo").value,
      notes: document.getElementById("mov-notas").value,
      status: "Pendiente",
    });
    if (error) throw error;

    document.getElementById("modal-movimiento").classList.remove("active");
    mostrarToast("Movimiento creado en estado Pendiente");
    cargarTablaMovimientos();
    cargarDashboard();
  } catch (error) {
    mostrarErrorFormulario("mov-form-error", interpretarErrorSupabase(error));
  }
});

// ============================================================
// INICIO: carga todo al abrir la página
// ============================================================
cargarDashboard();
cargarTablaMovimientos();