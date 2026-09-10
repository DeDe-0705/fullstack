import type { FastifyInstance } from 'fastify';
import type { AppDatabase } from '../db/database.js';
import { getProductById, listProducts } from '../services/productService.js';

export function registerProductRoutes(app: FastifyInstance, db: AppDatabase): void {
  app.get('/api/products', async () => ({ products: listProducts(db) }));

  app.get('/api/products/:id', async (req) => {
    const { id } = req.params as { id: string };
    return getProductById(db, id);
  });
}
