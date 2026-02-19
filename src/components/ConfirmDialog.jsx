import React from 'react';

const ConfirmDialog = ({ title, message, onConfirm, onCancel, confirmText = 'Delete', confirmColor = 'bg-red-500 hover:bg-red-600' }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6" onClick={onCancel}>
    <div className="bg-slate-800 border border-white/15 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition">
          Cancel
        </button>
        <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 ${confirmColor} text-white font-medium rounded-xl transition`}>
          {confirmText}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmDialog;
