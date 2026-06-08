import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Terms = () => {
  return (
    <>
      <Helmet>
        <title>Términos de Uso | Reveta</title>
        <meta name="description" content="Términos y condiciones de uso de Reveta" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 container py-8 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8">Términos de Uso</h1>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-muted-foreground">
              Última actualización: {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">1. Aceptación de los Términos</h2>
            <p>
              Al acceder y utilizar Reveta, aceptas estar sujeto a estos Términos de Uso y a nuestra 
              Política de Privacidad. Si no estás de acuerdo con alguno de estos términos, no debes 
              utilizar nuestra plataforma.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Descripción del Servicio</h2>
            <p>
              Reveta es una plataforma de compraventa de productos de segunda mano que permite a los 
              usuarios publicar, buscar y contactar con otros usuarios para realizar transacciones.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Registro de Cuenta</h2>
            <p>
              Para utilizar ciertas funciones de Reveta, debes crear una cuenta proporcionando 
              información veraz y actualizada. Eres responsable de mantener la confidencialidad de 
              tu cuenta y contraseña.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. Uso Aceptable</h2>
            <p>Te comprometes a:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>No publicar contenido ilegal, fraudulento o engañoso</li>
              <li>No vender productos prohibidos o robados</li>
              <li>No acosar o amenazar a otros usuarios</li>
              <li>No utilizar la plataforma para spam o publicidad no autorizada</li>
              <li>No intentar acceder a cuentas de otros usuarios</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Publicación de Productos</h2>
            <p>
              Al publicar un producto, garantizas que tienes derecho legal a venderlo y que la 
              descripción e imágenes son precisas. Reveta se reserva el derecho de eliminar 
              cualquier anuncio que viole estos términos.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Transacciones</h2>
            <p>
              Reveta es solo un intermediario para facilitar el contacto entre compradores y 
              vendedores. No somos parte de las transacciones y no garantizamos la calidad, 
              seguridad o legalidad de los productos anunciados.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Limitación de Responsabilidad</h2>
            <p>
              Reveta no se hace responsable de disputas entre usuarios, productos defectuosos, 
              estafas o cualquier daño derivado del uso de la plataforma.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. Propiedad Intelectual</h2>
            <p>
              Todo el contenido de Reveta, incluyendo logos, diseños y software, es propiedad de 
              Reveta o sus licenciantes y está protegido por las leyes de propiedad intelectual.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">9. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. Los 
              cambios serán efectivos inmediatamente después de su publicación en la plataforma.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">10. Contacto</h2>
            <p>
              Si tienes preguntas sobre estos términos, puedes contactarnos a través de 
              nuestro formulario de contacto o enviando un email a soporte@reveta.es
            </p>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Terms;
