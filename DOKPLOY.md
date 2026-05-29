# Deploy no Dokploy

## Variaveis de ambiente

Configure no Dokploy:

```env
PORT=25556
DATABASE_PATH=/app/data/selfgur.db
UPLOAD_DIR=/app/static
PUBLIC_URL=https://seu-dominio.com
SESSION_SECRET=troque-por-uma-chave-grande-e-secreta
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_RESET_PASSWORD=false
FORCE_SEED_DATA=false
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

Se aparecer a tela de login direto e voce nao souber a senha, significa que o banco persistente ja tem um admin criado.
Para resetar o primeiro admin existente sem apagar licencas, uploads ou imagens, configure temporariamente:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sua-nova-senha
ADMIN_RESET_PASSWORD=true
```

Depois faca redeploy, entre com esse usuario e senha, e volte `ADMIN_RESET_PASSWORD` para `false`.

## Banco e imagens antigos

O Dockerfile envia o `selfgur.db` e a pasta `static` atuais junto com a imagem.
No primeiro deploy, o container copia automaticamente:

- `selfgur.db` para o volume montado em `/app/data`
- conteudo da pasta `static` para o volume montado em `/app/static`

Se o Dokploy ja criou um banco vazio no volume antes desta correcao, configure temporariamente:

```env
FORCE_SEED_DATA=true
```

Faca redeploy uma vez. Depois volte para:

```env
FORCE_SEED_DATA=false
```
