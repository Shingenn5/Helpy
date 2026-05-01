import { useEffect, useMemo, useRef, useState } from 'react'

const modes = ['Ask', 'Code', 'Architect', 'Agent', 'Research']
const projects = ['/home/shingen/Tech Projects', 'qwen-coder-lab', 'obsidian-agent-vault']

export default function App() {
  const [activeProject, setActiveProject] = useState(projects[0])
  const [mode, setMode] = useState('Code')
  const [health, setHealth] = useState({ ok: false, label: 'Checking backend...' })
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Helpy is ready. Pick a project, add context, and run the coding loop.' }
  ])
  const [stream, setStream] = useState('')
  const [logs, setLogs] = useState(['Helpy booted. Markdown session logging is active.'])
  const [session, setSession] = useState(null)
  const assistantDraft = useRef('')
  const sessionRef = useRef(null)

  useEffect(() => {
    startSession()
    refreshHealth()
    const off = window.workstation?.agent.onStreamChunk((payload) => {
      assistantDraft.current += payload.chunk
      setStream(assistantDraft.current)

      if (payload.done) {
        const finalText = assistantDraft.current
        setMessages((items) => [...items, { role: 'assistant', content: finalText }])
        setLogs((items) => [...items, 'Aider-style mock stream logged to Markdown.'])
        logMarkdown({ role: 'assistant', content: finalText })
        assistantDraft.current = ''
        setStream('')
      }
    })
    return () => off?.()
  }, [])

  async function startSession() {
    const result = await window.workstation.session.start({
      project: activeProject,
      mode,
      summary: 'Helpy coding-agent session started'
    })
    sessionRef.current = result
    setSession(result)
    setLogs((items) => [...items, `Markdown log: ${result.path}`])
  }

  async function refreshHealth() {
    const result = await window.workstation.health()
    setHealth(result)
    setLogs((items) => [...items, `Health: ${result.label}`])
    logMarkdown({ role: 'event', content: `Backend health: ${result.label}` })
  }

  async function runMockAgent() {
    const text = prompt.trim()
    if (!text) return

    setStream('')
    assistantDraft.current = ''
    setMessages((items) => [...items, { role: 'user', content: text }])
    setLogs((items) => [...items, `Running ${mode} stream against ${activeProject}`])
    setPrompt('')
    await logMarkdown({ role: 'user', content: text })
    await window.workstation.agent.mockStream(text)
  }

  async function dockerAction(action) {
    const result = await window.workstation.docker[action]()
    setLogs((items) => [...items, `docker ${action}: ${result.ok ? 'ok' : 'failed'}`, result.stdout || result.stderr || 'no output'])
    logMarkdown({ role: 'event', content: `docker ${action}: ${result.ok ? 'ok' : 'failed'}\n${result.stdout || result.stderr || 'no output'}` })
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

  const contextFiles = useMemo(() => [
    'docker-compose.yml',
    'src/agents/aider-runner.ts',
    'vault/Helpy/Sessions/current-session.md'
  ], [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">H</div><div><strong>Helpy</strong><span>AiderDesk replacement</span></div></div>
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
          <div><span className="eyebrow">Aider Project</span><h1>{activeProject}</h1></div>
          <div className={`health-pill ${health.ok ? 'good' : 'bad'}`} onClick={refreshHealth}><span />{health.label}</div>
        </header>
        <div className="work-grid">
          <section className="conversation">
            <div className="conversation-header"><div><span className="eyebrow">Coding Loop</span><h2>{mode}</h2></div><button onClick={runMockAgent}>Run Agent Pass</button></div>
            <div className="message-list">
              {messages.map((message, index) => <div className={`message ${message.role}`} key={index}>{message.content}</div>)}
              {stream && <div className="message assistant"><div className="stream-label">Live Response Stream</div><p>{stream}<span className="cursor">|</span></p></div>}
            </div>
            <div className="composer"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Tell Helpy what to change, inspect, or explain..." /><button onClick={runMockAgent}>Send</button></div>
          </section>
          <aside className="right-panel">
            <section><div className="panel-title">Context Files</div>{contextFiles.map((file) => <div className="file-row" key={file}>{file}</div>)}</section>
            <section><div className="panel-title">Diff Viewer</div><div className="diff-box"><span>+ agent edits will show here</span><span>- old code placeholder</span></div></section>
          </aside>
        </div>
        <section className="bottom-drawer">
          <div className="drawer-head"><strong>Terminal / Docker / Aider Logs</strong><span>{session?.path || 'Starting Markdown log...'}</span><div><button onClick={() => dockerAction('status')}>Status</button><button onClick={() => dockerAction('start')}>Start</button><button onClick={() => dockerAction('stop')}>Stop</button></div></div>
          <pre>{logs.join('\n')}</pre>
        </section>
      </main>
    </div>
  )
}
