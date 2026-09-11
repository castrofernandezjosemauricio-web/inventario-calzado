// ============================================================
// CONFIGURACIÓN DE SUPABASE
// Acá se guarda la URL del proyecto y la clave pública (publishable key).
// Es segura para usar en el navegador porque las tablas están
// pensadas para leerse/escribirse solo desde esta app (sin RLS por ahora).
// ============================================================

const SUPABASE_URL = "https://pkojqznqpczyqycsqvtf.supabase.co";
const SUPABASE_KEY = "sb_publishable_5qr4fN8G45QMCLNzyO8-Vw_iOVcYVFh";

// Crea el cliente de Supabase que se usa en toda la app para
// hacer consultas (select/insert/update/delete) a las 3 tablas.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);