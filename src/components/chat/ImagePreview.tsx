import { useState } from 'react';
import { X, ZoomIn, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  className?: string;
}

export const ImagePreview = ({ src, alt = 'Image', className }: ImagePreviewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = alt || 'image';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  if (hasError) {
    return (
      <div className={cn("rounded-lg bg-muted flex items-center justify-center p-4", className)}>
        <span className="text-sm text-muted-foreground">Error al cargar imagen</span>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className={cn("relative cursor-pointer group rounded-lg overflow-hidden", className)}>
          {isLoading && (
            <div className="absolute inset-0 bg-muted animate-pulse" />
          )}
          <img
            src={src}
            alt={alt}
            className={cn(
              "max-w-[250px] max-h-[200px] rounded-lg object-cover transition-transform group-hover:scale-105",
              isLoading && "opacity-0"
            )}
            onLoad={() => setIsLoading(false)}
            onError={() => setHasError(true)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/90">
        <div className="relative">
          <img
            src={src}
            alt={alt}
            className="max-h-[80vh] max-w-full mx-auto object-contain"
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={handleDownload}
              className="rounded-full bg-white/10 hover:bg-white/20"
            >
              <Download className="h-4 w-4 text-white" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
