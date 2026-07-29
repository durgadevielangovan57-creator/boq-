import { useEffect, useState } from "react";
import apiFetch from "@/lib/api";

export type Product = {
  id: string;
  name: string;
  code: string;
  category?: string;                            
  subcategory?: string;
  description?: string;
  category_name?: string;
  subcategory_name?: string;
};

/**
 * Hook to handle product loading when navigating from the product picker
 * Returns the loaded product (if any) and indicates if we're in Step 11 mode
 */
export function useProductFromUrl(step: number) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || step !== 11) {
      setProduct(null);
      return;
    }                                                         

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("product");

    if (!productId) {
      setProduct(null);
      return;
    }

    const loadProductData = async () => {
      setIsLoading(true);
      try {
        const response = await apiFetch(`/api/products/${productId}`, {
          headers: {},
        });

        if (response.ok) {
          const data = await response.json();
          setProduct(data.product);
        }
      } catch (error) {
        console.error("Failed to load product data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProductData();
  }, [step]);

  return { product, isLoading }; 
}                

/**        
 * Map a product subcategory to an estimator type
 * Used when navigating from product picker to the correct estimator
 */
export function mapProductToEstimatorType(product: Product): string | null {
  const subcatLower = product.subcategory?.toLowerCase() || "";
  const catLower = product.category?.toLowerCase() || "";

  if (subcatLower.includes("door") || catLower.includes("door")) {
    return "doors";
  } else if (
    subcatLower.includes("electrical") ||
    catLower.includes("electrical")
  ) {
    return "electrical";
  } else if (subcatLower.includes("plumb") || catLower.includes("plumb")) {
    return "plumbing";
  } else if (subcatLower.includes("floor") || catLower.includes("floor")) {
    return "flooring";
  } else if (subcatLower.includes("paint") || catLower.includes("paint")) {
    return "painting";
  } else if (subcatLower.includes("ceiling") || catLower.includes("ceiling")) {
    return "false-ceiling";
  } else if (subcatLower.includes("blind") || catLower.includes("blind")) {
    return "blinds";
  } else if (
    subcatLower.includes("civil") ||
    subcatLower.includes("wall") ||
    catLower.includes("civil") ||
    catLower.includes("wall")
  ) {
    return "civil-wall";
  } else if (subcatLower.includes("ms") || catLower.includes("ms")) {
    return "ms-work";
  } else if (subcatLower.includes("ss") || catLower.includes("ss")) {
    return "ss-work";
  } else if (subcatLower.includes("fire") || catLower.includes("fire")) {
    return "fire-fighting";
  }

  return null;
}

/**
 * Get a default door type based on product name/subcategory
 */
export function getDefaultDoorTypeForProduct(product: Product): string | null {
  const subcatLower = product.subcategory?.toLowerCase() || "";
  const nameLower = product.name?.toLowerCase() || "";

  if (nameLower.includes("flush") || subcatLower.includes("flush")) {
    return "flush-door";
  } else if (nameLower.includes("wpc") || subcatLower.includes("wpc")) {
    return "wpc-door";
  } else if (nameLower.includes("glass") || subcatLower.includes("glass")) {
    return "glass-door";
  } else if (nameLower.includes("wood") || subcatLower.includes("wood")) {
    return "wooden-door";
  } else if (nameLower.includes("stile") || subcatLower.includes("stile")) {
    return "stile-door";
  }

  // Default to flush door if type can't be determined
  return "flush-door";
}
