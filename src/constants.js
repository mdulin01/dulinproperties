// constants.js - Dulin Properties constants

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Authorized owner emails
export const ownerEmails = [
  'diannedulin@gmail.com',
  'jdulin07@gmail.com',
  'dulinliam@gmail.com',
  'mdulin@gmail.com',
];

// Display name mapping
export const ownerDisplayNames = {
  'diannedulin': 'Dianne',
  'jdulin07': 'Jeff',
  'dulinliam': 'Liam',
  'mdulin': 'Mike',
};

// Expense report categories for uploaded management company reports
export const expenseReportCategories = [
  { value: 'owner-distribution', label: 'Owner Distribution', emoji: '💸' },
  { value: 'management-fee', label: 'Management Fee', emoji: '🏢' },
  { value: 'repair', label: 'Repair', emoji: '🔧' },
  { value: 'maintenance', label: 'Maintenance', emoji: '🔩' },
  { value: 'utilities', label: 'Utilities', emoji: '💡' },
  { value: 'landscaping', label: 'Landscaping', emoji: '🌿' },
  { value: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { value: 'taxes', label: 'Property Taxes', emoji: '📊' },
  { value: 'hoa', label: 'HOA', emoji: '🏘️' },
  { value: 'legal', label: 'Legal Fees', emoji: '⚖️' },
  { value: 'cleaning', label: 'Cleaning', emoji: '🧹' },
  { value: 'pest-control', label: 'Pest Control', emoji: '🐛' },
  { value: 'plumbing', label: 'Plumbing', emoji: '🚿' },
  { value: 'electrical', label: 'Electrical', emoji: '⚡' },
  { value: 'hvac', label: 'HVAC', emoji: '❄️' },
  { value: 'appliance', label: 'Appliance', emoji: '🍳' },
  { value: 'other', label: 'Other', emoji: '📋' },
];

// Property types
export const propertyTypes = [
  { value: 'single-family', label: 'Single Family', emoji: '🏠' },
  { value: 'multi-family', label: 'Multi Family', emoji: '🏘️' },
  { value: 'condo', label: 'Condo', emoji: '🏢' },
  { value: 'apartment', label: 'Apartment', emoji: '🏬' },
  { value: 'townhouse', label: 'Townhouse', emoji: '🏡' },
  { value: 'duplex', label: 'Duplex', emoji: '🏚️' },
  { value: 'mobile-home', label: 'Mobile Home', emoji: '🏕️' },
];

// Tenant status options
export const tenantStatuses = [
  { value: 'active', label: 'Active', color: 'text-green-400' },
  { value: 'pending', label: 'Pending', color: 'text-yellow-400' },
  { value: 'vacant', label: 'Vacant', color: 'text-red-400' },
  { value: 'notice', label: 'Notice Given', color: 'text-orange-400' },
];

// Property status options
export const propertyStatuses = [
  { value: 'occupied', label: 'Occupied', color: 'text-green-400', bg: 'bg-green-500/90' },
  { value: 'owner-occupied', label: 'Owner Occupied', color: 'text-teal-400', bg: 'bg-teal-500/90' },
  { value: 'vacant', label: 'Vacant', color: 'text-red-400', bg: 'bg-red-500/80' },
  { value: 'lease-expired', label: 'Lease Expired', color: 'text-orange-400', bg: 'bg-orange-500/80' },
  { value: 'month-to-month', label: 'Month-to-Month', color: 'text-blue-400', bg: 'bg-blue-500/80' },
  { value: 'renovation', label: 'Renovation', color: 'text-purple-400', bg: 'bg-purple-500/80' },
  { value: 'listed', label: 'Listed', color: 'text-yellow-400', bg: 'bg-yellow-500/80' },
];

// Document types
export const documentTypes = [
  { value: 'lease', label: 'Lease', emoji: '📋' },
  { value: 'receipt', label: 'Receipt', emoji: '🧾' },
  { value: 'invoice', label: 'Invoice', emoji: '📄' },
  { value: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { value: 'tax', label: 'Tax Document', emoji: '📊' },
  { value: 'inspection', label: 'Inspection', emoji: '🔍' },
  { value: 'permit', label: 'Permit', emoji: '📜' },
  { value: 'condo-bylaws', label: 'Condo By Laws', emoji: '📑' },
  { value: 'photo', label: 'Photo/Evidence', emoji: '📸' },
  { value: 'other', label: 'Other', emoji: '📁' },
];

// Expense categories — Property-specific
export const propertyExpenseCategories = [
  { value: 'owner-distribution', label: 'Owner Distribution', emoji: '💸' },
  { value: 'management-fee', label: 'Management Fee', emoji: '🏢' },
  { value: 'repair', label: 'Repair', emoji: '🔧' },
  { value: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { value: 'maintenance', label: 'Maintenance', emoji: '🔩' },
  { value: 'mortgage', label: 'Mortgage', emoji: '🏦' },
  { value: 'utilities', label: 'Utilities', emoji: '💡' },
  { value: 'internet', label: 'Internet', emoji: '📡' },
  { value: 'software', label: 'Software', emoji: '💻' },
  { value: 'taxes', label: 'Property Taxes', emoji: '📊' },
  { value: 'landscaping', label: 'Landscaping', emoji: '🌿' },
  { value: 'hoa', label: 'HOA', emoji: '🏘️' },
  { value: 'legal', label: 'Legal Fees', emoji: '⚖️' },
  { value: 'cleaning', label: 'Cleaning', emoji: '🧹' },
  { value: 'pest-control', label: 'Pest Control', emoji: '🐛' },
  { value: 'plumbing', label: 'Plumbing', emoji: '🚿' },
  { value: 'electrical', label: 'Electrical', emoji: '⚡' },
  { value: 'hvac', label: 'HVAC', emoji: '❄️' },
  { value: 'appliance', label: 'Appliance', emoji: '🍳' },
  { value: 'mileage', label: 'Mileage', emoji: '🚗' },
  { value: 'other', label: 'Other', emoji: '📋' },
];

// Expense categories — Operating / Business-wide (not tied to a specific property)
export const operatingExpenseCategories = [
  { value: 'op-software', label: 'Software', emoji: '💻' },
  { value: 'op-internet', label: 'Internet', emoji: '📡' },
  { value: 'op-home-office', label: 'Home Office', emoji: '🏠' },
  { value: 'op-accounting', label: 'Accounting', emoji: '🧮' },
  { value: 'op-subscriptions', label: 'Subscriptions', emoji: '🔄' },
  { value: 'op-office-supplies', label: 'Office Supplies', emoji: '🗂️' },
  { value: 'op-education', label: 'Education / Training', emoji: '📚' },
  { value: 'op-travel', label: 'Travel', emoji: '✈️' },
  { value: 'op-phone', label: 'Phone', emoji: '📱' },
  { value: 'op-marketing', label: 'Marketing', emoji: '📢' },
  { value: 'op-bank-fees', label: 'Bank Fees', emoji: '🏦' },
  { value: 'op-other', label: 'Other Operating', emoji: '📋' },
];

// Set of operating category values for quick lookup
export const OPERATING_CATEGORY_VALUES = new Set(
  operatingExpenseCategories.map(c => c.value)
);

// Combined list (for backwards compatibility with filters, etc.)
export const expenseCategories = [...propertyExpenseCategories, ...operatingExpenseCategories];

// Recurring expense frequencies
export const recurringFrequencies = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

// Capital item condition ratings
export const capitalConditions = [
  { value: 'good', label: 'Good', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
  { value: 'fair', label: 'Fair', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
  { value: 'poor', label: 'Poor', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
  { value: 'critical', label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
];

// IRS standard mileage rate (2025/2026)
export const MILEAGE_RATE = 0.70;

// Income categories
export const incomeCategories = [
  { value: 'rent', label: 'Rent', emoji: '💰' },
  { value: 'prepaid-rent', label: 'Prepaid Rent', emoji: '📅' },
  { value: 'late-fee', label: 'Late Fee', emoji: '⏰' },
  { value: 'deposit', label: 'Security Deposit', emoji: '🔒' },
  { value: 'refund', label: 'Refund', emoji: '↩️' },
  { value: 'parking', label: 'Parking', emoji: '🅿️' },
  { value: 'laundry', label: 'Laundry', emoji: '🧺' },
  { value: 'interest', label: 'Interest', emoji: '🏦' },
  { value: 'other', label: 'Other Income', emoji: '💵' },
];

// Task priorities (same as travel-planner)
export const taskPriorities = [
  { value: 'high', label: 'High', emoji: '🔴' },
  { value: 'medium', label: 'Medium', emoji: '🟡' },
  { value: 'low', label: 'Low', emoji: '⚪' },
];

// Time horizons for task filtering
export const timeHorizons = [
  { value: 'today', label: 'Today' },
  { value: 'this-week', label: 'This Week' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'all', label: 'All' },
];

// List categories
export const listCategories = [
  { value: 'maintenance', label: 'Maintenance', emoji: '🔧' },
  { value: 'shopping', label: 'Shopping', emoji: '🛒' },
  { value: 'renovation', label: 'Renovation', emoji: '🏗️' },
  { value: 'move-in', label: 'Move-in Checklist', emoji: '📋' },
  { value: 'move-out', label: 'Move-out Checklist', emoji: '📦' },
  { value: 'inspection', label: 'Inspection', emoji: '🔍' },
  { value: 'general', label: 'General', emoji: '📝' },
];

// Idea categories
export const ideaCategories = [
  { value: 'improvement', label: 'Property Improvement', emoji: '🏗️' },
  { value: 'investment', label: 'Investment', emoji: '💰' },
  { value: 'marketing', label: 'Marketing', emoji: '📢' },
  { value: 'process', label: 'Process', emoji: '⚙️' },
  { value: 'general', label: 'General', emoji: '💡' },
];

// Idea statuses
export const ideaStatuses = [
  { value: 'inbox', label: 'Inbox', emoji: '📥' },
  { value: 'exploring', label: 'Exploring', emoji: '🔍' },
  { value: 'planned', label: 'Planned', emoji: '📋' },
  { value: 'done', label: 'Done', emoji: '✅' },
  { value: 'parked', label: 'Parked', emoji: '🅿️' },
];

// Rent payment statuses
export const rentStatuses = [
  { value: 'paid', label: 'Paid', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  { value: 'partial', label: 'Partial', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { value: 'unpaid', label: 'Unpaid', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { value: 'late', label: 'Late', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
];

// Property colors for cards
export const propertyColors = [
  'from-teal-400 to-cyan-500',
  'from-blue-400 to-indigo-500',
  'from-emerald-400 to-teal-500',
  'from-purple-400 to-violet-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-cyan-400 to-blue-500',
  'from-green-400 to-emerald-500',
];
