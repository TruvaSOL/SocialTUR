import type { ChatMessage, SendResult } from '../game/server';
import { type TextKey, t } from '../i18n';

/** Ready-made messages, the same list the server accepts. Under-18s can only send these. */
export const PRESETS = ['hello', 'goal', 'letsgo', 'welcome', 'great', 'thanks'] as const;
export const EMOJI = ['ball', 'party', 'clap', 'fire', 'heart', 'laugh', 'wave'] as const;
const MAX_SHOWN = 120;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * The stadium chat: one shared room. Everyone can read; fans can write.
 * Messages are only ever put on screen as plain text.
 */
export class Chat {
  private title: HTMLElement;
  private close: HTMLButtonElement;
  private list: HTMLElement;
  private composer: HTMLElement;
  private status: HTMLElement;
  private messages: ChatMessage[] = [];
  private seen = new Set<number>();
  private unread = 0;
  /** 'none' (spectator), 'presets' (under 18) or 'free' (adult). */
  private canWrite: 'none' | 'presets' | 'free' = 'none';
  private ownNo: number | null = null;

  constructor(
    private panel: HTMLElement,
    private button: HTMLButtonElement,
    private send: (text: string | null, preset: string | null) => Promise<SendResult>,
  ) {
    const header = el('div', 'chat-header');
    this.title = el('strong');
    this.close = el('button', 'chat-close', '×');
    this.close.type = 'button';
    this.close.addEventListener('click', () => this.toggle(false));
    header.append(this.title, this.close);
    this.panel.append(header);
    this.list = el('div', 'chat-list');
    this.composer = el('div', 'chat-composer');
    this.status = el('p', 'chat-status');
    this.panel.append(this.list, this.status, this.composer);
    this.button.addEventListener('click', () => this.toggle());
    this.render();
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  toggle(open = !this.isOpen): void {
    this.panel.hidden = !open;
    document.querySelector('#ui')?.classList.toggle('chat-open', open);
    if (open) {
      this.unread = 0;
      this.list.scrollTop = this.list.scrollHeight;
    }
    this.renderButton();
  }

  /** Who may write, and how. `ownNo` marks the player's own messages. */
  setWriter(mode: 'none' | 'presets' | 'free', ownNo: number | null): void {
    this.canWrite = mode;
    this.ownNo = ownNo;
    this.render();
  }

  add(messages: ChatMessage[]): void {
    let added = 0;
    for (const m of messages) {
      if (this.seen.has(m.id)) continue;
      this.seen.add(m.id);
      this.messages.push(m);
      added++;
    }
    if (!added) return;
    this.messages.sort((a, b) => a.id - b.id);
    if (this.messages.length > MAX_SHOWN) this.messages.splice(0, this.messages.length - MAX_SHOWN);
    if (!this.isOpen) this.unread += added;
    const atBottom = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 40;
    this.renderList();
    if (atBottom || !this.isOpen) this.list.scrollTop = this.list.scrollHeight;
    this.renderButton();
  }

  /** Redraw in the current language. */
  refresh(): void {
    this.render();
  }

  private render(): void {
    this.renderList();
    this.renderComposer();
    this.renderButton();
  }

  private renderButton(): void {
    this.title.textContent = t('chat.button');
    this.close.setAttribute('aria-label', t('chat.close'));
    this.button.textContent = this.unread ? `${t('chat.button')} · ${this.unread}` : t('chat.button');
  }

  private text(m: ChatMessage): string {
    return m.preset ? t(`chat.preset.${m.body}` as TextKey) : m.body;
  }

  private renderList(): void {
    this.list.replaceChildren(
      ...this.messages.map((m) => {
        const row = el('p', m.no === this.ownNo ? 'chat-line own' : 'chat-line');
        row.append(el('strong', '', m.name), el('span', 'chat-no', `#${m.no}`), document.createTextNode(' ' + this.text(m)));
        return row;
      }),
    );
    if (!this.messages.length) this.list.append(el('p', 'chat-empty', t('chat.empty')));
  }

  private renderComposer(): void {
    this.composer.replaceChildren();
    this.status.textContent = '';
    if (this.canWrite === 'none') {
      this.composer.append(el('p', 'chat-hint', t('chat.joinHint')));
      return;
    }
    const chips = el('div', 'chat-chips');
    for (const key of [...EMOJI, ...PRESETS]) {
      const chip = el('button', EMOJI.includes(key as never) ? 'chip-emoji' : 'chip-phrase', t(`chat.preset.${key}` as TextKey));
      chip.type = 'button';
      chip.addEventListener('click', () => void this.submit(null, key));
      chips.append(chip);
    }
    this.composer.append(chips);
    if (this.canWrite === 'presets') {
      this.composer.append(el('p', 'chat-hint', t('chat.presetsOnly')));
      return;
    }
    const row = el('form', 'chat-row');
    const input = el('input');
    input.type = 'text';
    input.maxLength = 200;
    input.placeholder = t('chat.placeholder');
    input.setAttribute('aria-label', t('chat.placeholder'));
    const go = el('button', 'primary', t('chat.send'));
    go.type = 'submit';
    row.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      void this.submit(text, null);
    });
    row.append(input, go);
    this.composer.append(row);
  }

  private async submit(text: string | null, preset: string | null): Promise<void> {
    const result = await this.send(text, preset);
    this.status.textContent = result === 'ok' ? '' : t(`chat.error.${result}` as TextKey);
  }
}
