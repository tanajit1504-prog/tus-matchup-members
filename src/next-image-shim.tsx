import type { ImgHTMLAttributes } from 'react';

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
};

export default function Image({ priority, src, ...props }: ImageProps) {
  const source = typeof src === 'string' && src.startsWith('/')
    ? `${import.meta.env.BASE_URL}${src.slice(1)}`
    : src;

  return <img {...props} src={source} fetchPriority={priority ? 'high' : undefined} />;
}
