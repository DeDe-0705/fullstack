import type { AppDatabase } from '../db/database.js';
import { ProductNotFoundError } from '../errors.js';

export interface Product {
  id: string;
  name: string;
  stock: number;
}

export function listProducts(db: AppDatabase): Product[] {
  return db.prepare('SELECT id, name, stock FROM products ORDER BY id').all() as Product[];
}

export function getProductById(db: AppDatabase, id: string): Product {
  const row = db
    .prepare('SELECT id, name, stock FROM products WHERE id = ?')
    .get(id) as Product | undefined;
  if (!row) {
    throw new ProductNotFoundError(id);
  }
  return row;
}
