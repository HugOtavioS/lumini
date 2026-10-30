import { criarApp } from './criarApp';
import { lerConfig } from './config';

const config = lerConfig();
const app = await criarApp(config);
await app.listen(config.porta, '0.0.0.0');
console.log(`\n  Lumini API em http://localhost:${config.porta}  (banco: ${config.urlBanco ? 'PostgreSQL ' + new URL(config.urlBanco).host : config.caminhoBanco})`);
console.log('  Saúde: GET /saude  ·  Login: POST /auth/login  ·  Painel: GET /admin/resumo\n');
