const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

function runDockerCompose(args, options) {
  return new Promise((resolve) => {
    const composeFile = options.composeFile
    const command = ['docker', 'compose', '-f', composeFile, ...args].join(' ')

    if (!fs.existsSync(composeFile)) {
      resolve({
        ok: false,
        code: 1,
        stdout: '',
        stderr: `Missing compose file: ${composeFile}`,
        command
      })
      return
    }

    // boots docker thing, no shell path nonsense
    const child = spawn('docker', ['compose', '-f', composeFile, ...args], {
      cwd: path.dirname(composeFile),
      shell: false
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => stdout += data.toString())
    child.stderr.on('data', (data) => stderr += data.toString())
    child.on('error', (error) => resolve({ ok: false, code: 1, stdout, stderr: error.message, composeFile, command }))
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr, composeFile, command }))
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
