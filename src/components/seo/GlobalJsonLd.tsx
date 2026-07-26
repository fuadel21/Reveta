import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://reveta.es';
const SOCIAL_IMAGE = `${BASE_URL}/og-image.png?v=20260726`;

const GlobalJsonLd = () => {
  const globalGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${BASE_URL}/#organization`,
        name: 'Reveta',
        alternateName: 'Reveta Segunda Mano',
        url: `${BASE_URL}/`,
        logo: {
          '@type': 'ImageObject',
          '@id': `${BASE_URL}/#logo`,
          url: `${BASE_URL}/favicon.svg?v=20260710`,
          contentUrl: `${BASE_URL}/favicon.svg?v=20260710`,
          caption: 'Reveta',
        },
        image: {
          '@type': 'ImageObject',
          url: SOCIAL_IMAGE,
          width: 1200,
          height: 630,
        },
        description: 'Marketplace local para comprar y vender productos de segunda mano cerca de ti.',
        foundingLocation: {
          '@type': 'Country',
          name: 'España',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${BASE_URL}/#website`,
        name: 'Reveta',
        alternateName: 'Reveta Segunda Mano',
        url: `${BASE_URL}/`,
        inLanguage: 'es-ES',
        publisher: {
          '@id': `${BASE_URL}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(globalGraph)}</script>
    </Helmet>
  );
};

export default GlobalJsonLd;
