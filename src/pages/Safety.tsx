import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Ban, CheckCircle2, CreditCard, FileWarning, Flag, Lock, MessageCircle, PackageCheck, ShieldCheck, Smartphone, Truck } from 'lucide-react';

const buyerSteps = [
  'Mantén la conversación dentro del chat de Reveta para conservar pruebas.',
  'Desconfía de precios demasiado bajos, presión para pagar rápido o excusas para salir de la plataforma.',
  'Usa Compra Protegida cuando esté disponible y evita transferencias anticipadas a desconocidos.',
  'Revisa perfil, valoraciones, antigüedad, productos activos y señales de verificación.',
];

const sellerSteps = [
  'No aceptes capturas como prueba de pago. Comprueba siempre el estado real de la operación.',
  'Graba o fotografía el producto y el embalaje antes de enviarlo si el producto tiene valor alto.',
  'No pulses enlaces externos enviados por compradores. Puede ser phishing o suplantación.',
  'Usa el botón de denuncia si detectas comprador falso, Bizum inverso o intento de pago externo.',
];

const warningSigns = [
  'Pide pagar por Bizum, transferencia o enlace externo antes de cerrar la operación.',
  'Envía una web parecida a Reveta, Wallapop, Correos, banco o empresa de mensajería.',
  'Precio demasiado bajo para móviles, consolas, bicicletas, relojes, patinetes o productos Apple.',
  'Perfil recién creado, sin valoraciones, con fotos genéricas o datos contradictorios.',
  'Presiona con frases como “tengo otro comprador”, “paga ya” o “solo hoy”.',
  'Pide continuar por WhatsApp, Telegram, email o SMS sin motivo claro.',
];

const protectionCards = [
  {
    icon: ShieldCheck,
    title: 'Compra Protegida',
    text: 'Prioriza operaciones dentro de Reveta para que el pago, el chat y las pruebas queden vinculados.',
  },
  {
    icon: MessageCircle,
    title: 'Chat como prueba',
    text: 'La conversación dentro de Reveta ayuda a revisar acuerdos, condiciones y posibles incidencias.',
  },
  {
    icon: Flag,
    title: 'Denuncias de producto',
    text: 'Los usuarios pueden reportar anuncios falsos, productos prohibidos, precios sospechosos o fraude.',
  },
  {
    icon: PackageCheck,
    title: 'Evidencias de entrega',
    text: 'Para productos de valor, recomendamos fotos o vídeo del estado del producto y del embalaje.',
  },
];

const socialImage = 'https://reveta.es/og-image.svg?v=20260710';

const safetyJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '¿Cómo comprar con seguridad en Reveta?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Mantén la conversación dentro de Reveta, revisa el perfil del vendedor, evita pagos externos y usa Compra Protegida cuando esté disponible.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Qué hago si veo un producto sospechoso?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Usa el botón Denunciar producto, explica el motivo y evita pagar o compartir datos personales hasta que el anuncio sea revisado.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Qué señales pueden indicar fraude?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Precios demasiado bajos, pagos fuera de la plataforma, enlaces externos, urgencia excesiva, perfiles sin historial o solicitudes para continuar fuera del chat.',
      },
    },
  ],
};

const webPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Reveta Protección',
  url: 'https://reveta.es/seguridad',
  description: 'Centro de seguridad de Reveta para comprar y vender productos de segunda mano con más confianza.',
  inLanguage: 'es-ES',
  isPartOf: {
    '@type': 'WebSite',
    name: 'Reveta',
    url: 'https://reveta.es/',
  },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Reveta',
      item: 'https://reveta.es/',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Reveta Protección',
      item: 'https://reveta.es/seguridad',
    },
  ],
};

const Safety = () => {
  return (
    <>
      <Helmet>
        <title>Reveta Protección | Seguridad, antifraude y compra segura</title>
        <meta name="description" content="Centro de Seguridad de Reveta: consejos para comprar y vender segunda mano con más protección, evitar fraudes, detectar anuncios sospechosos y denunciar productos." />
        <meta name="keywords" content="compra segura segunda mano, evitar estafas segunda mano, compra protegida, seguridad marketplace, antifraude, Reveta Protección" />
        <meta name="robots" content="index,follow,max-image-preview:large" />
        <link rel="canonical" href="https://reveta.es/seguridad" />
        <meta property="og:title" content="Reveta Protección | Seguridad y antifraude" />
        <meta property="og:description" content="Compra y vende segunda mano con más confianza: evita pagos externos, detecta fraude y denuncia anuncios sospechosos." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://reveta.es/seguridad" />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:secure_url" content={socialImage} />
        <meta property="og:image:type" content="image/svg+xml" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Reveta" />
        <meta property="og:locale" content="es_ES" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Reveta Protección | Seguridad y antifraude" />
        <meta name="twitter:description" content="Consejos para comprar y vender segunda mano con más confianza en Reveta." />
        <meta name="twitter:image" content={socialImage} />
        <script type="application/ld+json">{JSON.stringify(webPageJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(safetyJsonLd)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <section className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/10">
            <div className="container py-14 md:py-20">
              <div className="mx-auto max-w-4xl text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Reveta Protección</h1>
                <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
                  Seguridad, antifraude y herramientas de confianza para comprar y vender productos de segunda mano sin salir del entorno seguro de Reveta.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <Link to="/search">Buscar productos seguros</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/upload">Vender con seguridad</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="container py-10">
            <div className="grid gap-5 md:grid-cols-4">
              {protectionCards.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title}>
                    <CardContent className="pt-6">
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="font-bold">{item.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="container pb-10">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 flex items-center gap-3">
                    <CreditCard className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold">Para compradores</h2>
                  </div>
                  <div className="space-y-3">
                    {buyerSteps.map((item) => (
                      <div key={item} className="flex gap-3 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 flex items-center gap-3">
                    <Truck className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold">Para vendedores</h2>
                  </div>
                  <div className="space-y-3">
                    {sellerSteps.map((item) => (
                      <div key={item} className="flex gap-3 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="container pb-10">
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 md:p-8">
              <div className="mb-5 flex items-start gap-3 text-amber-950">
                <AlertTriangle className="mt-1 h-6 w-6 shrink-0" />
                <div>
                  <h2 className="text-2xl font-bold">Señales de alerta de fraude</h2>
                  <p className="mt-2 text-sm text-amber-900">Si ves una o varias de estas señales, no pagues y denuncia el producto.</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {warningSigns.map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl bg-white/70 p-3 text-sm text-amber-950">
                    <Ban className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="container pb-14">
            <div className="grid gap-5 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <Lock className="mb-3 h-6 w-6 text-primary" />
                  <h2 className="font-bold">No salgas del entorno seguro</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Evita enlaces externos, webs clonadas y pagos que no puedas demostrar dentro de Reveta.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Smartphone className="mb-3 h-6 w-6 text-primary" />
                  <h2 className="font-bold">Cuidado con Bizum inverso</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Lee cada solicitud antes de aceptar. Un falso ingreso puede ser una solicitud para que tú envíes dinero.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <FileWarning className="mb-3 h-6 w-6 text-primary" />
                  <h2 className="font-bold">Documenta productos valiosos</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Guarda fotos, vídeos, número de serie y embalaje cuando vendas o compres productos de alto valor.</p>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Safety;
