import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * HelpPage — plain-language how-to for Dianne.
 * Accordion of sections she can expand one at a time.
 */
const SECTIONS = [
  {
    id: 'monthly',
    icon: '🗓️',
    title: 'Each month: add the new statements',
    body: (
      <>
        <p className="mb-2">
          When your monthly statements arrive (Barnett &amp; Hill, Absolute, the bank, and your credit cards),
          go to the <strong>Input Data</strong> tab at the top.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-white/80">
          <li>Look at the grid called &ldquo;{new Date().getFullYear()} statements by month.&rdquo;</li>
          <li>Find the row for the current month (it&rsquo;s highlighted in <span className="text-amber-300">amber</span>).</li>
          <li>Any box that still says &ldquo;<span className="bg-white/10 rounded px-1">⬜ Add</span>&rdquo; is missing a statement for that month.</li>
          <li>Click that box. A big drop-zone will appear.</li>
          <li>
            Drag the PDF from your Downloads folder onto the drop-zone, <em>or</em> click the zone to pick the file.
          </li>
          <li>Review the list of entries, uncheck any you don&rsquo;t want, then click <strong>Import Selected</strong>.</li>
        </ol>
        <p className="mt-2 text-white/60">
          When all four (or five) boxes for a month turn <span className="text-emerald-300">green ✅</span>, the month is done and the row folds up out of the way.
        </p>
      </>
    ),
  },
  {
    id: 'missed',
    icon: '🔍',
    title: 'I can\'t tell which statements are missing',
    body: (
      <>
        <p className="mb-2">The grid does the checking for you. Each cell shows one of:</p>
        <ul className="space-y-1 text-white/80">
          <li><span className="inline-block w-14">✅ green</span> &mdash; this statement is already imported.</li>
          <li><span className="inline-block w-14">⚠️ amber</span> &mdash; something was imported but it looks incomplete &mdash; click to review.</li>
          <li><span className="inline-block w-14">⬜ grey</span> &mdash; nothing has been added yet.</li>
        </ul>
        <p className="mt-2 text-white/60">
          The header of the grid also tells you how many months are complete and how many still need work.
        </p>
      </>
    ),
  },
  {
    id: 'drag-drop',
    icon: '📥',
    title: 'How drag-and-drop works',
    body: (
      <>
        <p className="mb-2">After you pick a statement source, a big dashed box appears. You have two ways to give it the PDF:</p>
        <ul className="list-disc list-inside space-y-1 text-white/80">
          <li><strong>Drag:</strong> open a Finder/Explorer window with the PDF, grab it with your mouse, and drop it on the dashed box. The box will glow as you drag over it.</li>
          <li><strong>Click:</strong> click anywhere in the box to open the usual file-chooser.</li>
        </ul>
        <p className="mt-2 text-white/60">
          Barnett &amp; Hill and Absolute PDFs are read automatically &mdash; you&rsquo;ll see a little spinner and then the list of transactions.
          For the bank and credit-card statements you&rsquo;ll paste the text into the box at the bottom of the screen instead (it&rsquo;s labelled &ldquo;Or paste statement text&rdquo;).
        </p>
      </>
    ),
  },
  {
    id: 'review',
    icon: '✅',
    title: 'Reviewing entries before importing',
    body: (
      <>
        <p className="mb-2">After the PDF is parsed you&rsquo;ll see a table of every line the program found.</p>
        <ul className="list-disc list-inside space-y-1 text-white/80">
          <li>The checkbox on the left is whether to import that line. Uncheck anything you don&rsquo;t want.</li>
          <li>If a line turns <span className="text-orange-300">orange</span> it looks like a duplicate of something you already have. Hover over it to see the existing entry.</li>
          <li>You can change the Category, Property, or description right in the table.</li>
          <li>When you&rsquo;re happy, click the big <strong>Import Selected</strong> button.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'dashboard',
    icon: '📊',
    title: 'Seeing the overall financial picture',
    body: (
      <>
        <p className="mb-2">
          Once you&rsquo;ve imported the month, switch to the <strong>Dashboard</strong> tab to see totals:
          year-to-date income, expenses, net income, and distributions.
        </p>
        <p className="mb-2 text-white/60">
          The &ldquo;Monthly Report&rdquo; below those numbers shows the per-property breakdown for each month &mdash; handy for spot-checking.
        </p>
      </>
    ),
  },
  {
    id: 'tax',
    icon: '🧾',
    title: 'Year-end: Schedule E for federal taxes',
    body: (
      <>
        <p className="mb-2">
          At the end of the year you (or your CPA) need a <em>Schedule E</em> &mdash; the IRS form listing
          rental income and expenses for each property. The app will build it for you.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-white/80">
          <li>Go to <strong>Dashboard</strong>.</li>
          <li>Click the <strong>Schedule E</strong> button near the top.</li>
          <li>Pick the tax year (current year, or the one just ended).</li>
          <li>Review the totals per property.</li>
          <li>Click <strong>Print / Save PDF</strong> to keep a copy, or <strong>Download CSV</strong> for your accountant.</li>
        </ol>
      </>
    ),
  },
  {
    id: 'big-text',
    icon: '🔠',
    title: 'Making text bigger',
    body: (
      <>
        <p className="mb-2">
          Look at the top-right of the screen for the <strong>Aa</strong> button. Click it to make everything in
          the app a little bigger. Click it again to go back to normal. Your choice is remembered on this device.
        </p>
      </>
    ),
  },
  {
    id: 'help-anywhere',
    icon: '❓',
    title: 'Little "?" icons everywhere',
    body: (
      <>
        <p className="mb-2">
          If you see a small <strong>?</strong> icon next to a button or setting, hover over it (or tap it on a phone) for a
          short explanation of what it does. Nothing will happen if you click them &mdash; they&rsquo;re just hints.
        </p>
      </>
    ),
  },
];

export default function HelpPage() {
  const [open, setOpen] = useState('monthly'); // start with the first section expanded

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">❓ Help</h2>
        <p className="text-sm text-white/60">
          Short how-to guides for the things you do most often. Click a title to expand it.
        </p>
      </div>

      <div className="space-y-2">
        {SECTIONS.map(section => {
          const isOpen = open === section.id;
          return (
            <div
              key={section.id}
              className={`border rounded-2xl overflow-hidden transition ${
                isOpen ? 'border-sky-500/30 bg-sky-500/[0.04]' : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : section.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition"
              >
                <span className="text-2xl leading-none" aria-hidden="true">{section.icon}</span>
                <span className="flex-1 text-base font-semibold text-white">{section.title}</span>
                {isOpen
                  ? <ChevronDown className="w-5 h-5 text-white/50" />
                  : <ChevronRight className="w-5 h-5 text-white/50" />
                }
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-sm text-white/80 leading-relaxed">
                  {section.body}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-4 text-sm text-white/70">
        <p className="font-semibold text-amber-300 mb-1">Still stuck?</p>
        <p>
          Call or text Mike &mdash; he can log in and look at your screen together with you. There&rsquo;s nothing in this
          app you can break by clicking around; everything can be undone.
        </p>
      </div>
    </div>
  );
}
