import { Helmet } from 'react-helmet-async';

interface NoIndexProps {
  title?: string;
  description?: string;
}

const NoIndex = ({ title = 'Reveta', description = 'Página privada o sin valor de indexación.' }: NoIndexProps) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="noindex,nofollow,noarchive" />
    </Helmet>
  );
};

export default NoIndex;
