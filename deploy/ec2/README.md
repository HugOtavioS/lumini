# Lumini — implantação da API na EC2 com o banco no RDS

Arquitetura: **app (SQLite no celular) → API na EC2 → PostgreSQL no RDS**. O painel web fica na mesma EC2,
servido pelo nginx. Uma porta só (80): `/` é o painel e `/api/` é a API.

O que mudou na API (branch `deploy/api-ec2`) — o SQLite continua funcionando para desenvolvimento:

| Arquivo | Mudança |
|---|---|
| `apps/api/src/db/banco.ts` | `Banco` virou interface, com `BancoSqlite` (o de antes) |
| `apps/api/src/db/bancoPostgres.ts` | **novo** — PostgreSQL via `pg`, usado quando `DATABASE_URL` existe |
| `apps/api/src/db/postgres/worker.mjs` | **novo** — conexão única com o RDS numa worker thread (as regras do `@lumini/sync` são síncronas) |
| `apps/api/src/db/postgres/001_schema.sql` | schema do RDS (o mesmo que você já rodou; a API reaplica sem mudar nada) |
| `apps/api/src/db/migracoes.ts` | no PostgreSQL, aplica o `001_schema.sql` |
| `apps/api/src/config.ts` | variáveis `DATABASE_URL` e `DB_SSL` |
| `admin.service.ts`, `auth.service.ts`, `armazenamentoSqlite.ts` | 5 linhas de SQL que só o SQLite aceitava (`= 1` em booleano, `ON CONFLICT` sem alvo) |
| `apps/api/test/api.test.ts` | com `TEST_DATABASE_URL`, os 12 testes rodam contra PostgreSQL (todos passam) |

---

## 1. Rede (console da AWS)

1. **EC2 → Launch instance**
   - AMI: **Amazon Linux 2023**; tipo **t3.micro** (ou t2.micro no nível gratuito).
   - Key pair: crie/baixe (`lumini.pem`).
   - Mesma **VPC** do RDS.
   - Security group `lumini-api-sg`, entrada: **SSH 22** do seu IP; **HTTP 80** de qualquer lugar (0.0.0.0/0).
2. **RDS → seu banco → security group → Inbound rules**: **PostgreSQL 5432** com origem **`lumini-api-sg`**
   (o security group da EC2, não um IP). Depois disso o RDS pode deixar de ser público.
3. Anote o **IP público** da EC2 (ou associe um Elastic IP para ele não mudar ao reiniciar).

## 2. Preparar a EC2 (via EC2 Instance Connect ou `ssh -i lumini.pem ec2-user@IP`)

```bash
# Node.js 22, git, nginx e cliente do PostgreSQL
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs git nginx postgresql15

# 1 GB de swap (a t3.micro tem só 1 GB de RAM)
sudo dd if=/dev/zero of=/swapfile bs=1M count=1024 && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab

node -v   # v22.x
```

## 3. Código

```bash
cd ~
git clone -b deploy/api-ec2 https://github.com/HugOtavioS/lumini.git
cd lumini
npm ci -w @lumini/api -w @lumini/web --no-audit --no-fund   # só API e painel (sem o app mobile)
```
> Repositório privado: o `git clone` pede usuário e um *personal access token* do GitHub como senha.

## 4. Configurar a API

```bash
cp deploy/ec2/api.env.exemplo apps/api/.env
openssl rand -hex 32          # copie o resultado para JWT_SECRET
nano apps/api/.env            # preencha DATABASE_URL (endpoint, usuário, senha do RDS) e JWT_SECRET
```

Teste a conexão com o RDS antes de subir a API:
```bash
psql "postgres://USUARIO:SENHA@ENDPOINT.rds.amazonaws.com:5432/lumini?sslmode=require" -c '\dt'
```

Primeira subida, em primeiro plano (aplica o schema e cria os dados de demonstração se o banco estiver vazio):
```bash
cd apps/api && npm run start
# deve mostrar: Lumini API em http://localhost:3000  (banco: PostgreSQL ....rds.amazonaws.com:5432)
# Ctrl+C para parar
cd ~/lumini
```

## 5. API como serviço (sobe sozinha e reinicia se cair)

```bash
sudo cp deploy/ec2/lumini-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lumini-api
sudo systemctl status lumini-api --no-pager
curl -s localhost:3000/saude
# logs: journalctl -u lumini-api -f
```

## 6. Painel web + nginx

```bash
VITE_API_URL=/api npm run build -w @lumini/web
sudo mkdir -p /usr/share/nginx/lumini && sudo cp -r apps/web/dist/* /usr/share/nginx/lumini/
sudo cp deploy/ec2/nginx-lumini.conf /etc/nginx/conf.d/lumini.conf
sudo sed -i 's/listen       80;/listen       8080;/; s/listen       \[::\]:80;/listen       [::]:8080;/' /etc/nginx/nginx.conf  # tira o site padrão da porta 80
sudo nginx -t && sudo systemctl enable --now nginx && sudo systemctl reload nginx
```

## 7. Testar de fora

- Painel: `http://IP-DA-EC2/` — login `gestora@solarvale.com.br` / `lumini123`
- API: `http://IP-DA-EC2/api/saude`
- No RDS: `SELECT numero_proposta, status_proposta FROM vw_proposta;`

## 8. Apontar o app para a nuvem

No PC, em `apps/mobile/.env.local`:
```
EXPO_PUBLIC_API_URL=http://IP-DA-EC2/api
```
e rode `npx expo start --clear`. Login no app: `carlos@lumini.com` / `lumini123`.

## Atualizar depois

```bash
cd ~/lumini && git pull && npm ci -w @lumini/api -w @lumini/web --no-audit --no-fund
sudo systemctl restart lumini-api
VITE_API_URL=/api npm run build -w @lumini/web && sudo cp -r apps/web/dist/* /usr/share/nginx/lumini/
```

## Observações

- **HTTP sem TLS** serve para a apresentação. Em produção: domínio + HTTPS (Certbot no nginx ou um Load Balancer
  com certificado do ACM). Builds de produção do Android bloqueiam HTTP; o Expo Go aceita.
- A conexão com o RDS usa SSL sem validar o certificado (`rejectUnauthorized: false`). Para validar, baixe o
  bundle da AWS (`global-bundle.pem`) e passe em `ssl.ca` no `worker.mjs`.
- A API usa **uma conexão** com o banco, com as consultas em sequência — suficiente para a demonstração e para
  a escala do projeto. Para muitos acessos simultâneos, o próximo passo é tornar a porta de armazenamento do
  `@lumini/sync` assíncrona e usar um pool.
- Para recomeçar do zero no RDS: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` e reinicie a API.
