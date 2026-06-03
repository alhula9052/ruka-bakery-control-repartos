import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método no permitido' })
  }
  try {
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      return json(500, { error: 'Faltan variables de entorno de Supabase en Netlify.' })
    }

    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader) return json(401, { error: 'No autorizado' })
    const token = authHeader.replace('Bearer ', '')

    const supabaseUser = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data: authData, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !authData.user) return json(401, { error: 'Sesión inválida' })

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role,is_active')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
      return json(403, { error: 'Solo administradores pueden crear usuarios.' })
    }

    const body = JSON.parse(event.body || '{}')
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const full_name = String(body.full_name || '').trim()
    const username = String(body.username || '').trim()
    const role = String(body.role || 'cajera')

    if (!email || !password || !full_name || !username) {
      return json(400, { error: 'Faltan datos obligatorios.' })
    }
    if (!['admin', 'cajera'].includes(role)) {
      return json(400, { error: 'Rol inválido.' })
    }
    if (password.length < 6) {
      return json(400, { error: 'La clave debe tener al menos 6 caracteres.' })
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })
    if (createError) return json(400, { error: createError.message })

    const { data: savedProfile, error: saveError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: created.user.id, username, full_name, role, is_active: true })
      .select()
      .single()
    if (saveError) return json(400, { error: saveError.message })

    return json(200, { message: 'Usuario creado correctamente.', profile: savedProfile })
  } catch (error) {
    return json(500, { error: error.message || 'Error interno' })
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}
