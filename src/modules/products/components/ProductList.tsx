import { ProductService } from "../services/productService";
import { Package, Tag, ShoppingCart } from "lucide-react";

export async function ProductList() {
  const products = await ProductService.getAll();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {products.map((product) => (
        <div 
          key={product.id} 
          className="group relative bg-black/40 border border-white/10 rounded-2xl p-6 overflow-hidden hover:border-blue-500/30 transition-all"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <Package size={80} />
          </div>
          
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded">
              {product.category}
            </span>
          </div>

          <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">
            {product.name}
          </h3>
          <p className="text-sm text-gray-500 mb-6 line-clamp-2">
            {product.description}
          </p>

          <div className="flex items-center justify-between mt-auto">
            <span className="text-2xl font-bold text-white">
              ${product.price.toFixed(2)}
            </span>
            <button className="p-2 bg-white text-black rounded-lg hover:bg-blue-500 hover:text-white transition-all">
              <ShoppingCart size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
