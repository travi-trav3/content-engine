/**
 * ledger.js
 *
 * One ledger entry per post, in the shape the gates read. A generated post
 * carries layout props; the gates were written against the session-era
 * fields (headline, subhead, text, thread), so every word a layout draws is
 * mapped onto those fields here. Nothing on the image may escape the gates:
 * any text prop not mapped to headline, subhead or thread lands in text.
 *
 * The ledger also records what was drawn (renderedText, from the renderer),
 * which photos were used and how well they matched the request, and the
 * render's fingerprint, so a published image can be traced to its inputs.
 */

'use strict';

const THREAD_FIELDS = ['question', 'offer', 'reply', 'handoff'];
const NOT_COPY = new Set(['sender', 'timestamp']);

/** headline, subhead, text, eyebrow and thread for the gates, from a layout's props. */
function creativeFields(layout, props) {
  const specs = layout.props;
  const str = (k) => (typeof props[k] === 'string' && props[k].trim() ? props[k].trim() : null);
  const used = new Set();
  const take = (k) => { used.add(k); return str(k); };

  let thread = null;
  if (Array.isArray(props.messages)) {
    used.add('messages');
    thread = props.messages.map((m) => ({ from: m.from === 'club' ? 'assistant' : 'member', text: m.text }));
  } else if (THREAD_FIELDS.every((k) => str(k))) {
    thread = [
      { from: 'member', text: take('question') },
      { from: 'assistant', text: take('offer') },
      { from: 'member', text: take('reply') },
      { from: 'assistant', text: take('handoff') },
    ];
  }

  let headline;
  if (str('value')) {
    // A stat card's number and its label are one claim; the stat gate
    // matches them together.
    headline = [take('value'), take('unit'), take('label')].filter(Boolean).join(' ');
  } else {
    headline = take('headline') || take('question') || take('quote') || take('label');
  }
  const subhead = take('emphasis');
  const eyebrow = take('eyebrow');

  const rest = [];
  if (eyebrow) rest.push(eyebrow);
  for (const [k, spec] of Object.entries(specs)) {
    if (used.has(k) || NOT_COPY.has(k) || props[k] === undefined) continue;
    const type = spec.type || 'text';
    if (type === 'text' && str(k)) rest.push(str(k));
    if (type === 'list' && Array.isArray(props[k]) && !spec.registry) {
      for (const item of props[k]) {
        if (typeof item === 'string') rest.push(item);
        else if (item && typeof item === 'object') {
          for (const [ik, is] of Object.entries(spec.item)) {
            if ((is.type || 'text') === 'text' && typeof item[ik] === 'string') rest.push(item[ik]);
          }
        }
      }
    }
  }
  return { headline, subhead, text: rest.length ? rest.join('\n') : null, eyebrow, thread };
}

function ledgerEntry({ index, entry, layout, post, render, size, batchNo }) {
  const nn = String(batchNo).padStart(2, '0');
  const creative = creativeFields(layout, post.props);
  const out = {
    post: index + 1,
    id: entry.id,
    date: entry.date,
    dueAt: entry.dueAt,
    channel: entry.channel,
    pillar: entry.pillar,
    territory: entry.territory,
    audience: entry.audience,
    feeling: entry.feeling,
    aversion: entry.aversion,
    message: entry.message,
    layout: entry.layout,
    renderSurface: entry.renderSurface,
    surface: entry.surface,
    format: entry.format,
    template: entry.layout,
    headline: creative.headline,
    subhead: creative.subhead,
    text: creative.text,
    eyebrow: creative.eyebrow,
    thread: creative.thread,
    sender: entry.sender || null,
    caption: post.caption,
    firstComment: post.firstComment,
    altText: post.altText,
    earnsItsPlace: post.earnsItsPlace,
    props: post.props,
    photos: post.photos,
    photoMatch: post.photoMatch,
    depictsAssistant: entry.depictsAssistant,
    interactionType: entry.interactionType || null,
    sourceDocument: entry.sourceDocument || null,
    endsAtHandoff: entry.endsAtHandoff || null,
    capabilityClearedBy: null,
    depictsScenario: entry.depictsScenario,
    operationalCheck: entry.operationalCheck || null,
    artDirectionMatch: entry.artDirectionMatch || null,
    ctaType: entry.ctaType,
    ctaVariant: entry.ctaVariant || null,
    // The ask the engine adds after the caption; postText is what Buffer gets.
    cta: entry.ctaLine || null,
    postText: entry.ctaLine ? `${post.caption}\n\n${entry.ctaLine}` : post.caption,
    founderVoice: false,
    clubMarks: [],
    review: entry.review || null,
    approvedBy: entry.approvedBy || null,
    plannedBy: entry.plannedBy,
    file: `${entry.id}.png`,
    size,
    assets: [{ source: `batch-${nn}/${entry.id}.png`, altText: post.altText }],
    status: 'written',
  };
  if (render) {
    out.dimensions = `${render.width}x${render.height}`;
    out.renderedText = render.text;
    out.render = { sha256: render.sha256, fitStep: render.fitStep, issues: render.issues };
    out.status = render.issues.length ? 'render-failed' : 'rendered';
  }
  return out;
}

module.exports = { creativeFields, ledgerEntry };
