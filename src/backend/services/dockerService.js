const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

function runDockerCompose(args, options) {
  return new Promise((resolve) => {
    const composeFile = options.composeFile

    if (!fs.existsSync(composeFile)) {
      resolve({
        ok: false,
        code: 1,
        stdout: '',
        stderr: `Missing compose file: ${composeFile}`
      })
      return
    }

    // boots docker thing
    const child = spawn('docker', ['compose', '-f', composeFile, ...args], {
      cwd: path.dirname(composeFile),
      shell: true
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => stdout += data.toString())
    child.stderr.on('data', (data) => stderr += data.toString())
    child.on('error', (error) => resolve({ ok: false, code: 1, stdout, stderr: error.message }))
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr, composeFile }))
  })
}

function createDockerService(options = {}) {
  const composeFile = options.composeFile || process.env.HELPY_COMPOSE_FILE || path.join(process.cwd(), 'docker-compose.yml')
  const composeOptions = { composeFile }

  return {
    start: () => runDockerCompose(['up', '-d'], composeOptions),
    stop: () => runDockerCompose(['down'], composeOptions),
    status: () => runDockerCompose(['ps'], composeOptions),
    logs: () => runDockerCompose(['logs', '--tail', '120'], composeOptions),
    config: () => ({ ok: true, composeFile })
  }
}

module.exports = { createDockerService }
