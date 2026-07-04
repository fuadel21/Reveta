import { Helmet } from 'react-helmet-async';

interface NoIndexProps {
  title?: string;
  description?: string;
  robots?: string;
}

const NoIndex = ({
  title = 'Reveta',
  description = 'Página privada o sin valor de indexación.',
  robots = 'noindex,nofollow,noarchive',
}: NoIndexProps) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
    </Helmet>
  );
};

export default NoIndex;
