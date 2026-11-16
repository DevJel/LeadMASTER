import React, {useEffect, useState} from 'react';
import {createGravatarAvatarUrl} from '../gravatar.mjs';

type Props = {
  email?: string;
  name?: string;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
};

function initials(name: string, email: string) {
  const label = (name || email.split('@')[0] || '?').replace(/[._-]+/g, ' ').trim();
  return label.split(/\\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}

/** Graceful, privacy-conscious Gravatar image with a local fallback. */
export function GravatarAvatar({email = '', name = '', size = 36, className = '', fallback}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setSrc(null);
    setFailed(false);
    createGravatarAvatarUrl(email, Math.round(size * 2)).then(url => {
      if (active) setSrc(url);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [email, size]);
  const style: React.CSSProperties = {width: size, height: size, minWidth: size, minHeight: size};
  if (src && !failed) {
    return <img src={src} alt={name ? `${name} avatar` : 'Profile avatar'} width={size} height={size}
      loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailed(true)} className={`inline-block rounded-full object-cover ${className}`} style={style}/>;
  }
  if (fallback) return <span className={`inline-grid place-items-center overflow-hidden rounded-full ${className}`} style={style}>{fallback}</span>;
  return <span aria-label={`${name || 'Contact'} initials avatar`} className={`inline-grid place-items-center overflow-hidden rounded-full bg-[#ececec] text-[#444] text-xs font-semibold ${className}`} style={style}>{initials(name, email)}</span>;
}
