import { supabase } from '@/integrations/supabase/client';

export const MAX_LISTING_IMAGES = 5;
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
export const MIN_LISTING_PRICE = 0.5;
export const MAX_LISTING_PRICE = 50000;
export const MIN_LISTING_TITLE = 8;
export const MIN_LISTING_DESCRIPTION = 20;
export const MAX_LISTING_DESCRIPTION = 2000;
export const ALLOWED_LISTING_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type ListingFormData = {
  title: string;
  description: string;
  price: string;
  category_id: string;
  subcategory_id: string;
  condition: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
};

export type ListingImage = {
  id: string;
  url: string;
  file?: File;
  original: boolean;
};

export type ListingValidation = {
  title: string;
  description: string;
  price: number;
  location: string;
};

export const EMPTY_LISTING_FORM: ListingFormData = {
  title: '',
  description: '',
  price: '',
  category_id: '',
  subcategory_id: '',
  condition: '',
  location: '',
  latitude: null,
  longitude: null,
};

export const CONDITION_LABELS: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  poor: 'Necesita reparación',
};

export const normalizeListingText = (value: string) => value.trim().replace(/\s+/g, ' ');
export const normalizeListingMultiline = (value: string) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
export const parseListingPrice = (value: string | number) => Number.parseFloat(String(value).replace(',', '.'));
export const formatListingPrice = (value: string | number) => {
  const amount = parseListingPrice(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '0,00 €';
};

export const isValidListingImage = (file: File) => ALLOWED_LISTING_IMAGE_TYPES.has(file.type) && file.size <= MAX_LISTING_IMAGE_BYTES;
export const containsContactDetails = (value: string) => /\b(whatsapp|telegram|bizum|transferencia|correo|email|gmail|hotmail|tel[eé]fono|tlf|\+34)\b/i.test(value);

export const validateListing = (form: ListingFormData, imageCount: number): { value?: ListingValidation; error?: string } => {
  const title = normalizeListingText(form.title);
  const description = normalizeListingMultiline(form.description);
  const location = normalizeListingText(form.location);
  const price = parseListingPrice(form.price);

  if (imageCount < 1) return { error: 'Añade al menos una foto.' };
  if (title.length < MIN_LISTING_TITLE) return { error: `El título debe tener al menos ${MIN_LISTING_TITLE} caracteres.` };
  if (description.length < MIN_LISTING_DESCRIPTION || description.length > MAX_LISTING_DESCRIPTION) {
    return { error: `La descripción debe tener entre ${MIN_LISTING_DESCRIPTION} y ${MAX_LISTING_DESCRIPTION} caracteres.` };
  }
  if (!Number.isFinite(price) || price < MIN_LISTING_PRICE || price > MAX_LISTING_PRICE) {
    return { error: `El precio debe estar entre ${MIN_LISTING_PRICE.toLocaleString('es-ES')} € y ${MAX_LISTING_PRICE.toLocaleString('es-ES')} €.` };
  }
  if (!form.category_id) return { error: 'Selecciona una categoría.' };
  if (!form.condition) return { error: 'Indica el estado del producto.' };
  if (location.length < 2) return { error: 'Añade una ubicación válida.' };
  if (containsContactDetails(`${title} ${description}`)) return { error: 'Retira teléfonos, correos o métodos de pago del anuncio y usa el chat de Reveta.' };
  return { value: { title, description, price, location } };
};

export const listingQualityChecks = (form: ListingFormData, imageCount: number) => {
  const price = parseListingPrice(form.price);
  return [
    { label: 'Al menos una foto', ok: imageCount > 0 },
    { label: `Título de ${MIN_LISTING_TITLE}+ caracteres`, ok: normalizeListingText(form.title).length >= MIN_LISTING_TITLE },
    { label: `Descripción de ${MIN_LISTING_DESCRIPTION}+ caracteres`, ok: normalizeListingMultiline(form.description).length >= MIN_LISTING_DESCRIPTION },
    { label: 'Precio válido', ok: Number.isFinite(price) && price >= MIN_LISTING_PRICE && price <= MAX_LISTING_PRICE },
    { label: 'Categoría elegida', ok: Boolean(form.category_id) },
    { label: 'Estado indicado', ok: Boolean(form.condition) },
    { label: 'Ubicación añadida', ok: normalizeListingText(form.location).length >= 2 },
  ];
};

const imageExtension = (file: File) => file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';

export const uploadListingImages = async (userId: string, images: ListingImage[]) => {
  const urlsById = new Map<string, string>();
  const uploadedPaths: string[] = [];
  try {
    for (const image of images) {
      if (!image.file) continue;
      const path = `${userId}/${crypto.randomUUID()}.${imageExtension(image.file)}`;
      const { error } = await supabase.storage.from('products').upload(path, image.file, { contentType: image.file.type, upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
      urlsById.set(image.id, publicUrl);
      uploadedPaths.push(path);
    }
    return { urlsById, uploadedPaths };
  } catch (error) {
    if (uploadedPaths.length > 0) await supabase.storage.from('products').remove(uploadedPaths);
    throw error;
  }
};

export const resolveListingImageUrls = (images: ListingImage[], urlsById: Map<string, string>) => images
  .map((image) => image.original ? image.url : urlsById.get(image.id))
  .filter((url): url is string => Boolean(url));

export const getOwnedStoragePath = (url: string, userId: string) => {
  try {
    const marker = '/storage/v1/object/public/products/';
    const index = url.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
    return path.startsWith(`${userId}/`) ? path : null;
  } catch {
    return null;
  }
};

export const getUnreferencedOwnedStoragePaths = async (urls: string[], userId: string, excludedProductId?: string) => {
  const candidates = urls
    .map((url) => ({ url, path: getOwnedStoragePath(url, userId) }))
    .filter((candidate): candidate is { url: string; path: string } => Boolean(candidate.path));

  const checks = await Promise.allSettled(candidates.map(async (candidate) => {
    let query = (supabase as any).from('products').select('id').contains('images', [candidate.url]).limit(1);
    if (excludedProductId) query = query.neq('id', excludedProductId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).length === 0 ? candidate.path : null;
  }));

  return checks.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []);
};

const DRAFT_DB = 'reveta-listing-drafts';
const DRAFT_STORE = 'drafts';
const DEFAULT_DRAFT_KEY = 'new-listing';
const fallbackKey = (draftKey: string) => `reveta:listing-draft:v3:${draftKey}`;

type StoredFile = { name: string; type: string; lastModified: number; blob: Blob };
type StoredDraft = { form: ListingFormData; files: StoredFile[]; originalUrls: string[]; savedAt: string };

const openDraftDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!('indexedDB' in window)) return reject(new Error('IndexedDB no disponible'));
  const request = indexedDB.open(DRAFT_DB, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(DRAFT_STORE)) request.result.createObjectStore(DRAFT_STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('No se pudo abrir el borrador'));
});

const idbRequest = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Error de almacenamiento'));
});

export const saveListingDraft = async (form: ListingFormData, images: ListingImage[], draftKey = DEFAULT_DRAFT_KEY) => {
  const draft: StoredDraft = {
    form,
    files: images.filter((image) => image.file).map((image) => ({
      name: image.file!.name,
      type: image.file!.type,
      lastModified: image.file!.lastModified,
      blob: image.file!,
    })),
    originalUrls: images.filter((image) => image.original).map((image) => image.url),
    savedAt: new Date().toISOString(),
  };
  try {
    const database = await openDraftDatabase();
    const transaction = database.transaction(DRAFT_STORE, 'readwrite');
    await idbRequest(transaction.objectStore(DRAFT_STORE).put(draft, draftKey));
    database.close();
    localStorage.removeItem(fallbackKey(draftKey));
  } catch {
    localStorage.setItem(fallbackKey(draftKey), JSON.stringify({ form, originalUrls: draft.originalUrls, savedAt: draft.savedAt }));
  }
  return draft.savedAt;
};

export const loadListingDraft = async (draftKey = DEFAULT_DRAFT_KEY): Promise<{ form: ListingFormData; files: File[]; originalUrls: string[]; savedAt: string } | null> => {
  try {
    const database = await openDraftDatabase();
    const transaction = database.transaction(DRAFT_STORE, 'readonly');
    const draft = await idbRequest(transaction.objectStore(DRAFT_STORE).get(draftKey)) as StoredDraft | undefined;
    database.close();
    if (!draft) return null;
    return {
      form: { ...EMPTY_LISTING_FORM, ...draft.form },
      files: (draft.files || []).map((stored) => new File([stored.blob], stored.name, { type: stored.type, lastModified: stored.lastModified })),
      originalUrls: draft.originalUrls || [],
      savedAt: draft.savedAt,
    };
  } catch {
    try {
      const fallback = JSON.parse(localStorage.getItem(fallbackKey(draftKey)) || 'null');
      return fallback?.form ? {
        form: { ...EMPTY_LISTING_FORM, ...fallback.form },
        files: [],
        originalUrls: fallback.originalUrls || [],
        savedAt: fallback.savedAt || new Date().toISOString(),
      } : null;
    } catch {
      return null;
    }
  }
};

export const clearListingDraft = async (draftKey = DEFAULT_DRAFT_KEY) => {
  localStorage.removeItem(fallbackKey(draftKey));
  try {
    const database = await openDraftDatabase();
    const transaction = database.transaction(DRAFT_STORE, 'readwrite');
    await idbRequest(transaction.objectStore(DRAFT_STORE).delete(draftKey));
    database.close();
  } catch {
    // The fallback was already removed.
  }
};

export const listingStateSignature = (form: ListingFormData, images: ListingImage[]) => JSON.stringify({
  form,
  images: images.map((image) => image.original ? image.url : `${image.file?.name}:${image.file?.size}:${image.file?.lastModified}`),
});
