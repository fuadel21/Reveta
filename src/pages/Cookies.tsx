import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';

const Cookies = () => {
  return (
    <>
      <Helmet>
        <title>Política de Cookies | Reveta</title>
        <meta name="description" content="Información sobre el uso de cookies en Reveta" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 container py-8 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8">Política de Cookies</h1>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-muted-foreground">
              Última actualización: {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">¿Qué son las cookies?</h2>
            <p>
              Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando 
              visitas un sitio web. Se utilizan para recordar tus preferencias, mejorar tu experiencia 
              y analizar cómo se utiliza la plataforma.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">Tipos de Cookies que Utilizamos</h2>

            <Card className="border-border/50 my-4">
              <CardContent className="pt-4">
                <h3 className="font-semibold text-lg mb-2">🔧 Cookies Esenciales</h3>
                <p className="text-muted-foreground text-sm">
                  Necesarias para el funcionamiento básico de la plataforma. No pueden desactivarse.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mt-2 text-sm">
                  <li>Autenticación y sesión de usuario</li>
                  <li>Preferencias de seguridad</li>
                  <li>Funcionamiento del carrito</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 my-4">
              <CardContent className="pt-4">
                <h3 className="font-semibold text-lg mb-2">⚙️ Cookies de Preferencias</h3>
                <p className="text-muted-foreground text-sm">
                  Permiten recordar tus preferencias y personalizar tu experiencia.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mt-2 text-sm">
                  <li>Idioma preferido</li>
                  <li>Tema claro/oscuro</li>
                  <li>Configuración de visualización</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 my-4">
              <CardContent className="pt-4">
                <h3 className="font-semibold text-lg mb-2">📊 Cookies Analíticas</h3>
                <p className="text-muted-foreground text-sm">
                  Nos ayudan a entender cómo los usuarios interactúan con la plataforma.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mt-2 text-sm">
                  <li>Páginas visitadas</li>
                  <li>Tiempo de permanencia</li>
                  <li>Origen del tráfico</li>
                </ul>
              </CardContent>
            </Card>

            <h2 className="text-xl font-semibold mt-8 mb-4">Cómo Gestionar las Cookies</h2>
            <p>
              Puedes configurar tu navegador para rechazar cookies o para que te avise cuando se 
              envíe una cookie. Ten en cuenta que algunas funciones de Reveta pueden no funcionar 
              correctamente si desactivas las cookies.
            </p>

            <h3 className="text-lg font-semibold mt-6 mb-3">Configuración por navegador:</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Chrome:</strong> Configuración → Privacidad y seguridad → Cookies</li>
              <li><strong>Firefox:</strong> Opciones → Privacidad & Seguridad → Cookies</li>
              <li><strong>Safari:</strong> Preferencias → Privacidad → Cookies</li>
              <li><strong>Edge:</strong> Configuración → Cookies y permisos del sitio</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">Duración de las Cookies</h2>
            <p>Las cookies pueden ser:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>De sesión:</strong> se eliminan al cerrar el navegador</li>
              <li><strong>Persistentes:</strong> permanecen hasta su fecha de expiración o hasta que las elimines manualmente</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">Actualizaciones</h2>
            <p>
              Esta política puede actualizarse para reflejar cambios en nuestras prácticas. Te 
              recomendamos revisarla periódicamente.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">Contacto</h2>
            <p>
              Si tienes preguntas sobre nuestra política de cookies, contacta con nosotros en: 
              privacidad@reveta.es
            </p>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Cookies;
