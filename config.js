// ============================================================
// CONFIGURACIÓN DE SUPABASE
// Acá se guarda la URL del proyecto y la clave pública (publishable key).
// Es segura para usar en el navegador porque las tablas están
// pensadas para leerse/escribirse solo desde esta app (sin RLS por ahora).
// ============================================================

const SUPABASE_URL = "https://pkojqznqpczyqycsqvtf.supabase.co";
const SUPABASE_KEY = "sb_publishable_5qr4fN8G45QMCLNzyO8-Vw_iOVcYVFh";

// Cliente de Supabase.
// La seguridad de las tablas está protegida mediante RLS
// y las políticas de roles y permisos.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);