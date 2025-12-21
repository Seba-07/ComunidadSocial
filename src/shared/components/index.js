/**
 * Sistema de Componentes UI Reutilizables
 * Componentes con parámetros variables para unificar diseño
 * @module shared/components
 */

import { createElement, $ } from '../utils/index.js';

// ============================================
// CONFIGURACIÓN DE TEMA
// ============================================

export const THEME = {
  colors: {
    primary: '#6eb43f',      // Verde Renca
    primaryDark: '#5a9633',
    primaryLight: '#8bc563',
    secondary: '#00579b',    // Azul
    accent: '#f5a623',       // Naranja
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    dark: '#1f2937',
    gray: '#6b7280',
    light: '#f3f4f6',
    white: '#ffffff'
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem'
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px'
  },
  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px rgba(0,0,0,0.1)',
    lg: '0 10px 15px rgba(0,0,0,0.1)',
    xl: '0 20px 25px rgba(0,0,0,0.15)'
  }
};

// ============================================
// COMPONENTE: HEADER
// ============================================

/**
 * Crea un header de página/sección
 * @param {Object} options - Opciones del header
 * @returns {string} HTML del header
 */
export function Header({
  title = '',
  subtitle = '',
  icon = null,
  actions = [],
  variant = 'page', // 'page', 'section', 'card'
  breadcrumbs = []
} = {}) {
  const variantClasses = {
    page: 'ui-header--page',
    section: 'ui-header--section',
    card: 'ui-header--card'
  };

  const breadcrumbsHtml = breadcrumbs.length > 0 ? `
    <nav class="ui-breadcrumbs">
      ${breadcrumbs.map((b, i) => `
        ${i > 0 ? '<span class="ui-breadcrumbs__separator">/</span>' : ''}
        ${b.href ? `<a href="${b.href}" class="ui-breadcrumbs__link">${b.label}</a>` :
          `<span class="ui-breadcrumbs__current">${b.label}</span>`}
      `).join('')}
    </nav>
  ` : '';

  const actionsHtml = actions.length > 0 ? `
    <div class="ui-header__actions">
      ${actions.map(action => Button(action)).join('')}
    </div>
  ` : '';

  const iconHtml = icon ? `
    <div class="ui-header__icon">
      <i class="fas fa-${icon}"></i>
    </div>
  ` : '';

  return `
    <header class="ui-header ${variantClasses[variant] || ''}">
      ${breadcrumbsHtml}
      <div class="ui-header__content">
        ${iconHtml}
        <div class="ui-header__text">
          <h1 class="ui-header__title">${title}</h1>
          ${subtitle ? `<p class="ui-header__subtitle">${subtitle}</p>` : ''}
        </div>
        ${actionsHtml}
      </div>
    </header>
  `;
}

// ============================================
// COMPONENTE: BUTTON
// ============================================

/**
 * Crea un botón
 * @param {Object} options - Opciones del botón
 * @returns {string} HTML del botón
 */
export function Button({
  label = '',
  icon = null,
  iconPosition = 'left',
  variant = 'primary', // 'primary', 'secondary', 'outline', 'ghost', 'danger', 'success'
  size = 'md', // 'sm', 'md', 'lg'
  disabled = false,
  loading = false,
  fullWidth = false,
  type = 'button',
  id = '',
  className = '',
  onClick = null,
  href = null,
  dataset = {}
} = {}) {
  const tag = href ? 'a' : 'button';
  const classes = [
    'ui-btn',
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    fullWidth ? 'ui-btn--full' : '',
    loading ? 'ui-btn--loading' : '',
    disabled ? 'ui-btn--disabled' : '',
    className
  ].filter(Boolean).join(' ');

  const iconHtml = icon && !loading ? `<i class="fas fa-${icon}"></i>` : '';
  const loadingHtml = loading ? '<span class="ui-btn__spinner"></span>' : '';
  const dataAttrs = Object.entries(dataset).map(([k, v]) => `data-${k}="${v}"`).join(' ');

  const content = iconPosition === 'left'
    ? `${loadingHtml}${iconHtml}${label ? `<span>${label}</span>` : ''}`
    : `${label ? `<span>${label}</span>` : ''}${iconHtml}${loadingHtml}`;

  if (tag === 'a') {
    return `<a href="${href}" class="${classes}" ${id ? `id="${id}"` : ''} ${dataAttrs}>${content}</a>`;
  }

  return `<button type="${type}" class="${classes}" ${disabled ? 'disabled' : ''} ${id ? `id="${id}"` : ''} ${dataAttrs}>${content}</button>`;
}

/**
 * Grupo de botones
 */
export function ButtonGroup({ buttons = [], align = 'left' } = {}) {
  return `
    <div class="ui-btn-group ui-btn-group--${align}">
      ${buttons.map(btn => Button(btn)).join('')}
    </div>
  `;
}

// ============================================
// COMPONENTE: CARD
// ============================================

/**
 * Crea una tarjeta
 * @param {Object} options - Opciones de la tarjeta
 * @returns {string} HTML de la tarjeta
 */
export function Card({
  title = '',
  subtitle = '',
  icon = null,
  content = '',
  footer = '',
  actions = [],
  variant = 'default', // 'default', 'elevated', 'outlined', 'colored'
  color = null,
  padding = 'md',
  id = '',
  className = '',
  onClick = null,
  collapsible = false,
  collapsed = false
} = {}) {
  const classes = [
    'ui-card',
    `ui-card--${variant}`,
    `ui-card--padding-${padding}`,
    color ? `ui-card--${color}` : '',
    onClick ? 'ui-card--clickable' : '',
    collapsible ? 'ui-card--collapsible' : '',
    collapsed ? 'ui-card--collapsed' : '',
    className
  ].filter(Boolean).join(' ');

  const headerHtml = title ? `
    <div class="ui-card__header">
      ${icon ? `<div class="ui-card__icon"><i class="fas fa-${icon}"></i></div>` : ''}
      <div class="ui-card__header-text">
        <h3 class="ui-card__title">${title}</h3>
        ${subtitle ? `<p class="ui-card__subtitle">${subtitle}</p>` : ''}
      </div>
      ${collapsible ? '<button class="ui-card__toggle"><i class="fas fa-chevron-down"></i></button>' : ''}
      ${actions.length > 0 ? `
        <div class="ui-card__header-actions">
          ${actions.map(a => Button({ ...a, size: 'sm', variant: 'ghost' })).join('')}
        </div>
      ` : ''}
    </div>
  ` : '';

  const footerHtml = footer ? `
    <div class="ui-card__footer">${footer}</div>
  ` : '';

  return `
    <div class="${classes}" ${id ? `id="${id}"` : ''}>
      ${headerHtml}
      <div class="ui-card__body">${content}</div>
      ${footerHtml}
    </div>
  `;
}

// ============================================
// COMPONENTE: STAT CARD
// ============================================

/**
 * Tarjeta de estadística
 */
export function StatCard({
  title = '',
  value = '0',
  icon = 'chart-bar',
  change = null,
  changeType = 'neutral', // 'positive', 'negative', 'neutral'
  color = 'primary',
  onClick = null,
  id = ''
} = {}) {
  const changeHtml = change !== null ? `
    <div class="ui-stat-card__change ui-stat-card__change--${changeType}">
      <i class="fas fa-${changeType === 'positive' ? 'arrow-up' : changeType === 'negative' ? 'arrow-down' : 'minus'}"></i>
      <span>${change}</span>
    </div>
  ` : '';

  return `
    <div class="ui-stat-card ui-stat-card--${color}" ${id ? `id="${id}"` : ''} ${onClick ? 'role="button" tabindex="0"' : ''}>
      <div class="ui-stat-card__icon">
        <i class="fas fa-${icon}"></i>
      </div>
      <div class="ui-stat-card__content">
        <span class="ui-stat-card__value">${value}</span>
        <span class="ui-stat-card__title">${title}</span>
        ${changeHtml}
      </div>
    </div>
  `;
}

// ============================================
// COMPONENTE: BADGE
// ============================================

/**
 * Crea un badge
 */
export function Badge({
  label = '',
  variant = 'default', // 'default', 'primary', 'success', 'warning', 'error', 'info'
  size = 'md',
  icon = null,
  dot = false,
  removable = false,
  className = ''
} = {}) {
  const classes = [
    'ui-badge',
    `ui-badge--${variant}`,
    `ui-badge--${size}`,
    dot ? 'ui-badge--dot' : '',
    className
  ].filter(Boolean).join(' ');

  const iconHtml = icon ? `<i class="fas fa-${icon}"></i>` : '';
  const removeHtml = removable ? '<button class="ui-badge__remove"><i class="fas fa-times"></i></button>' : '';

  return `<span class="${classes}">${iconHtml}${label}${removeHtml}</span>`;
}

// ============================================
// COMPONENTE: ALERT
// ============================================

/**
 * Crea una alerta
 */
export function Alert({
  title = '',
  message = '',
  variant = 'info', // 'info', 'success', 'warning', 'error'
  icon = null,
  dismissible = false,
  actions = [],
  id = ''
} = {}) {
  const defaultIcons = {
    info: 'info-circle',
    success: 'check-circle',
    warning: 'exclamation-triangle',
    error: 'times-circle'
  };

  const iconName = icon || defaultIcons[variant];

  return `
    <div class="ui-alert ui-alert--${variant}" ${id ? `id="${id}"` : ''} role="alert">
      <div class="ui-alert__icon">
        <i class="fas fa-${iconName}"></i>
      </div>
      <div class="ui-alert__content">
        ${title ? `<h4 class="ui-alert__title">${title}</h4>` : ''}
        <p class="ui-alert__message">${message}</p>
        ${actions.length > 0 ? `
          <div class="ui-alert__actions">
            ${actions.map(a => Button({ ...a, size: 'sm' })).join('')}
          </div>
        ` : ''}
      </div>
      ${dismissible ? '<button class="ui-alert__dismiss"><i class="fas fa-times"></i></button>' : ''}
    </div>
  `;
}

// ============================================
// COMPONENTE: MODAL
// ============================================

/**
 * Crea un modal
 */
export function Modal({
  id = 'modal',
  title = '',
  content = '',
  size = 'md', // 'sm', 'md', 'lg', 'xl', 'full'
  closable = true,
  footer = null,
  actions = []
} = {}) {
  const footerHtml = footer || (actions.length > 0 ? `
    <div class="ui-modal__footer">
      ${ButtonGroup({ buttons: actions, align: 'right' })}
    </div>
  ` : '');

  return `
    <div class="ui-modal-overlay" id="${id}" aria-hidden="true">
      <div class="ui-modal ui-modal--${size}" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
        <div class="ui-modal__header">
          <h2 class="ui-modal__title" id="${id}-title">${title}</h2>
          ${closable ? `<button class="ui-modal__close" data-close-modal="${id}"><i class="fas fa-times"></i></button>` : ''}
        </div>
        <div class="ui-modal__body">
          ${content}
        </div>
        ${footerHtml}
      </div>
    </div>
  `;
}

/**
 * Abre un modal
 */
export function openModal(id) {
  const modal = $(`#${id}`);
  if (modal) {
    modal.classList.add('ui-modal-overlay--visible');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }
}

/**
 * Cierra un modal
 */
export function closeModal(id) {
  const modal = $(`#${id}`);
  if (modal) {
    modal.classList.remove('ui-modal-overlay--visible');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }
}

// ============================================
// COMPONENTE: TABLE
// ============================================

/**
 * Crea una tabla
 */
export function Table({
  columns = [],
  data = [],
  id = '',
  striped = true,
  hoverable = true,
  responsive = true,
  emptyMessage = 'No hay datos disponibles',
  loading = false
} = {}) {
  const classes = [
    'ui-table',
    striped ? 'ui-table--striped' : '',
    hoverable ? 'ui-table--hoverable' : ''
  ].filter(Boolean).join(' ');

  const headerHtml = `
    <thead>
      <tr>
        ${columns.map(col => `
          <th class="${col.align ? `text-${col.align}` : ''}" style="${col.width ? `width: ${col.width}` : ''}">
            ${col.label}
          </th>
        `).join('')}
      </tr>
    </thead>
  `;

  let bodyHtml;
  if (loading) {
    bodyHtml = `
      <tbody>
        <tr>
          <td colspan="${columns.length}" class="ui-table__loading">
            <div class="ui-spinner"></div>
            <span>Cargando...</span>
          </td>
        </tr>
      </tbody>
    `;
  } else if (data.length === 0) {
    bodyHtml = `
      <tbody>
        <tr>
          <td colspan="${columns.length}" class="ui-table__empty">
            <i class="fas fa-inbox"></i>
            <span>${emptyMessage}</span>
          </td>
        </tr>
      </tbody>
    `;
  } else {
    bodyHtml = `
      <tbody>
        ${data.map((row, rowIndex) => `
          <tr data-row-index="${rowIndex}">
            ${columns.map(col => {
              const value = typeof col.render === 'function'
                ? col.render(row[col.key], row, rowIndex)
                : row[col.key] ?? '';
              return `<td class="${col.align ? `text-${col.align}` : ''}">${value}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    `;
  }

  const tableHtml = `
    <table class="${classes}" ${id ? `id="${id}"` : ''}>
      ${headerHtml}
      ${bodyHtml}
    </table>
  `;

  return responsive
    ? `<div class="ui-table-responsive">${tableHtml}</div>`
    : tableHtml;
}

// ============================================
// COMPONENTE: FORM ELEMENTS
// ============================================

/**
 * Input de formulario
 */
export function FormInput({
  type = 'text',
  id = '',
  name = '',
  label = '',
  placeholder = '',
  value = '',
  required = false,
  disabled = false,
  error = '',
  hint = '',
  icon = null,
  size = 'md',
  className = ''
} = {}) {
  const classes = [
    'ui-form-group',
    error ? 'ui-form-group--error' : '',
    size !== 'md' ? `ui-form-group--${size}` : '',
    className
  ].filter(Boolean).join(' ');

  const inputId = id || name || `input-${Math.random().toString(36).substr(2, 9)}`;

  return `
    <div class="${classes}">
      ${label ? `<label class="ui-form-label" for="${inputId}">${label}${required ? ' <span class="ui-form-required">*</span>' : ''}</label>` : ''}
      <div class="ui-form-input-wrapper ${icon ? 'ui-form-input-wrapper--icon' : ''}">
        ${icon ? `<span class="ui-form-input-icon"><i class="fas fa-${icon}"></i></span>` : ''}
        <input
          type="${type}"
          id="${inputId}"
          name="${name || inputId}"
          class="ui-form-input"
          placeholder="${placeholder}"
          value="${value}"
          ${required ? 'required' : ''}
          ${disabled ? 'disabled' : ''}
        />
      </div>
      ${error ? `<span class="ui-form-error">${error}</span>` : ''}
      ${hint && !error ? `<span class="ui-form-hint">${hint}</span>` : ''}
    </div>
  `;
}

/**
 * Select de formulario
 */
export function FormSelect({
  id = '',
  name = '',
  label = '',
  options = [],
  value = '',
  placeholder = 'Seleccione...',
  required = false,
  disabled = false,
  error = '',
  size = 'md'
} = {}) {
  const inputId = id || name || `select-${Math.random().toString(36).substr(2, 9)}`;

  return `
    <div class="ui-form-group ${error ? 'ui-form-group--error' : ''}">
      ${label ? `<label class="ui-form-label" for="${inputId}">${label}${required ? ' <span class="ui-form-required">*</span>' : ''}</label>` : ''}
      <select
        id="${inputId}"
        name="${name || inputId}"
        class="ui-form-select"
        ${required ? 'required' : ''}
        ${disabled ? 'disabled' : ''}
      >
        <option value="">${placeholder}</option>
        ${options.map(opt => {
          const optValue = typeof opt === 'object' ? opt.value : opt;
          const optLabel = typeof opt === 'object' ? opt.label : opt;
          return `<option value="${optValue}" ${optValue === value ? 'selected' : ''}>${optLabel}</option>`;
        }).join('')}
      </select>
      ${error ? `<span class="ui-form-error">${error}</span>` : ''}
    </div>
  `;
}

/**
 * Textarea de formulario
 */
export function FormTextarea({
  id = '',
  name = '',
  label = '',
  placeholder = '',
  value = '',
  rows = 4,
  required = false,
  disabled = false,
  error = '',
  maxLength = null
} = {}) {
  const inputId = id || name || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  return `
    <div class="ui-form-group ${error ? 'ui-form-group--error' : ''}">
      ${label ? `<label class="ui-form-label" for="${inputId}">${label}${required ? ' <span class="ui-form-required">*</span>' : ''}</label>` : ''}
      <textarea
        id="${inputId}"
        name="${name || inputId}"
        class="ui-form-textarea"
        placeholder="${placeholder}"
        rows="${rows}"
        ${required ? 'required' : ''}
        ${disabled ? 'disabled' : ''}
        ${maxLength ? `maxlength="${maxLength}"` : ''}
      >${value}</textarea>
      ${error ? `<span class="ui-form-error">${error}</span>` : ''}
    </div>
  `;
}

// ============================================
// COMPONENTE: EMPTY STATE
// ============================================

/**
 * Estado vacío
 */
export function EmptyState({
  icon = 'inbox',
  title = 'No hay datos',
  message = '',
  action = null
} = {}) {
  return `
    <div class="ui-empty-state">
      <div class="ui-empty-state__icon">
        <i class="fas fa-${icon}"></i>
      </div>
      <h3 class="ui-empty-state__title">${title}</h3>
      ${message ? `<p class="ui-empty-state__message">${message}</p>` : ''}
      ${action ? `<div class="ui-empty-state__action">${Button(action)}</div>` : ''}
    </div>
  `;
}

// ============================================
// COMPONENTE: LOADING
// ============================================

/**
 * Indicador de carga
 */
export function Loading({
  size = 'md',
  text = 'Cargando...',
  overlay = false
} = {}) {
  const content = `
    <div class="ui-loading ui-loading--${size}">
      <div class="ui-spinner"></div>
      ${text ? `<span class="ui-loading__text">${text}</span>` : ''}
    </div>
  `;

  return overlay
    ? `<div class="ui-loading-overlay">${content}</div>`
    : content;
}

// ============================================
// COMPONENTE: TABS
// ============================================

/**
 * Sistema de tabs
 */
export function Tabs({
  id = 'tabs',
  tabs = [],
  activeTab = 0,
  variant = 'default' // 'default', 'pills', 'underline'
} = {}) {
  return `
    <div class="ui-tabs ui-tabs--${variant}" id="${id}">
      <div class="ui-tabs__nav" role="tablist">
        ${tabs.map((tab, i) => `
          <button
            class="ui-tabs__tab ${i === activeTab ? 'ui-tabs__tab--active' : ''}"
            role="tab"
            aria-selected="${i === activeTab}"
            data-tab-index="${i}"
          >
            ${tab.icon ? `<i class="fas fa-${tab.icon}"></i>` : ''}
            <span>${tab.label}</span>
            ${tab.badge ? Badge({ label: tab.badge, size: 'sm' }) : ''}
          </button>
        `).join('')}
      </div>
      <div class="ui-tabs__content">
        ${tabs.map((tab, i) => `
          <div
            class="ui-tabs__panel ${i === activeTab ? 'ui-tabs__panel--active' : ''}"
            role="tabpanel"
            data-tab-panel="${i}"
          >
            ${tab.content || ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================
// COMPONENTE: PROGRESS
// ============================================

/**
 * Barra de progreso
 */
export function Progress({
  value = 0,
  max = 100,
  variant = 'primary',
  size = 'md',
  showLabel = false,
  animated = false
} = {}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return `
    <div class="ui-progress ui-progress--${size}">
      <div
        class="ui-progress__bar ui-progress__bar--${variant} ${animated ? 'ui-progress__bar--animated' : ''}"
        style="width: ${percentage}%"
        role="progressbar"
        aria-valuenow="${value}"
        aria-valuemin="0"
        aria-valuemax="${max}"
      >
        ${showLabel ? `<span class="ui-progress__label">${Math.round(percentage)}%</span>` : ''}
      </div>
    </div>
  `;
}

// ============================================
// COMPONENTE: AVATAR
// ============================================

/**
 * Avatar de usuario
 */
export function Avatar({
  src = null,
  name = '',
  size = 'md', // 'xs', 'sm', 'md', 'lg', 'xl'
  status = null, // 'online', 'offline', 'busy', 'away'
  shape = 'circle' // 'circle', 'square'
} = {}) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const content = src
    ? `<img src="${src}" alt="${name}" class="ui-avatar__img" />`
    : `<span class="ui-avatar__initials">${initials}</span>`;

  const statusHtml = status
    ? `<span class="ui-avatar__status ui-avatar__status--${status}"></span>`
    : '';

  return `
    <div class="ui-avatar ui-avatar--${size} ui-avatar--${shape}" title="${name}">
      ${content}
      ${statusHtml}
    </div>
  `;
}

// ============================================
// COMPONENTE: LIST
// ============================================

/**
 * Lista de items
 */
export function List({
  items = [],
  variant = 'default', // 'default', 'divided', 'cards'
  selectable = false,
  emptyMessage = 'No hay elementos'
} = {}) {
  if (items.length === 0) {
    return EmptyState({ message: emptyMessage });
  }

  return `
    <ul class="ui-list ui-list--${variant}">
      ${items.map((item, i) => `
        <li class="ui-list__item ${selectable ? 'ui-list__item--selectable' : ''}" data-index="${i}">
          ${item.avatar ? Avatar({ ...item.avatar, size: 'sm' }) : ''}
          ${item.icon ? `<span class="ui-list__icon"><i class="fas fa-${item.icon}"></i></span>` : ''}
          <div class="ui-list__content">
            <span class="ui-list__title">${item.title || item}</span>
            ${item.subtitle ? `<span class="ui-list__subtitle">${item.subtitle}</span>` : ''}
          </div>
          ${item.badge ? Badge(item.badge) : ''}
          ${item.action ? `<div class="ui-list__action">${Button({ ...item.action, size: 'sm', variant: 'ghost' })}</div>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

// ============================================
// EXPORTAR TODO
// ============================================

export default {
  THEME,
  Header,
  Button,
  ButtonGroup,
  Card,
  StatCard,
  Badge,
  Alert,
  Modal,
  openModal,
  closeModal,
  Table,
  FormInput,
  FormSelect,
  FormTextarea,
  EmptyState,
  Loading,
  Tabs,
  Progress,
  Avatar,
  List
};
