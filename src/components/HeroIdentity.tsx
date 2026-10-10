import { Ban, ImageOff } from 'lucide-react';
import { useState } from 'react';
import type { HeroOption } from '../api/openDotaRepository';
import './HeroIdentity.scss';

interface HeroIdentityProps {
  hero?: HeroOption | null;
  heroId?: number | null;
  variant?: 'card' | 'compact';
  isBanned?: boolean;
}

function heroImageUrl(hero: HeroOption | null | undefined): string | null {
  const path = hero?.imageUrl || hero?.iconUrl;
  if (!path) return null;
  try {
    const url = new URL(path, 'https://cdn.cloudflare.steamstatic.com');
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function HeroIdentity({ hero, heroId, variant = 'card', isBanned = false }: HeroIdentityProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageUrl = heroImageUrl(hero);
  const name = hero?.name || (heroId ? `Герой #${heroId}` : 'Герой не указан');
  const hasImage = imageUrl !== null && imageUrl !== failedImage;

  return (
    <span className={`hero-identity hero-identity--${variant}${isBanned ? ' hero-identity--banned' : ''}`}>
      <span className="hero-identity__portrait">
        {hasImage ? (
          <img
            src={imageUrl}
            alt=""
            width={256}
            height={144}
            loading="lazy"
            decoding="async"
            onError={() => setFailedImage(imageUrl)}
          />
        ) : <ImageOff className="hero-identity__placeholder" size={22} aria-hidden="true" />}
        {isBanned ? <Ban className="hero-identity__ban" size={18} aria-label="Забанен" /> : null}
      </span>
      <span className="hero-identity__name" title={name}>{name}</span>
    </span>
  );
}
