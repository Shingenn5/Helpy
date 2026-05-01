import { useEffect, useMemo, useRef, useState } from 'react'

const modes = ['Ask', 'Code', 'Architect', 'Agent', 'Research']
const projects = ['/home/shingen/Tech Projects', 'qwen-coder-lab', 'obsidian-agent-vault']

export default function App() {
  const [activeProject, setActiveProject] = useState(projects[0])
  const [mode, setMode] = useState('Code')
  const [health, setHealth] = useState({ ok: false, label: 'Checking backend...' })
  const [docker, setDocker] = useState({ ok: false, label: 'Docker not checked', composeFile: '' })
  const [settings, setSettings] = useState({ modelDir: '', modelFile: '', envPath: '' })
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Helpy is ready. Start the local backend, pick context, then run an Aider-style pass.' }
  ])
  const [stream, setStream] = useState('')
  const [logs, setLogs] = useState(['Helpy booted. Markdown session logging is active.'])
  const [session, setSession] = useState(null)
  const assistantDraft = useRef('')
  const sessionRef = useRef(null)

  useEffect(() => {
    boot()
    const off = window.workstation?.agent.onStreamChunk((payload) => {
      assistantDraft.current += payload.chunk
      setStream(assistantDraft.current)

      if (payload.done) {
        const finalText = assistantDraft.current
        setMessages((items) => [...items, { role: 'assistant', content: finalText }])
        addLog('Agent pass finished and logged.')
        logMarkdown({ role: 'assistant', content: finalText })
        assistantDraft.current = ''
        setStream('')
      }
    })
    return () => off?.()
  }, [])

  async function boot() {
    await startSession()
    await loadSettings()
    await loadDockerConfig()
    await refreshHealth()
    await dockerAction('status', { quiet: true })
  }

  async function startSession() {
    const result = await window.workstation.session.start({
      project: activeProject,
      mode,
      summary: 'Helpy coding-agent session started'
    })
    sessionRef.current = result
    setSession(result)
    addLog(`Markdown log: ${result.path}`)
  }

  async function loadDockerConfig() {
    const result = await window.workstation.docker.config()
    setDocker((current) => ({ ...current, composeFile: result.composeFile }))
  }

  async function loadSettings() {
    const result = await window.workstation.settings.get()
    setSettings(result)
    addLog(`Model config: ${result.modelDir}/${result.modelFile}`)
  }

  async function chooseModel() {
    const result = await window.workstation.settings.chooseModel()
    if (!result.ok) return
    setSettings((current) => ({ ...current, ...result }))
    addLog(`Model selected: ${result.modelPath}`)
    await logMarkdown({ role: 'event', content: `Model selected: ${result.modelPath}` })
  }

  async function refreshHealth() {
    const result = await window.workstation.health()
    setHealth(result)
    addLog(`Backend health: ${result.label}`)
    logMarkdown({ role: 'event', content: `Backend health: ${result.label}` })
  }

  async function runAgentPass() {
    const text = prompt.trim()
    if (!text) return

    setStream('')
    assistantDraft.current = ''
    setMessages((items) => [...items, { role: 'user', content: text }])
    setPrompt('')
    addLog(`Agent pass queued: ${mode} on ${activeProject}`)
    await logMarkdown({ role: 'user', content: text })
    await window.workstation.agent.mockStream(text)
  }

  async function dockerAction(action, options = {}) {
    const result = await window.workstation.docker[action]()
    const output = [result.command, result.stdout || result.stderr || 'no output'].filter(Boolean).join('\n')
    const label = `docker ${action}: ${result.ok ? 'ok' : 'failed'}`

    setDocker((current) => ({
      ...current,
      ok: result.ok,
      label,
      composeFile: result.composeFile || current.composeFile
    }))

    if (!options.quiet) addLog(`${label}\n${output}`)
    logMarkdown({ role: 'event', content: `${label}\n${output}` })

    if (action === 'start') {
      setTimeout(refreshHealth, 1200)
    }
  }

  async function logMarkdown(entry) {
    const current = sessionRef.current
    const result = await window.workstation.session.log({
      sessionId: current?.sessionId,
      project: activeProject,
      mode,
      ...entry
    })
    if (!sessionRef.current && result?.sessionId) {
      sessionRef.current = result
      setSession(result)
    }
  }

  function addLog(line) {
    setLogs((items) => [...items.slice(-180), `[${new Date().toLocaleTimeString()}] ${line}`])
  }

  const contextFiles = useMemo(() => [
    'docker-compose.yml',
    '.env',
    'src/backend/services/sessionLogger.js',
    'src/agents/aider-runner.ts'
  ], [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">H</div>
          <div><strong>Helpy</strong><span>AiderDesk replacement</span></div>
        </div>

        <section className="nav-section">
          <label>Project</label>
          <select value={activeProject} onChange={(event) => setActiveProject(event.target.value)}>
            {projects.map((project) => <option key={project}>{project}</option>)}
          </select>
        </section>

        <section className="nav-section">
          <label>Workflow</label>
          <div className="mode-list">
            {modes.map((item) => (
              <button key={item} className={item === mode ? 'active' : ''} onClick={() => setMode(item)}>
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="nav-section compact">
          <label>Session Log</label>
          <div className="path-chip">{session?.path || 'starting...'}</div>
        </section>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Current Aider Workspace</span>
            <h1>{activeProject}</h1>
          </div>
          <button className={`health-pill ${health.ok ? 'good' : 'bad'}`} onClick={refreshHealth}>
            <span />{health.label}
          </button>
        </header>

        <section className="status-strip">
          <StatusCard title="Local Model" value={health.ok ? 'Online' : 'Offline'} detail="llama.cpp /v1/models" good={health.ok} />
          <StatusCard title="Docker Backend" value={docker.ok ? 'Ready' : 'Needs attention'} detail={docker.label} good={docker.ok} />
          <StatusCard title="Aider Runner" value="Scaffolded" detail="PTY runner next" />
          <StatusCard title="Markdown DB" value="Writing" detail="session timeline active" good />
        </section>

        <div className="work-grid">
          <section className="conversation">
            <div className="conversation-header">
              <div>
                <span className="eyebrow">Aider-style command loop</span>
                <h2>{mode}</h2>
              </div>
              <button className="primary-button" onClick={runAgentPass}>Run Agent Pass</button>
            </div>

            <div className="message-list">
              {messages.map((message, index) => (
                <div className={`message ${message.role}`} key={index}>{message.content}</div>
              ))}
              {stream && (
                <div className="message assistant">
                  <div className="stream-label">Live Response Stream</div>
                  <p>{stream}<span className="cursor">|</span></p>
                </div>
              )}
            </div>

            <div className="composer">
              <input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runAgentPass()
                }}
                placeholder="Tell Helpy what to change, inspect, explain, or plan..."
              />
              <button onClick={runAgentPass}>Send</button>
            </div>
          </section>

          <aside className="right-panel">
            <section className="panel">
              <div className="panel-title">Model</div>
              <div className="model-card">
                <strong>{settings.modelFile || 'No model selected'}</strong>
                <span>{settings.modelDir || 'Choose a GGUF model to create .env'}</span>
              </div>
              <button onClick={chooseModel}>Choose Model</button>
            </section>

            <section className="panel">
              <div className="panel-title">Backend Control</div>
              <div className="backend-actions">
                <button className="primary-button" onClick={() => dockerAction('start')}>Start Backend</button>
                <button onClick={() => dockerAction('status')}>Status</button>
                <button onClick={() => dockerAction('logs')}>Logs</button>
                <button onClick={() => dockerAction('stop')}>Stop</button>
              </div>
              <div className="compose-path">{docker.composeFile || 'No compose file loaded'}</div>
            </section>

            <section className="panel">
              <div className="panel-title">Context Files</div>
              {contextFiles.map((file) => <div className="file-row" key={file}>{file}</div>)}
            </section>

            <section className="panel">
              <div className="panel-title">Diff Viewer</div>
              <div className="diff-box"><span>+ backend wiring now starts from Helpy</span><span>- fake-only Docker controls</span></div>
            </section>
          </aside>
        </div>

        <section className="bottom-drawer">
          <div className="drawer-head">
            <strong>Terminal / Docker / Aider Logs</strong>
            <span>{session?.path || 'Starting Markdown log...'}</span>
          </div>
          <pre>{logs.join('\n\n')}</pre>
        </section>
      </main>
    </div>
  )
}

function StatusCard({ title, value, detail, good }) {
  return (
    <div className={`status-card ${good ? 'good' : ''}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}
