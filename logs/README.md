# Logs de sesiones con agentes

Exports **sin editar** de las sesiones de Claude Code, uno por paso del flujo.

- Nombre: `YYYY-MM-DD_<paso>_<US-0X>_<agente>.jsonl` (p. ej. `2026-11-24_spec_US-01_spec-writer.jsonl`).
- Origen: transcripciones de Claude Code (`~/.claude/projects/<proyecto>/*.jsonl`) copiadas tal cual, o `/export` de la sesión.
- Regla: ningún agente ni persona edita estos archivos. Si contienen algo sensible por error, se elimina el archivo completo y se anota aquí el motivo.

| Archivo | Paso | Historia | Agente | Nota |
|---|---|---|---|---|
