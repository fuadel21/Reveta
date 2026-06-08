import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Privacy = () => {
  return (
    <>
      <Helmet>
        <title>Política de Privacidad | Reveta</title>
        <meta name="description" content="Política de privacidad y protección de datos de Reveta" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 container py-8 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8">Política de Privacidad</h1>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-muted-foreground">
              Última actualización: {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">1. Información que Recopilamos</h2>
            <p>Recopilamos la siguiente información:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Información de cuenta:</strong> nombre, email, teléfono (opcional)</li>
              <li><strong>Información de perfil:</strong> foto, ubicación, biografía</li>
              <li><strong>Contenido publicado:</strong> productos, mensajes, reseñas</li>
              <li><strong>Información técnica:</strong> dirección IP, tipo de dispositivo, navegador</li>
              <li><strong>Ubicación:</strong> cuando activas la búsqueda por proximidad</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Cómo Utilizamos tu Información</h2>
            <p>Utilizamos tu información para:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Proporcionar y mejorar nuestros servicios</li>
              <li>Facilitar la comunicación entre usuarios</li>
              <li>Enviar notificaciones sobre tu actividad</li>
              <li>Personalizar tu experiencia en la plataforma</li>
              <li>Prevenir fraudes y garantizar la seguridad</li>
              <li>Cumplir con obligaciones legales</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Compartición de Información</h2>
            <p>Compartimos información en las siguientes circunstancias:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Con otros usuarios:</strong> tu perfil público y productos publicados</li>
              <li><strong>Proveedores de servicios:</strong> empresas que nos ayudan a operar la plataforma</li>
              <li><strong>Requisitos legales:</strong> cuando sea requerido por ley o autoridades</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. Seguridad de los Datos</h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas para proteger tu 
              información personal contra acceso no autorizado, pérdida o alteración.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Tus Derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Acceso:</strong> solicitar una copia de tus datos personales</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos</li>
              <li><strong>Eliminación:</strong> solicitar la eliminación de tus datos</li>
              <li><strong>Portabilidad:</strong> recibir tus datos en formato estructurado</li>
              <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Retención de Datos</h2>
            <p>
              Conservamos tu información mientras mantengas una cuenta activa. Si eliminas tu 
              cuenta, eliminaremos tus datos personales, excepto cuando sea necesario conservarlos 
              por obligaciones legales.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Menores de Edad</h2>
            <p>
              Reveta no está dirigido a menores de 18 años. No recopilamos intencionadamente 
              información de menores de edad.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. Cambios en esta Política</h2>
            <p>
              Podemos actualizar esta política periódicamente. Te notificaremos sobre cambios 
              significativos a través de la plataforma o por email.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">9. Contacto</h2>
            <p>
              Para ejercer tus derechos o realizar consultas sobre privacidad, contacta con 
              nuestro Delegado de Protección de Datos en: privacidad@reveta.es
            </p>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Privacy;
