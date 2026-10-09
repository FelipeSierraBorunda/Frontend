import { useState, useEffect } from 'react'

// Dirección base del backend Django
const API = 'http://127.0.0.1:8000/api'

// fetch con token: añade el header Authorization.
// Si el access caducó (401), pide uno nuevo con el refresh y reintenta una vez.
async function apiFetch(ruta, opciones = {}, alExpirar) {
  const pedir = () =>
    fetch(API + ruta, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + localStorage.getItem('access'),
      },
    })

  let res = await pedir()
  if (res.status === 401) {
    const r = await fetch(API + '/auth/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: localStorage.getItem('refresh') }),
    })
    // Si el refresh también caducó, se cierra la sesión
    if (!r.ok) { alExpirar(); throw new Error('Sesión expirada') }
    const datos = await r.json()
    localStorage.setItem('access', datos.access)
    if (datos.refresh) localStorage.setItem('refresh', datos.refresh) // por si el backend rota el refresh
    res = await pedir()
  }
  return res
}

// ---------- Pantalla de login ----------
function Login({ alEntrar }) {
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')

  async function enviar(e) {
    e.preventDefault() // evita que el formulario recargue la página
    setError('')
    try {
      const res = await fetch(API + '/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usuario, password: clave }),
      })
      if (!res.ok) return setError('Usuario o contraseña incorrectos')
      const datos = await res.json()
      // Se guardan ambos tokens en el navegador
      localStorage.setItem('access', datos.access)
      localStorage.setItem('refresh', datos.refresh)
      alEntrar()
    } catch {
      setError('No se pudo conectar con el servidor')
    }
  }

  return (
    <form onSubmit={enviar}>
      <h2>Iniciar sesión</h2>
      <input placeholder="Usuario" value={usuario} onChange={e => setUsuario(e.target.value)} />
      <input type="password" placeholder="Contraseña" value={clave} onChange={e => setClave(e.target.value)} />
      <button>Entrar</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  )
}

// ---------- Pantalla de clientes (lista + crear + salir) ----------
function Clientes({ alSalir }) {
  const [clientes, setClientes] = useState([])
  const [nuevo, setNuevo] = useState({ nombre: '', contacto: '', email: '' })
  const [error, setError] = useState('')

  // GET: trae la lista de clientes
  async function cargar() {
    try {
      const res = await apiFetch('/clientes/', {}, alSalir)
      const datos = await res.json()
      setClientes(datos.results ?? datos) // si DRF tiene paginación, la lista viene en "results"
    } catch {
      setError('No se pudo cargar la lista')
    }
  }

  // [] = ejecutar solo una vez, al mostrar la pantalla
  useEffect(() => { cargar() }, [])

  // POST: crea un cliente y vuelve a cargar la lista
  async function crear(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await apiFetch('/clientes/', { method: 'POST', body: JSON.stringify(nuevo) }, alSalir)
      if (!res.ok) return setError(JSON.stringify(await res.json())) // DRF indica qué campo falló
      setNuevo({ nombre: '', contacto: '', email: '' })
      cargar()
    } catch {
      setError('No se pudo crear el cliente')
    }
  }

  // Actualiza un solo campo del formulario usando el atributo "name" del input
  const cambiar = e => setNuevo({ ...nuevo, [e.target.name]: e.target.value })

  return (
    <div>
      <h2>Clientes</h2>
      <button onClick={alSalir}>Cerrar sesión</button>

      <ul>
        {clientes.map(c => (
          <li key={c.id}> {c.id} - {c.nombre} — {c.contacto} — {c.email}</li>
        ))}
      </ul>

      <h3>Nuevo cliente</h3>
      <form onSubmit={crear}>
        <input name="nombre" placeholder="Nombre" value={nuevo.nombre} onChange={cambiar} />
        <input name="contacto" placeholder="Contacto" value={nuevo.contacto} onChange={cambiar} />
        <input name="email" placeholder="Email" value={nuevo.email} onChange={cambiar} />
        <button>Crear</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}

// ---------- Componente principal: alterna pantallas con estado ----------
export default function App() {
  // Si ya hay un token guardado, entra directo a la lista de clientes
  const [logueado, setLogueado] = useState(!!localStorage.getItem('access'))

  function salir() {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setLogueado(false)
  }

  return logueado ? <Clientes alSalir={salir} /> : <Login alEntrar={() => setLogueado(true)} />
}
