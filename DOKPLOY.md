# Deploy no Dokploy

## Variaveis de ambiente

Configure no Dokploy:

```env
PORT=25556
DATABASE_PATH=/app/data/selfgur.db
UPLOAD_DIR=/app/static
PUBLIC_URL=https://seu-dominio.com
SESSION_SECRET=troque-por-uma-chave-grande-e-secreta
```

`PUBLIC_URL` deve ser o dominio final com `https://`, sem barra no final.

## Volumes / Mounts

Na tela do print, use **Volume Mount** e crie estes dois volumes:

| Volume Name | Mount Path |
| --- | --- |
| `selfgur-db` | `/app/data` |
| `selfgur-static` | `/app/static` |

O banco SQLite fica em `/app/data/selfgur.db`.
As imagens e audios enviados ficam em `/app/static`.

## Porta

Expose/publish port: `25556`.

## Primeiro acesso

Depois do deploy, acesse:

```text
https://seu-dominio.com/admin
```

Crie o usuario administrador pela tela inicial do painel.

## Observacao sobre dados antigos

Se voce ja tem um `selfgur.db` antigo e pastas dentro de `static`, copie esses dados para os volumes persistentes do servidor:

- `selfgur.db` para o volume montado em `/app/data`
- conteudo da pasta `static` para o volume montado em `/app/static`
