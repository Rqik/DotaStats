import type { ReactNode } from 'react';
import './PageHeading.scss';

interface PageHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeading({ eyebrow, title, description, actions }: PageHeadingProps) {
  return <header className="page-heading"><div>{eyebrow ? <span className="page-heading__eyebrow">{eyebrow}</span> : null}<h1 className="page-heading__title">{title}</h1>{description ? <p className="page-heading__description">{description}</p> : null}</div>{actions ? <div className="page-heading__actions">{actions}</div> : null}</header>;
}
