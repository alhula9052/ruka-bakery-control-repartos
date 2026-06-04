import { createClient } from '@supabase/supabase-js'
import Chart from 'chart.js/auto'
import '../styles/styles.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const $ = (id) => document.getElementById(id)

const RUKA_LOGO_URL = 'https://xmbvyqxrjxtzcfzxcldt.supabase.co/storage/v1/object/sign/imagenes/logo-ruka.jpeg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8wMGM2OGI5MC00MGRkLTQ5ZWQtYWI5OC0yYmVmZjZjOTYyYzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZW5lcy9sb2dvLXJ1a2EuanBlZyIsImlhdCI6MTc4MDUzNDE0MCwiZXhwIjo0OTM0MTM0MTQwfQ.LJZIKuofvB4v_rGtNrL-umjsPxznTKr5L9hsYA5XL4E'

const money = (n) => new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
}).format(Number(n || 0))

const numberCL = (n) => new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 0
}).format(Number(n || 0))

const parseMoney = (value) => Number(String(value ?? '').replace(/[^0-9-]/g, '')) || 0

function formatMoneyInputValue(input) {
  input.value = input.value ? numberCL(parseMoney(input.value)) : ''
}

function bindMoneyInput(input, onChange = () => {}) {
  if (!input) return
  input.addEventListener('input', () => {
    formatMoneyInputValue(input)
    onChange(parseMoney(input.value))
  })
  input.addEventListener('blur', () => formatMoneyInputValue(input))
}

function cleanRut(value) {
  return String(value || '').replace(/[^0-9kK]/g, '').toUpperCase()
}

function formatRut(value) {
  const clean = cleanRut(value)
  if (!clean) return ''
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return body ? `${formattedBody}-${dv}` : dv
}

function validateRut(value) {
  const clean = cleanRut(value)
  if (clean.length < 2) return false

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  if (!/^\d+$/.test(body)) return false

  let sum = 0
  let multiplier = 2

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const result = 11 - (sum % 11)
  const expected = result === 11 ? '0' : result === 10 ? 'K' : String(result)
  return expected === dv
}

function bindRutInput(input) {
  if (!input) return
  input.addEventListener('input', () => { input.value = formatRut(input.value) })
  input.addEventListener('blur', () => { input.value = formatRut(input.value) })
}

function chileDateTimeParts() {
  const now = new Date()

  const dateParts = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)

  const timeParts = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  }).formatToParts(now)

  const getDate = (type) => dateParts.find(p => p.type === type)?.value || ''
  const getTime = (type) => timeParts.find(p => p.type === type)?.value || ''

  return {
    year: getDate('year'),
    month: getDate('month'),
    day: getDate('day'),
    hour: getTime('hour'),
    minute: getTime('minute')
  }
}

const today = () => {
  const p = chileDateTimeParts()
  return `${p.year}-${p.month}-${p.day}`
}

const nowTime = () => {
  const p = chileDateTimeParts()
  return `${p.hour}:${p.minute}`
}

const safe = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#039;',
  '"': '&quot;'
}[c]))

const state = {
  user: null,
  profile: null,
  section: 'dashboard',
  drivers: [],
  clients: [],
  renditions: [],
  profiles: [],
  currentRendition: null,
  draft: emptyDraft(),
  editingId: null,
}

const driverChartColors = [
  'rgba(204, 113, 43, 0.75)',
  'rgba(96, 62, 38, 0.75)',
  'rgba(226, 157, 74, 0.75)',
  'rgba(132, 77, 42, 0.75)',
  'rgba(245, 196, 112, 0.75)',
  'rgba(92, 130, 91, 0.75)',
  'rgba(78, 108, 151, 0.75)'
]

const driverChartBorderColors = [
  'rgba(204, 113, 43, 1)',
  'rgba(96, 62, 38, 1)',
  'rgba(226, 157, 74, 1)',
  'rgba(132, 77, 42, 1)',
  'rgba(245, 196, 112, 1)',
  'rgba(92, 130, 91, 1)',
  'rgba(78, 108, 151, 1)'
]

let dashboardActivityChart = null
let dashboardStatusChart = null

function emptyDraft() {
  return {
    driver: null,
    clients: [],
    expenses: [],
    received: 0,
    observations: '',
  }
}

init()

async function init() {
  renderLogin()
  const { data } = await supabase.auth.getSession()
  if (data.session) await boot(data.session.user)
}

function renderLogin() {
  document.body.className = ''
  $('app').innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="login-hero">
          <div class="brand brand-logo login-logo">
            <img src="${RUKA_LOGO_URL}" alt="Ruka Bakery">
          </div>

          <h1>Control de rendición de repartos</h1>
          <p>Registro operativo de clientes visitados, gastos, dinero recibido, diferencias, transferencias y comprobantes de caja.</p>

          <div class="chips">
            <span class="chip">Rendición diaria</span>
            <span class="chip">Clientes seleccionables</span>
            <span class="chip">Comprobante de caja</span>
          </div>
        </div>

        <form class="login-form" id="loginForm" autocomplete="on">
          <h2>Ingresar al sistema</h2>
          <p class="muted">Ingresa con tu correo y clave autorizados.</p>

          <div class="field">
            <label for="email">Correo</label>
            <input class="input" id="email" type="email" autocomplete="email" required />
          </div>

          <div class="field">
            <label for="password">Clave</label>
            <input class="input" id="password" type="password" autocomplete="current-password" required />
          </div>

          <div id="loginError" class="error"></div>

          <button class="btn" type="submit">
            <i class="fa-solid fa-right-to-bracket"></i> Entrar
          </button>
          
        </form>
      </section>
    </main>
  `
  $('loginForm').addEventListener('submit', handleLogin)
}

async function handleLogin(event) {
  event.preventDefault()
  $('loginError').textContent = ''

  const email = $('email').value.trim()
  const password = $('password').value
  const button = event.submitter

  button.disabled = true
  button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Validando'

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  button.disabled = false
  button.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar'

  if (error || !data.user) {
    $('loginError').textContent = 'Correo o clave incorrecta, o usuario no confirmado.'
    return
  }

  await boot(data.user)
}

async function boot(user) {
  state.user = user

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile || !profile.is_active) {
    await supabase.auth.signOut()
    renderLogin()
    $('loginError').textContent = 'Tu usuario no tiene perfil activo. Un administrador debe habilitarlo.'
    return
  }

  state.profile = profile
  await loadData()
  renderApp()
}

async function loadData() {
  const queries = [
    supabase.from('drivers').select('*').order('name'),
    supabase.from('clients').select('*').order('name'),
    supabase
      .from('renditions')
      .select('*, rendition_clients(*), rendition_expenses(*)')
      .order('created_at', { ascending: false })
      .limit(300),
  ]

  if (state.profile?.role === 'admin') {
    queries.push(supabase.from('profiles').select('*').order('full_name'))
  }

  const [driversRes, clientsRes, renditionsRes, profilesRes] = await Promise.all(queries)

  if (driversRes.error) console.error(driversRes.error)
  if (clientsRes.error) console.error(clientsRes.error)
  if (renditionsRes.error) console.error(renditionsRes.error)
  if (profilesRes?.error) console.error(profilesRes.error)

  state.drivers = driversRes.data || []
  state.clients = clientsRes.data || []
  state.renditions = renditionsRes.data || []
  state.profiles = profilesRes?.data || []
}

function renderApp() {
  document.body.className = state.profile.role === 'admin' ? 'role-admin' : ''

  $('app').innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <div class="brand brand-logo sidebar-logo">
          <img src="${RUKA_LOGO_URL}" alt="Ruka Bakery">
        </div>

        <nav class="nav">
          <button data-section="dashboard"><span>Dashboard</span></button>
          <button data-section="rendition"><span>Nueva rendición</span></button>
          <button data-section="reports"><span>Reportes</span></button>
          <button data-section="clients"><span>Clientes</span></button>
          <button data-section="drivers" class="admin-only"><span>Repartidores</span></button>
          <button data-section="users" class="admin-only"><span>Usuarios</span></button>
        </nav>
      </aside>

      <main class="main">
        <div class="topbar">
          <button class="btn secondary mobile-menu" id="mobileMenu">Menú</button>

          <div class="title" id="pageTitle"></div>

          <div class="userbox">
            <div class="avatar">${safe((state.profile.full_name || state.user.email || 'U')[0]).toUpperCase()}</div>
            <div>
              <strong>${safe(state.profile.full_name)}</strong><br>
              <span class="muted">${safe(state.profile.role)}</span>
            </div>
            <button class="btn ghost small logout-text" id="logoutBtn" title="Cerrar sesión">Salir</button>
          </div>
        </div>

        <section id="dashboard" class="section"></section>
        <section id="rendition" class="section"></section>
        <section id="reports" class="section"></section>
        <section id="clients" class="section"></section>
        <section id="drivers" class="section admin-only"></section>
        <section id="users" class="section admin-only"></section>
      </main>
    </div>

    <div id="modalRoot"></div>
  `

  document.querySelectorAll('.nav button').forEach(btn => {
    btn.addEventListener('click', () => setSection(btn.dataset.section))
  })

  $('logoutBtn').addEventListener('click', logout)
  $('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'))

  setSection(state.section)
}

async function logout() {
  await supabase.auth.signOut()
  state.user = null
  state.profile = null
  state.section = 'dashboard'
  renderLogin()
}

function setSection(section) {
  if (section === 'drivers' || section === 'users') {
    if (state.profile.role !== 'admin') section = 'dashboard'
  }

  state.section = section

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
  document.querySelectorAll('.nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.section === section)
  })

  $(section).classList.add('active')

  if ($('sidebar')) $('sidebar').classList.remove('open')

  if (section === 'dashboard') renderDashboard()
  if (section === 'rendition') renderRendition()
  if (section === 'reports') renderReports()
  if (section === 'clients') renderClients()
  if (section === 'drivers') renderDrivers()
  if (section === 'users') renderUsers()
}

function setTitle(title, subtitle) {
  $('pageTitle').innerHTML = `<h1>${title}</h1><p class="muted">${subtitle}</p>`
}

function activeRenditions() {
  return state.renditions.filter(r => !r.is_void && r.status !== 'anulada')
}

function isTodayChile(dateValue) {
  if (!dateValue) return false
  return String(dateValue).slice(0, 10) === today()
}

async function renderDashboard() {
  setTitle('Dashboard', 'Resumen operativo de rendiciones y diferencias del día.')

  $('dashboard').innerHTML = `
    <div class="card">
      <div class="empty">Cargando información del día...</div>
    </div>
  `

  await loadData()

  const rows = activeRenditions().filter(r => isTodayChile(r.rendition_date))

  const totals = {
    count: rows.length,
    gross: rows.reduce((s, r) => s + calcRenditionGross(r), 0),
    transferred: rows.reduce((s, r) => s + Number(r.transferred_amount || 0), 0),
    expected: rows.reduce((s, r) => s + Number(r.expected_amount || 0), 0),
    received: rows.reduce((s, r) => s + Number(r.received_amount || 0), 0),
    diff: rows.reduce((s, r) => s + Math.abs(Number(r.difference_amount || 0)), 0),
    expenses: rows.reduce((s, r) => s + Number(r.expenses_amount || 0), 0),
  }

  $('dashboard').innerHTML = `
    <div class="notice" style="margin-bottom:18px">
      Mostrando solo rendiciones de hoy: ${safe(today())}
    </div>

    <div class="grid kpis">
      ${kpi('Total repartos', totals.count)}
      ${kpi('Total vendido', money(totals.gross))}
      ${kpi('Transferido', money(totals.transferred))}
      ${kpi('Efectivo esperado', money(totals.expected))}
      ${kpi('Efectivo recibido', money(totals.received))}
      ${kpi('Diferencias', money(totals.diff))}
      ${kpi('Gastos', money(totals.expenses))}
    </div>
<div class="cols dashboard-charts" style="margin-top:18px">
  <div class="card">
    <h3>Actividad de hoy</h3>
    <div class="chart-box">
      <canvas id="activityChart"></canvas>
    </div>
  </div>

  <div class="card">
    <h3>Diferencias por estado de hoy</h3>
    <div class="chart-box">
      <canvas id="statusChart"></canvas>
    </div>
  </div>
</div>

    <div class="card" style="margin-top:18px">
      <h3>Últimas rendiciones de hoy</h3>
      ${reportsTable(rows.slice(0, 8), false)}
    </div>
  `

  setTimeout(() => {
    renderDashboardCharts(rows)
  }, 0)
}

function kpi(label, value) {
  return `<div class="card kpi"><div class="label">${label}</div><div class="value">${value}</div></div>`
}

function renderStatusSummary(rows) {
  const data = ['correcta', 'sobrante', 'faltante', 'anulada']
    .map(s => `${s}: ${rows.filter(r => r.status === s).length}`)
    .join(' · ')

  return `<span>${data}</span>`
}

function destroyDashboardCharts() {
  if (dashboardActivityChart) {
    dashboardActivityChart.destroy()
    dashboardActivityChart = null
  }

  if (dashboardStatusChart) {
    dashboardStatusChart.destroy()
    dashboardStatusChart = null
  }
}

function buildTodayActivityByDriver(rows) {
  const map = new Map()

  rows.forEach(r => {
    const name = r.driver_name || 'Sin repartidor'
    map.set(name, (map.get(name) || 0) + 1)
  })

  if (!map.size) {
    return {
      labels: ['Sin datos'],
      values: [0]
    }
  }

  return {
    labels: [...map.keys()],
    values: [...map.values()]
  }
}

function buildStatusSummaryData(rows) {
  const summary = {
    correcta: 0,
    sobrante: 0,
    faltante: 0,
    anulada: 0
  }

  rows.forEach(r => {
    const key = String(r.status || '').toLowerCase()
    if (summary[key] !== undefined) summary[key] += 1
  })

  return summary
}

function renderDashboardCharts(rows) {
  destroyDashboardCharts()

  const activityCanvas = document.getElementById('activityChart')
  const statusCanvas = document.getElementById('statusChart')

  if (!activityCanvas || !statusCanvas) return

  if (!rows.length) {
    const activityBox = activityCanvas.closest('.chart-box')
    const statusBox = statusCanvas.closest('.chart-box')

    if (activityBox) {
      activityBox.innerHTML = '<div class="empty">Sin rendiciones registradas para hoy</div>'
    }

    if (statusBox) {
      statusBox.innerHTML = '<div class="empty">Sin estados para mostrar</div>'
    }

    return
  }

  const driverColors = [
    'rgba(204, 113, 43, 0.75)',
    'rgba(96, 62, 38, 0.75)',
    'rgba(226, 157, 74, 0.75)',
    'rgba(132, 77, 42, 0.75)',
    'rgba(245, 196, 112, 0.75)',
    'rgba(92, 130, 91, 0.75)',
    'rgba(78, 108, 151, 0.75)'
  ]

  const driverBorderColors = [
    'rgba(204, 113, 43, 1)',
    'rgba(96, 62, 38, 1)',
    'rgba(226, 157, 74, 1)',
    'rgba(132, 77, 42, 1)',
    'rgba(245, 196, 112, 1)',
    'rgba(92, 130, 91, 1)',
    'rgba(78, 108, 151, 1)'
  ]

  const activity = buildTodayActivityByDriver(rows)
  const status = buildStatusSummaryData(rows)

  dashboardActivityChart = new Chart(activityCanvas, {
    type: 'bar',
    data: {
      labels: activity.labels,
      datasets: [
        {
          label: 'Rendiciones',
          data: activity.values,
          backgroundColor: activity.labels.map((_, i) => driverColors[i % driverColors.length]),
          borderColor: activity.labels.map((_, i) => driverBorderColors[i % driverBorderColors.length]),
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: context => `Rendiciones: ${context.raw}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  })

  dashboardStatusChart = new Chart(statusCanvas, {
    type: 'doughnut',
    data: {
      labels: ['Correcta', 'Sobrante', 'Faltante', 'Anulada'],
      datasets: [
        {
          data: [
            status.correcta,
            status.sobrante,
            status.faltante,
            status.anulada
          ],
          backgroundColor: [
            'rgba(92, 130, 91, 0.78)',
            'rgba(226, 157, 74, 0.78)',
            'rgba(201, 67, 67, 0.78)',
            'rgba(96, 62, 38, 0.78)'
          ],
          borderColor: [
            'rgba(92, 130, 91, 1)',
            'rgba(226, 157, 74, 1)',
            'rgba(201, 67, 67, 1)',
            'rgba(96, 62, 38, 1)'
          ],
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  })
}


function calcDraftGross() {
  return state.draft.clients.reduce((s, c) => s + Number(c.amount || 0), 0)
}

function calcDraftTransferred() {
  return state.draft.clients.reduce((s, c) => s + Number(c.transfer_amount || 0), 0)
}

function calcDraftExpectedCash() {
  return state.draft.clients.reduce((s, c) => {
    const total = Number(c.amount || 0)
    const transferred = Number(c.transfer_amount || 0)
    return s + Number(c.cash_expected_amount ?? (total - transferred))
  }, 0)
}

function calcDraftExpenses() {
  return state.draft.expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
}

function calcRenditionGross(r) {
  return (r.rendition_clients || []).reduce((s, c) => s + Number(c.amount || 0), 0)
}

function renderRendition() {
  setTitle(
    state.editingId ? 'Editar rendición' : 'Nueva rendición',
    'Selecciona repartidor, clientes visitados, gastos, transferencias y dinero recibido.'
  )

  const gross = calcDraftGross()
  const transferred = calcDraftTransferred()
  const expected = calcDraftExpectedCash()
  const expenses = calcDraftExpenses()
  const toRender = expected - expenses
  const diff = Number(state.draft.received || 0) - toRender
  const status = diff === 0 ? 'correcta' : diff > 0 ? 'sobrante' : 'faltante'

  $('rendition').innerHTML = `
    <div class="cols-3">
      <div class="card">
        <h2>1. Repartidor</h2>
        <div class="field">
          <label>Buscar</label>
          <input id="driverSearch" class="input">
        </div>
        <div class="list" id="driverList"></div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div>
            <h2>2. Clientes visitados</h2>
            <p class="muted">Pincha los clientes para agregarlos.</p>
          </div>
          <button class="btn secondary" id="quickClient">
            <i class="fa-solid fa-plus"></i> Cliente
          </button>
        </div>

        <div class="field">
          <label>Buscar cliente</label>
          <input id="clientSearch" class="input">
        </div>

        <div class="list" id="clientList"></div>
      </div>

      <aside class="card summary">
        <h2>Resumen</h2>
        <div class="summary-row"><span>Repartidor</span><strong>${safe(state.draft.driver?.name || 'Pendiente')}</strong></div>
        <div class="summary-row"><span>Clientes</span><strong>${state.draft.clients.length}</strong></div>
        <div class="summary-row"><span>Total entregado/vendido</span><strong id="sumGross">${money(gross)}</strong></div>
        <div class="summary-row"><span>Transferido por clientes</span><strong id="sumTransferred">${money(transferred)}</strong></div>
        <div class="summary-row"><span>Efectivo esperado</span><strong id="sumExpected">${money(expected)}</strong></div>
        <div class="summary-row"><span>Gastos</span><strong id="sumExpenses">${money(expenses)}</strong></div>
        <div class="summary-row"><span>A rendir</span><strong id="sumToRender">${money(toRender)}</strong></div>

        <div class="field">
          <label>Monto recibido en efectivo</label>
          <input id="received" class="input" type="text" inputmode="numeric" value="${state.draft.received ? numberCL(state.draft.received) : ''}">
        </div>

        <div class="summary-row">
          <span>Diferencia</span>
          <strong id="sumDiff" class="${status === 'correcta' ? 'ok' : status === 'faltante' ? 'danger' : 'warn'}">${money(diff)}</strong>
        </div>

        <div class="field">
          <label>Observaciones</label>
          <textarea id="observations" rows="3" class="input">${safe(state.draft.observations)}</textarea>
        </div>

        <div class="actions">
          <button class="btn secondary" id="expenseBtn">
            <i class="fa-solid fa-receipt"></i> Gasto
          </button>
          <button class="btn ghost" id="resetDraft">
            <i class="fa-solid fa-rotate-left"></i> Limpiar
          </button>
        </div>

        <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">

        <div id="receiptPreview">${receiptHtml(buildReceiptDraft())}</div>
      </aside>
    </div>

    <div class="card" style="margin-top:18px">
      <h3>Clientes agregados</h3>
      <div id="selectedClients"></div>
    </div>

    <div class="card" style="margin-top:18px">
      <h3>Gastos agregados</h3>
      <div id="selectedExpenses"></div>
    </div>

    <div class="bottom-actions">
      <div>
        <strong>${state.draft.driver ? safe(state.draft.driver.name) : 'Sin repartidor'}</strong><br>
        <span class="muted" id="bottomSummaryText">
          ${state.draft.clients.length} clientes · Efectivo esperado ${money(expected)} · A rendir ${money(toRender)} · Diferencia ${money(diff)}
        </span>
      </div>

      <div class="actions">
        <button class="btn secondary" id="printCurrent">
          <i class="fa-solid fa-print"></i> Imprimir
        </button>
        <button class="btn" id="saveRendition">
          <i class="fa-solid fa-floppy-disk"></i> ${state.editingId ? 'Guardar cambios' : 'Guardar rendición'}
        </button>
      </div>
    </div>
  `

  bindRendition()
  renderDriverList('')
  renderClientList('')
  renderSelectedClients()
  renderSelectedExpenses()
}

function bindRendition() {
  $('driverSearch').addEventListener('input', e => renderDriverList(e.target.value))
  $('clientSearch').addEventListener('input', e => renderClientList(e.target.value))
  $('quickClient').addEventListener('click', () => clientModal())
  $('expenseBtn').addEventListener('click', () => expenseModal())

  bindMoneyInput($('received'), value => {
    state.draft.received = value
    updateRenditionLiveSummary()
  })

  $('observations').addEventListener('input', e => {
    state.draft.observations = e.target.value
  })

  $('resetDraft').addEventListener('click', () => {
    state.draft = emptyDraft()
    state.editingId = null
    renderRendition()
  })

  $('printCurrent').addEventListener('click', () => printReceipt(buildReceiptDraft()))
  $('saveRendition').addEventListener('click', saveRendition)
}

function updateRenditionLiveSummary() {
  const gross = calcDraftGross()
  const transferred = calcDraftTransferred()
  const expected = calcDraftExpectedCash()
  const expenses = calcDraftExpenses()
  const toRender = expected - expenses
  const diff = Number(state.draft.received || 0) - toRender

  if ($('sumGross')) $('sumGross').textContent = money(gross)
  if ($('sumTransferred')) $('sumTransferred').textContent = money(transferred)
  if ($('sumExpected')) $('sumExpected').textContent = money(expected)
  if ($('sumExpenses')) $('sumExpenses').textContent = money(expenses)
  if ($('sumToRender')) $('sumToRender').textContent = money(toRender)

  const diffEl = $('sumDiff')
  if (diffEl) {
    diffEl.textContent = money(diff)
    diffEl.className = diff === 0 ? 'ok' : diff < 0 ? 'danger' : 'warn'
  }

  if ($('bottomSummaryText')) {
    $('bottomSummaryText').textContent = `${state.draft.clients.length} clientes · Efectivo esperado ${money(expected)} · A rendir ${money(toRender)} · Diferencia ${money(diff)}`
  }

  if ($('receiptPreview')) {
    $('receiptPreview').innerHTML = receiptHtml(buildReceiptDraft())
  }
}

function renderDriverList(filter) {
  const term = (filter || '').toLowerCase()

  const rows = state.drivers.filter(d => {
    return d.is_active !== false && d.name.toLowerCase().includes(term)
  })

  $('driverList').innerHTML = rows.length
    ? rows.map(d => `
      <button class="list-item ${state.draft.driver?.id === d.id ? 'selected' : ''}" data-id="${d.id}">
        <span>
          <strong>${safe(d.name)}</strong>
          <span class="muted">Repartidor</span>
        </span>
        <i class="fa-solid fa-check"></i>
      </button>
    `).join('')
    : `<div class="empty">No hay repartidores</div>`

  $('driverList').querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      state.draft.driver = state.drivers.find(d => d.id === button.dataset.id)
      renderRendition()
    })
  })
}

function renderClientList(filter) {
  const term = (filter || '').toLowerCase()

  const rows = state.clients.filter(c => {
    const text = `${c.name || ''} ${c.rut || ''}`.toLowerCase()
    return c.is_active !== false && text.includes(term)
  })

  $('clientList').innerHTML = rows.length
    ? rows.map(c => `
      <button class="list-item" data-id="${c.id}">
        <span>
          <strong>${safe(c.name)}</strong>
          <span class="muted">${c.rut ? safe(c.rut) + ' · ' : ''}Agregar a la rendición</span>
        </span>
        <i class="fa-solid fa-plus"></i>
      </button>
    `).join('')
    : `<div class="empty">No hay clientes</div>`

  $('clientList').querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => addClientToDraft(button.dataset.id))
  })
}

function addClientToDraft(id) {
  const client = state.clients.find(c => c.id === id)
  if (!client) return

  openModal('Agregar cliente visitado', `
    <div class="field">
      <label>Cliente</label>
      <input class="input" value="${safe(client.name)}" disabled>
    </div>

    <div class="field">
      <label>Monto total entregado / vendido</label>
      <input id="clientAmount" class="input" type="text" inputmode="numeric" autofocus>
    </div>

    <div class="form-grid">
      <div class="field">
        <label>Recibido en efectivo</label>
        <input id="clientCashAmount" class="input" type="text" inputmode="numeric">
      </div>

      <div class="field">
        <label>Transferido por cliente</label>
        <input id="clientTransferAmount" class="input" type="text" inputmode="numeric">
      </div>
    </div>

    <div class="notice" id="clientPaymentCheck">
      Ingresa el total y cómo pagó el cliente.
    </div>

    <div class="field">
      <label>Comentario / respaldo</label>
      <textarea id="clientComment" rows="3" class="input" placeholder="Ej.: Transferencia pendiente de verificar, transferencia parcial, comprobante enviado, etc."></textarea>
    </div>

    <button class="btn" id="confirmClient">
      <i class="fa-solid fa-plus"></i> Agregar cliente
    </button>
  `)

  const updatePaymentCheck = () => {
    const total = parseMoney($('clientAmount').value)
    const cash = parseMoney($('clientCashAmount').value)
    const transfer = parseMoney($('clientTransferAmount').value)
    const paid = cash + transfer
    const diff = total - paid
    const box = $('clientPaymentCheck')

    if (!total) {
      box.textContent = 'Ingresa el total entregado / vendido.'
      box.className = 'notice'
      return
    }

    if (diff === 0) {
      box.textContent = `Cuadrado: efectivo ${money(cash)} + transferencia ${money(transfer)} = ${money(total)}`
      box.className = 'notice ok'
      return
    }

    if (diff > 0) {
      box.textContent = `Falta asignar forma de pago por ${money(diff)}`
      box.className = 'notice warn'
      return
    }

    box.textContent = `Efectivo + transferencia supera el total por ${money(Math.abs(diff))}`
    box.className = 'notice danger'
  }

  bindMoneyInput($('clientAmount'), updatePaymentCheck)
  bindMoneyInput($('clientCashAmount'), updatePaymentCheck)
  bindMoneyInput($('clientTransferAmount'), updatePaymentCheck)

  $('confirmClient').addEventListener('click', () => {
    const amount = parseMoney($('clientAmount').value)
    const cashAmount = parseMoney($('clientCashAmount').value)
    const transferAmount = parseMoney($('clientTransferAmount').value)
    const paid = cashAmount + transferAmount

    if (!amount) {
      alert('Ingresa el monto total entregado / vendido.')
      return
    }

    if (paid !== amount) {
      alert('El efectivo más la transferencia debe cuadrar exactamente con el monto total del cliente.')
      return
    }

    state.draft.clients.push({
      client_id: client.id,
      client_name: client.name,
      name: client.name,
      document_type: null,
      document_number: null,
      products: $('clientComment').value.trim(),
      amount,
      transfer_amount: transferAmount,
      cash_expected_amount: cashAmount,
    })

    closeModal()
    renderRendition()
  })
}

function renderSelectedClients() {
  const box = $('selectedClients')
  if (!box) return

  if (!state.draft.clients.length) {
    box.innerHTML = '<div class="empty">Sin clientes agregados</div>'
    return
  }

  box.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Comentario</th>
            <th>Total</th>
            <th>Efectivo</th>
            <th>Transferencia</th>
            <th>Cuadratura</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${state.draft.clients.map((c, i) => {
            const total = Number(c.amount || 0)
            const cashAmount = Number(c.cash_expected_amount ?? (total - Number(c.transfer_amount || 0)))
            const transferAmount = Number(c.transfer_amount || 0)
            const rowDiff = total - cashAmount - transferAmount
            const isBalanced = rowDiff === 0

            return `
              <tr>
                <td>${safe(c.client_name || c.name)}</td>
                <td>${safe(c.products || '')}</td>
                <td>${money(total)}</td>
                <td>${money(cashAmount)}</td>
                <td>${money(transferAmount)}</td>
                <td>${isBalanced ? '<span class="badge correcta">Cuadrado</span>' : `<span class="badge faltante">${money(rowDiff)}</span>`}</td>
                <td>
                  <button class="btn ghost small remove-client" data-i="${i}">Quitar</button>
                </td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
  `

  box.querySelectorAll('.remove-client').forEach(button => {
    button.addEventListener('click', () => {
      state.draft.clients.splice(Number(button.dataset.i), 1)
      renderRendition()
    })
  })
}

function renderSelectedExpenses() {
  const box = $('selectedExpenses')
  if (!box) return

  if (!state.draft.expenses.length) {
    box.innerHTML = '<div class="empty">Sin gastos agregados</div>'
    return
  }

  box.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Observación</th>
            <th>Monto</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${state.draft.expenses.map((e, i) => `
            <tr>
              <td>${safe(e.expense_type)}</td>
              <td>${safe(e.observation || '')}</td>
              <td>${money(e.amount)}</td>
              <td>
                <button class="btn ghost small remove-expense" data-i="${i}">Quitar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `

  box.querySelectorAll('.remove-expense').forEach(button => {
    button.addEventListener('click', () => {
      state.draft.expenses.splice(Number(button.dataset.i), 1)
      renderRendition()
    })
  })
}

function expenseModal() {
  openModal('Agregar gasto', `
    <div class="field">
      <label>Tipo</label>
      <select id="expenseType">
        <option value="combustible">Combustible</option>
        <option value="peaje">Peaje</option>
        <option value="estacionamiento">Estacionamiento</option>
        <option value="imprevisto">Imprevisto</option>
        <option value="otro">Otro</option>
      </select>
    </div>

    <div class="field">
      <label>Monto</label>
      <input id="expenseAmount" class="input" type="text" inputmode="numeric" autofocus>
    </div>

    <div class="field">
      <label>Observación</label>
      <textarea id="expenseObservation" class="input" rows="3"></textarea>
    </div>

    <button class="btn" id="confirmExpense">
      <i class="fa-solid fa-plus"></i> Agregar gasto
    </button>
  `)

  bindMoneyInput($('expenseAmount'), () => {})

  $('confirmExpense').addEventListener('click', () => {
    state.draft.expenses.push({
      expense_type: $('expenseType').value,
      amount: parseMoney($('expenseAmount').value),
      observation: $('expenseObservation').value.trim()
    })

    closeModal()
    renderRendition()
  })
}

async function saveRendition() {
  if (!state.draft.driver) {
    alert('Selecciona un repartidor.')
    return
  }

  if (!state.draft.clients.length) {
    alert('Agrega al menos un cliente.')
    return
  }

  const gross = calcDraftGross()
  const transferred = calcDraftTransferred()
  const expected = calcDraftExpectedCash()
  const expenses = calcDraftExpenses()

  const payload = {
    rendition_date: today(),
    rendition_time: nowTime(),
    driver_id: state.draft.driver.id,
    driver_name: state.draft.driver.name,
    expected_amount: expected,
    transferred_amount: transferred,
    expenses_amount: expenses,
    received_amount: Number(state.draft.received || 0),
    observations: state.draft.observations || null,
    updated_by: state.user.id,
  }

  let renditionId = state.editingId
  let res

  if (renditionId) {
    res = await supabase.from('renditions').update(payload).eq('id', renditionId).select().single()
  } else {
    payload.created_by = state.user.id
    res = await supabase.from('renditions').insert(payload).select().single()
    renditionId = res.data?.id
  }

  if (res.error) {
    alert('No se pudo guardar: ' + res.error.message)
    return
  }

  await supabase.from('rendition_clients').delete().eq('rendition_id', renditionId)
  await supabase.from('rendition_expenses').delete().eq('rendition_id', renditionId)

  if (state.draft.clients.length) {
    const details = state.draft.clients.map(c => {
      const amount = Number(c.amount || 0)
      const transferAmount = Number(c.transfer_amount || 0)

      return {
        rendition_id: renditionId,
        client_id: c.client_id,
        client_name: c.client_name || c.name,
        document_type: c.document_type || null,
        document_number: c.document_number || null,
        products: c.products || null,
        amount,
        transfer_amount: transferAmount,
        cash_expected_amount: Number(c.cash_expected_amount ?? (amount - transferAmount)),
      }
    })

    const detailRes = await supabase.from('rendition_clients').insert(details)
    if (detailRes.error) {
      alert('Rendición guardada, pero falló detalle de clientes: ' + detailRes.error.message)
      return
    }
  }

  if (state.draft.expenses.length) {
    const expensesRows = state.draft.expenses.map(e => ({
      rendition_id: renditionId,
      expense_type: e.expense_type || 'otro',
      amount: Number(e.amount || 0),
      observation: e.observation || null
    }))

    const expenseRes = await supabase.from('rendition_expenses').insert(expensesRows)
    if (expenseRes.error) {
      alert('Rendición guardada, pero falló detalle de gastos: ' + expenseRes.error.message)
      return
    }
  }

  state.draft = emptyDraft()
  state.editingId = null

  await loadData()
  setSection('reports')
}

function renderReports() {
  setTitle('Reportes', 'Consulta, reimprime, edita, anula o elimina rendiciones.')

  const driverOptions = state.drivers
    .map(d => `<option value="${safe(d.id)}">${safe(d.name)}</option>`)
    .join('')

  $('reports').innerHTML = `
    <div class="card">
      <div class="form-grid">
        <div class="field">
          <label>Desde</label>
          <input id="fromDate" class="input" type="date">
        </div>

        <div class="field">
          <label>Hasta</label>
          <input id="toDate" class="input" type="date">
        </div>

        <div class="field">
          <label>Repartidor</label>
          <select id="filterDriver" class="input">
            <option value="">Todos los repartidores</option>
            ${driverOptions}
          </select>
        </div>

        <div class="field">
          <label>Buscar</label>
          <input id="searchReports" class="input" type="search" placeholder="Buscar por cliente, repartidor, estado o monto">
        </div>
      </div>

      <div class="actions">
        <button class="btn secondary" id="filterReports">Filtrar</button>
        <button class="btn ghost" id="clearReports">Limpiar</button>
        <button class="btn ghost" id="exportCsv">Exportar CSV</button>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div id="reportTable"></div>
    </div>
  `

  $('filterReports').addEventListener('click', drawReportTable)

  $('clearReports').addEventListener('click', () => {
    $('fromDate').value = ''
    $('toDate').value = ''
    $('filterDriver').value = ''
    $('searchReports').value = ''
    drawReportTable()
  })

  $('exportCsv').addEventListener('click', exportCsv)
  $('searchReports').addEventListener('input', drawReportTable)
  $('filterDriver').addEventListener('change', drawReportTable)
  $('fromDate').addEventListener('change', drawReportTable)
  $('toDate').addEventListener('change', drawReportTable)

  drawReportTable()
}

function filteredReportRows() {
  const f = $('fromDate')?.value
  const t = $('toDate')?.value
  const driverId = $('filterDriver')?.value
  const search = ($('searchReports')?.value || '').trim().toLowerCase()

  return state.renditions.filter(r => {
    const byDateFrom = !f || String(r.rendition_date || '').slice(0, 10) >= f
    const byDateTo = !t || String(r.rendition_date || '').slice(0, 10) <= t
    const byDriver = !driverId || r.driver_id === driverId

    const clientsText = (r.rendition_clients || [])
      .map(c => `${c.client_name || ''} ${c.products || ''} ${c.amount || ''} ${c.transfer_amount || ''} ${c.cash_expected_amount || ''}`)
      .join(' ')

    const expensesText = (r.rendition_expenses || [])
      .map(e => `${e.expense_type || ''} ${e.observation || ''} ${e.amount || ''}`)
      .join(' ')

    const searchable = [
      r.rendition_date,
      String(r.rendition_time || '').slice(0, 5),
      r.driver_name,
      r.expected_amount,
      r.transferred_amount,
      r.expenses_amount,
      r.received_amount,
      r.difference_amount,
      r.status,
      r.observations,
      clientsText,
      expensesText
    ].join(' ').toLowerCase()

    const bySearch = !search || searchable.includes(search)

    return byDateFrom && byDateTo && byDriver && bySearch
  })
}

function drawReportTable() {
  $('reportTable').innerHTML = reportsTable(filteredReportRows(), true)
}

function reportsTable(rows, actions) {
  if (!rows.length) return '<div class="empty">Sin rendiciones registradas</div>'

  const totalGross = rows.reduce((s, r) => s + calcRenditionGross(r), 0)
  const totalTransferred = rows.reduce((s, r) => s + Number(r.transferred_amount || 0), 0)
  const totalExpected = rows.reduce((s, r) => s + Number(r.expected_amount || 0), 0)
  const totalExpenses = rows.reduce((s, r) => s + Number(r.expenses_amount || 0), 0)
  const totalReceived = rows.reduce((s, r) => s + Number(r.received_amount || 0), 0)
  const totalDiff = rows.reduce((s, r) => s + Number(r.difference_amount || 0), 0)

  return `
    <div class="report-mini-summary">
      <span><strong>${rows.length}</strong> rendición(es)</span>
      <span>Total vendido: <strong>${money(totalGross)}</strong></span>
      <span>Transferido: <strong>${money(totalTransferred)}</strong></span>
      <span>Efectivo esperado: <strong>${money(totalExpected)}</strong></span>
      <span>Gastos: <strong>${money(totalExpenses)}</strong></span>
      <span>Recibido: <strong>${money(totalReceived)}</strong></span>
      <span>Diferencia: <strong>${money(totalDiff)}</strong></span>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Repartidor</th>
            <th>Clientes</th>
            <th>Total vendido</th>
            <th>Transferido</th>
            <th>Esperado efectivo</th>
            <th>Gastos</th>
            <th>Recibido efectivo</th>
            <th>Diferencia</th>
            <th>Estado</th>
            ${actions ? '<th>Acciones</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${safe(String(r.rendition_date || '').slice(0, 10))}</td>
              <td>${safe(String(r.rendition_time || '').slice(0, 5))}</td>
              <td>${safe(r.driver_name)}</td>
              <td>${(r.rendition_clients || []).length}</td>
              <td>${money(calcRenditionGross(r))}</td>
              <td>${money(r.transferred_amount || 0)}</td>
              <td>${money(r.expected_amount)}</td>
              <td>${money(r.expenses_amount)}</td>
              <td>${money(r.received_amount)}</td>
              <td>${money(r.difference_amount)}</td>
              <td><span class="badge ${r.status}">${safe(r.status)}</span></td>
              ${actions ? `
                <td>
                  <div class="actions">
                    <button class="btn ghost small" onclick="window.rukaActions.view('${r.id}')">Ver</button>
                    <button class="btn ghost small" onclick="window.rukaActions.reprint('${r.id}')">Imprimir</button>
                    ${r.status !== 'anulada' ? `
                      <button class="btn ghost small" onclick="window.rukaActions.edit('${r.id}')">Editar</button>
                      <button class="btn ghost small" onclick="window.rukaActions.void('${r.id}')">Anular</button>
                    ` : ''}
                    ${state.profile.role === 'admin' ? `
                      <button class="btn danger small" onclick="window.rukaActions.del('${r.id}')">Eliminar</button>
                    ` : ''}
                  </div>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

window.rukaActions = {
  view(id) {
    const r = state.renditions.find(x => x.id === id)
    if (!r) return

    const gross = calcRenditionGross(r)
    const transferred = Number(r.transferred_amount || 0)

    openModal('Detalle de rendición', `
      <div class="summary-row"><span>Fecha</span><strong>${safe(String(r.rendition_date || '').slice(0, 10))} ${safe(String(r.rendition_time || '').slice(0, 5))}</strong></div>
      <div class="summary-row"><span>Repartidor</span><strong>${safe(r.driver_name)}</strong></div>
      <div class="summary-row"><span>Total entregado/vendido</span><strong>${money(gross)}</strong></div>
      <div class="summary-row"><span>Transferido por clientes</span><strong>${money(transferred)}</strong></div>
      <div class="summary-row"><span>Efectivo esperado</span><strong>${money(r.expected_amount)}</strong></div>
      <div class="summary-row"><span>Gastos</span><strong>${money(r.expenses_amount)}</strong></div>
      <div class="summary-row"><span>Recibido efectivo</span><strong>${money(r.received_amount)}</strong></div>
      <div class="summary-row"><span>Diferencia</span><strong>${money(r.difference_amount)}</strong></div>
      <div class="summary-row"><span>Estado</span><strong>${safe(r.status)}</strong></div>

      <h4>Clientes</h4>
      <div class="compact-list">
        ${(r.rendition_clients || []).map(c => {
          const amount = Number(c.amount || 0)
          const transferAmount = Number(c.transfer_amount || 0)
          const cashExpected = Number(c.cash_expected_amount ?? (amount - transferAmount))

          return `
            <div class="list-item">
              <span>
                <strong>${safe(c.client_name)}</strong>
                <span class="muted">${safe(c.products || '')}</span>
                <span class="muted">Efectivo: ${money(cashExpected)} · Transferencia: ${money(transferAmount)}</span>
              </span>
              <strong>${money(amount)}</strong>
            </div>
          `
        }).join('') || '<div class="empty">Sin clientes</div>'}
      </div>

      <h4>Gastos</h4>
      <div class="compact-list">
        ${(r.rendition_expenses || []).map(e => `
          <div class="list-item">
            <span>
              <strong>${safe(e.expense_type)}</strong>
              <span class="muted">${safe(e.observation || '')}</span>
            </span>
            <strong>${money(e.amount)}</strong>
          </div>
        `).join('') || '<div class="empty">Sin gastos</div>'}
      </div>

      <div class="actions" style="margin-top:14px">
        <button class="btn secondary" onclick="window.rukaActions.reprint('${r.id}')">Imprimir</button>
      </div>
    `)
  },

  reprint(id) {
    const r = state.renditions.find(x => x.id === id)
    if (r) printReceipt(buildReceiptFromRendition(r))
  },

  edit(id) {
    const r = state.renditions.find(x => x.id === id)
    if (!r || r.status === 'anulada') return

    state.editingId = id
    state.draft = {
      driver: state.drivers.find(d => d.id === r.driver_id) || { id: r.driver_id, name: r.driver_name },
      clients: (r.rendition_clients || []).map(c => {
        const amount = Number(c.amount || 0)
        const transferAmount = Number(c.transfer_amount || 0)

        return {
          client_id: c.client_id,
          client_name: c.client_name,
          name: c.client_name,
          document_type: c.document_type,
          document_number: c.document_number,
          products: c.products,
          amount,
          transfer_amount: transferAmount,
          cash_expected_amount: Number(c.cash_expected_amount ?? (amount - transferAmount)),
        }
      }),
      expenses: (r.rendition_expenses || []).map(e => ({
        expense_type: e.expense_type,
        amount: Number(e.amount || 0),
        observation: e.observation
      })),
      received: Number(r.received_amount || 0),
      observations: r.observations || ''
    }

    setSection('rendition')
  },

  async void(id) {
    const r = state.renditions.find(x => x.id === id)
    if (!r || r.status === 'anulada') return

    const reason = prompt('Motivo de anulación') || ''

    const { error } = await supabase.rpc('void_rendition', {
      p_rendition_id: id,
      p_reason: reason
    })

    if (error) {
      alert(error.message)
      return
    }

    await loadData()
    renderReports()
  },

  async del(id) {
    if (state.profile.role !== 'admin') return

    if (!confirm('Esta acción elimina definitivamente la rendición. ¿Continuar?')) return

    const { error } = await supabase.from('renditions').delete().eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    await loadData()
    renderReports()
  }
}

function buildReceiptDraft() {
  const gross = calcDraftGross()
  const transferred = calcDraftTransferred()
  const expected = calcDraftExpectedCash()
  const expenses = calcDraftExpenses()
  const toRender = expected - expenses
  const diff = Number(state.draft.received || 0) - toRender

  return {
    date: today(),
    time: nowTime(),
    driver_name: state.draft.driver?.name || '',
    clients: state.draft.clients,
    expenses_detail: state.draft.expenses,
    gross,
    transferred,
    expected,
    expenses,
    to_render: toRender,
    received: Number(state.draft.received || 0),
    diff,
    status: diff === 0 ? 'Rendición correcta' : diff > 0 ? 'Sobrante' : 'Faltante',
    observations: state.draft.observations || ''
  }
}

function buildReceiptFromRendition(r) {
  const clientRows = (r.rendition_clients || []).map(c => {
    const amount = Number(c.amount || 0)
    const transferAmount = Number(c.transfer_amount || 0)

    return {
      client_id: c.client_id,
      client_name: c.client_name,
      name: c.client_name,
      amount,
      transfer_amount: transferAmount,
      cash_expected_amount: Number(c.cash_expected_amount ?? (amount - transferAmount)),
      products: c.products || '',
      comment: c.products || ''
    }
  })

  const gross = clientRows.reduce((s, c) => s + Number(c.amount || 0), 0)
  const transferred = Number(r.transferred_amount ?? clientRows.reduce((s, c) => s + Number(c.transfer_amount || 0), 0))

  return {
    date: String(r.rendition_date || '').slice(0, 10),
    time: String(r.rendition_time || '').slice(0, 5),
    driver_name: r.driver_name,
    clients: clientRows,
    expenses_detail: (r.rendition_expenses || []).map(e => ({
      expense_type: e.expense_type,
      amount: Number(e.amount || 0),
      observation: e.observation || ''
    })),
    gross,
    transferred,
    expected: Number(r.expected_amount || 0),
    expenses: Number(r.expenses_amount || 0),
    to_render: Number(r.expected_amount || 0) - Number(r.expenses_amount || 0),
    received: Number(r.received_amount || 0),
    diff: Number(r.difference_amount || 0),
    status: r.status,
    observations: r.observations || ''
  }
}

function normalizeReceiptName(name) {
  const text = String(name || '').replace(/\s+/g, ' ').trim()
  if (!text) return 'Cliente'

  return text
    .replace(/\bSOCIEDAD\b/gi, 'SOC.')
    .replace(/\bSERVICIOS\b/gi, 'SERV.')
    .replace(/\bSERVICIO\b/gi, 'SERV.')
    .replace(/\bALIMENTACIÓN\b/gi, 'ALIM.')
    .replace(/\bALIMENTACION\b/gi, 'ALIM.')
    .replace(/\bLIMITADA\b/gi, 'LTDA.')
    .replace(/\bCOMERCIAL\b/gi, 'COM.')
    .replace(/\bINVERSIONES\b/gi, 'INV.')
    .replace(/\bRESPONSABILIDAD\b/gi, 'RESP.')
    .replace(/\bEMPRESA\b/gi, 'EMP.')
    .replace(/\bGASTRONOMÍA\b/gi, 'GASTR.')
    .replace(/\bGASTRONOMIA\b/gi, 'GASTR.')
    .replace(/\bRESTAURANT\b/gi, 'REST.')
    .replace(/\bPANADERÍA\b/gi, 'PAN.')
    .replace(/\bPANADERIA\b/gi, 'PAN.')
    .replace(/\bCAFETERÍA\b/gi, 'CAF.')
    .replace(/\bCAFETERIA\b/gi, 'CAF.')
    .trim()
}

function shortReceiptName(name, max = 34) {
  const text = normalizeReceiptName(name)
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function shortReceiptText(value, max = 42) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function receiptHtml(r) {
  const clients = r.clients || []
  const expenses = r.expenses_detail || []
  const gross = Number(r.gross ?? clients.reduce((s, c) => s + Number(c.amount || 0), 0))
  const transferred = Number(r.transferred ?? clients.reduce((s, c) => s + Number(c.transfer_amount || 0), 0))
  const expected = Number(r.expected ?? clients.reduce((s, c) => {
    const amount = Number(c.amount || 0)
    const transferAmount = Number(c.transfer_amount || 0)
    return s + Number(c.cash_expected_amount ?? (amount - transferAmount))
  }, 0))
  const expensesTotal = Number(r.expenses || 0)
  const toRender = Number(r.to_render ?? (expected - expensesTotal))

  const clientRows = clients.length
    ? clients.map(c => {
      const name = shortReceiptName(c.client_name || c.name || 'Cliente')
      const comment = shortReceiptText(c.comment || c.products || c.observation || '')
      const amount = Number(c.amount || 0)
      const transferAmount = Number(c.transfer_amount || 0)
      const cashExpected = Number(c.cash_expected_amount ?? (amount - transferAmount))

      return `
        <div class="receipt-item receipt-client-row">
          <span>${safe(name)}</span>
          <strong>${money(amount)}</strong>
        </div>
        ${transferAmount > 0 ? `
          <div class="receipt-item receipt-subitem">
            <span>Transferido</span>
            <strong>${money(transferAmount)}</strong>
          </div>
          <div class="receipt-item receipt-subitem">
            <span>Efectivo esperado</span>
            <strong>${money(cashExpected)}</strong>
          </div>
        ` : ''}
        ${comment ? `<div class="receipt-note">${safe(comment)}</div>` : ''}
      `
    }).join('')
    : `<div class="receipt-note">Sin clientes</div>`

  const expenseRows = expenses.length
    ? expenses.map(e => {
      const type = shortReceiptName(e.expense_type || 'Gasto', 28)
      const observation = shortReceiptText(e.observation || '', 38)

      return `
        <div class="receipt-item receipt-expense-row">
          <span>${safe(type)}</span>
          <strong>${money(e.amount || 0)}</strong>
        </div>
        ${observation ? `<div class="receipt-note">${safe(observation)}</div>` : ''}
      `
    }).join('')
    : ''

  return `
    <div class="receipt">
      <h3>RUKA BAKERY</h3>
      <div class="receipt-center">CONTROL DE RENDICIÓN</div>
      <div class="receipt-line"></div>

      <div class="receipt-meta">Fecha: ${safe(r.date || '-')}</div>
      <div class="receipt-meta">Hora: ${safe(r.time || '-')}</div>
      <div class="receipt-meta">Repartidor: ${safe(shortReceiptText(r.driver_name || '-', 30))}</div>

      <div class="receipt-line"></div>
      <div class="receipt-section">CLIENTES</div>
      ${clientRows}

      <div class="receipt-line"></div>
      <div class="receipt-section">RESUMEN</div>

      <div class="receipt-item">
        <span>Total clientes</span>
        <strong>${money(gross)}</strong>
      </div>
      <div class="receipt-item">
        <span>Transferencias</span>
        <strong>${money(transferred)}</strong>
      </div>
      <div class="receipt-item">
        <span>Efectivo esperado</span>
        <strong>${money(expected)}</strong>
      </div>
      <div class="receipt-item">
        <span>Gastos</span>
        <strong>${money(expensesTotal)}</strong>
      </div>

      ${expenses.length ? `
        <div class="receipt-section">Detalle gastos</div>
        ${expenseRows}
      ` : ''}

      <div class="receipt-item">
        <span>A rendir</span>
        <strong>${money(toRender)}</strong>
      </div>
      <div class="receipt-item">
        <span>Recibido efectivo</span>
        <strong>${money(r.received || 0)}</strong>
      </div>
      <div class="receipt-item">
        <span>Diferencia</span>
        <strong>${money(r.diff || 0)}</strong>
      </div>

      <div class="receipt-meta">Estado: ${safe(r.status || '-')}</div>
      <div class="receipt-line"></div>
      <div class="receipt-meta">Obs.: ${safe(shortReceiptText(r.observations || '-', 42))}</div>

      <div class="signature-line">Firma repartidor</div>
      <div class="signature-line">Firma cajera</div>
    </div>
  `
}

function printReceipt(r) {
  const receipt = receiptHtml(r)
  const printWindow = window.open('', '_blank', 'width=420,height=700')

  if (!printWindow) {
    alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.')
    return
  }

  printWindow.document.open()
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Imprimir comprobante</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }

          html,
          body {
            width: 80mm;
            margin: 0;
            padding: 0;
            background: #fff;
          }

          body {
            display: block;
            font-family: Arial, Helvetica, sans-serif;
            color: #000;
          }

          .receipt {
            width: 80mm;
            max-width: 80mm;
            margin: 0;
            padding: 3mm 3mm 5mm 3mm;
            box-sizing: border-box;
            background: #fff;
            color: #000;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13.5px;
            line-height: 1.22;
            font-weight: 600;
          }

          .receipt h3 {
            margin: 0 0 2mm 0;
            padding: 0;
            text-align: center;
            font-size: 15px;
            line-height: 1.1;
            font-weight: 800;
            letter-spacing: .4px;
          }

          .receipt-center {
            text-align: center;
            font-size: 12.5px;
            font-weight: 800;
            margin-bottom: 2mm;
          }

          .receipt-line {
            border-top: 1px dashed #000;
            margin: 2mm 0;
          }

          .receipt-section {
            font-size: 12.5px;
            font-weight: 800;
            margin: 1.5mm 0 1mm 0;
            text-transform: uppercase;
          }

          .receipt-item {
            display: grid;
            grid-template-columns: 1fr 23mm;
            column-gap: 2mm;
            align-items: start;
            width: 100%;
            margin: .8mm 0;
          }

          .receipt-item span {
            min-width: 0;
            text-align: left;
            overflow-wrap: break-word;
            word-break: normal;
          }

          .receipt-subitem {
            font-size: 12.5px;
            margin-left: 2mm;
          }

          .receipt-subitem span {
            color: #222;
          }

          .receipt-item strong {
            text-align: right;
            white-space: nowrap;
            font-weight: 800;
          }

          .receipt-note {
            font-size: 11.5px;
            font-weight: 500;
            line-height: 1.18;
            margin: 0 0 1mm 2mm;
            overflow-wrap: break-word;
          }

          .signature-line {
            margin-top: 8mm;
            border-top: 1px solid #000;
            padding-top: 1mm;
            font-size: 12px;
            font-weight: 600;
          }

          @media print {
            html,
            body {
              width: 80mm;
              margin: 0;
              padding: 0;
            }

            .receipt {
              width: 80mm;
              max-width: 80mm;
              margin: 0;
              padding: 3mm 3mm 5mm 3mm;
              box-shadow: none;
              border: 0;
            }
          }
        </style>
      </head>
      <body>
        ${receipt}
        <script>
          window.onload = function () {
            setTimeout(function () {
              window.print()
            }, 250)
          }

          window.onafterprint = function () {
            setTimeout(function () {
              window.close()
            }, 300)
          }
        <\/script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

function renderClients() {
  setTitle('Clientes', 'Administra la lista de clientes disponibles para rendición.')

  $('clients').innerHTML = `
    <div class="card">
      <div class="actions">
        <button class="btn" id="newClient">Nuevo cliente</button>
      </div>
      <div style="height:14px"></div>
      <div id="clientsTable"></div>
    </div>
  `

  $('newClient').addEventListener('click', () => clientModal())
  drawClients()
}

function drawClients() {
  $('clientsTable').innerHTML = state.clients.length
    ? `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>RUT</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.clients.map(c => `
              <tr>
                <td>${safe(c.name)}</td>
                <td>${safe(c.rut || '-')}</td>
                <td>${c.is_active ? 'Activo' : 'Inactivo'}</td>
                <td>
                  <div class="actions">
                    <button class="btn ghost small" onclick="window.clientActions.view('${c.id}')">Ver</button>
                    <button class="btn ghost small" onclick="window.clientActions.edit('${c.id}')">Editar</button>
                    ${state.profile.role === 'admin' ? `<button class="btn danger small" onclick="window.clientActions.del('${c.id}')">Eliminar</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
    : '<div class="empty">Sin clientes</div>'
}

function clientModal(client = null) {
  const isEdit = Boolean(client)

  openModal(isEdit ? 'Editar cliente' : 'Nuevo cliente', `
    <div class="field">
      <label>Nombre</label>
      <input id="clientName" class="input" value="${safe(client?.name || '')}" autofocus>
    </div>

    <div class="field">
      <label>RUT</label>
      <input id="clientRut" class="input" value="${safe(client?.rut || '')}" inputmode="text">
    </div>

    <div id="clientRutError" class="error"></div>

    <button class="btn" id="saveClient">${isEdit ? 'Guardar cambios' : 'Guardar cliente'}</button>
  `)

  bindRutInput($('clientRut'))

  $('saveClient').addEventListener('click', async () => {
    const name = $('clientName').value.trim()
    const rut = formatRut($('clientRut').value)

    $('clientRutError').textContent = ''

    if (!name) return

    if (rut && !validateRut(rut)) {
      $('clientRutError').textContent = 'RUT inválido. Revisa el dígito verificador.'
      return
    }

    const payload = { name, rut: rut || null }

    const query = isEdit
      ? supabase.from('clients').update(payload).eq('id', client.id)
      : supabase.from('clients').insert({ ...payload, created_by: state.user.id })

    const { error } = await query

    if (error) {
      alert(error.message)
      return
    }

    closeModal()
    await loadData()
    state.section === 'clients' ? renderClients() : renderRendition()
  })
}

window.clientActions = {
  view(id) {
    const c = state.clients.find(x => x.id === id)
    if (!c) return

    openModal('Detalle de cliente', `
      <div class="summary-row"><span>Nombre</span><strong>${safe(c.name)}</strong></div>
      <div class="summary-row"><span>RUT</span><strong>${safe(c.rut || '-')}</strong></div>
      <div class="summary-row"><span>Estado</span><strong>${c.is_active ? 'Activo' : 'Inactivo'}</strong></div>
      <div class="summary-row"><span>Creado</span><strong>${safe(String(c.created_at || '').slice(0, 10))}</strong></div>
    `)
  },

  edit(id) {
    const c = state.clients.find(x => x.id === id)
    if (c) clientModal(c)
  },

  async del(id) {
    if (state.profile.role !== 'admin') return

    if (!confirm('¿Eliminar este cliente?')) return

    const { error } = await supabase.from('clients').delete().eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    await loadData()
    renderClients()
  }
}

function renderDrivers() {
  setTitle('Repartidores', 'Solo administradores pueden crear o modificar repartidores.')

  $('drivers').innerHTML = `
    <div class="card">
      <div class="actions">
        <button class="btn" id="newDriver">Nuevo repartidor</button>
      </div>

      <div style="height:14px"></div>

      ${state.drivers.length ? `
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${state.drivers.map(d => `
                <tr>
                  <td>${safe(d.name)}</td>
                  <td>${d.is_active ? 'Activo' : 'Inactivo'}</td>
                  <td>
                    <div class="actions">
                      <button class="btn ghost small" onclick="window.driverActions.view('${d.id}')">Ver</button>
                      <button class="btn ghost small" onclick="window.driverActions.edit('${d.id}')">Editar</button>
                      <button class="btn danger small" onclick="window.driverActions.del('${d.id}')">Eliminar</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty">Sin repartidores</div>'}
    </div>
  `

  $('newDriver').addEventListener('click', () => driverModal())
}

function driverModal(driver = null) {
  const isEdit = Boolean(driver)

  openModal(isEdit ? 'Editar repartidor' : 'Nuevo repartidor', `
    <div class="field">
      <label>Nombre</label>
      <input id="driverName" class="input" value="${safe(driver?.name || '')}" autofocus>
    </div>

    <button class="btn" id="saveDriver">${isEdit ? 'Guardar cambios' : 'Guardar repartidor'}</button>
  `)

  $('saveDriver').addEventListener('click', async () => {
    const name = $('driverName').value.trim()
    if (!name) return

    const query = isEdit
      ? supabase.from('drivers').update({ name }).eq('id', driver.id)
      : supabase.from('drivers').insert({ name, created_by: state.user.id })

    const { error } = await query

    if (error) {
      alert(error.message)
      return
    }

    closeModal()
    await loadData()
    renderDrivers()
  })
}

window.driverActions = {
  view(id) {
    const d = state.drivers.find(x => x.id === id)
    if (!d) return

    openModal('Detalle de repartidor', `
      <div class="summary-row"><span>Nombre</span><strong>${safe(d.name)}</strong></div>
      <div class="summary-row"><span>Estado</span><strong>${d.is_active ? 'Activo' : 'Inactivo'}</strong></div>
      <div class="summary-row"><span>Creado</span><strong>${safe(String(d.created_at || '').slice(0, 10))}</strong></div>
    `)
  },

  edit(id) {
    const d = state.drivers.find(x => x.id === id)
    if (d) driverModal(d)
  },

  async del(id) {
    if (state.profile.role !== 'admin') return

    if (!confirm('¿Eliminar este repartidor?')) return

    const { error } = await supabase.from('drivers').delete().eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    await loadData()
    renderDrivers()
  }
}

async function createUserFromFrontend() {
  const status = $('userStatus')
  if (status) status.textContent = ''

  const email = $('newUserEmail')?.value.trim()
  const password = $('newUserPassword')?.value
  const full_name = $('newUserName')?.value.trim()
  const username = $('newUserUsername')?.value.trim()
  const role = $('newUserRole')?.value

  if (!email || !password || !full_name || !username || !role) {
    if (status) status.textContent = 'Completa todos los campos para crear el usuario.'
    return
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    if (status) status.textContent = 'No hay sesión activa. Vuelve a iniciar sesión.'
    return
  }

  if (status) status.textContent = 'Creando usuario...'

  try {
    const response = await fetch('/.netlify/functions/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ email, password, full_name, username, role })
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(result.error || 'No se pudo crear el usuario.')
    }

    if (status) status.textContent = 'Usuario creado correctamente.'

    $('newUserEmail').value = ''
    $('newUserPassword').value = ''
    $('newUserName').value = ''
    $('newUserUsername').value = ''

    await loadData()
    drawUsers()
  } catch (error) {
    if (status) status.textContent = error.message || 'Error al crear usuario.'
  }
}

function renderUsers() {
  setTitle('Usuarios', 'Crea y administra accesos para cajeras o administradores.')

  $('users').innerHTML = `
    <div class="card">
      <div class="form-grid">
        <div class="field"><label>Correo</label><input id="newUserEmail" class="input" type="email"></div>
        <div class="field"><label>Clave temporal</label><input id="newUserPassword" class="input" type="password"></div>
        <div class="field"><label>Nombre</label><input id="newUserName" class="input"></div>
        <div class="field"><label>Usuario interno</label><input id="newUserUsername" class="input"></div>
        <div class="field"><label>Rol</label><select id="newUserRole"><option value="cajera">Cajera</option><option value="admin">Admin</option></select></div>
      </div>

      <button class="btn" id="createUser">Crear usuario</button>
      <div id="userStatus" class="statusbar"></div>
    </div>

    <div class="card" style="margin-top:18px">
      <h3>Usuarios registrados</h3>
      <div id="usersTable"></div>
    </div>
  `

  $('createUser').addEventListener('click', createUserFromFrontend)
  drawUsers()
}

function drawUsers() {
  $('usersTable').innerHTML = state.profiles.length
    ? `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${state.profiles.map(u => `
              <tr>
                <td>${safe(u.full_name)}</td>
                <td>${safe(u.username || '')}</td>
                <td>${safe(u.role)}</td>
                <td>${u.is_active ? 'Activo' : 'Inactivo'}</td>
                <td>
                  <div class="actions">
                    <button class="btn ghost small" onclick="window.userActions.view('${u.id}')">Ver</button>
                    <button class="btn ghost small" onclick="window.userActions.edit('${u.id}')">Editar</button>
                    <button class="btn danger small" onclick="window.userActions.toggle('${u.id}')">${u.is_active ? 'Eliminar' : 'Activar'}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
    : '<div class="empty">Sin usuarios</div>'
}

function userModal(user) {
  openModal('Editar usuario', `
    <div class="field">
      <label>Nombre</label>
      <input id="editUserName" class="input" value="${safe(user.full_name || '')}">
    </div>

    <div class="field">
      <label>Usuario interno</label>
      <input id="editUserUsername" class="input" value="${safe(user.username || '')}">
    </div>

    <div class="field">
      <label>Rol</label>
      <select id="editUserRole">
        <option value="cajera" ${user.role === 'cajera' ? 'selected' : ''}>Cajera</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
      </select>
    </div>

    <button class="btn" id="saveUserEdit">Guardar cambios</button>
  `)

  $('saveUserEdit').addEventListener('click', async () => {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: $('editUserName').value.trim(),
        username: $('editUserUsername').value.trim(),
        role: $('editUserRole').value
      })
      .eq('id', user.id)

    if (error) {
      alert(error.message)
      return
    }

    closeModal()
    await loadData()
    renderUsers()
  })
}

window.userActions = {
  view(id) {
    const u = state.profiles.find(x => x.id === id)
    if (!u) return

    openModal('Detalle de usuario', `
      <div class="summary-row"><span>Nombre</span><strong>${safe(u.full_name)}</strong></div>
      <div class="summary-row"><span>Usuario</span><strong>${safe(u.username || '')}</strong></div>
      <div class="summary-row"><span>Rol</span><strong>${safe(u.role)}</strong></div>
      <div class="summary-row"><span>Estado</span><strong>${u.is_active ? 'Activo' : 'Inactivo'}</strong></div>
    `)
  },

  edit(id) {
    const u = state.profiles.find(x => x.id === id)
    if (u) userModal(u)
  },

  async toggle(id) {
    const u = state.profiles.find(x => x.id === id)
    if (!u) return

    if (u.id === state.user.id && u.is_active) {
      alert('No puedes eliminar/desactivar tu propio usuario activo.')
      return
    }

    if (!confirm(u.is_active ? '¿Eliminar/desactivar este usuario?' : '¿Activar este usuario?')) return

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !u.is_active })
      .eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    await loadData()
    renderUsers()
  }
}

function openModal(title, content) {
  $('modalRoot').innerHTML = `
    <div class="modal">
      <div class="modal-card">
        <div class="modal-head">
          <h3>${title}</h3>
          <button class="close" id="closeModal">×</button>
        </div>
        <div style="height:12px"></div>
        ${content}
      </div>
    </div>
  `

  $('closeModal').addEventListener('click', closeModal)
}

function closeModal() {
  $('modalRoot').innerHTML = ''
}

function exportCsv() {
  const rows = filteredReportRows()

  const header = 'Fecha;Hora;Repartidor;Clientes;Total vendido;Transferido;Esperado efectivo;Gastos;Recibido efectivo;Diferencia;Estado'

  const body = rows.map(r => [
    String(r.rendition_date || '').slice(0, 10),
    String(r.rendition_time || '').slice(0, 5),
    r.driver_name,
    (r.rendition_clients || []).map(c => c.client_name).join(', '),
    calcRenditionGross(r),
    r.transferred_amount || 0,
    r.expected_amount,
    r.expenses_amount,
    r.received_amount,
    r.difference_amount,
    r.status
  ].join(';'))

  const csv = [header, ...body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')

  link.href = URL.createObjectURL(blob)
  link.download = 'reporte-rendiciones-ruka-bakery.csv'
  link.click()

  URL.revokeObjectURL(link.href)
}
