import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://reveta.es';

const GlobalJsonLd = () => {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'Reveta',
    url: BASE_URL,
    logo: `${BASE_URL}/favicon.svg`,
    description: 'Marketplace local para comprar y vender productos de segunda mano cerca de ti.',
    foundingLocation: {
      '@type': 'Country',
      name: 'España',
    },
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'Reveta',
    url: BASE_URL,
    inLanguage: 'es-ES',
    publisher: {
      '@id': `${BASE_URL}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(organizationJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(websiteJsonLd)}</script>
    </Helmet>
  );
};

export default GlobalJsonLd;
