export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  created_at: string;
}

export type CreateProductDTO = Omit<Product, 'id' | 'created_at'>;
