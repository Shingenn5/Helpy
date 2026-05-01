const { spawn } = require('node:child_process')

function runDockerCompose(args) {
  return new Promise((resolve) => {
    // boots docker thing
    const child = spawn('docker', ['compose', ...args], {
      cwd: process.cwd(),
      shell: true
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => stdout += data.toString())
    child.stderr.on('data', (data) => stderr += data.toString())
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr }))
  })
}

function createDockerService() {
  return {
    start: () => runDockerCompose(['up', '-d']),
    stop: () => runDockerCompose(['down']),
    status: () => runDockerCompose(['ps'])
  }
}

module.exports = { createDockerService }
