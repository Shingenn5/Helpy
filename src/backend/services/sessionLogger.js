function createSessionLogger() {
  return {
    async append(payload = {}) {
      // future obsidian brain dump
      return {
        ok: true,
        path: null,
        entry: {
          createdAt: new Date().toISOString(),
          project: payload.project || 'unset',
          mode: payload.mode || 'ask',
          summary: payload.summary || ''
        }
      }
    }
  }
}

module.exports = { createSessionLogger }
