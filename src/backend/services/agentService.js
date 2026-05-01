function createAgentService(baseUrl) {
  return {
    async streamChat(event, payload = {}) {
      const messages = payload.messages || []
      const mode = payload.mode || 'Code'

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: payload.model || 'local-model',
            stream: true,
            temperature: 0.2,
            messages: [
              { role: 'system', content: systemPrompt(mode) },
              ...messages
            ]
          })
        })

        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => '')
          event.sender.send('agent:stream-chunk', {
            chunk: `Backend returned ${response.status}. ${text}`,
            done: true,
            error: true
          })
          return { ok: false, status: response.status }
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const chunk = json.choices?.[0]?.delta?.content || ''
              if (chunk) event.sender.send('agent:stream-chunk', { chunk, done: false })
            } catch {
              // shrug, bad server line
            }
          }
        }

        event.sender.send('agent:stream-chunk', { chunk: '', done: true })
        return { ok: true }
      } catch (error) {
        event.sender.send('agent:stream-chunk', {
          chunk: `Could not reach local model: ${error.message}`,
          done: true,
          error: true
        })
        return { ok: false, error: error.message }
      }
    }
  }
}

function systemPrompt(mode) {
  return [
    'You are Helpy, a local-first AiderDesk-style coding assistant.',
    'Be direct, engineering-focused, and careful with file changes.',
    `Current workflow mode: ${mode}.`,
    'For now, propose edits and plans; future versions will apply patches through Aider.'
  ].join('\n')
}

module.exports = { createAgentService }
