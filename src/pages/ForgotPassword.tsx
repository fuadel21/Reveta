import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Email inválido');

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el email de recuperación',
        variant: 'destructive'
      });
    } else {
      setEmailSent(true);
    }

    setIsLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Recuperar Contraseña | Reveta</title>
        <meta name="description" content="Recupera tu contraseña de Reveta" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-hero">
                <span className="text-xl font-bold text-primary-foreground">R</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Reveta</span>
            </Link>
          </div>

          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                {emailSent ? 'Revisa tu email' : 'Recuperar Contraseña'}
              </CardTitle>
              <CardDescription>
                {emailSent
                  ? 'Te hemos enviado un enlace para restablecer tu contraseña'
                  : 'Introduce tu email y te enviaremos un enlace para restablecer tu contraseña'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailSent ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground mb-6">
                    Hemos enviado un email a <strong>{email}</strong> con instrucciones para restablecer tu contraseña.
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Si no lo recibes en unos minutos, revisa tu carpeta de spam.
                  </p>
                  <Link to="/auth">
                    <Button variant="outline" className="gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      Volver al inicio de sesión
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                  </div>

                  <Button type="submit" className="w-full gradient-hero" disabled={isLoading}>
                    {isLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                  </Button>
                </form>
              )}

              {!emailSent && (
                <div className="mt-6 text-center">
                  <Link
                    to="/auth"
                    className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
