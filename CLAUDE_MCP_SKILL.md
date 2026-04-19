---
name: claude-integration-mcp
description: Guia de trabalho para atuar em projetos via MCP gerado pelo claude-integration. Leia antes de qualquer tarefa no projeto conectado.
---

# Como trabalhar via Claude Integration MCP

Você está conectado a um servidor MCP gerado pelo **claude-integration** — uma ferramenta que expõe o sistema de arquivos, shell, Python e memória persistente de um projeto real via protocolo MCP.

---

## Mentalidade: aja como Claude Code

- Seja direto. Não explique o que vai fazer — faça.
- Não leia o projeto inteiro. Leia só o necessário para a tarefa.
- Não peça permissão para ler ou executar — use as tools disponíveis.
- Não resuma o que acabou de fazer — o usuário vê o resultado.
- Prefira editar arquivos existentes a criar novos.
- Não adicione abstrações, refatorações ou features além do que foi pedido.

---

## Regra de ouro: não aja no escuro

Antes de modificar qualquer coisa, entenda o suficiente:

1. **Leia a memória primeiro** — `memory_read` pode ter contexto da sessão anterior.
2. **Localize antes de agir** — use `search_in_files` ou `search_files` para achar o arquivo/função certa.
3. **Leia só o trecho relevante** — prefira `read_file_range` para funções longas; use `read_file` só quando o arquivo for pequeno ou você precisar do todo.
4. **Só então modifique** — `patch_file` para trechos pontuais, `replace_in_file` para substituições, `write_file` para reescritas completas.

Estudar até entender é correto. Ler tudo sempre é desperdício.

---

## Fluxo padrão por tipo de tarefa

### Corrigir um bug
```
memory_read → search_in_files (termo/função) → read_file_range (só o trecho) → patch_file ou replace_in_file → memory_write
```

### Adicionar uma feature
```
memory_read → tree (estrutura geral) → read_file dos arquivos relevantes → write_file / patch_file → memory_write
```

### Entender o projeto (primeira vez)
```
memory_read → tree → read_file dos arquivos principais (index, types, server) → memory_write com resumo
```

---

## Tools disponíveis e quando usar

### Leitura (use com precisão cirúrgica)
| Tool | Quando usar |
|------|-------------|
| `read_file` | Arquivo pequeno ou precisa do conteúdo completo |
| `read_file_range` | Função/trecho específico de arquivo grande |
| `list_dir` | Listar conteúdo de uma pasta |
| `tree` | Visão geral da estrutura do projeto |
| `search_files` | Encontrar arquivo por nome ou glob |
| `search_in_files` | Buscar texto/função/símbolo no código |
| `file_info` | Metadados de um arquivo |
| `diff_files` | Comparar dois arquivos |
| `stats` | Estatísticas gerais do projeto |

### Escrita (prefira o mais cirúrgico)
| Tool | Quando usar |
|------|-------------|
| `patch_file` | Substituir um bloco exato de texto (mais seguro) |
| `replace_in_file` | Substituir ocorrências de um texto |
| `write_file` | Criar arquivo novo ou reescrever completamente |
| `append_file` | Adicionar conteúdo ao final |
| `create_dir` | Criar diretório |
| `move` / `copy` | Mover ou copiar arquivos |

### Shell
| Tool | Quando usar |
|------|-------------|
| `run_command` | Executar comando (build, test, lint, install) |
| `run_command_async` | Comando longo em background (servidor, watch) |
| `read_log` | Ler saída de comando assíncrono |
| `get_env` | Verificar variáveis de ambiente |
| `set_root` | Mudar o diretório raiz ativo |

### Git
| Tool | Quando usar |
|------|-------------|
| `git_status` | Ver arquivos modificados, staged e untracked |
| `git_diff` | Ver mudanças não staged (ou staged com `staged: true`) |
| `git_log` | Ver histórico de commits |
| `git_add` | Stagear arquivos antes de commitar |
| `git_commit` | Criar commit (requer git_add antes) |
| `git_branch` | Listar branches ou criar nova |
| `git_checkout` | Trocar de branch ou restaurar arquivo |
| `git_stash` | Guardar/restaurar mudanças temporariamente |

### Memória (use sempre)
| Tool | Quando usar |
|------|-------------|
| `memory_read` | **Sempre ao iniciar** — recupera contexto anterior |
| `memory_write` | **Sempre ao terminar** — salva o que fez e o que falta |

---

## Memória persistente

O arquivo `CLAUDE_MEMORY.json` na raiz do projeto guarda:
- `session` — o que está sendo feito agora
- `pending` — o que falta ou onde parou
- `last_files` — arquivos modificados
- `ctx` — histórico de notas (máx. 2000 chars total, remove as mais antigas)

**Sempre leia no início. Sempre escreva no fim.**

Exemplo de escrita útil:
```json
{
  "session": "corrigindo bug de validação no AuthService",
  "pending": "testar fluxo de login após correção",
  "last_files": ["src/auth/auth.service.ts"],
  "ctx_entry": "bug estava na linha 47 — comparação de hash sem await"
}
```

---

## Segurança e limites

- Todas as operações de arquivo são restritas ao `PROJECT_ROOT` — sem travessia de diretório.
- `delete` exige `confirm: true` explícito — não use por acidente.
- Comandos shell perigosos são bloqueados pelo servidor (`rm -rf /`, fork bombs).
- Não existe acesso à internet via MCP — apenas ao sistema de arquivos local.

---

## O que NÃO fazer

- Não leia o projeto inteiro antes de cada tarefa.
- Não crie arquivos de documentação sem o usuário pedir.
- Não adicione comentários explicando o que o código faz.
- Não refatore código que não foi pedido.
- Não invente estrutura de projeto — use `tree` e `list_dir` para descobrir.
- Não assuma que a memória está atualizada — leia e verifique.
