import { useParams } from 'react-router-dom';
import ListingEditor from '@/components/listing/ListingEditor';

const EditProduct = () => {
  const { productId } = useParams<{ productId: string }>();
  return <ListingEditor mode="edit" productId={productId} />;
};

export default EditProduct;
