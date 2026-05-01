function createHealthService(baseUrl) {
  const rootUrl = baseUrl.replace(/\/v1$/, '')

  return {
    async check() {
      try {
        const res = await fetch(`${baseUrl}/models`)
        if (!res.ok) {
          const health = await checkRootHealth(rootUrl)
          if (health.ok) return { ok: false, loading: true, status: res.status, label: 'Model loading' }
          return { ok: false, status: res.status, label: `Backend HTTP ${res.status}` }
        }
        const data = await res.json().catch(() => ({}))
        return { ok: true, status: res.status, label: 'Local backend online', models: data.data || [] }
      } catch (error) {
        const health = await checkRootHealth(rootUrl)
        if (health.ok) return { ok: false, loading: true, status: health.status, label: 'Model loading' }
        return { ok: false, status: 0, label: 'Backend offline', error: error.message }
      }
    }
  }
}

async function checkRootHealth(rootUrl) {
  try {
    const res = await fetch(`${rootUrl}/health`)
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

module.exports = { createHealthService }
