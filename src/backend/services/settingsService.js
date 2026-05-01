const fs = require('node:fs/promises')
const path = require('node:path')

function createSettingsService(options = {}) {
  const envPath = options.envPath || path.join(process.cwd(), '.env')

  return {
    async get() {
      const values = await readEnv(envPath)
      return {
        ok: true,
        envPath,
        modelDir: values.LLAMA_MODEL_DIR || '/home/shingen/AI_Core/models',
        modelFile: values.LLAMA_MODEL_FILE || 'Qwen3.6-35B-A3B-UD-IQ2_M.gguf',
        port: values.LLAMA_PORT || '8080'
      }
    },

    async setModel(modelPath) {
      const modelDir = path.dirname(modelPath)
      const modelFile = path.basename(modelPath)
      const values = await readEnv(envPath)

      values.LLAMA_CPP_IMAGE = values.LLAMA_CPP_IMAGE || 'ghcr.io/ggml-org/llama.cpp:server-cuda'
      values.LLAMA_PORT = values.LLAMA_PORT || '8080'
      values.LLAMA_MODEL_DIR = modelDir
      values.LLAMA_MODEL_FILE = modelFile
      values.LLAMA_CONTEXT = values.LLAMA_CONTEXT || '8192'
      values.LLAMA_GPU_LAYERS = values.LLAMA_GPU_LAYERS || '999'

      await writeEnv(envPath, values)
      return { ok: true, envPath, modelDir, modelFile, modelPath }
    }
  }
}

async function readEnv(envPath) {
  try {
    const text = await fs.readFile(envPath, 'utf8')
    const values = {}

    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const index = trimmed.indexOf('=')
      if (index === -1) return
      values[trimmed.slice(0, index)] = trimmed.slice(index + 1)
    })

    return values
  } catch {
    return {}
  }
}

async function writeEnv(envPath, values) {
  const lines = [
    '# Managed by Helpy. You can still edit this by hand.',
    `LLAMA_CPP_IMAGE=${values.LLAMA_CPP_IMAGE}`,
    `LLAMA_PORT=${values.LLAMA_PORT}`,
    `LLAMA_MODEL_DIR=${values.LLAMA_MODEL_DIR}`,
    `LLAMA_MODEL_FILE=${values.LLAMA_MODEL_FILE}`,
    `LLAMA_CONTEXT=${values.LLAMA_CONTEXT}`,
    `LLAMA_GPU_LAYERS=${values.LLAMA_GPU_LAYERS}`,
    ''
  ]

  await fs.writeFile(envPath, lines.join('\n'), 'utf8')
}

module.exports = { createSettingsService }
