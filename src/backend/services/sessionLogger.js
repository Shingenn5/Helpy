const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

function createSessionLogger(options = {}) {
  const root = options.root || process.env.HELPY_VAULT_PATH || path.join(os.homedir(), 'HelpyVault')
  const sessionsDir = path.join(root, 'Helpy', 'Sessions')

  return {
    async start(payload = {}) {
      const now = new Date()
      const sessionId = payload.sessionId || makeSessionId(now)
      const filePath = path.join(sessionsDir, `${sessionId}.md`)
      await fs.mkdir(sessionsDir, { recursive: true })

      try {
        await fs.access(filePath)
      } catch {
        await fs.writeFile(filePath, buildFrontmatter(payload, now, sessionId), 'utf8')
      }

      return { ok: true, sessionId, path: filePath }
    },

    async append(payload = {}) {
      const now = new Date()
      const sessionId = payload.sessionId || makeSessionId(now)
      const filePath = path.join(sessionsDir, `${sessionId}.md`)
      await fs.mkdir(sessionsDir, { recursive: true })

      try {
        await fs.access(filePath)
      } catch {
        await fs.writeFile(filePath, buildFrontmatter(payload, now, sessionId), 'utf8')
      }

      await fs.appendFile(filePath, formatEntry(payload, now), 'utf8')

      return {
        ok: true,
        path: filePath,
        sessionId,
        entry: {
          createdAt: now.toISOString(),
          project: payload.project || 'unset',
          mode: payload.mode || 'ask',
          role: payload.role || 'event'
        }
      }
    }
  }
}

function makeSessionId(date) {
  return `${date.toISOString().slice(0, 10)}-helpy-session`
}

function buildFrontmatter(payload, date, sessionId) {
  const project = payload.project || 'unset'
  const mode = payload.mode || 'Code'

  return [
    '---',
    `id: ${yaml(sessionId)}`,
    `title: ${yaml(`Helpy session ${date.toISOString().slice(0, 10)}`)}`,
    `created: ${yaml(date.toISOString())}`,
    `updated: ${yaml(date.toISOString())}`,
    `project: ${yaml(project)}`,
    `mode: ${yaml(mode)}`,
    'tool: Helpy',
    'type: coding-agent-session',
    'tags:',
    '  - helpy',
    '  - aiderdesk-replacement',
    '  - coding-agent',
    '---',
    '',
    '# Helpy Session',
    '',
    `Project: \`${project}\``,
    '',
    '## Timeline',
    ''
  ].join('\n')
}

function formatEntry(payload, date) {
  const role = payload.role || 'event'
  const label = role[0].toUpperCase() + role.slice(1)
  const body = payload.content || payload.summary || ''
  const meta = [
    `mode: ${payload.mode || 'Code'}`,
    payload.project ? `project: ${payload.project}` : null
  ].filter(Boolean).join(' | ')

  return [
    `### ${label} - ${date.toISOString()}`,
    '',
    meta ? `_${meta}_` : '',
    '',
    fenceFor(role, body),
    ''
  ].join('\n')
}

function fenceFor(role, body) {
  if (role === 'assistant' || role === 'user') return body
  return ['```text', body, '```'].join('\n')
}

function yaml(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`
}

module.exports = { createSessionLogger }
