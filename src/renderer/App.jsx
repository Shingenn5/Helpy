import { useEffect, useMemo, useState } from 'react'

const modes = ['Ask', 'Code', 'Architect', 'Agent', 'Research']
const projects = ['/home/shingen/Tech Projects', 'qwen-coder-lab', 'obsidian-agent-vault']

export default function App() {
  const [activeProject, setActiveProject] = useState(projects[0])
  const [mode, setMode] = useState('Ask')
  const [health, setHealth] = useState({ ok: false, label: 'Checking backend...' })
  const [prompt, setPrompt] = useState('')
  const [stream, setStream] = useState('Ready for local agent work.')
  const [logs, setLogs] = useState(['Workbench booted. Docker controls are scaffolded.'])

  useEffect(() => {
    refreshHealth()
    const off = window.workstation?.agent.onStreamChunk((payload) => {
      setStream((current) => current + payload.chunk)
      if (payload.done) setLogs((items) => [...items, 'Mock stream finished.'])
    })
    return () => off?.()
  }, [])

  async function refreshHealth() {
    const result = await window.workstation.health()
    setHealth(result)
    setLogs((items) => [...items, `Health: ${result.label}`])
  }

  async function runMockAgent() {
    setStream('')
    setLogs((items) => [...items, `Running ${mode} stream against ${activeProject}`])
    await window.workstation.agent.mockStream(prompt)
  }

  async function dockerAction(action) {
    const result = await window.workstation.docker[action]()
    setLogs((items) => [...items, `docker ${action}: ${result.ok ? 'ok' : 'failed'}`, result.stdout || result.stderr || 'no output'])
  }

  const contextFiles = useMemo(() => [
    'docker-compose.yml',
    'src/agents/aider-runner.ts',
    'vault/Sessions/2026-05-01-local-agent.md'
  ], [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">AI</div><div><strong>Workstation</strong><span>local control plane</span></div></div>
        <section className="nav-section">
          <label>Project</label>
          <select value={activeProject} onChange={(event) => setActiveProject(event.target.value)}>
            {projects.map((project) => <option key={project}>{project}</option>)}
          </select>
        </section>
        <section className="nav-section">
          <label>Modes</label>
          <div className="mode-list">
            {modes.map((item) => <button key={item} className={item === mode ? 'active' : ''} onClick={() => setMode(item)}>{item}</button>)}
          </div>
        </section>
        <button className="settings-button">Settings</button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">Active Project</span><h1>{activeProject}</h1></div>
          <div className={`health-pill ${health.ok ? 'good' : 'bad'}`} onClick={refreshHealth}><span />{health.label}</div>
        </header>
        <div className="work-grid">
          <section className="conversation">
            <div className="conversation-header"><div><span className="eyebrow">Mode</span><h2>{mode}</h2></div><button onClick={runMockAgent}>Run Mock Stream</button></div>
            <div className="message-list">
              <div className="message user">Build a local-first coding agent session with Obsidian logging.</div>
              <div className="message assistant"><div className="stream-label">Live Response Stream</div><p>{stream}<span className="cursor">|</span></p></div>
            </div>
            <div className="composer"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask the local agent..." /><button onClick={runMockAgent}>Send</button></div>
          </section>
          <aside className="right-panel">
            <section><div className="panel-title">Context Files</div>{contextFiles.map((file) => <div className="file-row" key={file}>{file}</div>)}</section>
            <section><div className="panel-title">Diff Viewer</div><div className="diff-box"><span>+ agent edits will show here</span><span>- old code placeholder</span></div></section>
          </aside>
        </div>
        <section className="bottom-drawer">
          <div className="drawer-head"><strong>Terminal / Docker / Aider Logs</strong><div><button onClick={() => dockerAction('status')}>Status</button><button onClick={() => dockerAction('start')}>Start</button><button onClick={() => dockerAction('stop')}>Stop</button></div></div>
          <pre>{logs.join('\n')}</pre>
        </section>
      </main>
    </div>
  )
}
