import type * as MessageParser from '@rocket.chat/message-parser';

const escapeHTML = (str: string): string =>
	str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const renderInline = (tokens: (MessageParser.Inlines | { fallback: MessageParser.Plain; type: undefined })[]): string =>
	tokens
		.map((token) => {
			if (token.type === undefined && 'fallback' in token) {
				return escapeHTML(token.fallback.value);
			}

			switch (token.type) {
				case 'PLAIN_TEXT':
					return escapeHTML(token.value);

				case 'LINK':
					return `<span>[<a href="${escapeHTML(token.value.src.value)}">${renderInline(
						Array.isArray(token.value.label) ? token.value.label : [token.value.label],
					)}</a>](${escapeHTML(token.value.src.value)})</span>`;

				case 'MENTION_USER':
					const classes =
						token.value.value === 'all'
							? 'rcx-box rcx-box--full rcx-message__highlight rcx-message__highlight--relevant'
							: 'rcx-box rcx-box--full rcx-message__highlight rcx-message__highlight--critical rcx-message__highlight--clickable';

					return `<span class="${classes}">@${escapeHTML(token.value.value)}</span>`;

				case 'MENTION_CHANNEL':
					return `<span class="mention-channel">#${escapeHTML(token.value.value)}</span>`;

				case 'BOLD':
					return `*<strong>${renderInline(token.value)}</strong>*`;

				case 'ITALIC':
					return `_<em>${renderInline(token.value)}</em>_`;

				case 'STRIKE':
					return `~<del>${renderInline(token.value)}</del>~`;

				case 'INLINE_CODE':
					return `\`<code class="code-colors inline">${escapeHTML(token.value.value)}</code>\``;

				case 'EMOJI':
					return escapeHTML(token.value.value);

				case 'COLOR':
					return `<span style="color: ${escapeHTML(token.value.color)}">${renderInline(token.value.value)}</span>`;

				case 'IMAGE':
					return `<img src="${escapeHTML(token.value.src.value)}" alt="${escapeHTML(token.value.label)}" />`;

				case 'TIMESTAMP':
					return `<time data-timestamp="${escapeHTML(token.value.timestamp.toString())}">${escapeHTML(
						token.value.timestamp.toString(),
					)}</time>`;

				case 'INLINE_KATEX':
					return `<span class="katex">${escapeHTML(token.value)}</span>`;

				default:
					return '';
			}
		})
		.join('');

export const renderToHtml = (tokens: MessageParser.Root): string => {
	return tokens
		.map((block) => {
			switch (block.type) {
				case 'BIG_EMOJI':
					return `<div class="big-emoji">${escapeHTML(block.value)}</div>`;

				case 'PARAGRAPH':
					return `<p>${renderInline(block.value)}</p>`;

				case 'HEADING':
					return `${'#'.repeat(block.level)} <h${block.level}>${renderInline(block.value)}</h${block.level}>`;

				case 'UNORDERED_LIST':
					return `<ul>${block.value.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`;

				case 'ORDERED_LIST':
					return `<ol>${block.value.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ol>`;

				case 'TASKS':
					return `<ul class="task-list">${block.value
						.map(
							(task) => `<li><input type="checkbox" disabled ${task.status === 'DONE' ? 'checked' : ''}> ${renderInline(task.value)}</li>`,
						)
						.join('')}</ul>`;

				case 'QUOTE':
					return `<blockquote>${renderInline(block.value)}</blockquote>`;

				case 'CODE':
					return `<pre><code class="language-${block.language}">${escapeHTML(block.value.join('\n'))}</code></pre>`;

				case 'KATEX':
					return `<span class="katex">${escapeHTML(block.value)}</span>`;

				case 'LINE_BREAK':
					return `<br />`;

				default:
					return '';
			}
		})
		.join('');
};
