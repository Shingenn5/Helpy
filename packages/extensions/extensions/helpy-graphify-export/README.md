# Helpy Graphify Export

Creates Graphify-friendly Markdown notes and runs the real `graphify` CLI against the configured Helpy memory folder.

Outputs:

```text
Graph/Projects/
Graph/Files/
graphify-out/
```

The notes include YAML frontmatter, tags, headings, relationships, and wikilinks so Graphify has clean source material to extract.

Commands:

```text
/helpy-graphify-refresh
/helpy-graphify-build
/helpy-graphify-update
/helpy-graphify-watch
/helpy-graphify-query
/helpy-memory-query
/helpy-graphify-open-report
```

Use `Vault Root` as the working directory Graphify scans. Obsidian is only a viewer/editor for that folder; Graphify builds `graphify-out/graph.json`, `GRAPH_REPORT.md`, and `graph.html`.

CLI calls:

```text
graphify extract .
graphify extract . --update
graphify watch .
```

Helpy probes a few Graphify CLI shapes because the `graphifyy` package has changed command syntax across releases. The preferred commands are:

```text
graphify .
graphify . --update
graphify . --watch
```

Some `graphifyy` releases only expose code-update commands:

```text
graphify update .
graphify watch .
```

If that CLI reports "No code files found" for a Markdown-only Helpy vault, the extension writes a semantic fallback graph to `graphify-out/` from the Markdown notes so the memory folder still has queryable artifacts.

The semantic fallback extracts typed nodes for sessions, prompts, assistant responses, agent starts, tasks, projects, rules, tags, models, providers, modes, filesystem paths, and wikilinks.

`/helpy-memory-query` searches the local semantic `graphify-out/graph.json` directly, so it still works when the installed Graphify CLI only supports code-file update commands.
