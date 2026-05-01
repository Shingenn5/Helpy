function createHealthService(baseUrl) {
  return {
    async check() {
      try {
        const res = await fetch(`${baseUrl}/models`)
        if (!res.ok) return { ok: false, status: res.status, label: 'Backend unhappy' }
        const data = await res.json().catch(() => ({}))
        return { ok: true, status: res.status, label: 'Local backend online', models: data.data || [] }
      } catch (error) {
        return { ok: false, status: 0, label: 'Backend offline', error: error.message }
      }
    }
  }
}

module.exports = { createHealthService }
