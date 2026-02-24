// utils.js - Shared utilities for Dulin Properties

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  if (!date || isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

export const formatCurrencyDetailed = (amount) => {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export const validateFileSize = (file) => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_FILE_SIZE_MB}MB.`;
  }
  return null;
};

export const getSafeFileName = (name) => {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
};

export const isHeicFile = (file) => {
  return file.type === 'image/heic' || file.type === 'image/heif' ||
    file.name?.toLowerCase().endsWith('.heic') || file.name?.toLowerCase().endsWith('.heif');
};

export const getDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  const target = parseLocalDate(dateStr);
  if (!target) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = target - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const isTaskDueToday = (task) => {
  if (!task.dueDate) return false;
  const today = new Date().toISOString().split('T')[0];
  return task.dueDate === today;
};

export const isTaskDueThisWeek = (task) => {
  if (!task.dueDate) return false;
  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  const dueDate = parseLocalDate(task.dueDate);
  return dueDate >= today && dueDate <= endOfWeek;
};

export const taskMatchesHorizon = (task, horizon) => {
  if (horizon === 'all') return true;
  if (horizon === 'today') return isTaskDueToday(task);
  if (horizon === 'this-week') return isTaskDueThisWeek(task);
  if (horizon === 'overdue') {
    if (!task.dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return task.dueDate < today && task.status !== 'done';
  }
  return true;
};

export const suggestIdeaCategoryFromUrl = (url) => {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('zillow') || lower.includes('realtor') || lower.includes('redfin')) return 'investment';
  if (lower.includes('homedepot') || lower.includes('lowes') || lower.includes('menards')) return 'improvement';
  if (lower.includes('facebook') || lower.includes('craigslist') || lower.includes('marketplace')) return 'marketing';
  return null;
};

export const fetchUrlMetadata = async (url) => {
  // Simple metadata fetch — returns basic info
  try {
    return { title: getDomainFromUrl(url), description: '', image: null };
  } catch {
    return null;
  }
};

export const getDomainFromUrl = (url) => {
  if (!url) return '';
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return url;
  }
};

export const getLeaseStatus = (leaseEnd) => {
  if (!leaseEnd) return null;
  const days = getDaysUntil(leaseEnd);
  if (days === null) return null;
  if (days < 0) return { label: 'Expired', color: 'text-red-400', urgency: 'high' };
  if (days <= 30) return { label: `${days}d left`, color: 'text-orange-400', urgency: 'medium' };
  if (days <= 90) return { label: `${days}d left`, color: 'text-yellow-400', urgency: 'low' };
  return { label: `${days}d left`, color: 'text-green-400', urgency: 'none' };
};
