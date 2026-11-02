import React from "react";
import Icon, { type IconName } from "./Icon";
import type { Tone } from "../app/copy";

const toneIcon: Record<Tone, IconName> = {
  neutral: "dot",
  accent: "check",
  info: "info",
  success: "check",
  warning: "alert",
  danger: "octagon",
};

/** Status is always text + icon + colour; never colour alone. */
export function Badge({
  tone = "neutral",
  icon,
  children,
  size = "md",
}: {
  tone?: Tone;
  icon?: IconName | null;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const glyph = icon === undefined ? toneIcon[tone] : icon;
  return (
    <span className={`ax-badge ax-badge--${tone} ax-badge--${size}`}>
      {glyph && <Icon name={glyph} size={size === "lg" ? 16 : 13} />}
      <span>{children}</span>
    </span>
  );
}

export function EvidenceMark({ status }: { status: string }) {
  return (
    <span
      className={`ax-evidence-mark ax-evidence-mark--${status.toLowerCase()}`}
      aria-hidden="true"
    />
  );
}

export function PageHeader({
  step,
  title,
  lead,
  actions,
  icon,
}: {
  step?: string;
  title: string;
  lead: React.ReactNode;
  actions?: React.ReactNode;
  icon: IconName;
}) {
  return (
    <div className="ax-page-header">
      <div className="ax-page-header__text">
        {step && (
          <p className="ax-eyebrow">
            <Icon name={icon} size={14} />
            {step}
          </p>
        )}
        <h1>{title}</h1>
        <p className="ax-lead">{lead}</p>
      </div>
      {actions && <div className="ax-page-header__actions">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  className = "",
  headingLevel = 2,
  actions,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
  actions?: React.ReactNode;
  id?: string;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={`ax-panel ${className}`} aria-labelledby={id}>
      {(title || actions) && (
        <div className="ax-panel__head">
          <div>
            {title && <H id={id}>{title}</H>}
            {description && <p className="ax-panel__desc">{description}</p>}
          </div>
          {actions && <div className="ax-panel__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="ax-empty" aria-label={title}>
      <span className="ax-empty__icon">
        <Icon name={icon} size={22} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action && <div className="ax-empty__action">{action}</div>}
    </section>
  );
}

export function TechDetails({
  label = "Technical details",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="ax-tech">
      <summary>
        <Icon name="chevronDown" size={14} className="ax-tech__chevron" />
        {label}
      </summary>
      <div className="ax-tech__body">{children}</div>
    </details>
  );
}

export function KeyValues({
  items,
  compact = false,
}: {
  items: [React.ReactNode, React.ReactNode][];
  compact?: boolean;
}) {
  return (
    <dl className={compact ? "ax-kv ax-kv--compact" : "ax-kv"}>
      {items.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className="ax-code">{children}</code>;
}

export function Metric({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: Tone;
}) {
  return (
    <div className={`ax-metric ax-metric--${tone}`}>
      <span className="ax-metric__value">{value}</span>
      <span className="ax-metric__label">{label}</span>
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  role,
  icon,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  role?: "status" | "alert";
  icon?: IconName;
}) {
  return (
    <div className={`ax-notice ax-notice--${tone}`} role={role}>
      <Icon name={icon ?? toneIcon[tone]} size={18} />
      <div>
        {title && <p className="ax-notice__title">{title}</p>}
        {children && <div className="ax-notice__body">{children}</div>}
      </div>
    </div>
  );
}

export function SourceLink({
  url,
  children,
}: {
  url: string | null;
  children: React.ReactNode;
}) {
  const safe = url && /^https:\/\//i.test(url);
  return safe ? (
    <a
      className="ax-source-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <Icon name="external" size={12} />
      <span className="ax-sr">(opens in a new tab)</span>
    </a>
  ) : (
    <span>{children}</span>
  );
}

export function Spinner() {
  return <span className="ax-spinner" aria-hidden="true" />;
}
