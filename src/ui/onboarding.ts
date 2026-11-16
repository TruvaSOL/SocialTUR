import { GAME } from '../config/game';
import { NAME_MAX, cleanName, isOldEnough } from '../game/profile';
import { type TextKey, t } from '../i18n';
import { DEFAULT_LOOK, LOOK_FIELDS, type Look, randomLook } from '../world/looks';

export interface NewResident {
  name: string;
  birthYear: number;
  look: Look;
}

export interface OnboardingHooks {
  /** The editor is about to show: point the camera at the character. */
  onEditorOpen(): void;
  /** A choice changed: redraw the character. */
  onLookChange(look: Look): void;
}

type Step = 'welcome' | 'age' | 'editor' | 'account' | null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * The sheet a newcomer sees before the game: welcome, birth year, then the character editor.
 * The same editor is reused later to change the character. All text comes from the language files.
 */
export class Onboarding {
  private step: Step = null;
  private birthYear = 0;
  private name = '';
  private look: Look = { ...DEFAULT_LOOK };
  private tooYoung = false;
  private nameError = false;
  /** Set while editing an existing character: called instead of boarding the ferry. */
  private onSave: ((name: string, look: Look) => void) | null = null;
  private onBoard: ((resident: NewResident) => void) | null = null;
  private sendLink: ((email: string) => Promise<boolean>) | null = null;
  /** Called when the sheet closes, however it was closed. */
  private onClose: (() => void) | null = null;
  private email = '';
  private linkState: 'idle' | 'sending' | 'sent' | 'failed' = 'idle';

  constructor(
    private root: HTMLElement,
    private hooks: OnboardingHooks,
  ) {}

  get open(): boolean {
    return this.step !== null;
  }

  /** First visit: welcome, age, editor, then `onBoard` with the result. */
  startNew(onBoard: (resident: NewResident) => void): void {
    this.onBoard = onBoard;
    this.onSave = null;
    this.look = randomLook(Math.random);
    this.name = '';
    this.go('welcome');
  }

  /** Later visits: change the character and name. */
  edit(name: string, look: Look, onSave: (name: string, look: Look) => void): void {
    this.onSave = onSave;
    this.onBoard = null;
    this.name = name;
    this.look = { ...look };
    this.go('editor');
  }

  /** Asks for an e-mail address and sends a sign-in link to it. `onClose` runs when the sheet goes away. */
  askAccount(sendLink: (email: string) => Promise<boolean>, onClose: () => void): void {
    this.sendLink = sendLink;
    this.linkState = 'idle';
    this.go('account');
    this.onClose = onClose;
  }

  /** Closes whatever is showing. */
  dismiss(): void {
    if (this.step) this.close();
  }

  /** Redraw in the current language. */
  refresh(): void {
    if (this.step) this.render();
  }

  private go(step: Step): void {
    this.step = step;
    this.tooYoung = false;
    this.nameError = false;
    if (step === 'editor') {
      this.hooks.onEditorOpen();
      this.hooks.onLookChange(this.look);
    }
    this.render();
  }

  private close(): void {
    this.step = null;
    this.root.hidden = true;
    this.root.replaceChildren();
    const onClose = this.onClose;
    this.onClose = null;
    onClose?.();
  }

  private render(): void {
    const sheet = this.root;
    sheet.hidden = false;
    sheet.replaceChildren();
    sheet.dataset.step = this.step ?? '';
    if (this.step === 'welcome') this.renderWelcome(sheet);
    else if (this.step === 'age') this.renderAge(sheet);
    else if (this.step === 'editor') this.renderEditor(sheet);
    else if (this.step === 'account') this.renderAccount(sheet);
  }

  private renderAccount(sheet: HTMLElement): void {
    sheet.append(el('h2', '', t('account.title')));
    const later = el('button', '', t(this.linkState === 'sent' ? 'account.close' : 'account.later'));
    later.type = 'button';
    later.addEventListener('click', () => this.close());
    if (this.linkState === 'sent') {
      sheet.append(el('p', '', t('account.sent', { email: this.email })), later);
      return;
    }
    sheet.append(el('p', '', t('account.hint')));
    const input = el('input');
    input.type = 'email';
    input.value = this.email;
    input.placeholder = t('account.emailPlaceholder');
    input.autocomplete = 'email';
    input.setAttribute('aria-label', t('account.emailPlaceholder'));
    sheet.append(input);
    if (this.linkState === 'failed') sheet.append(el('p', 'error', t('account.failed')));
    const actions = el('div', 'sheet-actions');
    const send = el('button', 'primary', t(this.linkState === 'sending' ? 'account.sending' : 'account.send'));
    send.type = 'button';
    send.disabled = this.linkState === 'sending';
    send.addEventListener('click', async () => {
      const email = input.value.trim();
      this.email = email;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !this.sendLink) {
        this.linkState = 'failed';
        this.render();
        return;
      }
      this.linkState = 'sending';
      this.render();
      const ok = await this.sendLink(email);
      if (this.step !== 'account') return; // closed while waiting
      this.linkState = ok ? 'sent' : 'failed';
      this.render();
    });
    actions.append(later, send);
    sheet.append(actions);
  }

  private renderWelcome(sheet: HTMLElement): void {
    sheet.append(el('h1', '', GAME.name), el('p', '', t('welcome.tagline')));
    const start = el('button', 'primary', t('welcome.start'));
    start.type = 'button';
    start.addEventListener('click', () => this.go('age'));
    sheet.append(start);
  }

  private renderAge(sheet: HTMLElement): void {
    sheet.append(el('h2', '', t('age.title')), el('p', '', t('age.hint')));
    const select = el('select');
    select.setAttribute('aria-label', t('age.title'));
    const placeholder = el('option', '', t('age.choose'));
    placeholder.value = '';
    select.append(placeholder);
    const thisYear = new Date().getFullYear();
    for (let year = thisYear - 5; year >= thisYear - 100; year--) {
      const option = el('option', '', String(year));
      option.value = String(year);
      if (year === this.birthYear) option.selected = true;
      select.append(option);
    }
    sheet.append(select);
    if (this.tooYoung) sheet.append(el('p', 'error', t('age.tooYoung', { age: GAME.minAge })));
    const next = el('button', 'primary', t('common.continue'));
    next.type = 'button';
    next.addEventListener('click', () => {
      this.birthYear = Number(select.value);
      if (!this.birthYear) return;
      if (!isOldEnough(this.birthYear)) {
        this.tooYoung = true;
        this.render();
        return;
      }
      this.go('editor');
    });
    sheet.append(next);
  }

  private renderEditor(sheet: HTMLElement): void {
    sheet.append(el('h2', '', t('editor.title')));

    const nameRow = el('label', 'field');
    nameRow.append(el('span', '', t('editor.name')));
    const input = el('input');
    input.type = 'text';
    input.maxLength = NAME_MAX;
    input.value = this.name;
    input.placeholder = t('editor.namePlaceholder');
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      this.name = input.value;
    });
    nameRow.append(input);
    sheet.append(nameRow);
    if (this.nameError) sheet.append(el('p', 'error', t('editor.nameError')));

    const rows = el('div', 'rows');
    for (const field of LOOK_FIELDS) {
      const row = el('div', 'row');
      row.append(el('span', 'row-label', t(`look.${field.key}` as TextKey)));
      const options = el('div', 'options');
      for (let i = 0; i < field.count; i++) {
        const label = field.colors ? '' : t(`look.${field.key}.${i}` as TextKey);
        const button = el('button', field.colors ? 'swatch' : 'choice', label);
        button.type = 'button';
        if (field.colors) {
          button.style.background = hex(field.colors[i]);
          button.setAttribute('aria-label', `${t(`look.${field.key}` as TextKey)} ${i + 1}`);
        }
        button.setAttribute('aria-pressed', String(this.look[field.key] === i));
        button.addEventListener('click', () => {
          this.look[field.key] = i;
          this.hooks.onLookChange(this.look);
          for (const other of options.children) other.setAttribute('aria-pressed', String(other === button));
        });
        options.append(button);
      }
      row.append(options);
      rows.append(row);
    }
    sheet.append(rows);

    const actions = el('div', 'sheet-actions');
    const random = el('button', '', t('editor.random'));
    random.type = 'button';
    random.addEventListener('click', () => {
      this.look = randomLook(Math.random);
      this.hooks.onLookChange(this.look);
      this.render();
    });
    const done = el('button', 'primary', t(this.onSave ? 'editor.save' : 'editor.board'));
    done.type = 'button';
    done.addEventListener('click', () => {
      const name = cleanName(this.name);
      if (!name) {
        this.nameError = true;
        this.render();
        return;
      }
      const look = { ...this.look };
      const { onSave, onBoard, birthYear } = this;
      this.close();
      if (onSave) onSave(name, look);
      else onBoard?.({ name, birthYear, look });
    });
    actions.append(random, done);
    sheet.append(actions);
  }
}
