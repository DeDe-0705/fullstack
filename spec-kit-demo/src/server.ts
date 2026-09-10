import { buildApp } from './app.js';
import { createDatabase } from './db/database.js';
import { seedProducts } from './db/seed.js';

const db = createDatabase('./data/app.db');
seedProducts(db);

// PORT 环境变量可覆盖默认端口，避免与本机其他服务冲突
const port = Number(process.env.PORT ?? 3000);
const app = buildApp(db);
await app.listen({ port, host: '0.0.0.0' });
console.log(`库存下单 API 已启动: http://localhost:${port}`);
