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
/helpy-graphify-open-report
```

Use `Vault Root` as the working directory Graphify scans. Obsidian is only a viewer/editor for that folder; Graphify builds `graphify-out/graph.json`, `GRAPH_REPORT.md`, and `graph.html`.

CLI calls:

```text
graphify extract .
graphify extract . --update
graphify watch .
```
