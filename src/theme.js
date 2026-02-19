/**
 * Centralized theme configuration for Dulin Properties
 */

export const colors = {
  // Primary colors by section
  rentals: { border: 'border-teal-500/20', bg: 'from-teal-950/30', shadow: 'shadow-[0_0_30px_rgba(20,184,166,0.06)]', text: 'text-teal-400', lightText: 'text-teal-300' },
  documents: { border: 'border-amber-500/20', bg: 'from-amber-950/30', shadow: 'shadow-[0_0_30px_rgba(245,158,11,0.06)]', text: 'text-amber-400', lightText: 'text-amber-300' },
  financials: { border: 'border-emerald-500/20', bg: 'from-emerald-950/30', shadow: 'shadow-[0_0_30px_rgba(16,185,129,0.06)]', text: 'text-emerald-400', lightText: 'text-emerald-300' },
  hub: { border: 'border-purple-500/20', bg: 'from-purple-950/30', shadow: 'shadow-[0_0_30px_rgba(139,92,246,0.06)]', text: 'text-purple-400', lightText: 'text-purple-300' },

  // Hub subsections
  tasks: { border: 'border-teal-500/20', bg: 'from-teal-950/30', text: 'text-teal-400', lightText: 'text-teal-300', badge: 'bg-teal-500/20' },
  lists: { border: 'border-emerald-500/20', bg: 'from-emerald-950/30', text: 'text-emerald-400', lightText: 'text-emerald-300', badge: 'bg-emerald-500/20' },
  ideas: { border: 'border-amber-500/20', bg: 'from-amber-950/30', text: 'text-amber-400', lightText: 'text-amber-300', badge: 'bg-amber-500/20' },

  // Status indicators
  priority: {
    high: { bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-500/60', shadow: 'shadow-red-500/20' },
    medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-400/40', shadow: 'shadow-amber-500/10' },
    low: { bg: 'bg-slate-500/20', text: 'text-slate-400', ring: 'ring-slate-500/20', shadow: 'shadow-slate-500/10' },
  },

  status: {
    highlight: { ring: 'ring-amber-400/70', shadow: 'shadow-amber-500/20' },
    unstarted: { ring: 'ring-yellow-400/50', border: 'border-yellow-500/40', shadow: 'shadow-yellow-500/15' },
    open: { ring: 'ring-yellow-400/50', shadow: 'shadow-yellow-500/15' },
    inbox: { ring: 'ring-cyan-400/40', border: 'border-cyan-500/30', shadow: 'shadow-cyan-500/10' },
  },

  // Tenant status
  tenant: {
    active: { bg: 'bg-green-500/20', text: 'text-green-400', ring: 'ring-green-500/40' },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', ring: 'ring-yellow-500/40' },
    vacant: { bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-500/40' },
    notice: { bg: 'bg-orange-500/20', text: 'text-orange-400', ring: 'ring-orange-500/40' },
  },

  // Gradients
  gradients: {
    teal: 'from-teal-400 to-cyan-500',
    emerald: 'from-emerald-400 to-teal-500',
    purple: 'from-purple-400 to-violet-500',
    amber: 'from-amber-400 to-orange-500',
    primary: 'from-teal-400 to-cyan-500',
  },

  // Utility colors
  background: { light: 'bg-white/[0.05]', lighter: 'bg-white/[0.08]', card: 'bg-white/[0.05]' },
  border: { light: 'border-white/[0.08]', lighter: 'border-white/[0.12]' },
  text: { primary: 'text-white', secondary: 'text-white/70', tertiary: 'text-white/40', muted: 'text-white/25' },
};

export const spacing = {
  cardGap: 'gap-3',
  itemGap: 'gap-2',
  sectionGap: 'gap-6',
  tightGap: 'gap-1.5',
  cardPadding: 'p-4',
  sectionPadding: 'p-4',
  compactPadding: 'p-3',
  largePadding: 'p-6',
  contentPaddingX: 'px-4',
  contentPaddingY: 'py-2',
  sectionMargin: 'mb-6',
  cardMargin: 'mb-3',
};

export const sizing = {
  cardRadius: 'rounded-2xl',
  smallRadius: 'rounded-xl',
  tinyRadius: 'rounded-lg',
  iconSmall: 'w-3 h-3',
  iconBase: 'w-4 h-4',
  iconLarge: 'w-5 h-5',
  iconXL: 'w-6 h-6',
  buttonSmall: 'px-2 py-1 text-xs',
  buttonBase: 'px-3 py-2 text-sm',
  buttonLarge: 'px-4 py-3 text-base',
};

export const getSectionTheme = (section) => {
  const themes = {
    rentals: colors.rentals,
    documents: colors.documents,
    financials: colors.financials,
    hub: colors.hub,
    tasks: colors.tasks,
    lists: colors.lists,
    ideas: colors.ideas,
  };
  return themes[section] || colors.hub;
};

export const getSectionContainerClass = (section) => {
  const theme = getSectionTheme(section);
  return `rounded-3xl border ${theme.border} bg-gradient-to-br ${theme.bg} via-slate-900/50 to-slate-950/40 backdrop-blur-xl ${theme.shadow}`;
};

export const getCardClass = (highlighted, statusOverride) => {
  const baseClass = `${colors.background.card} backdrop-blur-md border ${colors.border.light} ${sizing.cardRadius} transition-all hover:${colors.background.lighter}`;
  if (highlighted) {
    return `${baseClass} ring-2 ${colors.status.highlight.ring} shadow-lg ${colors.status.highlight.shadow}`;
  }
  if (statusOverride) {
    return `${baseClass} ring-1 ${statusOverride.ring} shadow-lg ${statusOverride.shadow}`;
  }
  return baseClass;
};

export default { colors, spacing, sizing, getSectionTheme, getSectionContainerClass, getCardClass };
