import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Facebook, 
  Twitter, 
  Linkedin, 
  Link2, 
  MessageCircle,
  Share2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SocialShareButtonsProps {
  url?: string;
  title: string;
  description?: string;
  compact?: boolean;
}

const SocialShareButtons = ({ url, title, description, compact = false }: SocialShareButtonsProps) => {
  const { toast } = useToast();
  const shareUrl = url || window.location.href;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || title);

  const shareLinks = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: 'hover:text-green-500'
    },
    {
      name: 'Twitter',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: 'hover:text-blue-400'
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'hover:text-blue-600'
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: 'hover:text-blue-700'
    },
  ];

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Enlace copiado',
        description: 'El enlace se ha copiado al portapapeles'
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el enlace',
        variant: 'destructive'
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl
        });
      } catch (err) {
        // User cancelled or error
      }
    }
  };

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {navigator.share && (
            <DropdownMenuItem onClick={handleNativeShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Compartir
            </DropdownMenuItem>
          )}
          {shareLinks.map((link) => (
            <DropdownMenuItem key={link.name} asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <link.icon className="h-4 w-4 mr-2" />
                {link.name}
              </a>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={copyToClipboard}>
            <Link2 className="h-4 w-4 mr-2" />
            Copiar enlace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {shareLinks.map((link) => (
        <Button
          key={link.name}
          variant="outline"
          size="sm"
          asChild
          className={link.color}
        >
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            <link.icon className="h-4 w-4 mr-2" />
            {link.name}
          </a>
        </Button>
      ))}
      <Button variant="outline" size="sm" onClick={copyToClipboard}>
        <Link2 className="h-4 w-4 mr-2" />
        Copiar enlace
      </Button>
    </div>
  );
};

export default SocialShareButtons;
